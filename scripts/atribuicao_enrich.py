#!/usr/bin/env python3
"""
Enriquecimento atribuicao WhatsApp x VENDA x CRM — Netcar
==========================================================
Le docs/atribuicao_whatsapp_leads.csv (gerado por evolution_attribution.py)
e adiciona colunas cruzando por telefone normalizado:

  - virou_venda (0/1), data_venda, valor_venda      <- ERP Postgres (Automacar)
  - no_crm (0/1), crm_estado, crm_origem            <- CRM MySQL (fabrica)

Saida: docs/atribuicao_whatsapp_leads_enriquecido.csv

Uso:
    python3 scripts/atribuicao_enrich.py
"""
import csv, os, re, sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
IN_CSV = ROOT / "docs" / "atribuicao_whatsapp_leads.csv"
OUT_CSV = ROOT / "docs" / "atribuicao_whatsapp_leads_enriquecido.csv"

ENV_CRM = Path("/Users/marcelomarchis/Library/CloudStorage/Dropbox/DEPTO. TI/VPS KINGHOST/docker-backups/stacks/netcar-leads-vps/.env")
ENV_PG = Path("/Users/marcelomarchis/Library/CloudStorage/Dropbox/DEPTO. TI/BANCO DE MARGENS/estoque-fipe/.env")


def norm(p):
    d = re.sub(r"\D", "", p or "")
    if not d:
        return ""
    if d.startswith("55") and len(d) >= 12:
        base = d
    elif len(d) in (10, 11):
        base = "55" + d
    else:
        base = d
    if len(base) == 12 and base.startswith("55"):
        base = base[:4] + "9" + base[4:]
    return base


def _env_url(path, key):
    txt = path.read_text()
    return next(l.split("=", 1)[1].strip() for l in txt.splitlines() if l.startswith(key + "="))


def pg_sales():
    import psycopg2
    u = urlparse(_env_url(ENV_PG, "PG_CONNECTION_STRING"))
    c = psycopg2.connect(host=u.hostname, port=u.port or 5432, user=u.username,
                         password=u.password, dbname=u.path.lstrip("/"), connect_timeout=20)
    cur = c.cursor()
    cur.execute("""
        SELECT v.datavenda, v.valorvenda, cl.celular, cl.fone
        FROM vendidos v JOIN cadclientes cl ON cl.codgeral = v.codgeralcomprador
        WHERE v.datavenda >= '2025-01-01'
    """)
    sales = {}
    for dv, vv, cel, fone in cur.fetchall():
        val = float(vv or 0)
        d = dv.strftime("%Y-%m-%d")
        for raw in (cel, fone):
            n = norm(raw)
            if not n:
                continue
            if n not in sales or d > sales[n][0]:
                sales[n] = (d, val)
    c.close()
    return sales


def crm_leads():
    import pymysql
    u = urlparse(_env_url(ENV_CRM, "CRM_DATABASE_URL").replace("mysql+pymysql://", "mysql://"))
    c = pymysql.connect(host=u.hostname, port=u.port or 3306, user=u.username,
                        password=u.password, database=u.path.lstrip("/"),
                        connect_timeout=20, charset="utf8mb4",
                        cursorclass=pymysql.cursors.DictCursor)
    cur = c.cursor()
    cur.execute("""
        SELECT celular, id_state, origem, canal
        FROM crm_negocio WHERE date_create >= '2025-01-01'
    """)
    leads = {}
    for r in cur.fetchall():
        for raw in (r.get("celular"),):
            n = norm(raw)
            if not n:
                continue
            if n not in leads:
                leads[n] = {"estado": r.get("id_state"), "origem": r.get("origem") or "",
                            "canal": r.get("canal") or ""}
    c.close()
    return leads


def main():
    if not IN_CSV.exists():
        print(f"entrada ausente: {IN_CSV} — roda evolution_attribution.py antes")
        sys.exit(1)

    rows = list(csv.DictReader(open(IN_CSV, encoding="utf-8")))
    print(f"leads: {len(rows)}")

    sales = pg_sales()
    crm = crm_leads()
    print(f"vendas ERP: {len(sales)} | leads CRM: {len(crm)}")

    n_venda = n_crm = 0
    for r in rows:
        n = norm(r.get("telefone", ""))
        sv = sales.get(n)
        r["virou_venda"] = "1" if sv else "0"
        r["data_venda"] = sv[0] if sv else ""
        r["valor_venda"] = f"{sv[1]:.2f}" if sv else ""
        cl = crm.get(n)
        r["no_crm"] = "1" if cl else "0"
        r["crm_estado"] = str(cl["estado"]) if cl else ""
        r["crm_origem"] = cl["origem"] if cl else ""
        if sv: n_venda += 1
        if cl: n_crm += 1

    fields = list(rows[0].keys())
    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    print(f"\nCSV: {OUT_CSV}")
    print(f"com venda: {n_venda} | no CRM: {n_crm}")


if __name__ == "__main__":
    main()
