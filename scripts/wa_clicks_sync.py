#!/usr/bin/env python3
"""Sincroniza, deduplica e aplica retencao ao log proprio de cliques WhatsApp."""

from __future__ import annotations

import datetime as dt
import json
import os
import re
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

from offline_config import (
    ConfigError,
    atomic_write_json,
    chmod_private,
    env_int,
    env_bool,
    load_env_file,
    private_path,
    redact_text,
    required_env,
    service_url,
)


load_env_file()
BASE_URL = service_url(
    "WA_LOG_BASE_URL", allow_insecure_flag="WA_LOG_ALLOW_INSECURE_HTTP"
)
TOKEN = required_env("WA_LOG_TOKEN")
OUT = private_path("ATTRIBUTION_CLICK_LOG_PATH", "wa_clicks_log.jsonl")
STATE = private_path("WA_LOG_STATE_PATH", "wa_clicks_state.json")
RETENTION_DAYS = env_int("ATTRIBUTION_RETENTION_DAYS", 365, minimum=1)
SOURCE_TIMEZONE = ZoneInfo(
    os.environ.get("ATTRIBUTION_SOURCE_TIMEZONE", "America/Sao_Paulo").strip()
)
SECRET_FIELD_RE = re.compile(
    r"(?:token|secret|password|passwd|api_?key|authorization)", re.I
)


def parse_time(record: dict) -> dt.datetime | None:
    iso_candidates = []
    for field in ("ts", "timestamp", "event_ts", "created_at", "dt", "datetime"):
        raw = record.get(field)
        if raw in (None, ""):
            continue
        try:
            numeric = float(raw)
            if numeric > 10_000_000_000:
                numeric /= 1000
            return dt.datetime.fromtimestamp(numeric, dt.timezone.utc)
        except (TypeError, ValueError, OverflowError):
            iso_candidates.append(str(raw).strip())
    for raw_dt in iso_candidates:
        try:
            parsed = dt.datetime.fromisoformat(raw_dt.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=SOURCE_TIMEZONE)
            return parsed.astimezone(dt.timezone.utc)
        except ValueError:
            continue
    return None


def normalize_record(record: dict) -> dict:
    normalized = {
        str(key): value
        for key, value in record.items()
        if not SECRET_FIELD_RE.search(str(key))
    }
    click_id = str(record.get("click_id") or record.get("clickId") or "").strip().lower()
    wa_ref = str(
        record.get("wa_ref") or record.get("waRef") or record.get("code") or ""
    ).strip().upper()
    if click_id:
        normalized["click_id"] = click_id
    if wa_ref:
        normalized["wa_ref"] = wa_ref
        normalized.setdefault("code", wa_ref)
    aliases = {
        "landingPage": "landing_page",
        "vehicleId": "vehicle_id",
        "vehicleName": "vehicle_name",
        "utmSource": "utm_source",
        "utmMedium": "utm_medium",
        "utmCampaign": "utm_campaign",
        "utmContent": "utm_content",
        "utmTerm": "utm_term",
        "trafficSource": "traffic_source",
        "waIntent": "intent",
    }
    for source, destination in aliases.items():
        if record.get(source) not in (None, "") and not normalized.get(destination):
            normalized[destination] = record[source]
    return normalized


def record_key(record: dict) -> tuple[str, ...]:
    click_id = str(record.get("click_id") or "").strip()
    if click_id:
        return ("click_id", click_id)
    return (
        "wa_ref_time",
        str(record.get("wa_ref") or record.get("code") or ""),
        str(record.get("ts") or record.get("timestamp") or ""),
        str(record.get("dt") or record.get("datetime") or ""),
    )


def read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    rows: list[dict] = []
    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as exc:
                raise RuntimeError(
                    f"JSONL invalido em {path.name}:{line_number}"
                ) from exc
            if isinstance(value, dict):
                rows.append(normalize_record(value))
    return rows


def atomic_write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            for row in rows:
                handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
        os.chmod(temp_name, 0o600)
        os.replace(temp_name, path)
        chmod_private(path)
    except Exception:
        try:
            os.unlink(temp_name)
        except OSError:
            pass
        raise


def download(since: str) -> list[dict]:
    query = {}
    if since:
        query["since"] = since
    headers = {
        "Accept": "application/x-ndjson, application/json, text/plain",
        "Authorization": f"Bearer {TOKEN}",
        "X-WA-Log-Token": TOKEN,
    }

    def fetch(include_query_token: bool) -> str:
        request_query = dict(query)
        if include_query_token:
            request_query["token"] = TOKEN
        suffix = f"?{urllib.parse.urlencode(request_query)}" if request_query else ""
        request = urllib.request.Request(f"{BASE_URL}/{suffix}", headers=headers)
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.read().decode("utf-8", "replace")

    try:
        body = fetch(False)
    except urllib.error.HTTPError as exc:
        if exc.code not in (401, 403) or not env_bool(
            "WA_LOG_ALLOW_QUERY_TOKEN", default=False
        ):
            raise
        body = fetch(True)

    rows: list[dict] = []
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        payload = None
    if isinstance(payload, list):
        return [normalize_record(value) for value in payload if isinstance(value, dict)]
    if isinstance(payload, dict):
        nested = payload.get("data")
        if isinstance(nested, list):
            return [normalize_record(value) for value in nested if isinstance(value, dict)]
        return [normalize_record(payload)]

    for line_number, line in enumerate(body.splitlines(), start=1):
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                f"servidor retornou JSON invalido na linha {line_number}"
            ) from exc
        if isinstance(value, dict):
            rows.append(normalize_record(value))
    return rows


def main() -> None:
    since = ""
    if STATE.exists():
        state = json.loads(STATE.read_text(encoding="utf-8"))
        since = str(state.get("last_dt") or "")[:10]
        if since:
            since_date = dt.date.fromisoformat(since) - dt.timedelta(days=1)
            since = since_date.isoformat()

    incoming = download(since)
    existing = read_jsonl(OUT)
    combined: dict[tuple[str, ...], dict] = {
        record_key(record): record for record in existing
    }
    before = len(combined)
    for record in incoming:
        combined[record_key(record)] = record

    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=RETENTION_DAYS)
    retained = []
    for record in combined.values():
        record_time = parse_time(record)
        if record_time is not None and record_time >= cutoff:
            retained.append(record)
    retained.sort(
        key=lambda record: parse_time(record)
        or dt.datetime.min.replace(tzinfo=dt.timezone.utc)
    )
    atomic_write_jsonl(OUT, retained)

    dated = [parse_time(record) for record in incoming]
    dated = [value for value in dated if value is not None]
    if dated:
        atomic_write_json(
            STATE,
            {"last_dt": max(dated).isoformat().replace("+00:00", "Z")},
        )

    print(
        "cliques recebidos: "
        f"{len(incoming)} | novos/atualizados: {max(0, len(combined) - before)} | "
        f"retidos: {len(retained)} | arquivo: {OUT}"
    )


if __name__ == "__main__":
    try:
        main()
    except (ConfigError, urllib.error.URLError, json.JSONDecodeError, RuntimeError) as exc:
        print(f"erro: {redact_text(exc)}", file=sys.stderr)
        sys.exit(1)
