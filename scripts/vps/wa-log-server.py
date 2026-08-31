#!/usr/bin/env python3
"""Coletor mínimo de atribuição do clique para WhatsApp, sem PII.

Este arquivo é a fonte versionada de ``/opt/wa-log/server.py``. O token vem
exclusivamente do ambiente do container.
"""

from __future__ import annotations

import hmac
import json
import os
import re
import threading
import time
from collections import deque
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse


TOKEN = os.environ.get("WA_LOG_TOKEN", "")
DATA = os.environ.get("WA_LOG_DATA_PATH", "/data/clicks.jsonl")
PORT = int(os.environ.get("WA_LOG_PORT", "8099"))
ALLOW_QUERY_TOKEN = os.environ.get("WA_LOG_ALLOW_QUERY_TOKEN", "0").lower() in {
    "1",
    "true",
    "yes",
    "on",
}

CROCKFORD_7 = r"[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{7}"
WA_REF = re.compile(
    rf"^[MGODSRU](?:{CROCKFORD_7}|\d{{1,5}}|[A-Z2-9]{{4}})$",
    re.IGNORECASE,
)
CLICK_ID = re.compile(r"^nc_[a-f0-9]{32}$", re.IGNORECASE)
LOCK = threading.Lock()
ALLOWED = {
    "https://www.netcarmultimarcas.com.br",
    "https://netcarmultimarcas.com.br",
}


def clean(value: object, max_length: int) -> str:
    return re.sub(r"[\x00-\x1f\x7f]", "", str(value or "")).strip()[:max_length]


def first(body: dict, *names: str) -> object:
    for name in names:
        value = body.get(name)
        if value not in (None, ""):
            return value
    return ""


def normalized_wa_ref(body: dict) -> str:
    explicit = clean(first(body, "wa_ref", "waRef"), 8).upper()
    legacy = clean(body.get("code"), 8).upper()
    if explicit and legacy and explicit != legacy:
        raise ValueError("code e wa_ref divergentes")
    value = explicit or legacy
    if not WA_REF.fullmatch(value):
        raise ValueError("wa_ref inválido")
    return value


def normalized_click_id(body: dict) -> str:
    value = clean(first(body, "click_id", "clickId"), 35).lower()
    if value and not CLICK_ID.fullmatch(value):
        raise ValueError("click_id inválido")
    return value


def client_timestamp(body: dict, now: int) -> int:
    try:
        value = int(body.get("ts") or now)
    except (TypeError, ValueError):
        value = now
    if abs(value - now) > 7 * 24 * 60 * 60:
        return now
    return value


def build_record(body: dict, *, now: int | None = None) -> dict:
    """Valida o contrato público e conserva somente contexto comercial."""
    current = int(time.time()) if now is None else now
    wa_ref = normalized_wa_ref(body)
    click_id = normalized_click_id(body)
    timestamp = client_timestamp(body, current)

    record = {
        "dt": datetime.fromtimestamp(current, timezone.utc).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        ),
        "code": wa_ref,
        "wa_ref": wa_ref,
        "click_id": click_id,
        "src": clean(first(body, "src", "traffic_source"), 24),
        "campaign": clean(first(body, "campaign", "traffic_campaign"), 120),
        "gclid": clean(first(body, "gclid", "traffic_gclid"), 180),
        "gbraid": clean(first(body, "gbraid", "traffic_gbraid"), 180),
        "wbraid": clean(first(body, "wbraid", "traffic_wbraid"), 180),
        "fbclid": clean(first(body, "fbclid", "traffic_fbclid"), 240),
        "utm_source": clean(
            first(body, "utm_source", "traffic_utm_source"), 100
        ),
        "utm_medium": clean(first(body, "utm_medium", "traffic_medium"), 100),
        "utm_content": clean(
            first(body, "utm_content", "traffic_content"), 180
        ),
        "utm_term": clean(first(body, "utm_term", "traffic_utm_term"), 180),
        "landing_page": clean(
            first(body, "landing_page", "traffic_landing_page"), 500
        ),
        "referrer": clean(first(body, "referrer", "traffic_referrer"), 500),
        "page": clean(first(body, "page", "page_path"), 300),
        "event_name": clean(body.get("event_name"), 60),
        "wa_event_id": clean(body.get("wa_event_id"), 80),
        "wa_source": clean(body.get("wa_source"), 80),
        "wa_source_raw": clean(body.get("wa_source_raw"), 100),
        "wa_intent": clean(first(body, "wa_intent", "intent"), 80),
        "wa_intent_raw": clean(body.get("wa_intent_raw"), 100),
        "wa_conversion": clean(body.get("wa_conversion"), 40),
        "wa_vehicle_id": clean(first(body, "wa_vehicle_id", "vehicle_id"), 40),
        "wa_vehicle_name": clean(
            first(body, "wa_vehicle_name", "vehicle_name"), 180
        ),
        "wa_page_type": clean(body.get("wa_page_type"), 60),
        "page_path": clean(first(body, "page_path", "page"), 300),
        "regional_city_slug": clean(body.get("regional_city_slug"), 100),
        "landing_slug": clean(body.get("landing_slug"), 120),
        "landing_type": clean(body.get("landing_type"), 60),
        "privacy_consent": clean(body.get("privacy_consent"), 20),
        "gbp_profile": clean(body.get("gbp_profile"), 40),
        "ts": timestamp,
    }
    return record


def dedupe_key(record: dict) -> tuple[str, str]:
    click_id = str(record.get("click_id") or "")
    return ("click_id", click_id) if click_id else ("wa_ref", record["wa_ref"])


def recent_identities() -> dict[tuple[str, str], int]:
    seen: dict[tuple[str, str], int] = {}
    if not os.path.exists(DATA):
        return seen
    with open(DATA, encoding="utf-8") as stream:
        for line in deque(stream, maxlen=10_000):
            try:
                row = json.loads(line)
                wa_ref = clean(first(row, "wa_ref", "code"), 8).upper()
                click_id = clean(first(row, "click_id", "clickId"), 35).lower()
                key = ("click_id", click_id) if click_id else ("wa_ref", wa_ref)
                seen[key] = int(row.get("ts") or 0)
            except (json.JSONDecodeError, KeyError, TypeError, ValueError):
                continue
    return seen


SEEN = recent_identities()


def supplied_token(handler: BaseHTTPRequestHandler, query: dict) -> str:
    authorization = handler.headers.get("Authorization", "")
    if authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    header_token = handler.headers.get("X-WA-Log-Token", "").strip()
    if header_token:
        return header_token
    if ALLOW_QUERY_TOKEN:
        return str((query.get("token") or [""])[0])
    return ""


def token_is_valid(supplied: str) -> bool:
    return bool(TOKEN and supplied and hmac.compare_digest(supplied, TOKEN))


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def _cors(self):
        origin = self.headers.get("Origin", "")
        if origin in ALLOWED:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Credentials", "true")
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
            self.send_header(
                "Access-Control-Allow-Headers",
                "Content-Type, Authorization, X-WA-Log-Token",
            )
            self.send_header("Access-Control-Max-Age", "86400")

    def _finish(self, status: int):
        self.send_response(status)
        self._cors()
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def do_OPTIONS(self):
        if self.headers.get("Origin", "") not in ALLOWED:
            self._finish(403)
            return
        self._finish(204)

    def do_POST(self):
        try:
            if self.headers.get("Origin", "") not in ALLOWED:
                self._finish(403)
                return
            length = int(self.headers.get("Content-Length") or 0)
            if length <= 0 or length > 16_384:
                self._finish(400)
                return
            body = json.loads(self.rfile.read(length) or b"{}")
            if not isinstance(body, dict):
                self._finish(400)
                return
            record = build_record(body)
            key = dedupe_key(record)
            with LOCK:
                previous_ts = SEEN.get(key, 0)
                if previous_ts and abs(record["ts"] - previous_ts) <= 10:
                    self._finish(204)
                    return
                with open(DATA, "a", encoding="utf-8") as stream:
                    stream.write(json.dumps(record, ensure_ascii=False) + "\n")
                SEEN[key] = record["ts"]
            self._finish(204)
        except ValueError:
            self._finish(422)
        except Exception:
            self._finish(400)

    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        if not token_is_valid(supplied_token(self, query)):
            self._finish(403)
            return
        since = str((query.get("since") or [""])[0])[:10]
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/x-ndjson; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if not os.path.exists(DATA):
            return
        with LOCK, open(DATA, encoding="utf-8") as stream:
            for line in stream:
                if since:
                    try:
                        if json.loads(line).get("dt", "")[:10] < since:
                            continue
                    except json.JSONDecodeError:
                        continue
                self.wfile.write(line.encode("utf-8"))


def serve() -> None:
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()


if __name__ == "__main__":
    serve()
