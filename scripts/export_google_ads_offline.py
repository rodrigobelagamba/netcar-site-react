#!/usr/bin/env python3
"""Gera um lote revisavel de conversoes offline para o Google Ads Data Manager.

O script e deliberadamente offline: le o CSV enriquecido, seleciona apenas
vendas confirmadas com correspondencia forte e grava arquivos locais. Ele nao
autentica e nao envia nada ao Google Ads.

Seguranca e idempotencia:
- somente uma lista fechada de campos, sem telefone, email, nome ou JID, sai;
- ``Order ID`` e um hash deterministico, nunca um identificador bruto do CRM;
- reprocessar a mesma entrada produz as mesmas linhas e os mesmos Order IDs;
- um ledger opcional exclui somente conversoes que o operador ja confirmou
  como importadas no Google Ads;
- conflitos e linhas invalidas vao para um CSV de rejeicoes sem dados brutos.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import io
import json
import os
import re
import sys
import tempfile
import unicodedata
from collections import Counter
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from typing import Iterable, Sequence
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


READY_HEADERS = (
    "Conversion action",
    "Conversion date and time",
    "Conversion value",
    "Currency",
    "Order ID",
    "Event source",
    "GCLID",
    "GBRAID",
    "WBRAID",
)

REJECTED_HEADERS = ("source_row", "record_fingerprint", "reason")
CONFIRMED_FIELD_CANDIDATES = ("virou_venda", "sale_confirmed", "confirmed_sale")
SALE_DATE_CANDIDATES = (
    "data_venda",
    "sale_date",
    "sold_at",
    "conversion_date_time",
)
SALE_VALUE_CANDIDATES = ("valor_venda", "sale_value", "valorvenda", "conversion_value")
STABLE_ID_CANDIDATES = (
    "sale_id",
    "id_venda",
    "codvenda",
    "attribution_id",
    "crm_business_id",
    "click_id",
    "wa_ref",
)
TRUTHY_DEFAULT = frozenset({"1", "true", "yes", "sim", "sold", "sale", "venda"})
EVENT_SOURCES = ("WEB", "APP", "IN_STORE", "PHONE", "OTHER")
APPROVED_SALE_MATCH_CONFIDENCES = frozenset({"high", "medium"})
# Lista fechada: somente chaves de negocio/cliente/venda com igualdade exata ou
# cliente unico dentro da janela temporal podem liberar uma venda para importacao.
# Fallback por telefone nunca e prova suficiente para atribuir receita a um clique.
APPROVED_SALE_MATCH_METHODS = frozenset(
    {
        "business_id_exact",
        "crm_business_id_exact",
        "deal_id_exact",
        "negocio_id_exact",
        "sale_id_exact",
        "id_venda_exact",
        "transaction_id_exact",
        "order_id_exact",
        "customer_id_time",
    }
)
EMAIL_RE = re.compile(r"(?i)[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}")
E164_RE = re.compile(r"^\+?\d{10,15}$")
CONTROL_RE = re.compile(r"[\x00-\x1f\x7f]")
URL_IDENTIFIER_RE = re.compile(r"^[A-Za-z0-9._~-]{1,2048}$")


class ExportError(RuntimeError):
    """Erro de configuracao ou estrutura da entrada."""


class RowRejected(ValueError):
    """Linha individual que nao pode entrar no lote."""


@dataclass(frozen=True)
class Candidate:
    source_row: int
    fingerprint: str
    values: tuple[str, ...]
    timestamp: dt.datetime
    timestamp_precision: str

    @property
    def transaction_id(self) -> str:
        return self.values[READY_HEADERS.index("Order ID")]

    def as_dict(self) -> dict[str, str]:
        return dict(zip(READY_HEADERS, self.values))


@dataclass(frozen=True)
class ExportSummary:
    input_rows: int
    confirmed_rows: int
    ready_rows: int
    rejected_rows: int
    skipped_not_confirmed: int
    skipped_already_applied: int
    exact_duplicates: int
    braid_rows: int
    recent_rows_under_24h: int
    assumed_date_only_time_rows: int
    rejection_reasons: dict[str, int]
    batch_id: str
    output_dir: str


def normalized_key(value: object) -> str:
    raw = unicodedata.normalize("NFKD", str(value or ""))
    ascii_text = raw.encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9]+", "_", ascii_text).strip("_")


def normalize_row(row: dict[str, object]) -> dict[str, str]:
    normalized: dict[str, str] = {}
    for key, value in row.items():
        name = normalized_key(key)
        if name:
            normalized[name] = str(value or "").strip()
    return normalized


def first_value(row: dict[str, str], names: Iterable[str]) -> str:
    for name in names:
        value = row.get(normalized_key(name), "").strip()
        if value:
            return value
    return ""


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def record_fingerprint(row: dict[str, str]) -> str:
    serialized = json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return "rec_" + hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:20]


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    if not path.is_file():
        raise ExportError(f"CSV de entrada nao encontrado: {path}")
    text = path.read_text(encoding="utf-8-sig")
    if not text.strip():
        raise ExportError("CSV de entrada vazio")
    sample = text[:8192]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    if not reader.fieldnames:
        raise ExportError("CSV sem cabecalho")
    normalized_headers = [normalized_key(value) for value in reader.fieldnames]
    rows = [normalize_row(row) for row in reader]
    return normalized_headers, rows


def parse_confirmation_values(raw: str) -> frozenset[str]:
    values = {value.strip().lower() for value in raw.split(",") if value.strip()}
    if not values:
        raise ExportError("--confirmed-values nao pode ficar vazio")
    return frozenset(values)


def resolve_confirmation_field(headers: Sequence[str], configured: str | None) -> str:
    if configured:
        field = normalized_key(configured)
        if field not in headers:
            raise ExportError(f"campo de confirmacao ausente: {configured}")
        return field
    for candidate in CONFIRMED_FIELD_CANDIDATES:
        if candidate in headers:
            return candidate
    raise ExportError(
        "CSV sem campo de venda confirmada; use --confirmed-field explicitamente"
    )


def parse_decimal(raw: str) -> Decimal:
    value = raw.strip()
    if not value:
        raise RowRejected("missing_conversion_value")
    value = re.sub(r"(?i)(?:\bBRL\b|R\$)", "", value).replace(" ", "")
    if not value:
        raise RowRejected("invalid_conversion_value")

    if "," in value and "." in value:
        if value.rfind(",") > value.rfind("."):
            value = value.replace(".", "").replace(",", ".")
        else:
            value = value.replace(",", "")
    elif "," in value:
        value = value.replace(".", "").replace(",", ".")
    elif re.fullmatch(r"-?\d{1,3}(?:\.\d{3})+", value):
        value = value.replace(".", "")

    try:
        amount = Decimal(value)
    except InvalidOperation as exc:
        raise RowRejected("invalid_conversion_value") from exc
    if not amount.is_finite() or amount < 0:
        raise RowRejected("invalid_conversion_value")
    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def parse_local_time(value: str) -> dt.time:
    try:
        parsed = dt.time.fromisoformat(value)
    except ValueError as exc:
        raise ExportError("--date-only-time deve usar HH:MM ou HH:MM:SS") from exc
    if parsed.tzinfo is not None:
        raise ExportError("--date-only-time nao deve conter fuso")
    return parsed.replace(microsecond=0)


def parse_timestamp(
    raw: str,
    timezone: ZoneInfo,
    date_only_time: dt.time,
) -> tuple[dt.datetime, str]:
    value = raw.strip()
    if not value:
        raise RowRejected("missing_conversion_time")

    iso_value = value[:-1] + "+00:00" if value.endswith(("Z", "z")) else value
    parsed: dt.datetime | None = None
    precision = "datetime"
    try:
        parsed = dt.datetime.fromisoformat(iso_value)
    except ValueError:
        parsed = None

    if parsed is None:
        date_formats = ("%d/%m/%Y", "%Y/%m/%d", "%d-%m-%Y")
        datetime_formats = (
            "%d/%m/%Y %H:%M:%S",
            "%d/%m/%Y %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%d-%m-%Y %H:%M:%S",
            "%d-%m-%Y %H:%M",
        )
        for fmt in datetime_formats:
            try:
                parsed = dt.datetime.strptime(value, fmt)
                break
            except ValueError:
                continue
        if parsed is None:
            for fmt in date_formats:
                try:
                    parsed_date = dt.datetime.strptime(value, fmt).date()
                    parsed = dt.datetime.combine(parsed_date, date_only_time)
                    precision = "date_only_assumed_time"
                    break
                except ValueError:
                    continue
    elif "T" not in value and " " not in value:
        parsed = dt.datetime.combine(parsed.date(), date_only_time)
        precision = "date_only_assumed_time"

    if parsed is None:
        raise RowRejected("invalid_conversion_time")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone)
    else:
        parsed = parsed.astimezone(timezone)
    return parsed.replace(microsecond=0), precision


def safe_click_identifier(value: str, field: str) -> str:
    identifier = value.strip()
    if not identifier:
        return ""
    # Click IDs chegam como valores de parametro de URL e devem permanecer
    # exatamente como recebidos. Aceitar somente caracteres URL-safe impede que
    # uma coluna mapeada por engano exporte telefone formatado, email ou formula
    # de planilha como se fosse identificador de anuncio.
    if EMAIL_RE.search(identifier) or E164_RE.fullmatch(identifier):
        raise RowRejected("identifier_looks_like_pii")
    if CONTROL_RE.search(identifier) or not URL_IDENTIFIER_RE.fullmatch(identifier):
        raise RowRejected(f"invalid_{field.lower()}")
    return identifier


def validate_action_name(value: str) -> str:
    action = value.strip()
    if not action:
        raise ExportError("informe --conversion-action ou GOOGLE_ADS_CONVERSION_ACTION")
    if CONTROL_RE.search(action) or EMAIL_RE.search(action) or E164_RE.fullmatch(action):
        raise ExportError("nome da acao de conversao invalido")
    return action


def validate_sale_match_evidence(row: dict[str, str]) -> None:
    """Exige evidencia forte antes de marcar uma venda como pronta.

    Arquivos antigos que nao possuem os campos de auditoria sao mantidos fora
    do lote pronto. O operador ainda os encontra no CSV de rejeicoes/revisao,
    sem que o exportador tente inferir uma correspondencia retroativamente.
    """

    confidence = row.get("sale_match_confidence", "").strip().lower()
    method = row.get("sale_match_method", "").strip().lower()
    if not confidence or not method:
        raise RowRejected("missing_sale_match_evidence")
    if confidence not in APPROVED_SALE_MATCH_CONFIDENCES:
        raise RowRejected("sale_match_confidence_not_approved")
    if method not in APPROVED_SALE_MATCH_METHODS:
        raise RowRejected("sale_match_method_not_approved")


def transaction_id(
    row: dict[str, str],
    conversion_action: str,
    conversion_time: dt.datetime,
    identifiers: Sequence[str],
) -> str:
    stable = first_value(row, STABLE_ID_CANDIDATES)
    if stable:
        material = f"netcar-google-ads|{conversion_action}|stable|{stable}"
    else:
        joined_identifiers = "|".join(identifier for identifier in identifiers if identifier)
        if not joined_identifiers:
            raise RowRejected("missing_stable_identity")
        material = (
            f"netcar-google-ads|{conversion_action}|fallback|"
            f"{joined_identifiers}|{conversion_time.isoformat()}"
        )
    return "nc_" + hashlib.sha256(material.encode("utf-8")).hexdigest()[:32]


def make_candidate(
    row: dict[str, str],
    source_row: int,
    *,
    conversion_action: str,
    currency: str,
    event_source: str,
    timezone: ZoneInfo,
    date_only_time: dt.time,
    as_of: dt.datetime,
    max_age_days: int,
    allow_missing_value: bool,
) -> Candidate:
    fingerprint = record_fingerprint(row)
    validate_sale_match_evidence(row)
    gclid = safe_click_identifier(row.get("gclid", ""), "gclid")
    gbraid = safe_click_identifier(row.get("gbraid", ""), "gbraid")
    wbraid = safe_click_identifier(row.get("wbraid", ""), "wbraid")
    if not any((gclid, gbraid, wbraid)):
        raise RowRejected("missing_google_click_identifier")
    if gbraid and wbraid:
        raise RowRejected("gbraid_wbraid_both_set")

    timestamp_raw = first_value(row, SALE_DATE_CANDIDATES)
    conversion_time, timestamp_precision = parse_timestamp(
        timestamp_raw, timezone, date_only_time
    )
    if conversion_time.date() > as_of.date():
        raise RowRejected("future_conversion_time")
    if (as_of.date() - conversion_time.date()).days > max_age_days:
        raise RowRejected("conversion_older_than_import_window")

    value_raw = first_value(row, SALE_VALUE_CANDIDATES)
    if value_raw:
        value = f"{parse_decimal(value_raw):.2f}"
    elif allow_missing_value:
        value = ""
    else:
        raise RowRejected("missing_conversion_value")

    order_id = transaction_id(
        row, conversion_action, conversion_time, (gclid, gbraid, wbraid)
    )
    values = (
        conversion_action,
        conversion_time.isoformat(timespec="seconds"),
        value,
        currency,
        order_id,
        event_source,
        gclid,
        gbraid,
        wbraid,
    )
    return Candidate(
        source_row=source_row,
        fingerprint=fingerprint,
        values=values,
        timestamp=conversion_time,
        timestamp_precision=timestamp_precision,
    )


def read_ledger(path: Path | None) -> set[str]:
    if path is None:
        return set()
    if not path.exists():
        return set()
    ids: set[str] = set()
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if not re.fullmatch(r"nc_[0-9a-f]{32}", line):
            raise ExportError(f"ledger possui Order ID invalido: linha nao reconhecida")
        ids.add(line)
    return ids


def csv_bytes(headers: Sequence[str], rows: Iterable[Sequence[object]]) -> bytes:
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(headers)
    writer.writerows(rows)
    return buffer.getvalue().encode("utf-8")


def atomic_write(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
        path.chmod(0o600)
    except Exception:
        try:
            os.unlink(temporary)
        except OSError:
            pass
        raise


def export_batch(
    *,
    input_path: Path,
    output_dir: Path,
    conversion_action: str,
    timezone: ZoneInfo,
    currency: str,
    event_source: str,
    confirmation_field: str | None,
    confirmed_values: frozenset[str],
    date_only_time: dt.time,
    max_age_days: int,
    allow_missing_value: bool,
    applied_ledger: Path | None,
    as_of: dt.datetime,
) -> ExportSummary:
    headers, rows = read_csv(input_path)
    confirmed_field = resolve_confirmation_field(headers, confirmation_field)
    applied_ids = read_ledger(applied_ledger)

    accepted: dict[str, Candidate] = {}
    conflicted_ids: set[str] = set()
    rejected: list[tuple[int, str, str]] = []
    rejection_reasons: Counter[str] = Counter()
    confirmed_rows = 0
    skipped_not_confirmed = 0
    skipped_already_applied = 0
    exact_duplicates = 0

    def reject(candidate_row: int, fingerprint: str, reason: str) -> None:
        rejected.append((candidate_row, fingerprint, reason))
        rejection_reasons[reason] += 1

    for source_row, row in enumerate(rows, start=2):
        if row.get(confirmed_field, "").strip().lower() not in confirmed_values:
            skipped_not_confirmed += 1
            continue
        confirmed_rows += 1
        fingerprint = record_fingerprint(row)
        try:
            candidate = make_candidate(
                row,
                source_row,
                conversion_action=conversion_action,
                currency=currency,
                event_source=event_source,
                timezone=timezone,
                date_only_time=date_only_time,
                as_of=as_of,
                max_age_days=max_age_days,
                allow_missing_value=allow_missing_value,
            )
        except RowRejected as exc:
            reject(source_row, fingerprint, str(exc))
            continue

        if candidate.transaction_id in applied_ids:
            skipped_already_applied += 1
            continue
        if candidate.transaction_id in conflicted_ids:
            reject(source_row, fingerprint, "duplicate_transaction_conflict")
            continue
        previous = accepted.get(candidate.transaction_id)
        if previous is None:
            accepted[candidate.transaction_id] = candidate
            continue
        if previous.values == candidate.values:
            exact_duplicates += 1
            reject(source_row, fingerprint, "duplicate_identical")
            continue

        del accepted[candidate.transaction_id]
        conflicted_ids.add(candidate.transaction_id)
        reject(
            previous.source_row,
            previous.fingerprint,
            "duplicate_transaction_conflict",
        )
        reject(source_row, fingerprint, "duplicate_transaction_conflict")

    ready = sorted(
        accepted.values(),
        key=lambda candidate: (candidate.timestamp, candidate.transaction_id),
    )
    rejected.sort(key=lambda item: (item[0], item[2]))
    ready_payload = csv_bytes(READY_HEADERS, (candidate.values for candidate in ready))
    rejected_payload = csv_bytes(REJECTED_HEADERS, rejected)
    batch_id = "gads_" + hashlib.sha256(ready_payload).hexdigest()[:20]

    ready_path = output_dir / "google_ads_offline_ready.csv"
    rejected_path = output_dir / "google_ads_offline_rejected.csv"
    manifest_path = output_dir / "google_ads_offline_manifest.json"
    ledger_template_path = output_dir / "google_ads_offline_applied_ids.template.txt"
    atomic_write(ready_path, ready_payload)
    atomic_write(rejected_path, rejected_payload)

    ledger_lines = [
        "# Copie estes IDs para um ledger definitivo SOMENTE depois de o Google Ads",
        "# confirmar que o lote foi aplicado com sucesso. Linhas iniciadas por # sao ignoradas.",
        *(candidate.transaction_id for candidate in ready),
    ]
    atomic_write(
        ledger_template_path,
        ("\n".join(ledger_lines) + "\n").encode("utf-8"),
    )

    braid_rows = sum(
        bool(candidate.as_dict()["GBRAID"] or candidate.as_dict()["WBRAID"])
        for candidate in ready
    )
    recent_rows = sum(
        dt.timedelta(0) <= as_of - candidate.timestamp < dt.timedelta(hours=24)
        for candidate in ready
    )
    assumed_time_rows = sum(
        candidate.timestamp_precision == "date_only_assumed_time" for candidate in ready
    )

    manifest = {
        "schema_version": 1,
        "batch_id": batch_id,
        "generated_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "source_sha256": file_sha256(input_path),
        "ready_sha256": hashlib.sha256(ready_payload).hexdigest(),
        "conversion_action": conversion_action,
        "timezone": str(timezone),
        "currency": currency,
        "event_source": event_source,
        "max_age_days": max_age_days,
        "date_only_assumed_time": date_only_time.isoformat(timespec="seconds"),
        "sale_match_policy": {
            "approved_confidences": sorted(APPROVED_SALE_MATCH_CONFIDENCES),
            "approved_methods": sorted(APPROVED_SALE_MATCH_METHODS),
            "missing_evidence": "rejected",
            "phone_fallback": "rejected",
        },
        "counts": {
            "input_rows": len(rows),
            "confirmed_rows": confirmed_rows,
            "ready_rows": len(ready),
            "rejected_rows": len(rejected),
            "skipped_not_confirmed": skipped_not_confirmed,
            "skipped_already_applied": skipped_already_applied,
            "exact_duplicates": exact_duplicates,
            "braid_rows": braid_rows,
            "recent_rows_under_24h": recent_rows,
            "assumed_date_only_time_rows": assumed_time_rows,
        },
        "rejection_reasons": dict(sorted(rejection_reasons.items())),
        "contains_pii": False,
        "uploaded": False,
        "automatic_upload": False,
        "review_required": True,
    }
    atomic_write(
        manifest_path,
        (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8"),
    )

    return ExportSummary(
        input_rows=len(rows),
        confirmed_rows=confirmed_rows,
        ready_rows=len(ready),
        rejected_rows=len(rejected),
        skipped_not_confirmed=skipped_not_confirmed,
        skipped_already_applied=skipped_already_applied,
        exact_duplicates=exact_duplicates,
        braid_rows=braid_rows,
        recent_rows_under_24h=recent_rows,
        assumed_date_only_time_rows=assumed_time_rows,
        rejection_reasons=dict(sorted(rejection_reasons.items())),
        batch_id=batch_id,
        output_dir=str(output_dir.resolve()),
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Gera CSV de vendas confirmadas para revisao/importacao no Google Ads "
            "Data Manager; nunca envia dados."
        )
    )
    parser.add_argument("--input", required=True, type=Path, help="CSV enriquecido")
    parser.add_argument(
        "--output-dir",
        type=Path,
        help="diretorio de saida (padrao: <pasta-do-input>/google-ads-offline-export)",
    )
    parser.add_argument(
        "--conversion-action",
        default=os.environ.get("GOOGLE_ADS_CONVERSION_ACTION", ""),
        help="nome EXATO da acao no Google Ads",
    )
    parser.add_argument("--timezone", default="America/Sao_Paulo")
    parser.add_argument("--currency", default="BRL")
    parser.add_argument("--event-source", choices=EVENT_SOURCES, default="IN_STORE")
    parser.add_argument("--confirmed-field", help="campo que confirma a venda")
    parser.add_argument(
        "--confirmed-values",
        default=",".join(sorted(TRUTHY_DEFAULT)),
        help="valores aceitos, separados por virgula",
    )
    parser.add_argument(
        "--date-only-time",
        default="12:00:00",
        help="horario local assumido quando a venda tem apenas data",
    )
    parser.add_argument("--max-age-days", type=int, default=90)
    parser.add_argument(
        "--allow-missing-value",
        action="store_true",
        help="permite valor vazio; por padrao a linha e rejeitada",
    )
    parser.add_argument(
        "--applied-ledger",
        type=Path,
        help="arquivo de Order IDs ja confirmados como importados",
    )
    parser.add_argument(
        "--as-of",
        help="instante de referencia ISO 8601 (util para auditoria/testes)",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="retorna codigo 2 se houver rejeicoes, depois de gravar os arquivos",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        action = validate_action_name(args.conversion_action)
        currency = args.currency.strip().upper()
        if not re.fullmatch(r"[A-Z]{3}", currency):
            raise ExportError("--currency deve ser codigo ISO de 3 letras, como BRL")
        if args.max_age_days < 1:
            raise ExportError("--max-age-days deve ser >= 1")
        try:
            timezone = ZoneInfo(args.timezone)
        except ZoneInfoNotFoundError as exc:
            raise ExportError(f"fuso desconhecido: {args.timezone}") from exc
        date_only_time = parse_local_time(args.date_only_time)
        if args.as_of:
            as_of, _ = parse_timestamp(args.as_of, timezone, date_only_time)
        else:
            as_of = dt.datetime.now(timezone).replace(microsecond=0)
        output_dir = args.output_dir or args.input.parent / "google-ads-offline-export"
        summary = export_batch(
            input_path=args.input.resolve(),
            output_dir=output_dir.resolve(),
            conversion_action=action,
            timezone=timezone,
            currency=currency,
            event_source=args.event_source,
            confirmation_field=args.confirmed_field,
            confirmed_values=parse_confirmation_values(args.confirmed_values),
            date_only_time=date_only_time,
            max_age_days=args.max_age_days,
            allow_missing_value=args.allow_missing_value,
            applied_ledger=args.applied_ledger.resolve() if args.applied_ledger else None,
            as_of=as_of,
        )
    except (ExportError, RowRejected, OSError, UnicodeError, csv.Error) as exc:
        print(f"erro: {exc}", file=sys.stderr)
        return 1

    print(json.dumps(summary.__dict__, ensure_ascii=False, sort_keys=True))
    if args.strict and summary.rejected_rows:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
