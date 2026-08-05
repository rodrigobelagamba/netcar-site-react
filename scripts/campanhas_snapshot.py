#!/usr/bin/env python3
"""
Snapshot diario campanhas ativas Meta + Google — Netcar
========================================================
Grava por dia: campanha, status, orcamento/dia, gasto do dia, impressoes.
Saida: docs/campanhas_ativas_historico.csv (append, dedupe por data+plataforma+id)

Fontes:
  Meta   -> ~/data/netcar/.env (META_ACCESS_TOKEN, META_AD_ACCOUNT)
  Google -> AutoADS-cloud-clean/autoads-analyst/google-ads.yaml (OAuth)

Uso:
    python3 scripts/campanhas_snapshot.py
"""
import csv, json, os, re, urllib.parse, urllib.request
from datetime import date, timedelta
from pathlib import Path

ROOT = Path("/Users/marcelomarchis/Library/CloudStorage/Dropbox/DEPTO. TI/SITE REACT")
OUT = ROOT / "docs" / "campanhas_ativas_historico.csv"
META_ENV = Path.home() / "data" / "netcar" / ".env"
GOOGLE_YAML = Path("/Users/marcelomarchis/AutoADS-cloud-clean/autoads-analyst/google-ads.yaml")
GADS_VER = "v22"
HOJE = date.today().isoformat()
ONTEM = (date.today() - timedelta(days=1)).isoformat()


def _get(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {})
    return json.load(urllib.request.urlopen(req, timeout=40))


def _post(url, payload, headers):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(),
                                 method="POST", headers=headers)
    return json.load(urllib.request.urlopen(req, timeout=40))


def _meta_env(k):
    return next(l.split("=", 1)[1].strip() for l in META_ENV.read_text().splitlines()
                if l.startswith(k + "="))


def meta_rows():
    tok = _meta_env("META_ACCESS_TOKEN")
    acc = _meta_env("META_AD_ACCOUNT")
    if not acc.startswith("act_"):
        acc = "act_" + acc
    base = f"https://graph.facebook.com/v21.0/{acc}"
    camps = _get(f"{base}/campaigns?fields=id,name,status,effective_status,daily_budget&limit=200&access_token={tok}").get("data", [])
    ins = {}
    try:
        r = _get(f"{base}/insights?level=campaign&fields=campaign_id,spend,impressions&time_range={{\"since\":\"{ONTEM}\",\"until\":\"{ONTEM}\"}}&limit=200&access_token={tok}")
        ins = {x["campaign_id"]: x for x in r.get("data", [])}
    except Exception:
        pass
    rows = []
    for c in camps:
        if c.get("effective_status") not in ("ACTIVE", "PAUSED"):
            continue
        i = ins.get(c["id"], {})
        rows.append({
            "data": HOJE, "plataforma": "meta", "id": c["id"],
            "campanha": c.get("name", ""), "status": c.get("effective_status", ""),
            "orcamento_dia": round(int(c.get("daily_budget", 0)) / 100, 2),
            "gasto_ontem": i.get("spend", ""), "impressoes_ontem": i.get("impressions", ""),
        })
    return rows


def _google_creds():
    t = GOOGLE_YAML.read_text()
    return dict(re.findall(r'^(\w+):\s*"?([^"\n]+?)"?\s*$', t, re.M))


def _google_token(y):
    data = urllib.parse.urlencode({"client_id": y["client_id"], "client_secret": y["client_secret"],
                                   "refresh_token": y["refresh_token"], "grant_type": "refresh_token"}).encode()
    return json.load(urllib.request.urlopen(
        urllib.request.Request("https://oauth2.googleapis.com/token", data=data), timeout=30))["access_token"]


def google_rows():
    y = _google_creds()
    at = _google_token(y)
    hdr = {"Authorization": f"Bearer {at}", "developer-token": y["developer_token"],
           "Content-Type": "application/json"}
    cid = y["client_customer_id"].replace("-", "")
    url = f"https://googleads.googleapis.com/{GADS_VER}/customers/{cid}/googleAds:searchStream"
    q = ("SELECT campaign.id, campaign.name, campaign.status, "
         "campaign_budget.amount_micros, metrics.cost_micros, metrics.impressions "
         f"FROM campaign WHERE segments.date = '{ONTEM}'")
    resp = _post(url, {"query": q}, hdr)
    res = [x for b in resp for x in b.get("results", [])]
    by_id = {x["campaign"]["id"]: x for x in res}
    # campanhas sem impressao ontem nao vem no metrics — busca lista completa
    q2 = "SELECT campaign.id, campaign.name, campaign.status, campaign_budget.amount_micros FROM campaign"
    resp2 = _post(url, {"query": q2}, hdr)
    res2 = [x for b in resp2 for x in b.get("results", [])]
    rows = []
    for x in res2:
        c = x.get("campaign", {})
        if c.get("status") not in ("ENABLED", "PAUSED"):
            continue
        b = x.get("campaignBudget", {})
        m = by_id.get(c["id"], {}).get("metrics", {})
        rows.append({
            "data": HOJE, "plataforma": "google", "id": c["id"],
            "campanha": c.get("name", ""), "status": c.get("status", ""),
            "orcamento_dia": round(int(b.get("amountMicros", 0)) / 1e6, 2),
            "gasto_ontem": round(int(m.get("costMicros", 0)) / 1e6, 2) if m else 0,
            "impressoes_ontem": m.get("impressions", 0) if m else 0,
        })
    return rows


def main():
    rows = []
    try:
        m = meta_rows()
        rows += m
        print(f"meta: {len(m)} campanhas")
    except Exception as e:
        print(f"meta ERRO: {type(e).__name__} {e}")
    try:
        g = google_rows()
        rows += g
        print(f"google: {len(g)} campanhas")
    except Exception as e:
        print(f"google ERRO: {type(e).__name__} {e}")

    fields = ["data", "plataforma", "id", "campanha", "status",
              "orcamento_dia", "gasto_ontem", "impressoes_ontem"]
    existing = []
    if OUT.exists():
        existing = list(csv.DictReader(open(OUT, encoding="utf-8")))
    seen = {(r["data"], r["plataforma"], r["id"]) for r in existing}
    novas = [r for r in rows if (r["data"], r["plataforma"], str(r["id"])) not in seen]
    todos = existing + novas
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in todos:
            w.writerow({k: r.get(k, "") for k in fields})
    print(f"novas hoje: {len(novas)} | total historico: {len(todos)}")
    print(f"CSV: {OUT}")


if __name__ == "__main__":
    main()
