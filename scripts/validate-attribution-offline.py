#!/usr/bin/env python3
"""Testes sinteticos, sem rede, do pipeline offline de atribuicao."""

from __future__ import annotations

import csv
import datetime as dt
import importlib.util
import json
import os
import stat
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
from pathlib import Path
from unittest import mock
from urllib.parse import urlparse


SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
os.environ.setdefault("ATTRIBUTION_DATA_DIR", tempfile.mkdtemp(prefix="netcar-unit-data-"))
os.environ.setdefault("NETCAR_ATTRIBUTION_ENV_FILE", "/tmp/netcar-env-inexistente")
os.environ.setdefault("EVO_BASE_URL", "https://evolution.example.test")
os.environ.setdefault("EVO_API_KEY", "synthetic-only")
os.environ.setdefault("EVO_INSTANCE", "synthetic")
os.environ.setdefault("WA_LOG_BASE_URL", "https://wa.example.test")
os.environ.setdefault("WA_LOG_TOKEN", "synthetic-only")

import atribuicao_enrich as enrich  # noqa: E402
import auditoria_ian as ian  # noqa: E402
import evolution_attribution as evolution  # noqa: E402
import offline_config as config  # noqa: E402
import wa_clicks_sync as clicks_sync  # noqa: E402

WA_LOG_SERVER_PATH = SCRIPT_DIR / "vps" / "wa-log-server.py"
WA_LOG_SPEC = importlib.util.spec_from_file_location("wa_log_server", WA_LOG_SERVER_PATH)
assert WA_LOG_SPEC and WA_LOG_SPEC.loader
wa_log_server = importlib.util.module_from_spec(WA_LOG_SPEC)
WA_LOG_SPEC.loader.exec_module(wa_log_server)


class FakeResponse:
    def __init__(self, payload: object):
        self.payload = json.dumps(payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self) -> bytes:
        return self.payload


class OfflineAttributionTests(unittest.TestCase):
    def test_wa_log_server_accepts_strong_identity_and_context(self):
        click_id = "nc_0123456789abcdef0123456789abcdef"
        record = wa_log_server.build_record(
            {
                "code": "G2345678",
                "wa_ref": "G2345678",
                "click_id": click_id,
                "traffic_source": "Google Ads",
                "traffic_campaign": "estoque-rs",
                "wa_source": "vehicle_sidebar",
                "wa_intent": "vehicle_inquiry",
                "wa_vehicle_id": "19884",
                "wa_vehicle_name": "Fiat Fastback",
                "page_path": "/veiculo/fastback",
                "privacy_consent": "accepted",
                "free_form_message": "não deve ser persistida",
                "ts": 1_788_170_400,
            },
            now=1_788_170_400,
        )
        self.assertEqual(record["wa_ref"], "G2345678")
        self.assertEqual(record["click_id"], click_id)
        self.assertEqual(record["campaign"], "estoque-rs")
        self.assertEqual(record["wa_vehicle_id"], "19884")
        self.assertNotIn("free_form_message", record)

    def test_wa_log_server_keeps_all_supported_legacy_refs(self):
        for wa_ref in ("G1", "M12345", "O2A4Z"):
            with self.subTest(wa_ref=wa_ref):
                record = wa_log_server.build_record(
                    {"code": wa_ref, "ts": 1_788_170_400},
                    now=1_788_170_400,
                )
                self.assertEqual(record["wa_ref"], wa_ref)

    def test_wa_log_server_rejects_malformed_identity(self):
        with self.assertRaises(ValueError):
            wa_log_server.build_record(
                {"wa_ref": "X2345678", "ts": 1_788_170_400},
                now=1_788_170_400,
            )
        with self.assertRaises(ValueError):
            wa_log_server.build_record(
                {
                    "code": "G2345678",
                    "wa_ref": "M2345678",
                    "ts": 1_788_170_400,
                },
                now=1_788_170_400,
            )
        with self.assertRaises(ValueError):
            wa_log_server.build_record(
                {
                    "wa_ref": "G2345678",
                    "click_id": "nc_invalido",
                    "ts": 1_788_170_400,
                },
                now=1_788_170_400,
            )

    def test_wa_log_server_disables_query_token_by_default(self):
        class FakeHandler:
            headers: dict[str, str] = {}

        previous = wa_log_server.ALLOW_QUERY_TOKEN
        try:
            wa_log_server.ALLOW_QUERY_TOKEN = False
            self.assertEqual(
                wa_log_server.supplied_token(FakeHandler(), {"token": ["legacy"]}),
                "",
            )
            wa_log_server.ALLOW_QUERY_TOKEN = True
            self.assertEqual(
                wa_log_server.supplied_token(FakeHandler(), {"token": ["legacy"]}),
                "legacy",
            )
        finally:
            wa_log_server.ALLOW_QUERY_TOKEN = previous

    def test_phone_types_do_not_collide(self):
        fixed = enrich.normalize_phone("(51) 3333-4444")
        modern_mobile = enrich.normalize_phone("(51) 99888-7777")
        old_mobile = enrich.normalize_phone("(51) 6888-7777")
        self.assertEqual(fixed, "555133334444")
        self.assertEqual(modern_mobile, "5551998887777")
        self.assertEqual(old_mobile, "5551968887777")
        self.assertNotEqual(fixed, old_mobile)

    def test_naive_source_time_uses_sao_paulo(self):
        parsed = enrich.parse_datetime("2026-08-31T10:00:00")
        self.assertEqual(parsed.isoformat(), "2026-08-31T13:00:00+00:00")

    def test_weak_click_id_requires_window(self):
        result = enrich.match_click(
            {
                "click_id": "legacy-weak",
                "primeiro_contato": "2026-08-31T10:00:00Z",
            },
            [{"click_id": "legacy-weak", "ts": "2026-08-20T10:00:00Z"}],
        )
        self.assertIsNone(result.row)

    def test_sale_before_lead_never_matches(self):
        result = enrich.match_sale(
            {
                "telefone": "51999999999",
                "primeiro_contato": "2026-08-31T10:00:00Z",
            },
            {"deal_id": "deal-1"},
            [
                {
                    "deal_id": "deal-1",
                    "telefone": "51999999999",
                    "sold_at": "2026-08-30T10:00:00Z",
                }
            ],
        )
        self.assertIsNone(result.row)

    def test_missing_stages_penalize_end_to_end_confidence(self):
        high = enrich.MatchResult(row={"id": "1"}, method="exact", confidence="high")
        self.assertEqual(
            enrich.weakest_confidence((high, enrich.MatchResult(), enrich.MatchResult())),
            "low",
        )

    def test_sessions_split_on_ref_ctwa_and_inactivity(self):
        base = 1_788_170_400
        context_one = {
            "externalAdReply": {"sourceId": "ad-1", "title": "Anuncio 1"},
            "conversionSource": "FB_Ads",
        }
        context_two = {
            "externalAdReply": {"sourceId": "ad-2", "title": "Anuncio 2"},
            "conversionSource": "FB_Ads",
        }
        messages = [
            {
                "messageTimestamp": base,
                "key": {"fromMe": False},
                "message": {"conversation": "Fastback - (G2345678)."},
            },
            {
                "messageTimestamp": base + 60,
                "key": {"fromMe": False},
                "message": {
                    "conversation": "Novo clique",
                    "extendedTextMessage": {"contextInfo": context_one},
                },
            },
            {
                "messageTimestamp": base + 120,
                "key": {"fromMe": False},
                "message": {
                    "conversation": "Outro anuncio",
                    "extendedTextMessage": {"contextInfo": context_two},
                },
            },
            {
                "messageTimestamp": base + 180,
                "key": {"fromMe": False},
                "message": {"conversation": "Outro ref - (UABCDEFG)."},
            },
            {
                "messageTimestamp": base
                + evolution.SESSION_GAP_HOURS * 3600
                + 500,
                "key": {"fromMe": False},
                "message": {"conversation": "Retorno sem marcador"},
            },
        ]
        with mock.patch.object(
            evolution,
            "api",
            return_value={"messages": {"records": messages}},
        ):
            sessions = evolution.analyze_chat("5551999999999@s.whatsapp.net")[
                "sessions"
            ]
        self.assertEqual(
            [session["started_reason"] for session in sessions],
            ["first_inbound", "new_ctwa", "new_ctwa", "new_wa_ref", "inactivity_gap"],
        )
        self.assertEqual(sessions[0]["code"]["codigo"], "G2345678")
        self.assertEqual(sessions[3]["code"]["codigo"], "UABCDEFG")

    def test_failed_full_merge_preserves_previous_session(self):
        old = {
            "sessions": [
                {
                    "first": {"ts_epoch": 1_788_170_400},
                    "code": {"codigo": "G2345678"},
                    "last_ts": 1_788_170_400,
                }
            ]
        }
        merged = evolution.merge_result(
            "5551999999999@s.whatsapp.net", old, {"vazio": True}
        )
        self.assertEqual(len(merged["sessions"]), 1)

    def test_evolution_total_failure_preserves_checkpoint_and_returns_error(self):
        with tempfile.TemporaryDirectory(prefix="netcar-evolution-total-") as directory:
            root = Path(directory)
            checkpoint = root / "checkpoint.json"
            output = root / "leads.csv"
            audit = root / "audit.json"
            now = int(dt.datetime.now(dt.timezone.utc).timestamp())
            previous = {
                "previous@s.whatsapp.net": {
                    "lmts": now,
                    "r": {
                        "sessions": [
                            {
                                "first": {"ts_epoch": now},
                                "last_ts": now,
                            }
                        ]
                    },
                }
            }
            checkpoint.write_text(json.dumps(previous), encoding="utf-8")
            output.write_text("saida-anterior\n", encoding="utf-8")
            checkpoint_before = checkpoint.read_bytes()
            output_before = output.read_bytes()
            chats = [
                {
                    "remoteJid": "failed-1@s.whatsapp.net",
                    "lastMessage": {"messageTimestamp": now},
                },
                {
                    "remoteJid": "failed-2@s.whatsapp.net",
                    "lastMessage": {"messageTimestamp": now},
                },
            ]

            with (
                mock.patch.multiple(
                    evolution,
                    CHECKPOINT=checkpoint,
                    OUT_CSV=output,
                    COLLECTION_AUDIT=audit,
                    FULL=False,
                    BACKFILL_ADS=False,
                    SINCE=None,
                    MAX_FAILURE_RATE_PERCENT=10,
                ),
                mock.patch.object(evolution, "api", return_value=chats),
                mock.patch.object(evolution, "analyze_chat", return_value=None),
            ):
                status = evolution.main()

            self.assertEqual(status, 1)
            self.assertEqual(checkpoint.read_bytes(), checkpoint_before)
            self.assertEqual(output.read_bytes(), output_before)
            summary = json.loads(audit.read_text(encoding="utf-8"))
            self.assertEqual(summary["status"], "total_failure")
            self.assertEqual(summary["queued"], 2)
            self.assertEqual(summary["succeeded"], 0)
            self.assertEqual(summary["failed"], 2)
            self.assertFalse(summary["checkpoint_updated"])

    def test_evolution_partial_failure_preserves_successes_and_enforces_threshold(self):
        with tempfile.TemporaryDirectory(prefix="netcar-evolution-partial-") as directory:
            root = Path(directory)
            checkpoint = root / "checkpoint.json"
            output = root / "leads.csv"
            audit = root / "audit.json"
            now = int(dt.datetime.now(dt.timezone.utc).timestamp())
            checkpoint.write_text("{}\n", encoding="utf-8")
            chats = [
                {
                    "remoteJid": f"lead-{index}@s.whatsapp.net",
                    "lastMessage": {"messageTimestamp": now + index},
                }
                for index in range(5)
            ]

            def analyze(jid):
                if jid == "lead-4@s.whatsapp.net":
                    return None
                return {
                    "sessions": [
                        {
                            "first": {
                                "ts": evolution.ts_to_iso(now),
                                "ts_epoch": now,
                                "txt": "Quero saber mais sobre este carro.",
                                "phone": "",
                                "push": "",
                            },
                            "code": None,
                            "ctwa": None,
                            "started_reason": "first_inbound",
                            "last_ts": now,
                        }
                    ]
                }

            with (
                mock.patch.multiple(
                    evolution,
                    CHECKPOINT=checkpoint,
                    OUT_CSV=output,
                    COLLECTION_AUDIT=audit,
                    FULL=False,
                    BACKFILL_ADS=False,
                    SINCE=None,
                    MAX_FAILURE_RATE_PERCENT=10,
                ),
                mock.patch.object(evolution, "api", return_value=chats),
                mock.patch.object(evolution, "analyze_chat", side_effect=analyze),
                mock.patch.object(evolution, "resolve_ads", return_value={}),
            ):
                status = evolution.main()

            self.assertEqual(status, 1)
            saved_checkpoint = json.loads(checkpoint.read_text(encoding="utf-8"))
            self.assertEqual(len(saved_checkpoint), 4)
            self.assertNotIn("lead-4@s.whatsapp.net", saved_checkpoint)
            self.assertTrue(output.exists())
            summary = json.loads(audit.read_text(encoding="utf-8"))
            self.assertEqual(
                summary["status"], "partial_failure_threshold_exceeded"
            )
            self.assertEqual(summary["queued"], 5)
            self.assertEqual(summary["succeeded"], 4)
            self.assertEqual(summary["failed"], 1)
            self.assertEqual(summary["failure_rate_percent"], 20.0)
            self.assertTrue(summary["checkpoint_updated"])

    def test_evolution_partial_failure_at_threshold_returns_success(self):
        with tempfile.TemporaryDirectory(prefix="netcar-evolution-limit-") as directory:
            root = Path(directory)
            checkpoint = root / "checkpoint.json"
            output = root / "leads.csv"
            audit = root / "audit.json"
            now = int(dt.datetime.now(dt.timezone.utc).timestamp())
            chats = [
                {
                    "remoteJid": f"lead-{index}@s.whatsapp.net",
                    "lastMessage": {"messageTimestamp": now + index},
                }
                for index in range(4)
            ]

            def analyze(jid):
                if jid == "lead-3@s.whatsapp.net":
                    return None
                return {
                    "sessions": [
                        {
                            "first": {"ts_epoch": now},
                            "last_ts": now,
                        }
                    ]
                }

            with (
                mock.patch.multiple(
                    evolution,
                    CHECKPOINT=checkpoint,
                    OUT_CSV=output,
                    COLLECTION_AUDIT=audit,
                    FULL=False,
                    BACKFILL_ADS=False,
                    SINCE=None,
                    MAX_FAILURE_RATE_PERCENT=25,
                ),
                mock.patch.object(evolution, "api", return_value=chats),
                mock.patch.object(evolution, "analyze_chat", side_effect=analyze),
                mock.patch.object(evolution, "resolve_ads", return_value={}),
            ):
                status = evolution.main()

            self.assertEqual(status, 0)
            summary = json.loads(audit.read_text(encoding="utf-8"))
            self.assertEqual(summary["status"], "partial_failure_within_threshold")
            self.assertEqual(summary["failure_rate_percent"], 25.0)

    def test_vehicle_parser_accepts_long_new_ref(self):
        context = evolution.infer_message_context(
            "Quero mais informações sobre Fiat Fastback - (U2345678)."
        )
        self.assertEqual(context["vehicle_name"], "Fiat Fastback")

    def test_click_sync_uses_headers_and_json_array(self):
        captured = []

        def fake_open(request, timeout=60):
            captured.append(request)
            return FakeResponse(
                [
                    {
                        "ts": time.time(),
                        "click_id": "NC_" + "A" * 32,
                        "wa_ref": "U2345678",
                        "token": "must-not-persist",
                    }
                ]
            )

        with mock.patch.object(clicks_sync.urllib.request, "urlopen", fake_open):
            rows = clicks_sync.download("")
        request = captured[0]
        headers = {key.lower(): value for key, value in request.header_items()}
        self.assertNotIn("token=", request.full_url)
        self.assertEqual(headers["authorization"], "Bearer synthetic-only")
        self.assertEqual(rows[0]["click_id"], "nc_" + "a" * 32)
        self.assertNotIn("token", rows[0])

    def test_click_sync_prunes_invalid_timestamp(self):
        with tempfile.TemporaryDirectory(prefix="netcar-click-sync-") as directory:
            old_out, old_state = clicks_sync.OUT, clicks_sync.STATE
            clicks_sync.OUT = Path(directory) / "clicks.jsonl"
            clicks_sync.STATE = Path(directory) / "state.json"
            values = [
                {"ts": time.time(), "click_id": "nc_" + "b" * 32},
                {"ts": "invalid", "click_id": "nc_" + "c" * 32},
            ]
            try:
                with mock.patch.object(clicks_sync, "download", return_value=values):
                    clicks_sync.main()
                lines = clicks_sync.OUT.read_text(encoding="utf-8").splitlines()
                self.assertEqual(len(lines), 1)
                self.assertEqual(stat.S_IMODE(clicks_sync.OUT.stat().st_mode), 0o600)
            finally:
                clicks_sync.OUT, clicks_sync.STATE = old_out, old_state

    def test_ian_filters_old_messages_and_preserves_valid_output(self):
        old = ian.CUTOFF_EPOCH - 100
        recent = ian.CUTOFF_EPOCH + 100
        payload = {
            "messages": {
                "records": [
                    {
                        "messageTimestamp": old,
                        "key": {"fromMe": False},
                        "message": {"conversation": "antiga"},
                    },
                    {
                        "messageTimestamp": recent,
                        "key": {"fromMe": False},
                        "message": {"conversation": "recente"},
                    },
                ]
            }
        }
        with mock.patch.object(ian, "api", return_value=payload):
            result = ian.analyze_chat("5551999999999@s.whatsapp.net")
        self.assertEqual(result["n_cliente"], 1)
        self.assertEqual(result["thread"][0]["txt"], "recente")

        with tempfile.TemporaryDirectory(prefix="netcar-ian-") as directory:
            previous_outdir = ian.OUTDIR
            ian.OUTDIR = Path(directory)
            existing = ian.OUTDIR / "conversas_ian.jsonl"
            existing.write_text("saida-valida-anterior\n", encoding="utf-8")
            try:
                with mock.patch.object(ian, "api", return_value=[]):
                    with self.assertRaises(RuntimeError):
                        ian.main()
                self.assertEqual(
                    existing.read_text(encoding="utf-8"), "saida-valida-anterior\n"
                )
            finally:
                ian.OUTDIR = previous_outdir

    def test_tls_and_http_guards(self):
        self.assertEqual(
            enrich._tls_mode(
                urlparse("mysql://u:p@host/db?sslmode=verify-full"), "CRM_SSLMODE_TEST"
            ),
            "verify-full",
        )
        with self.assertRaises(config.ConfigError):
            enrich._tls_mode(urlparse("mysql://u:p@host/db"), "CRM_SSLMODE_TEST")

        os.environ["REMOTE_HTTP_TEST"] = "http://vps.example.test:8080"
        os.environ.pop("REMOTE_HTTP_ALLOW", None)
        with self.assertRaises(config.ConfigError):
            config.service_url(
                "REMOTE_HTTP_TEST", allow_insecure_flag="REMOTE_HTTP_ALLOW"
            )
        os.environ["LOOPBACK_HTTP_TEST"] = "http://127.0.0.1:18080"
        os.environ["EVO_SSH_TARGET"] = "user@host"
        self.assertEqual(
            config.service_url(
                "LOOPBACK_HTTP_TEST",
                allow_insecure_flag="REMOTE_HTTP_ALLOW",
                allow_loopback_when_env="EVO_SSH_TARGET",
            ),
            "http://127.0.0.1:18080",
        )

    def test_env_file_is_not_executed(self):
        with tempfile.TemporaryDirectory(prefix="netcar-env-") as directory:
            marker = Path(directory) / "executed"
            env_file = Path(directory) / ".env"
            key = "NETCAR_SYNTHETIC_LITERAL"
            os.environ.pop(key, None)
            env_file.write_text(f"{key}=$(touch {marker})\n", encoding="utf-8")
            config.load_env_file(env_file)
            self.assertFalse(marker.exists())
            self.assertEqual(os.environ[key], f"$(touch {marker})")

    def test_output_audit_and_confirmed_export_contract(self):
        click_id = "nc_" + "d" * 32
        leads = [
            {
                "telefone": "51999999999",
                "jid": "x@s.whatsapp.net",
                "primeiro_contato": "2026-08-31T10:00:00Z",
                "wa_ref": "G2345678",
                "click_id": click_id,
                "wa_source": "Google Ads",
            }
        ]
        clicks = [
            {
                "ts": "2026-08-31T09:59:00Z",
                "click_id": click_id,
                "wa_ref": "G2345678",
                "utm_source": "google",
                "source": "vehicle_sidebar",
                "gclid": "gclid-synthetic",
            }
        ]
        output = enrich.enrich_rows(
            leads,
            clicks,
            [
                {
                    "deal_id": "deal-1",
                    "telefone": "51999999999",
                    "created_at": "2026-08-31T10:01:00Z",
                    "click_id": click_id,
                }
            ],
            [
                {
                    "sale_id": "sale-1",
                    "deal_id": "deal-1",
                    "telefone": "51999999999",
                    "sold_at": "2026-09-01T10:00:00Z",
                }
            ],
        )
        row = output[0]
        self.assertEqual(row["traffic_source"], "google")
        self.assertEqual(row["wa_source"], "vehicle_sidebar")
        self.assertEqual(row["crm_matched"], "1")
        self.assertEqual(row["no_crm"], "0")
        audit = enrich.build_audit(leads, clicks, [], [], output)
        self.assertEqual(audit["schema_version"], 3)
        self.assertEqual(
            audit["identity_coverage"]["evolution_leads_with_new_wa_ref"], 1
        )
        self.assertEqual(
            audit["identity_coverage"]["site_clicks_with_strong_click_id"], 1
        )
        self.assertEqual(
            audit["freshness"]["latest_evolution_lead_at"],
            "2026-08-31T10:00:00Z",
        )
        self.assertTrue(audit["privacy"]["contains_pii"])
        self.assertFalse(audit["privacy"]["summary_contains_raw_pii"])
        conversions = enrich.confirmed_conversions(output)
        self.assertEqual(conversions[0]["export_status"], "ready_with_ad_id")
        self.assertEqual(conversions[0]["sale_match_method"], "business_id_exact")

        review_only = enrich.confirmed_conversions(
            [
                {
                    "virou_venda": "1",
                    "gclid": "gclid-synthetic",
                    "sale_match_method": "phone_time_fallback",
                    "sale_match_confidence": "medium",
                }
            ]
        )
        self.assertEqual(review_only[0]["export_status"], "review_match_evidence")

    def test_independent_sales_skip_is_explicit_and_invents_no_sale(self):
        with tempfile.TemporaryDirectory(prefix="netcar-partial-") as directory:
            root = Path(directory)
            evolution_csv = root / "evolution.csv"
            click_log = root / "clicks.jsonl"
            crm_csv = root / "crm.csv"
            output_csv = root / "output.csv"
            audit_json = root / "audit.json"
            conversions_csv = root / "conversions.csv"
            click_id = "nc_" + "e" * 32
            evolution_csv.write_text(
                "telefone,jid,primeiro_contato,wa_ref,click_id\n"
                f"51999999999,x@s.whatsapp.net,2026-08-31T10:00:00Z,G2345678,{click_id}\n",
                encoding="utf-8",
            )
            click_log.write_text(
                json.dumps(
                    {
                        "ts": "2026-08-31T09:59:00Z",
                        "click_id": click_id,
                        "wa_ref": "G2345678",
                    }
                )
                + "\n",
                encoding="utf-8",
            )
            crm_csv.write_text(
                "deal_id,telefone,created_at,click_id\n"
                f"deal-1,51999999999,2026-08-31T10:01:00Z,{click_id}\n",
                encoding="utf-8",
            )
            status = enrich.main(
                [
                    "--evolution-csv",
                    str(evolution_csv),
                    "--click-log",
                    str(click_log),
                    "--crm-csv",
                    str(crm_csv),
                    "--skip-sales",
                    "--output",
                    str(output_csv),
                    "--audit-output",
                    str(audit_json),
                    "--confirmed-conversions-output",
                    str(conversions_csv),
                ]
            )
            self.assertEqual(status, 0)
            with output_csv.open(encoding="utf-8") as handle:
                row = next(csv.DictReader(handle))
            self.assertEqual(row["crm_matched"], "1")
            self.assertEqual(row["virou_venda"], "0")
            audit = json.loads(audit_json.read_text(encoding="utf-8"))
            self.assertEqual(audit["source_coverage"]["crm"], "snapshot")
            self.assertEqual(
                audit["source_coverage"]["sales"], "skipped_unavailable"
            )
            self.assertTrue(audit["coverage_is_partial"])
            self.assertEqual(audit["matched_totals"]["sale"], 0)
            with conversions_csv.open(encoding="utf-8") as handle:
                self.assertEqual(list(csv.DictReader(handle)), [])

    def test_retention_is_applied_before_evolution_todo(self):
        source = (SCRIPT_DIR / "evolution_attribution.py").read_text(encoding="utf-8")
        self.assertLess(source.index("retention_cutoff ="), source.index("todo = []"))

    def test_runner_never_removes_a_live_process_lock(self):
        with tempfile.TemporaryDirectory(prefix="netcar-runner-lock-") as directory:
            root = Path(directory)
            data_dir = root / "data"
            log_dir = root / "logs"
            lock_dir = data_dir / ".daily.lock"
            lock_dir.mkdir(parents=True)
            env_file = root / "attribution.env"
            env_file.write_text(
                "\n".join(
                    (
                        "EVO_BASE_URL=https://evolution.example.test",
                        "EVO_API_KEY=synthetic-only",
                        "EVO_INSTANCE=synthetic",
                        "WA_LOG_BASE_URL=https://wa.example.test",
                        "WA_LOG_TOKEN=synthetic-only",
                        "ATTRIBUTION_SKIP_DATABASES=1",
                    )
                )
                + "\n",
                encoding="utf-8",
            )
            sleeper = subprocess.Popen(["sleep", "30"])
            try:
                (lock_dir / "pid").write_text(f"{sleeper.pid}\n", encoding="utf-8")
                child_env = os.environ.copy()
                child_env.update(
                    {
                        "ATTRIBUTION_DATA_DIR": str(data_dir),
                        "ATTRIBUTION_LOG_DIR": str(log_dir),
                        "ATTRIBUTION_PYTHON": sys.executable,
                    }
                )
                result = subprocess.run(
                    [
                        str(SCRIPT_DIR / "atribuicao_diaria.sh"),
                        "--env-file",
                        str(env_file),
                        "--dry-run",
                    ],
                    check=False,
                    capture_output=True,
                    text=True,
                    env=child_env,
                    timeout=10,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn("pipeline ja esta em execucao", result.stdout)
                self.assertTrue(lock_dir.is_dir())
                self.assertEqual(
                    (lock_dir / "pid").read_text(encoding="utf-8").strip(),
                    str(sleeper.pid),
                )
            finally:
                sleeper.terminate()
                sleeper.wait(timeout=5)

            # Um lock realmente obsoleto pode ser assumido, e somente o novo
            # proprietario deve remove-lo ao terminar.
            (lock_dir / "pid").write_text("99999999\n", encoding="utf-8")
            result = subprocess.run(
                [
                    str(SCRIPT_DIR / "atribuicao_diaria.sh"),
                    "--env-file",
                    str(env_file),
                    "--dry-run",
                ],
                check=False,
                capture_output=True,
                text=True,
                env=child_env,
                timeout=10,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertFalse(lock_dir.exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
