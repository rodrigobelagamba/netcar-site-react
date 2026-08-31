#!/usr/bin/env python3
"""Testes isolados do exportador de conversoes offline do Google Ads."""

from __future__ import annotations

import csv
import datetime as dt
import io
import json
import tempfile
import unittest
from pathlib import Path
from zoneinfo import ZoneInfo

from export_google_ads_offline import (
    ExportError,
    READY_HEADERS,
    export_batch,
    main,
    parse_local_time,
)


TIMEZONE = ZoneInfo("America/Sao_Paulo")
AS_OF = dt.datetime(2026, 8, 31, 18, 0, 0, tzinfo=TIMEZONE)


def write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    fieldnames = sorted({key for row in rows for key in row})
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


class GoogleAdsOfflineExportTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tempdir.name)
        self.input_path = self.root / "enriched.csv"

    def tearDown(self) -> None:
        self.tempdir.cleanup()

    def run_export(
        self,
        rows: list[dict[str, object]],
        *,
        output_name: str = "output",
        ledger: Path | None = None,
        allow_missing_value: bool = False,
        include_match_evidence: bool = True,
    ):
        if include_match_evidence:
            rows = [
                {
                    "sale_match_method": "business_id_exact",
                    "sale_match_confidence": "high",
                    **row,
                }
                for row in rows
            ]
        write_csv(self.input_path, rows)
        return export_batch(
            input_path=self.input_path,
            output_dir=self.root / output_name,
            conversion_action="Venda confirmada",
            timezone=TIMEZONE,
            currency="BRL",
            event_source="IN_STORE",
            confirmation_field=None,
            confirmed_values=frozenset({"1", "sim", "true"}),
            date_only_time=parse_local_time("12:00:00"),
            max_age_days=90,
            allow_missing_value=allow_missing_value,
            applied_ledger=ledger,
            as_of=AS_OF,
        )

    def test_exports_only_confirmed_valid_rows_without_pii(self) -> None:
        rows = [
            {
                "virou_venda": "1",
                "sale_id": "101",
                "data_venda": "2026-08-31",
                "valor_venda": "R$ 92.000,00",
                "gclid": "GCLID_case_SENSITIVE_101",
                "telefone": "+5551999999999",
                "email": "cliente@example.com",
                "nome": "Cliente Teste",
            },
            {
                "virou_venda": "sim",
                "sale_id": "102",
                "data_venda": "2026-08-30 12:30:00",
                "valor_venda": "89900.50",
                "gbraid": "GBRAID_case_SENSITIVE_102",
            },
            {
                "virou_venda": "true",
                "sale_id": "103",
                "data_venda": "2026-08-29T15:00:00-03:00",
                "valor_venda": "110000",
                "wbraid": "WBRAID_case_SENSITIVE_103",
            },
            {
                "virou_venda": "0",
                "sale_id": "104",
                "data_venda": "2026-08-31",
                "valor_venda": "100000",
                "gclid": "GCLID_NOT_A_SALE",
            },
            {
                "virou_venda": "1",
                "sale_id": "105",
                "data_venda": "2026-08-30",
                "valor_venda": "100000",
                "gbraid": "GBRAID_BOTH",
                "wbraid": "WBRAID_BOTH",
            },
            {
                "virou_venda": "1",
                "sale_id": "101",
                "data_venda": "2026-08-31",
                "valor_venda": "R$ 92.000,00",
                "gclid": "GCLID_case_SENSITIVE_101",
                "telefone": "+5551999999999",
                "email": "cliente@example.com",
                "nome": "Cliente Teste",
            },
            {
                "virou_venda": "1",
                "sale_id": "106",
                "data_venda": "2026-08-30",
                "valor_venda": "100000",
            },
            {
                "virou_venda": "1",
                "sale_id": "107",
                "data_venda": "2026-08-30",
                "valor_venda": "100000",
                "gclid": "lead@example.com",
            },
            {
                "virou_venda": "1",
                "sale_id": "108",
                "data_venda": "2026-05-01",
                "valor_venda": "100000",
                "gclid": "GCLID_TOO_OLD",
            },
        ]

        summary = self.run_export(rows)
        self.assertEqual(summary.input_rows, 9)
        self.assertEqual(summary.confirmed_rows, 8)
        self.assertEqual(summary.ready_rows, 3)
        self.assertEqual(summary.rejected_rows, 5)
        self.assertEqual(summary.skipped_not_confirmed, 1)
        self.assertEqual(summary.exact_duplicates, 1)
        self.assertEqual(summary.braid_rows, 2)
        self.assertEqual(summary.assumed_date_only_time_rows, 1)

        output = self.root / "output"
        ready = read_csv(output / "google_ads_offline_ready.csv")
        self.assertEqual(tuple(ready[0]), READY_HEADERS)
        self.assertEqual(
            {row["Conversion value"] for row in ready},
            {"92000.00", "89900.50", "110000.00"},
        )
        self.assertTrue(all(row["Conversion date and time"].endswith("-03:00") for row in ready))
        self.assertTrue(all(row["Order ID"].startswith("nc_") for row in ready))
        self.assertEqual(len({row["Order ID"] for row in ready}), 3)
        self.assertIn(
            "GCLID_case_SENSITIVE_101", {row["GCLID"] for row in ready}
        )

        all_output = "\n".join(
            path.read_text(encoding="utf-8") for path in output.iterdir() if path.is_file()
        )
        self.assertNotIn("cliente@example.com", all_output)
        self.assertNotIn("+5551999999999", all_output)
        self.assertNotIn("Cliente Teste", all_output)

        rejected = read_csv(output / "google_ads_offline_rejected.csv")
        reasons = {row["reason"] for row in rejected}
        self.assertIn("gbraid_wbraid_both_set", reasons)
        self.assertIn("duplicate_identical", reasons)
        self.assertIn("missing_google_click_identifier", reasons)
        self.assertIn("identifier_looks_like_pii", reasons)
        self.assertIn("conversion_older_than_import_window", reasons)

        manifest = json.loads(
            (output / "google_ads_offline_manifest.json").read_text(encoding="utf-8")
        )
        self.assertFalse(manifest["contains_pii"])
        self.assertFalse(manifest["uploaded"])
        self.assertTrue(manifest["review_required"])
        self.assertEqual(
            manifest["sale_match_policy"]["approved_confidences"],
            ["high", "medium"],
        )
        self.assertEqual(manifest["sale_match_policy"]["phone_fallback"], "rejected")

    def test_rerun_is_byte_stable_and_ledger_excludes_only_applied_ids(self) -> None:
        rows = [
            {
                "virou_venda": "1",
                "sale_id": "201",
                "data_venda": "2026-08-30T18:00:00Z",
                "valor_venda": "100000",
                "gclid": "GCLID_201",
            },
            {
                "virou_venda": "1",
                "sale_id": "202",
                "data_venda": "2026-08-30 10:00:00",
                "valor_venda": "120000",
                "wbraid": "WBRAID_202",
            },
        ]
        first = self.run_export(rows, output_name="first")
        second = self.run_export(rows, output_name="second")
        first_csv = (self.root / "first/google_ads_offline_ready.csv").read_bytes()
        second_csv = (self.root / "second/google_ads_offline_ready.csv").read_bytes()
        self.assertEqual(first_csv, second_csv)
        self.assertEqual(first.batch_id, second.batch_id)

        ready = read_csv(self.root / "first/google_ads_offline_ready.csv")
        ledger = self.root / "applied.txt"
        ledger.write_text(
            "# confirmado pelo operador\n" + ready[0]["Order ID"] + "\n",
            encoding="utf-8",
        )
        after_apply = self.run_export(rows, output_name="after", ledger=ledger)
        self.assertEqual(after_apply.ready_rows, 1)
        self.assertEqual(after_apply.skipped_already_applied, 1)

    def test_conflicting_duplicate_is_removed_instead_of_guessed(self) -> None:
        rows = [
            {
                "virou_venda": "1",
                "sale_id": "301",
                "data_venda": "2026-08-30",
                "valor_venda": "90000",
                "gclid": "GCLID_301",
            },
            {
                "virou_venda": "1",
                "sale_id": "301",
                "data_venda": "2026-08-30",
                "valor_venda": "91000",
                "gclid": "GCLID_301",
            },
        ]
        summary = self.run_export(rows)
        self.assertEqual(summary.ready_rows, 0)
        self.assertEqual(summary.rejected_rows, 2)
        self.assertEqual(
            summary.rejection_reasons, {"duplicate_transaction_conflict": 2}
        )

    def test_gclid_can_coexist_with_one_braid_but_never_both_braids(self) -> None:
        rows = [
            {
                "virou_venda": "1",
                "sale_id": "351",
                "data_venda": "2026-08-30",
                "valor_venda": "90000",
                "gclid": "GCLID_351",
                "gbraid": "GBRAID_351",
            },
            {
                "virou_venda": "1",
                "sale_id": "352",
                "data_venda": "2026-08-30",
                "valor_venda": "91000",
                "gclid": "GCLID_352",
                "gbraid": "GBRAID_352",
                "wbraid": "WBRAID_352",
            },
        ]
        summary = self.run_export(rows)
        self.assertEqual(summary.ready_rows, 1)
        self.assertEqual(summary.rejection_reasons, {"gbraid_wbraid_both_set": 1})
        ready = read_csv(self.root / "output/google_ads_offline_ready.csv")
        self.assertEqual(ready[0]["GCLID"], "GCLID_351")
        self.assertEqual(ready[0]["GBRAID"], "GBRAID_351")

    def test_formatted_phone_cannot_escape_through_click_id_column(self) -> None:
        rows = [
            {
                "virou_venda": "1",
                "sale_id": "361",
                "data_venda": "2026-08-30",
                "valor_venda": "90000",
                "gclid": "+55 (51) 99999-9999",
            }
        ]
        summary = self.run_export(rows)
        self.assertEqual(summary.ready_rows, 0)
        self.assertEqual(summary.rejection_reasons, {"invalid_gclid": 1})

    def test_missing_value_requires_explicit_opt_in(self) -> None:
        rows = [
            {
                "virou_venda": "1",
                "sale_id": "401",
                "data_venda": "2026-08-30",
                "gclid": "GCLID_401",
            }
        ]
        rejected = self.run_export(rows, output_name="rejected")
        self.assertEqual(rejected.ready_rows, 0)
        self.assertEqual(rejected.rejection_reasons, {"missing_conversion_value": 1})

        accepted = self.run_export(
            rows, output_name="accepted", allow_missing_value=True
        )
        self.assertEqual(accepted.ready_rows, 1)
        ready = read_csv(self.root / "accepted/google_ads_offline_ready.csv")
        self.assertEqual(ready[0]["Conversion value"], "")

    def test_cli_strict_writes_files_then_returns_two(self) -> None:
        rows = [
            {
                "virou_venda": "1",
                "sale_id": "501",
                "data_venda": "2026-08-30",
                "valor_venda": "100000",
            }
        ]
        write_csv(self.input_path, rows)
        output = self.root / "strict"
        stdout = io.StringIO()
        previous = __import__("sys").stdout
        try:
            __import__("sys").stdout = stdout
            status = main(
                [
                    "--input",
                    str(self.input_path),
                    "--output-dir",
                    str(output),
                    "--conversion-action",
                    "Venda confirmada",
                    "--as-of",
                    "2026-08-31T18:00:00-03:00",
                    "--strict",
                ]
            )
        finally:
            __import__("sys").stdout = previous
        self.assertEqual(status, 2)
        self.assertTrue((output / "google_ads_offline_rejected.csv").is_file())

    def test_confirmation_field_is_mandatory(self) -> None:
        rows = [
            {
                "sale_id": "601",
                "data_venda": "2026-08-30",
                "valor_venda": "100000",
                "gclid": "GCLID_601",
            }
        ]
        with self.assertRaises(ExportError):
            self.run_export(rows)

    def test_only_approved_strong_sale_matches_become_ready(self) -> None:
        rows = [
            {
                "virou_venda": "1",
                "sale_id": "701",
                "data_venda": "2026-08-30",
                "valor_venda": "100000",
                "gclid": "GCLID_701",
                "sale_match_method": "business_id_exact",
                "sale_match_confidence": "high",
            },
            {
                "virou_venda": "1",
                "sale_id": "702",
                "data_venda": "2026-08-30",
                "valor_venda": "100000",
                "gclid": "GCLID_702",
                "sale_match_method": "customer_id_time",
                "sale_match_confidence": "medium",
            },
            {
                "virou_venda": "1",
                "sale_id": "703",
                "data_venda": "2026-08-30",
                "valor_venda": "100000",
                "gclid": "GCLID_703",
                "sale_match_method": "sale_id_exact",
                "sale_match_confidence": "medium",
            },
        ]

        summary = self.run_export(rows, include_match_evidence=False)
        self.assertEqual(summary.ready_rows, 3)
        self.assertEqual(summary.rejected_rows, 0)

    def test_phone_fallback_and_low_confidence_are_review_only(self) -> None:
        rows = [
            {
                "virou_venda": "1",
                "sale_id": "711",
                "data_venda": "2026-08-30",
                "valor_venda": "100000",
                "gclid": "GCLID_711",
                "sale_match_method": "phone_time_fallback",
                "sale_match_confidence": "medium",
            },
            {
                "virou_venda": "1",
                "sale_id": "712",
                "data_venda": "2026-08-30",
                "valor_venda": "100000",
                "gclid": "GCLID_712",
                "sale_match_method": "phone_only_fallback",
                "sale_match_confidence": "low",
            },
            {
                "virou_venda": "1",
                "sale_id": "713",
                "data_venda": "2026-08-30",
                "valor_venda": "100000",
                "gclid": "GCLID_713",
                "sale_match_method": "business_id_exact",
                "sale_match_confidence": "low",
            },
        ]

        summary = self.run_export(rows, include_match_evidence=False)
        self.assertEqual(summary.ready_rows, 0)
        self.assertEqual(summary.rejected_rows, 3)
        self.assertEqual(
            summary.rejection_reasons,
            {
                "sale_match_confidence_not_approved": 2,
                "sale_match_method_not_approved": 1,
            },
        )

    def test_legacy_csv_without_sale_match_fields_is_rejected_safely(self) -> None:
        rows = [
            {
                "virou_venda": "1",
                "sale_id": "721",
                "data_venda": "2026-08-30",
                "valor_venda": "100000",
                "gclid": "GCLID_721",
            }
        ]

        summary = self.run_export(rows, include_match_evidence=False)
        self.assertEqual(summary.ready_rows, 0)
        self.assertEqual(summary.rejected_rows, 1)
        self.assertEqual(
            summary.rejection_reasons, {"missing_sale_match_evidence": 1}
        )
        rejected = read_csv(self.root / "output/google_ads_offline_rejected.csv")
        self.assertEqual(rejected[0]["reason"], "missing_sale_match_evidence")


if __name__ == "__main__":
    unittest.main(verbosity=2)
