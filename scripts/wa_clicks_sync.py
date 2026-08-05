#!/usr/bin/env python3
"""
Sync do log proprio de cliques WhatsApp (site -> wa-log.php)
=============================================================
Baixa incremental de https://www.netcarmultimarcas.com.br/wa-log.php
(token) e grava docs/wa_clicks_log.jsonl (dedupe por code+ts).

Join com atribuicao: codigo_site (G482) = code aqui -> gclid/campanha.
Com gclid + telefone do lead + venda ERP => offline conversions Google.

Uso:
    python3 scripts/wa_clicks_sync.py
"""
import json, os, sys, urllib.request, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "wa_clicks_log.jsonl")
STATE = os.path.join(ROOT, "scripts", ".wa_clicks_state.json")

BASE = "https://wa.netcarmultimarcas.com.br/"
TOKEN = os.environ.get("WA_LOG_TOKEN", "NCwalog9f2c7e4b18d3a6f50c2e9b74d1f")


def main():
    since = ""
    if os.path.exists(STATE):
        since = json.load(open(STATE)).get("last_dt", "")[:10]
        # margem: repete o dia anterior, dedupe resolve
        if since:
            d = datetime.date.fromisoformat(since) - datetime.timedelta(days=1)
            since = d.isoformat()

    url = f"{BASE}?token={TOKEN}" + (f"&since={since}" if since else "")
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            body = r.read().decode("utf-8", "replace")
    except Exception as e:
        print(f"erro ao baixar: {e}")
        sys.exit(1)

    novas = [json.loads(l) for l in body.splitlines() if l.strip()]
    print(f"linhas recebidas: {len(novas)} (since={since or 'tudo'})")

    existentes = set()
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as f:
            for l in f:
                try:
                    r = json.loads(l)
                    existentes.add((r.get("code"), r.get("ts"), r.get("dt")))
                except Exception:
                    pass

    add = 0
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "a", encoding="utf-8") as f:
        for r in novas:
            k = (r.get("code"), r.get("ts"), r.get("dt"))
            if k not in existentes:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
                existentes.add(k)
                add += 1

    last = max((r.get("dt", "") for r in novas), default="")
    if last:
        json.dump({"last_dt": last}, open(STATE, "w"))
    print(f"novas gravadas: {add} | total arquivo: {len(existentes)} | arquivo: {OUT}")


if __name__ == "__main__":
    main()
