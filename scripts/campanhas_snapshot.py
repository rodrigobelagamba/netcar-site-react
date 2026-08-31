#!/usr/bin/env python3
"""Snapshot privado e portavel de campanhas Meta/Google ativas."""

from __future__ import annotations

import csv
import datetime as dt
import json
import os
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request

from offline_config import (
    ConfigError,
    chmod_private,
    env_int,
    load_env_file,
    private_path,
    redact_text,
    required_env,
)


load_env_file()
OUT = private_path("CAMPAIGN_SNAPSHOT_OUTPUT_CSV", "campanhas_ativas_historico.csv")
RETENTION_DAYS = env_int("CAMPAIGN_SNAPSHOT_RETENTION_DAYS", 730, minimum=1)
META_GRAPH_VERSION = os.environ.get("META_GRAPH_VERSION", "v22.0").strip()
GOOGLE_ADS_API_VERSION = os.environ.get("GOOGLE_ADS_API_VERSION", "v22").strip()
TODAY = dt.date.today()
YESTERDAY = TODAY - dt.timedelta(days=1)
FIELDS = (
    "data",
    "plataforma",
    "id",
    "campanha",
    "status",
    "orcamento_dia",
    "gasto_ontem",
    "impressoes_ontem",
)


def _json_request(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    body: bytes | None = None,
    timeout: int = 40,
) -> object:
    request = urllib.request.Request(
        url,
        data=body,
        method="POST" if body is not None else "GET",
        headers=headers or {},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def _meta_get(path: str, params: dict[str, object], token: str) -> dict:
    query = urllib.parse.urlencode(params)
    url = f"https://graph.facebook.com/{META_GRAPH_VERSION}/{path}?{query}"
    value = _json_request(
        url,
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
    )
    if not isinstance(value, dict):
        raise RuntimeError("Meta retornou payload inesperado")
    return value


def meta_rows() -> list[dict]:
    token = required_env("META_ACCESS_TOKEN")
    account = required_env("META_AD_ACCOUNT")
    if not account.startswith("act_"):
        account = "act_" + account
    account = urllib.parse.quote(account, safe="_")
    campaigns = _meta_get(
        f"{account}/campaigns",
        {
            "fields": "id,name,status,effective_status,daily_budget",
            "limit": 500,
        },
        token,
    ).get("data", [])
    insights = _meta_get(
        f"{account}/insights",
        {
            "level": "campaign",
            "fields": "campaign_id,spend,impressions",
            "time_range": json.dumps(
                {"since": YESTERDAY.isoformat(), "until": YESTERDAY.isoformat()},
                separators=(",", ":"),
            ),
            "limit": 500,
        },
        token,
    ).get("data", [])
    insights_by_id = {
        str(row.get("campaign_id")): row
        for row in insights
        if isinstance(row, dict) and row.get("campaign_id") is not None
    }
    rows: list[dict] = []
    for campaign in campaigns:
        if not isinstance(campaign, dict):
            continue
        if campaign.get("effective_status") not in ("ACTIVE", "PAUSED"):
            continue
        campaign_id = str(campaign.get("id") or "")
        metrics = insights_by_id.get(campaign_id, {})
        rows.append(
            {
                "data": TODAY.isoformat(),
                "plataforma": "meta",
                "id": campaign_id,
                "campanha": campaign.get("name", ""),
                "status": campaign.get("effective_status", ""),
                "orcamento_dia": round(int(campaign.get("daily_budget") or 0) / 100, 2),
                "gasto_ontem": metrics.get("spend", ""),
                "impressoes_ontem": metrics.get("impressions", ""),
            }
        )
    return rows


def _google_access_token() -> str:
    form = urllib.parse.urlencode(
        {
            "client_id": required_env("GOOGLE_ADS_CLIENT_ID"),
            "client_secret": required_env("GOOGLE_ADS_CLIENT_SECRET"),
            "refresh_token": required_env("GOOGLE_ADS_REFRESH_TOKEN"),
            "grant_type": "refresh_token",
        }
    ).encode("utf-8")
    payload = _json_request(
        "https://oauth2.googleapis.com/token",
        body=form,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=30,
    )
    if not isinstance(payload, dict) or not payload.get("access_token"):
        raise RuntimeError("Google OAuth nao retornou access_token")
    return str(payload["access_token"])


def _google_search(query: str, token: str) -> list[dict]:
    customer_id = required_env("GOOGLE_ADS_CUSTOMER_ID").replace("-", "")
    headers = {
        "Authorization": f"Bearer {token}",
        "developer-token": required_env("GOOGLE_ADS_DEVELOPER_TOKEN"),
        "Content-Type": "application/json",
    }
    login_customer = os.environ.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "").replace("-", "").strip()
    if login_customer:
        headers["login-customer-id"] = login_customer
    url = (
        f"https://googleads.googleapis.com/{GOOGLE_ADS_API_VERSION}/customers/"
        f"{urllib.parse.quote(customer_id, safe='')}/googleAds:searchStream"
    )
    payload = _json_request(
        url,
        headers=headers,
        body=json.dumps({"query": query}).encode("utf-8"),
    )
    if not isinstance(payload, list):
        raise RuntimeError("Google Ads retornou payload inesperado")
    return [
        row
        for batch in payload
        if isinstance(batch, dict)
        for row in batch.get("results", [])
        if isinstance(row, dict)
    ]


def google_rows() -> list[dict]:
    token = _google_access_token()
    metrics_query = (
        "SELECT campaign.id, campaign.name, campaign.status, "
        "campaign_budget.amount_micros, metrics.cost_micros, metrics.impressions "
        f"FROM campaign WHERE segments.date = '{YESTERDAY.isoformat()}'"
    )
    metrics = {
        str(row.get("campaign", {}).get("id")): row
        for row in _google_search(metrics_query, token)
    }
    campaigns = _google_search(
        "SELECT campaign.id, campaign.name, campaign.status, "
        "campaign_budget.amount_micros FROM campaign",
        token,
    )
    rows: list[dict] = []
    for row in campaigns:
        campaign = row.get("campaign") or {}
        if campaign.get("status") not in ("ENABLED", "PAUSED"):
            continue
        campaign_id = str(campaign.get("id") or "")
        budget = row.get("campaignBudget") or {}
        campaign_metrics = (metrics.get(campaign_id) or {}).get("metrics") or {}
        rows.append(
            {
                "data": TODAY.isoformat(),
                "plataforma": "google",
                "id": campaign_id,
                "campanha": campaign.get("name", ""),
                "status": campaign.get("status", ""),
                "orcamento_dia": round(int(budget.get("amountMicros") or 0) / 1_000_000, 2),
                "gasto_ontem": round(
                    int(campaign_metrics.get("costMicros") or 0) / 1_000_000, 2
                ),
                "impressoes_ontem": campaign_metrics.get("impressions", 0),
            }
        )
    return rows


def _read_existing() -> list[dict]:
    if not OUT.exists():
        return []
    with OUT.open(encoding="utf-8-sig", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def _write_atomic(rows: list[dict]) -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{OUT.name}.", dir=str(OUT.parent))
    try:
        with os.fdopen(fd, "w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=FIELDS, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(rows)
        os.chmod(temp_name, 0o600)
        os.replace(temp_name, OUT)
        chmod_private(OUT)
    except Exception:
        try:
            os.unlink(temp_name)
        except OSError:
            pass
        raise


def main() -> int:
    requested = {
        value.strip().lower()
        for value in os.environ.get("CAMPAIGN_SNAPSHOT_PLATFORMS", "meta,google").split(",")
        if value.strip()
    }
    unknown = requested - {"meta", "google"}
    if not requested or unknown:
        raise ConfigError("CAMPAIGN_SNAPSHOT_PLATFORMS deve conter meta e/ou google")

    incoming: list[dict] = []
    if "meta" in requested:
        rows = meta_rows()
        incoming.extend(rows)
        print(f"meta: {len(rows)} campanhas")
    if "google" in requested:
        rows = google_rows()
        incoming.extend(rows)
        print(f"google: {len(rows)} campanhas")

    cutoff = TODAY - dt.timedelta(days=RETENTION_DAYS)
    merged: dict[tuple[str, str, str], dict] = {}
    for row in [*_read_existing(), *incoming]:
        try:
            row_date = dt.date.fromisoformat(str(row.get("data") or ""))
        except ValueError:
            continue
        if row_date >= cutoff:
            key = (row_date.isoformat(), str(row.get("plataforma")), str(row.get("id")))
            merged[key] = {field: row.get(field, "") for field in FIELDS}
    output = [merged[key] for key in sorted(merged)]
    _write_atomic(output)
    print(f"novas hoje: {len(incoming)} | total historico: {len(output)} | CSV: {OUT}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ConfigError, RuntimeError, urllib.error.URLError, json.JSONDecodeError) as exc:
        print(f"erro: {redact_text(exc)}", file=sys.stderr)
        sys.exit(1)
