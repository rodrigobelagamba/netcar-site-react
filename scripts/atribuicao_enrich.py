#!/usr/bin/env python3
"""
Concilia Evolution -> clique do site -> CRM -> venda de forma auditavel.

Prioridades de match:
1. click_id forte (nc_ + 32 hex), quando presente nos dois lados;
2. wa_ref + janela temporal (novo Crockford ou formatos legados);
3. ID de negocio/cliente entre CRM e ERP;
4. telefone normalizado + janela temporal, sempre marcado como fallback.

O script pode consultar os bancos ou receber snapshots CSV, o que permite testes
sinteticos sem rede e auditorias reprodutiveis.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import json
import os
import re
import sys
import tempfile
import ssl
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable, Sequence
from urllib.parse import unquote, urlparse
from urllib.parse import parse_qs
from zoneinfo import ZoneInfo

from offline_config import (
    ConfigError,
    atomic_write_json,
    chmod_private,
    env_int,
    load_env_file,
    private_path,
    redact_text,
    required_env,
)


load_env_file()

CLICK_WINDOW_HOURS = env_int("ATTRIBUTION_CLICK_WINDOW_HOURS", 48, minimum=1)
CLICK_FUTURE_SKEW_MINUTES = env_int(
    "ATTRIBUTION_CLICK_FUTURE_SKEW_MINUTES", 10, minimum=0
)
CRM_WINDOW_DAYS = env_int("ATTRIBUTION_CRM_WINDOW_DAYS", 30, minimum=1)
SALE_WINDOW_DAYS = env_int("ATTRIBUTION_SALE_WINDOW_DAYS", 180, minimum=1)
RETENTION_DAYS = env_int("ATTRIBUTION_RETENTION_DAYS", 365, minimum=1)
SOURCE_TIMEZONE = ZoneInfo(
    os.environ.get("ATTRIBUTION_SOURCE_TIMEZONE", "America/Sao_Paulo").strip()
)

DEFAULT_EVOLUTION_CSV = private_path(
    "EVOLUTION_OUTPUT_CSV", "atribuicao_whatsapp_leads.csv"
)
DEFAULT_CLICK_LOG = private_path(
    "ATTRIBUTION_CLICK_LOG_PATH", "wa_clicks_log.jsonl"
)
DEFAULT_OUTPUT_CSV = private_path(
    "ATTRIBUTION_OUTPUT_CSV", "atribuicao_whatsapp_leads_enriquecido.csv"
)
DEFAULT_AUDIT_JSON = private_path(
    "ATTRIBUTION_AUDIT_JSON", "atribuicao_whatsapp_audit.json"
)
DEFAULT_CONFIRMED_CONVERSIONS_CSV = private_path(
    "ATTRIBUTION_CONFIRMED_CONVERSIONS_CSV", "conversoes_confirmadas.csv"
)

STRONG_CLICK_ID_RE = re.compile(r"^nc_[0-9a-f]{32}$", re.I)
NEW_WA_REF_RE = re.compile(r"^[MGODSRU][23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{7}$", re.I)
LEGACY_WA_REF_RE = re.compile(r"^[MGODSRU](?:\d{3,5}|[A-Z2-9]{4})$", re.I)
SECRET_FIELD_RE = re.compile(
    r"(?:^|_)(?:password|passwd|secret|api_?key|access_?token|database_?url|connection_?string)(?:$|_)",
    re.I,
)


def first_value(row: dict, *keys: str) -> str:
    for key in keys:
        value = row.get(key)
        if value is not None and str(value).strip() != "":
            return str(value).strip()
    return ""


def normalize_phone(value: object) -> str:
    digits = re.sub(r"\D", "", str(value or ""))
    if not digits:
        return ""
    if digits.startswith("55") and len(digits) >= 12:
        normalized = digits
    elif len(digits) in (10, 11):
        normalized = "55" + digits
    else:
        normalized = digits
    # So acrescenta o nono digito a numeros que parecem celulares antigos.
    # Fixos (assinante iniciado em 2–5) permanecem distintos.
    if (
        len(normalized) == 12
        and normalized.startswith("55")
        and normalized[4] in "6789"
    ):
        normalized = normalized[:4] + "9" + normalized[4:]
    return normalized


# Compatibilidade com consumidores antigos.
norm = normalize_phone


def normalize_click_id(value: object) -> str:
    raw = str(value or "").strip().lower()
    return raw if raw else ""


def normalize_wa_ref(value: object) -> str:
    return str(value or "").strip().upper()


def parse_datetime(value: object) -> dt.datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, dt.datetime):
        parsed = value
    elif isinstance(value, dt.date):
        parsed = dt.datetime.combine(value, dt.time.min)
    elif isinstance(value, (int, float)) or str(value).strip().isdigit():
        try:
            numeric = float(value)
            if numeric > 10_000_000_000:
                numeric /= 1000
            parsed = dt.datetime.fromtimestamp(numeric, dt.timezone.utc)
        except (ValueError, OverflowError, OSError):
            return None
    else:
        raw = str(value).strip()
        candidates = [raw, raw.replace("Z", "+00:00")]
        parsed = None
        for candidate in candidates:
            try:
                parsed = dt.datetime.fromisoformat(candidate)
                break
            except ValueError:
                pass
        if parsed is None:
            for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
                try:
                    parsed = dt.datetime.strptime(raw, fmt)
                    break
                except ValueError:
                    pass
        if parsed is None:
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=SOURCE_TIMEZONE)
    return parsed.astimezone(dt.timezone.utc)


def lead_time(row: dict) -> dt.datetime | None:
    return parse_datetime(
        first_value(
            row,
            "primeiro_contato_epoch",
            "primeiro_contato",
            "first_contact_at",
            "created_at",
        )
    )


def click_time(row: dict) -> dt.datetime | None:
    return parse_datetime(
        first_value(row, "ts", "timestamp", "event_ts", "dt", "datetime", "created_at")
    )


def crm_time(row: dict) -> dt.datetime | None:
    return parse_datetime(first_value(row, "created_at", "date_create", "crm_created_at"))


def sale_time(row: dict) -> dt.datetime | None:
    return parse_datetime(
        first_value(row, "sale_date", "sold_at", "datavenda", "data_venda")
    )


def safe_row(row: dict) -> dict:
    safe: dict = {}
    for key, value in row.items():
        key_text = str(key)
        if SECRET_FIELD_RE.search(key_text):
            continue
        if isinstance(value, (dt.date, dt.datetime)):
            value = value.isoformat()
        safe[key_text] = redact_text(value) if isinstance(value, str) else value
    return safe


def load_csv(path: Path) -> list[dict]:
    if not path.exists():
        raise FileNotFoundError(f"arquivo ausente: {path}")
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        raise FileNotFoundError(f"arquivo ausente: {path}")
    rows = []
    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as exc:
                raise RuntimeError(f"JSONL invalido em {path.name}:{line_number}") from exc
            if isinstance(value, dict):
                rows.append(value)
    return rows


def write_csv_atomic(path: Path, rows: list[dict], preferred_fields: Sequence[str]) -> None:
    fields = list(preferred_fields)
    seen = set(fields)
    for row in rows:
        for key in row:
            if key not in seen:
                fields.append(key)
                seen.add(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(rows)
        os.chmod(temp_name, 0o600)
        os.replace(temp_name, path)
        chmod_private(path)
    except Exception:
        try:
            os.unlink(temp_name)
        except OSError:
            pass
        raise


def build_index(
    rows: Iterable[dict], keys: Sequence[str], normalizer: Callable[[object], str]
) -> dict[str, list[dict]]:
    index: dict[str, list[dict]] = {}
    for row in rows:
        value = normalizer(first_value(row, *keys))
        if value:
            index.setdefault(value, []).append(row)
    return index


@dataclass
class MatchResult:
    row: dict | None = None
    method: str = "none"
    confidence: str = "none"
    candidate_count: int = 0
    delta_seconds: int | None = None
    note: str = ""


def _nearest_temporal(
    candidates: Sequence[dict],
    target: dt.datetime | None,
    time_getter: Callable[[dict], dt.datetime | None],
    minimum_delta_seconds: int,
    maximum_delta_seconds: int,
) -> tuple[dict | None, int | None, int]:
    if target is None:
        return (candidates[0], None, len(candidates)) if len(candidates) == 1 else (None, None, len(candidates))
    eligible: list[tuple[int, dict]] = []
    for candidate in candidates:
        timestamp = time_getter(candidate)
        if timestamp is None:
            continue
        delta = int((timestamp - target).total_seconds())
        if minimum_delta_seconds <= delta <= maximum_delta_seconds:
            eligible.append((delta, candidate))
    if not eligible:
        return None, None, len(candidates)
    eligible.sort(key=lambda item: abs(item[0]))
    return eligible[0][1], eligible[0][0], len(eligible)


def match_click(lead: dict, clicks: Sequence[dict]) -> MatchResult:
    target = lead_time(lead)
    lead_click_id = normalize_click_id(
        first_value(lead, "click_id", "wa_click_id", "event_id")
    )
    if lead_click_id:
        candidates = [
            row
            for row in clicks
            if normalize_click_id(first_value(row, "click_id", "wa_click_id", "event_id"))
            == lead_click_id
        ]
        if candidates:
            selected, delta, eligible_count = _nearest_temporal(
                candidates,
                target,
                click_time,
                -CLICK_WINDOW_HOURS * 3600,
                CLICK_FUTURE_SKEW_MINUTES * 60,
            )
            strong = bool(STRONG_CLICK_ID_RE.fullmatch(lead_click_id))
            if selected is None and strong and len(candidates) == 1:
                selected = candidates[0]
            if selected is not None:
                return MatchResult(
                    selected,
                    "click_id_exact",
                    "high" if strong and len(candidates) == 1 else "medium",
                    len(candidates),
                    -delta if delta is not None else None,
                    "click_id forte" if strong else "click_id nao padronizado",
                )

    wa_ref = normalize_wa_ref(
        first_value(lead, "wa_ref", "codigo_site", "code", "codigo")
    )
    if not wa_ref:
        return MatchResult(note="lead sem click_id/wa_ref")
    candidates = [
        row
        for row in clicks
        if normalize_wa_ref(first_value(row, "wa_ref", "code", "codigo_site"))
        == wa_ref
    ]
    if not candidates:
        return MatchResult(method="wa_ref_not_found", note="wa_ref ausente no log")
    selected, delta, eligible_count = _nearest_temporal(
        candidates,
        target,
        click_time,
        -CLICK_WINDOW_HOURS * 3600,
        CLICK_FUTURE_SKEW_MINUTES * 60,
    )
    if selected is None:
        return MatchResult(
            method="wa_ref_ambiguous_or_outside_window",
            candidate_count=len(candidates),
            note="sem candidato temporal unico/elegivel",
        )
    is_new = bool(NEW_WA_REF_RE.fullmatch(wa_ref))
    is_legacy = bool(LEGACY_WA_REF_RE.fullmatch(wa_ref))
    if len(candidates) > 1 or eligible_count > 1:
        confidence = "low"
    elif is_new:
        confidence = "high"
    else:
        confidence = "medium" if is_legacy else "low"
    return MatchResult(
        selected,
        "wa_ref_time",
        confidence,
        len(candidates),
        -delta if delta is not None else None,
        "novo Crockford" if is_new else "wa_ref legado/fallback",
    )


def match_crm(lead: dict, click: dict | None, crm_rows: Sequence[dict]) -> MatchResult:
    target = lead_time(lead)
    business_id = first_value(
        lead, "crm_business_id", "business_id", "deal_id", "negocio_id", "id_negocio"
    )
    if business_id:
        candidates = [
            row
            for row in crm_rows
            if first_value(row, "business_id", "deal_id", "negocio_id", "id_negocio", "id")
            == business_id
        ]
        if candidates:
            return MatchResult(
                candidates[0],
                "business_id_exact",
                "high" if len(candidates) == 1 else "medium",
                len(candidates),
            )

    click_id = normalize_click_id(
        first_value(click or {}, "click_id", "wa_click_id")
        or first_value(lead, "click_id", "wa_click_id")
    )
    if click_id:
        candidates = [
            row
            for row in crm_rows
            if normalize_click_id(first_value(row, "click_id", "wa_click_id"))
            == click_id
        ]
        if candidates:
            selected, delta, _ = _nearest_temporal(
                candidates, target, crm_time, -86400, CRM_WINDOW_DAYS * 86400
            )
            selected = selected or (candidates[0] if len(candidates) == 1 else None)
            if selected:
                return MatchResult(
                    selected,
                    "click_id_exact",
                    "high" if len(candidates) == 1 else "medium",
                    len(candidates),
                    delta,
                )

    wa_ref = normalize_wa_ref(
        first_value(click or {}, "wa_ref", "code")
        or first_value(lead, "wa_ref", "codigo_site", "code")
    )
    if wa_ref:
        candidates = [
            row
            for row in crm_rows
            if normalize_wa_ref(first_value(row, "wa_ref", "codigo_site", "code"))
            == wa_ref
        ]
        if candidates:
            selected, delta, eligible_count = _nearest_temporal(
                candidates, target, crm_time, -86400, CRM_WINDOW_DAYS * 86400
            )
            if selected:
                return MatchResult(
                    selected,
                    "wa_ref_time",
                    "high" if len(candidates) == 1 and eligible_count == 1 else "low",
                    len(candidates),
                    delta,
                )

    phone = normalize_phone(first_value(lead, "telefone", "phone", "celular"))
    if not phone:
        return MatchResult(note="lead sem telefone e sem IDs compartilhados")
    candidates = []
    for row in crm_rows:
        phones = {
            normalize_phone(first_value(row, "phone", "telefone", "celular")),
            normalize_phone(first_value(row, "phone_alt", "fone")),
        }
        if phone in phones:
            candidates.append(row)
    if not candidates:
        return MatchResult(method="phone_not_found", note="telefone ausente no CRM")
    selected, delta, eligible_count = _nearest_temporal(
        candidates, target, crm_time, -86400, CRM_WINDOW_DAYS * 86400
    )
    if selected:
        return MatchResult(
            selected,
            "phone_time_fallback",
            "medium" if len(candidates) == 1 and eligible_count == 1 else "low",
            len(candidates),
            delta,
            "fallback por telefone normalizado",
        )
    if len(candidates) == 1 and crm_time(candidates[0]) is None:
        return MatchResult(
            candidates[0],
            "phone_only_fallback",
            "low",
            1,
            note="CRM sem timestamp comparavel",
        )
    return MatchResult(
        method="phone_ambiguous_or_outside_window",
        candidate_count=len(candidates),
        note="telefone nao identifica negocio unico na janela",
    )


def match_sale(
    lead: dict, crm: dict | None, sales_rows: Sequence[dict]
) -> MatchResult:
    target = lead_time(lead)
    business_id = first_value(
        crm or {}, "business_id", "deal_id", "negocio_id", "id_negocio", "id"
    ) or first_value(lead, "business_id", "deal_id", "negocio_id", "id_negocio")
    if business_id:
        candidates = [
            row
            for row in sales_rows
            if first_value(row, "business_id", "deal_id", "negocio_id", "id_negocio")
            == business_id
        ]
        if candidates:
            selected, delta, eligible_count = _nearest_temporal(
                candidates, target, sale_time, 0, SALE_WINDOW_DAYS * 86400
            )
            if (
                selected is None
                and len(candidates) == 1
                and sale_time(candidates[0]) is None
            ):
                selected = candidates[0]
            if selected:
                return MatchResult(
                    selected,
                    "business_id_exact",
                    "high" if len(candidates) == 1 and eligible_count <= 1 else "medium",
                    len(candidates),
                    delta,
                )

    customer_id = first_value(crm or {}, "customer_id", "cliente_id", "id_cliente")
    if customer_id:
        candidates = [
            row
            for row in sales_rows
            if first_value(row, "customer_id", "cliente_id", "id_cliente")
            == customer_id
        ]
        if candidates:
            selected, delta, eligible_count = _nearest_temporal(
                candidates, target, sale_time, 0, SALE_WINDOW_DAYS * 86400
            )
            if selected:
                return MatchResult(
                    selected,
                    "customer_id_time",
                    "medium" if eligible_count == 1 else "low",
                    len(candidates),
                    delta,
                )

    phone = normalize_phone(first_value(lead, "telefone", "phone", "celular"))
    if not phone:
        return MatchResult(note="sem ID de negocio/cliente ou telefone")
    candidates = []
    for row in sales_rows:
        phones = {
            normalize_phone(first_value(row, "phone", "telefone", "celular")),
            normalize_phone(first_value(row, "phone_alt", "fone")),
        }
        if phone in phones:
            candidates.append(row)
    if not candidates:
        return MatchResult(method="phone_not_found", note="telefone sem venda")
    selected, delta, eligible_count = _nearest_temporal(
        candidates, target, sale_time, 0, SALE_WINDOW_DAYS * 86400
    )
    if selected:
        return MatchResult(
            selected,
            "phone_time_fallback",
            "medium" if eligible_count == 1 and len(candidates) == 1 else "low",
            len(candidates),
            delta,
            "fallback por telefone; nao prova causalidade",
        )
    if len(candidates) == 1 and target is None:
        return MatchResult(
            candidates[0], "phone_only_fallback", "low", 1, note="lead sem data"
        )
    return MatchResult(
        method="phone_ambiguous_or_outside_window",
        candidate_count=len(candidates),
        note="nenhuma venda elegivel na janela",
    )


def infer_store(*rows: dict | None) -> str:
    for row in rows:
        if not row:
            continue
        explicit = first_value(row, "store", "loja", "store_id", "loja_id", "gbp_profile")
        if explicit:
            return explicit
        content = first_value(row, "utm_content", "traffic_content")
        if re.search(r"(?:^|[_-])loja[_-]?1(?:[_-]|$)", content, re.I):
            return "loja_1"
        if re.search(r"(?:^|[_-])loja[_-]?2(?:[_-]|$)", content, re.I):
            return "loja_2"
    return ""


def weakest_confidence(results: Sequence[MatchResult]) -> str:
    rank = {"none": 0, "low": 1, "medium": 2, "high": 3}
    matched = [result.confidence for result in results if result.row is not None]
    if not matched:
        return "none"
    score = min(rank.get(value, 0) for value in matched)
    # Cada elo ausente reduz a confianca ponta a ponta; uma origem forte sem
    # CRM/venda nao pode aparecer como atribuicao completa de alta confianca.
    score = max(1, score - sum(1 for result in results if result.row is None))
    return {1: "low", 2: "medium", 3: "high"}.get(score, "none")


def attribution_id(lead: dict) -> str:
    material = "|".join(
        (
            first_value(lead, "jid"),
            normalize_phone(first_value(lead, "telefone", "phone", "celular")),
            first_value(lead, "primeiro_contato", "first_contact_at"),
            normalize_wa_ref(first_value(lead, "wa_ref", "codigo_site", "code")),
        )
    )
    return "atl_" + hashlib.sha256(material.encode("utf-8")).hexdigest()[:20]


def enrich_rows(
    leads: Sequence[dict],
    clicks: Sequence[dict],
    crm_rows: Sequence[dict],
    sales_rows: Sequence[dict],
) -> list[dict]:
    enriched: list[dict] = []
    for original in leads:
        lead = safe_row(original)
        click_match = match_click(lead, clicks)
        click = safe_row(click_match.row) if click_match.row else None
        crm_match = match_crm(lead, click, crm_rows)
        crm = safe_row(crm_match.row) if crm_match.row else None
        sale_match = match_sale(lead, crm, sales_rows)
        sale = safe_row(sale_match.row) if sale_match.row else None

        wa_ref = normalize_wa_ref(
            first_value(click or {}, "wa_ref", "code")
            or first_value(lead, "wa_ref", "codigo_site", "code")
        )
        click_id = normalize_click_id(
            first_value(click or {}, "click_id", "wa_click_id")
            or first_value(lead, "click_id", "wa_click_id")
        )
        methods = (
            f"click:{click_match.method}|crm:{crm_match.method}|sale:{sale_match.method}"
        )
        confidence = weakest_confidence((click_match, crm_match, sale_match))
        traffic_source = first_value(
            click or {},
            "traffic_source",
            "utm_source",
            "trafficSource",
        )
        wa_source = first_value(click or {}, "wa_source", "source") or first_value(
            lead, "wa_source", "origem"
        )

        output = dict(lead)
        output.update(
            {
                "attribution_id": first_value(
                    lead, "lead_session_id", "lead_id", "attribution_id"
                )
                or attribution_id(lead),
                "click_id": click_id,
                "wa_ref": wa_ref,
                "source": traffic_source,
                "traffic_source": traffic_source,
                "wa_source": wa_source,
                "intent": first_value(click or {}, "intent", "wa_intent", "waIntent")
                or first_value(lead, "intent"),
                "campaign": first_value(
                    click or {}, "campaign", "utm_campaign", "traffic_campaign", "utmCampaign"
                )
                or first_value(lead, "campanha_meta", "campanha_titulo"),
                "gclid": first_value(click or {}, "gclid"),
                "gbraid": first_value(click or {}, "gbraid"),
                "wbraid": first_value(click or {}, "wbraid"),
                "fbclid": first_value(click or {}, "fbclid"),
                "ctwa_clid": first_value(lead, "ctwa_clid")
                or first_value(click or {}, "ctwa_clid"),
                "utm_source": first_value(click or {}, "utm_source", "traffic_utm_source", "utmSource"),
                "utm_medium": first_value(click or {}, "utm_medium", "traffic_medium", "utmMedium"),
                "utm_content": first_value(click or {}, "utm_content", "traffic_content", "utmContent"),
                "utm_term": first_value(click or {}, "utm_term", "utmTerm"),
                "landing_page": first_value(
                    click or {}, "landing_page", "landing", "page_location", "landingPage"
                ),
                "referrer": first_value(click or {}, "referrer", "document_referrer"),
                "page": first_value(click or {}, "page", "page_path")
                or first_value(lead, "page", "page_path"),
                "vehicle_id": first_value(
                    click or {}, "vehicle_id", "wa_vehicle_id", "item_id", "vehicleId"
                )
                or first_value(lead, "vehicle_id", "wa_vehicle_id"),
                "vehicle_name": first_value(
                    click or {}, "vehicle_name", "wa_vehicle_name", "item_name", "vehicleName"
                )
                or first_value(lead, "vehicle_name", "wa_vehicle_name"),
                "store": infer_store(crm, sale, click, lead),
                "salesperson": first_value(
                    crm or {}, "salesperson", "vendedor", "seller", "responsavel"
                )
                or first_value(sale or {}, "salesperson", "vendedor", "seller")
                or first_value(lead, "salesperson", "vendedor"),
                "crm_business_id": first_value(
                    crm or {}, "business_id", "deal_id", "negocio_id", "id_negocio", "id"
                ),
                "crm_customer_id": first_value(
                    crm or {}, "customer_id", "cliente_id", "id_cliente"
                ),
                "crm_matched": "1" if crm else "0",
                "no_crm": "0" if crm else "1",
                "crm_estado": first_value(crm or {}, "state", "estado", "id_state", "status"),
                "crm_origem": first_value(crm or {}, "origin", "origem"),
                "crm_canal": first_value(crm or {}, "channel", "canal"),
                "sale_id": first_value(sale or {}, "sale_id", "id_venda", "codvenda", "id"),
                "virou_venda": "1" if sale else "0",
                "data_venda": first_value(
                    sale or {}, "sale_date", "sold_at", "data_venda", "datavenda"
                ),
                "valor_venda": first_value(sale or {}, "sale_value", "valor_venda", "valorvenda"),
                "sold_vehicle_id": first_value(
                    sale or {}, "vehicle_id", "veiculo_id", "codveiculo"
                ),
                "click_match_method": click_match.method,
                "click_match_confidence": click_match.confidence,
                "click_match_candidates": click_match.candidate_count,
                "click_match_delta_seconds": click_match.delta_seconds
                if click_match.delta_seconds is not None
                else "",
                "crm_match_method": crm_match.method,
                "crm_match_confidence": crm_match.confidence,
                "crm_match_candidates": crm_match.candidate_count,
                "crm_match_delta_seconds": crm_match.delta_seconds
                if crm_match.delta_seconds is not None
                else "",
                "sale_match_method": sale_match.method,
                "sale_match_confidence": sale_match.confidence,
                "sale_match_candidates": sale_match.candidate_count,
                "sale_match_delta_seconds": sale_match.delta_seconds
                if sale_match.delta_seconds is not None
                else "",
                "match_method": methods,
                "confidence": confidence,
            }
        )
        enriched.append(output)
    return enriched


def _identifier(value: str, env_name: str) -> str:
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value):
        raise ConfigError(f"{env_name} deve ser identificador SQL simples")
    return value


def _tls_mode(parsed, env_name: str) -> str:
    query = parse_qs(parsed.query)
    raw = (
        os.environ.get(env_name, "").strip()
        or (query.get("sslmode") or query.get("ssl-mode") or query.get("ssl") or [""])[0]
    )
    normalized = str(raw).strip().lower().replace("_", "-")
    aliases = {"1": "verify-full", "true": "verify-full", "required": "require"}
    normalized = aliases.get(normalized, normalized)
    if normalized not in {"require", "verify-ca", "verify-full"}:
        raise ConfigError(
            f"{env_name}/sslmode deve exigir TLS: require, verify-ca ou verify-full"
        )
    return normalized


def _pick_column(
    available: set[str], env_name: str, candidates: Sequence[str]
) -> str | None:
    configured = os.environ.get(env_name, "").strip()
    if configured:
        configured = _identifier(configured, env_name)
        if configured not in available:
            raise ConfigError(f"{env_name} nao existe na tabela configurada")
        return configured
    return next((candidate for candidate in candidates if candidate in available), None)


CRM_FIELDS = {
    "business_id": ("id", "deal_id", "id_negocio", "negocio_id", "codnegocio", "codigo"),
    "customer_id": ("cliente_id", "id_cliente", "client_id", "codgeral"),
    "phone": ("celular", "telefone", "phone"),
    "phone_alt": ("fone", "telefone2"),
    "click_id": ("click_id", "wa_click_id"),
    "wa_ref": ("wa_ref", "codigo_site"),
    "created_at": ("date_create", "created_at", "data_cadastro"),
    "state": ("id_state", "estado", "status"),
    "origin": ("origem", "source"),
    "channel": ("canal", "channel"),
    "store": ("loja", "store", "loja_id", "id_loja"),
    "salesperson": ("vendedor", "salesperson", "vendedor_id", "id_vendedor", "responsavel"),
    "vehicle_id": ("veiculo_id", "id_veiculo", "codveiculo"),
    "vehicle_name": ("veiculo", "vehicle_name", "modelo"),
}


def fetch_crm_rows() -> list[dict]:
    import pymysql

    dsn = urlparse(required_env("CRM_DATABASE_URL").replace("mysql+pymysql://", "mysql://"))
    ssl_mode = _tls_mode(dsn, "CRM_SSLMODE")
    if not dsn.hostname or not dsn.path.lstrip("/"):
        raise ConfigError("CRM_DATABASE_URL invalida")
    ssl_context = ssl.create_default_context(cafile=os.environ.get("CRM_SSL_CA") or None)
    if ssl_mode == "require":
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
    elif ssl_mode == "verify-ca":
        ssl_context.check_hostname = False
    if os.environ.get("CRM_SSL_CERT"):
        ssl_context.load_cert_chain(
            os.environ["CRM_SSL_CERT"], os.environ.get("CRM_SSL_KEY") or None
        )
    table = _identifier(os.environ.get("CRM_TABLE", "crm_negocio"), "CRM_TABLE")
    connection = pymysql.connect(
        host=dsn.hostname,
        port=dsn.port or 3306,
        user=unquote(dsn.username or ""),
        password=unquote(dsn.password or ""),
        database=dsn.path.lstrip("/"),
        connect_timeout=20,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        ssl=ssl_context,
    )
    try:
        with connection.cursor() as cursor:
            cursor.execute(f"SHOW COLUMNS FROM `{table}`")
            columns = {str(row["Field"]) for row in cursor.fetchall()}
            mapping = {
                logical: _pick_column(columns, f"CRM_{logical.upper()}_COLUMN", candidates)
                for logical, candidates in CRM_FIELDS.items()
            }
            mapping = {key: value for key, value in mapping.items() if value}
            if not mapping:
                raise ConfigError("nenhuma coluna CRM reconhecida")
            select_sql = ", ".join(
                f"`{column}` AS `{logical}`" for logical, column in mapping.items()
            )
            params: list[object] = []
            where = ""
            if mapping.get("created_at"):
                start = (
                    dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=RETENTION_DAYS)
                ).date()
                where = f" WHERE `{mapping['created_at']}` >= %s"
                params.append(start)
            cursor.execute(f"SELECT {select_sql} FROM `{table}`{where}", params)
            return [safe_row(row) for row in cursor.fetchall()]
    finally:
        connection.close()


SALE_FIELDS = {
    "sale_id": ("id", "id_venda", "codvenda", "codigo"),
    "business_id": ("crm_negocio_id", "deal_id", "negocio_id", "id_negocio", "lead_id"),
    "customer_id": ("codgeralcomprador", "cliente_id", "id_cliente"),
    "sale_date": ("sold_at", "datavenda", "data_venda"),
    "sale_value": ("valorvenda", "valor_venda", "value"),
    "vehicle_id": ("codveiculo", "veiculo_id", "id_veiculo"),
    "store": ("loja", "store", "id_loja", "empresa"),
    "salesperson": ("vendedor", "codvendedor", "id_vendedor", "salesperson"),
}
CUSTOMER_FIELDS = {
    "customer_id": ("codgeral", "id", "cliente_id", "id_cliente"),
    "phone": ("celular", "telefone", "phone"),
    "phone_alt": ("fone", "telefone2"),
}


def fetch_sales_rows() -> list[dict]:
    import psycopg2
    import psycopg2.extras

    dsn = urlparse(required_env("PG_CONNECTION_STRING"))
    ssl_mode = _tls_mode(dsn, "PGSSLMODE")
    if not dsn.hostname or not dsn.path.lstrip("/"):
        raise ConfigError("PG_CONNECTION_STRING invalida")
    sales_table = _identifier(os.environ.get("ERP_SALES_TABLE", "vendidos"), "ERP_SALES_TABLE")
    customers_table = _identifier(
        os.environ.get("ERP_CUSTOMERS_TABLE", "cadclientes"), "ERP_CUSTOMERS_TABLE"
    )
    connection = psycopg2.connect(
        host=dsn.hostname,
        port=dsn.port or 5432,
        user=unquote(dsn.username or ""),
        password=unquote(dsn.password or ""),
        dbname=dsn.path.lstrip("/"),
        connect_timeout=20,
        sslmode=ssl_mode,
        sslrootcert=os.environ.get("PGSSLROOTCERT") or None,
        sslcert=os.environ.get("PGSSLCERT") or None,
        sslkey=os.environ.get("PGSSLKEY") or None,
    )
    try:
        cursor = connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute(
            "SELECT table_name, column_name FROM information_schema.columns "
            "WHERE table_schema = current_schema() AND table_name IN (%s, %s)",
            (sales_table, customers_table),
        )
        all_columns: dict[str, set[str]] = {sales_table: set(), customers_table: set()}
        for row in cursor.fetchall():
            all_columns[str(row["table_name"])].add(str(row["column_name"]))
        sales_mapping = {
            logical: _pick_column(
                all_columns[sales_table], f"ERP_{logical.upper()}_COLUMN", candidates
            )
            for logical, candidates in SALE_FIELDS.items()
        }
        customer_mapping = {
            logical: _pick_column(
                all_columns[customers_table],
                f"ERP_CUSTOMER_{logical.upper()}_COLUMN",
                candidates,
            )
            for logical, candidates in CUSTOMER_FIELDS.items()
        }
        sales_mapping = {key: value for key, value in sales_mapping.items() if value}
        customer_mapping = {
            key: value for key, value in customer_mapping.items() if value
        }
        select_parts = [
            f'v."{column}" AS "{logical}"'
            for logical, column in sales_mapping.items()
            if column
        ]
        select_parts.extend(
            f'c."{column}" AS "{logical}"'
            for logical, column in customer_mapping.items()
            if column and logical != "customer_id"
        )
        if not select_parts:
            raise ConfigError("nenhuma coluna ERP reconhecida")
        join = ""
        if sales_mapping.get("customer_id") and customer_mapping.get("customer_id"):
            join = (
                f' LEFT JOIN "{customers_table}" c ON '
                f'c."{customer_mapping["customer_id"]}" = '
                f'v."{sales_mapping["customer_id"]}"'
            )
        elif any(logical in customer_mapping for logical in ("phone", "phone_alt")):
            raise ConfigError("ERP sem colunas de cliente para relacionar telefones")
        params: list[object] = []
        where = ""
        if sales_mapping.get("sale_date"):
            start = (
                dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=RETENTION_DAYS)
            ).date()
            where = f' WHERE v."{sales_mapping["sale_date"]}" >= %s'
            params.append(start)
        cursor.execute(
            f'SELECT {", ".join(select_parts)} FROM "{sales_table}" v{join}{where}',
            params,
        )
        return [safe_row(dict(row)) for row in cursor.fetchall()]
    finally:
        connection.close()


PREFERRED_FIELDS = (
    "attribution_id",
    "primeiro_contato",
    "telefone",
    "jid",
    "click_id",
    "wa_ref",
    "source",
    "traffic_source",
    "wa_source",
    "intent",
    "campaign",
    "gclid",
    "gbraid",
    "wbraid",
    "fbclid",
    "ctwa_clid",
    "utm_source",
    "utm_medium",
    "utm_content",
    "utm_term",
    "landing_page",
    "referrer",
    "page",
    "vehicle_id",
    "vehicle_name",
    "store",
    "salesperson",
    "crm_business_id",
    "crm_customer_id",
    "crm_matched",
    "no_crm",
    "crm_estado",
    "crm_origem",
    "crm_canal",
    "sale_id",
    "virou_venda",
    "data_venda",
    "valor_venda",
    "sold_vehicle_id",
    "click_match_method",
    "click_match_confidence",
    "click_match_candidates",
    "click_match_delta_seconds",
    "crm_match_method",
    "crm_match_confidence",
    "crm_match_candidates",
    "crm_match_delta_seconds",
    "sale_match_method",
    "sale_match_confidence",
    "sale_match_candidates",
    "sale_match_delta_seconds",
    "match_method",
    "confidence",
)

CONFIRMED_CONVERSION_FIELDS = (
    "attribution_id",
    "sale_id",
    "conversion_time",
    "conversion_value",
    "currency",
    "click_id",
    "gclid",
    "gbraid",
    "wbraid",
    "fbclid",
    "ctwa_clid",
    "sale_match_method",
    "sale_match_confidence",
    "match_method",
    "confidence",
    "export_status",
)

APPROVED_CONVERSION_SALE_METHODS = {
    "business_id_exact",
    "customer_id_time",
}
APPROVED_CONVERSION_SALE_CONFIDENCES = {"high", "medium"}


def confirmed_conversions(output: Sequence[dict]) -> list[dict]:
    rows = []
    for row in output:
        if str(row.get("virou_venda") or "") != "1":
            continue
        has_ad_identifier = any(
            first_value(row, field)
            for field in ("gclid", "gbraid", "wbraid", "fbclid", "ctwa_clid")
        )
        sale_match_method = first_value(row, "sale_match_method").lower()
        sale_match_confidence = first_value(row, "sale_match_confidence").lower()
        has_strong_sale_evidence = (
            sale_match_method in APPROVED_CONVERSION_SALE_METHODS
            and sale_match_confidence in APPROVED_CONVERSION_SALE_CONFIDENCES
        )
        if not has_ad_identifier:
            export_status = "missing_ad_click_identifier"
        elif not has_strong_sale_evidence:
            export_status = "review_match_evidence"
        else:
            export_status = "ready_with_ad_id"
        rows.append(
            {
                "attribution_id": first_value(row, "attribution_id"),
                "sale_id": first_value(row, "sale_id"),
                "conversion_time": first_value(row, "data_venda"),
                "conversion_value": first_value(row, "valor_venda"),
                "currency": first_value(row, "currency")
                or os.environ.get("ATTRIBUTION_CONVERSION_CURRENCY", "BRL"),
                "click_id": first_value(row, "click_id"),
                "gclid": first_value(row, "gclid"),
                "gbraid": first_value(row, "gbraid"),
                "wbraid": first_value(row, "wbraid"),
                "fbclid": first_value(row, "fbclid"),
                "ctwa_clid": first_value(row, "ctwa_clid"),
                "sale_match_method": sale_match_method,
                "sale_match_confidence": sale_match_confidence,
                "match_method": first_value(row, "match_method"),
                "confidence": first_value(row, "confidence"),
                "export_status": export_status,
            }
        )
    return rows


def build_audit(
    leads: Sequence[dict],
    clicks: Sequence[dict],
    crm_rows: Sequence[dict],
    sales_rows: Sequence[dict],
    output: Sequence[dict],
    source_coverage: dict[str, str] | None = None,
) -> dict:
    def counts(field: str) -> dict[str, int]:
        return dict(sorted(Counter(str(row.get(field) or "none") for row in output).items()))

    coverage = source_coverage or {
        "clicks": "provided",
        "crm": "provided",
        "sales": "provided",
    }
    unavailable = [
        name for name, status in coverage.items() if status in {"skipped_unavailable", "empty_or_unavailable"}
    ]

    return {
        "schema_version": 2,
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
        "input_counts": {
            "evolution_leads": len(leads),
            "site_clicks": len(clicks),
            "crm_rows": len(crm_rows),
            "sales_rows": len(sales_rows),
        },
        "output_count": len(output),
        "source_coverage": coverage,
        "coverage_is_partial": bool(unavailable),
        "coverage_limitations": [
            f"{name} indisponivel; nenhum match dessa etapa foi inferido"
            for name in unavailable
        ],
        "matches": {
            "click_method": counts("click_match_method"),
            "click_confidence": counts("click_match_confidence"),
            "crm_method": counts("crm_match_method"),
            "crm_confidence": counts("crm_match_confidence"),
            "sale_method": counts("sale_match_method"),
            "sale_confidence": counts("sale_match_confidence"),
            "overall_confidence": counts("confidence"),
        },
        "matched_totals": {
            "click": sum(1 for row in output if row.get("click_match_confidence") != "none"),
            "crm": sum(1 for row in output if row.get("crm_matched") == "1"),
            "sale": sum(1 for row in output if row.get("virou_venda") == "1"),
        },
        "confirmed_conversion_export": {
            "rows": sum(1 for row in output if row.get("virou_venda") == "1"),
            "ready_with_ad_id": sum(
                1
                for row in confirmed_conversions(output)
                if row["export_status"] == "ready_with_ad_id"
            ),
            "automatic_upload": False,
        },
        "windows": {
            "click_hours": CLICK_WINDOW_HOURS,
            "click_future_skew_minutes": CLICK_FUTURE_SKEW_MINUTES,
            "crm_days": CRM_WINDOW_DAYS,
            "sale_days": SALE_WINDOW_DAYS,
        },
        "privacy": {
            "contains_pii": True,
            "summary_contains_raw_pii": False,
            "summary_is_pseudonymized_aggregate": True,
            "detail_pii_fields": [
                "telefone",
                "jid",
                "nome_whatsapp",
                "primeira_msg",
                "salesperson",
            ],
            "access_control": "arquivos locais do proprietario; permissoes 0600",
            "retention_days": RETENTION_DAYS,
        },
    }


def parser() -> argparse.ArgumentParser:
    value = argparse.ArgumentParser(description=__doc__)
    value.add_argument("--evolution-csv", type=Path, default=DEFAULT_EVOLUTION_CSV)
    value.add_argument("--click-log", type=Path, default=DEFAULT_CLICK_LOG)
    value.add_argument("--crm-csv", type=Path)
    value.add_argument("--sales-csv", type=Path)
    value.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_CSV)
    value.add_argument("--audit-output", type=Path, default=DEFAULT_AUDIT_JSON)
    value.add_argument(
        "--confirmed-conversions-output",
        type=Path,
        default=DEFAULT_CONFIRMED_CONVERSIONS_CSV,
    )
    value.add_argument(
        "--skip-databases",
        action="store_true",
        help="nao consulta CRM/ERP; use com snapshots sinteticos ou auditoria parcial",
    )
    value.add_argument(
        "--skip-crm",
        action="store_true",
        help="nao consulta CRM quando nenhum snapshot CRM foi fornecido",
    )
    value.add_argument(
        "--skip-sales",
        action="store_true",
        help="nao consulta ERP/vendas quando nenhum snapshot foi fornecido",
    )
    value.add_argument(
        "--allow-missing-click-log",
        action="store_true",
        help="permite gerar relatorio sem o log de cliques",
    )
    return value


def main(argv: Sequence[str] | None = None) -> int:
    args = parser().parse_args(argv)
    leads = load_csv(args.evolution_csv.resolve())
    if args.click_log.exists():
        clicks = load_jsonl(args.click_log.resolve())
    elif args.allow_missing_click_log:
        clicks = []
    else:
        raise FileNotFoundError(f"arquivo ausente: {args.click_log}")

    skip_crm = args.skip_databases or args.skip_crm
    skip_sales = args.skip_databases or args.skip_sales

    if args.crm_csv:
        crm_rows = load_csv(args.crm_csv.resolve())
        crm_coverage = "snapshot"
    elif skip_crm:
        crm_rows = []
        crm_coverage = "skipped_unavailable"
    else:
        crm_rows = fetch_crm_rows()
        crm_coverage = "live_database"

    if args.sales_csv:
        sales_rows = load_csv(args.sales_csv.resolve())
        sales_coverage = "snapshot"
    elif skip_sales:
        sales_rows = []
        sales_coverage = "skipped_unavailable"
    else:
        sales_rows = fetch_sales_rows()
        sales_coverage = "live_database"

    output = enrich_rows(leads, clicks, crm_rows, sales_rows)
    write_csv_atomic(args.output.resolve(), output, PREFERRED_FIELDS)
    conversions = confirmed_conversions(output)
    write_csv_atomic(
        args.confirmed_conversions_output.resolve(),
        conversions,
        CONFIRMED_CONVERSION_FIELDS,
    )
    audit = build_audit(
        leads,
        clicks,
        crm_rows,
        sales_rows,
        output,
        {
            "clicks": "jsonl" if clicks else "empty_or_unavailable",
            "crm": crm_coverage,
            "sales": sales_coverage,
        },
    )
    atomic_write_json(args.audit_output.resolve(), audit, indent=2)
    print(
        f"leads: {len(leads)} | cliques: {len(clicks)} | CRM: {len(crm_rows)} | "
        f"vendas: {len(sales_rows)} | saida: {args.output.resolve()} | "
        f"auditoria: {args.audit_output.resolve()} | "
        f"conversoes confirmadas: {args.confirmed_conversions_output.resolve()}"
    )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ConfigError, FileNotFoundError, RuntimeError, ValueError) as exc:
        print(f"erro: {redact_text(exc)}", file=sys.stderr)
        sys.exit(1)
