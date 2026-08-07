#!/usr/bin/env python3
"""
Atribuicao de leads WhatsApp — Netcar
=====================================
Extrai da Evolution API (instancia netcar-bot) a origem de cada conversa:

1. CTWA (click-to-WhatsApp ads Meta): payload conversionSource=FB_Ads + link do criativo
2. Codigo (X99999 ou legado X999): gerado pelo site na 1a mensagem (M=Meta, G=Google Ads, O=organico, D=direto, S=social, R=referral)

Saida: docs/atribuicao_whatsapp_leads.csv (incremental, dedupe por jid)
Checkpoint: scripts/.evolution_checkpoint.json (so refaz chats novos/atualizados)

Uso:
    python3 scripts/evolution_attribution.py            # incremental
    python3 scripts/evolution_attribution.py --full     # revarre tudo
"""
import json, subprocess, re, csv, sys, os, datetime, time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

# VPS nova (191.252.212.86) — instancia tester-marcelo = numero iAN 51 99729-3118 (store desde mar/26, viva)
# VPS antiga (137.131.196.46) — instancia netcar-bot = numero velho 51 98879-0281 (store morreu 20/abr/26)
BASE_URL = os.environ.get("EVO_BASE_URL", "http://191.252.212.86:8080")
API_KEY  = os.environ.get("EVO_API_KEY", "429683C4C977415CAAFCCE10F7D57E11")
INSTANCE = os.environ.get("EVO_INSTANCE", "tester-marcelo")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_CSV = os.path.join(ROOT, "docs", "atribuicao_whatsapp_leads.csv")
CHECKPOINT = os.path.join(ROOT, "scripts", ".evolution_checkpoint.json")
AD_CACHE = os.path.join(ROOT, "scripts", ".ad_map.json")
FULL = "--full" in sys.argv
BACKFILL_ADS = "--backfill-ads" in sys.argv  # reprocessa chats CTWA sem ad_id salvo
_since = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--since=")), None)
SINCE = datetime.datetime.strptime(_since, "%Y-%m-%d") if _since else None

# Aceita legado (G482) e novo (G48217) — site gera 5 digitos desde ago/2026
CODPAT = re.compile(r"\(([MGODSR]\d{3,5})\)")
LETRA = {"M": "Meta (via site)", "G": "Google Ads", "O": "Organico", "D": "Direto", "S": "Social", "R": "Referral"}


def api(path, body=None, timeout=60):
    cmd = ["curl", "-sS", "-m", str(timeout), "-X", "POST" if body is not None else "GET",
           f"{BASE_URL}{path}", "-H", f"apikey: {API_KEY}", "-H", "Content-Type: application/json"]
    if body is not None:
        cmd += ["-d", json.dumps(body)]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 10).stdout
    return json.loads(out)


def ts_to_iso(t):
    return datetime.datetime.utcfromtimestamp(int(t)).strftime("%Y-%m-%d %H:%M") if t else ""


def phone_of(jid, recs=None):
    """JIDs @lid escondem o telefone; Baileys expoe o real em remoteJidAlt/senderPn."""
    if jid.endswith("@s.whatsapp.net"):
        return "+" + jid.split("@")[0].split(":")[0]
    for rec in (recs or []):
        for src in (rec, rec.get("key") or {}):
            for f in ("senderPn", "remoteJidAlt", "participantAlt"):
                v = src.get(f)
                if v and "@s.whatsapp.net" in str(v):
                    return "+" + str(v).split("@")[0].split(":")[0]
    return ""


def analyze_chat(jid):
    """Retorna dict com atribuicao do chat, ou None se erro."""
    try:
        r = api(f"/chat/findMessages/{INSTANCE}", {"where": {"key": {"remoteJid": jid}}, "limit": 300}, timeout=40)
        recs = (r.get("messages") or {}).get("records") or []
    except Exception:
        return None
    recs = [m for m in recs if isinstance(m, dict)]
    recs.sort(key=lambda m: m.get("messageTimestamp") or 0)

    first_in, code, ctwa = None, None, None
    for m in recs:
        key = m.get("key") or {}
        if key.get("fromMe"):
            continue
        msg = m.get("message") or {}
        txt = (msg.get("conversation") or (msg.get("extendedTextMessage") or {}).get("text")
               or (msg.get("imageMessage") or {}).get("caption") or "")
        if first_in is None:
            first_in = {"ts": ts_to_iso(m.get("messageTimestamp")), "txt": txt[:200],
                        "phone": phone_of(jid, recs), "push": m.get("pushName") or ""}
        cm = CODPAT.search(txt)
        if cm and code is None:
            code = {"codigo": cm.group(1), "origem": LETRA.get(cm.group(1)[0], "?")}
        cis = []
        if isinstance(m.get("contextInfo"), dict):
            cis.append(m["contextInfo"])
        for v in msg.values():
            if isinstance(v, dict) and isinstance(v.get("contextInfo"), dict):
                cis.append(v["contextInfo"])
        for ci in cis:
            ear = ci.get("externalAdReply") or {}
            if (ear or ci.get("conversionSource")) and ctwa is None:
                ctwa = {"fonte": ci.get("conversionSource") or "ads",
                        "titulo": (ear.get("title") or "")[:100],
                        "criativo_url": (ear.get("sourceUrl") or "")[:150],
                        "ad_id": str(ear.get("sourceId") or ""),
                        "ctwa_clid": (ear.get("ctwaClid") or "")[:80],
                        "media_url": (ear.get("mediaUrl") or "")[:150],
                        "headline": (ear.get("body") or "").split("\n")[0][:120],
                        "ts": ts_to_iso(m.get("messageTimestamp"))}

    if not first_in:
        return {"vazio": True}
    return {"first": first_in, "code": code, "ctwa": ctwa}


def meta_token():
    tok = os.environ.get("META_ACCESS_TOKEN")
    if tok:
        return tok
    for p in (Path.home() / "data/netcar/.env",
              Path("/Users/marcelomarchis/AutoADS-cloud-clean/autoads-analyst/.env")):
        try:
            for l in p.read_text().splitlines():
                if l.startswith("META_ACCESS_TOKEN="):
                    return l.split("=", 1)[1].strip()
        except Exception:
            pass
    return ""


def _graph(idv, fields, tok):
    url = f"https://graph.facebook.com/v22.0/{idv}?fields={fields}&access_token={tok}"
    return json.load(urllib.request.urlopen(url, timeout=30))


def resolve_ads(ad_ids):
    """ad_id -> campanha/conjunto/anuncio via Meta API. Cache em .ad_map.json."""
    cache = json.load(open(AD_CACHE)) if os.path.exists(AD_CACHE) else {}
    missing = [a for a in ad_ids if a and a not in cache]
    if missing:
        tok = meta_token()
        if not tok:
            print("META_ACCESS_TOKEN ausente — resolucao de anuncios pulada")
        else:
            for i, aid in enumerate(missing):
                try:
                    d = _graph(aid, "name,status,adset_id,campaign_id", tok)
                    camp = _graph(d["campaign_id"], "name,status", tok) if d.get("campaign_id") else {}
                    adset = _graph(d["adset_id"], "name,status", tok) if d.get("adset_id") else {}
                    cache[aid] = {"anuncio": d.get("name", ""), "anuncio_status": d.get("status", ""),
                                  "campanha": camp.get("name", ""), "campanha_status": camp.get("status", ""),
                                  "conjunto": adset.get("name", "")}
                except Exception as e:
                    cache[aid] = {"erro": str(e)[:100]}
                if i and i % 20 == 0:
                    print(f"  ads resolvidos {i}/{len(missing)}", flush=True)
                time.sleep(0.2)
            json.dump(cache, open(AD_CACHE, "w"))
    return cache


def main():
    chats = api(f"/chat/findChats/{INSTANCE}", {}, timeout=240)
    print(f"chats na instancia: {len(chats)}")

    ck = {} if FULL else (json.load(open(CHECKPOINT)) if os.path.exists(CHECKPOINT) else {})
    todo = []
    for ch in chats:
        jid = ch.get("remoteJid") or ""
        lmts = (ch.get("lastMessage") or {}).get("messageTimestamp") or 0
        if not jid or "@" not in jid or jid.endswith("@g.us"):
            continue
        if SINCE and (not lmts or datetime.datetime.utcfromtimestamp(int(lmts)) < SINCE):
            continue
        if str(lmts) != str(ck.get(jid, {}).get("lmts")):
            todo.append((jid, lmts))
    if BACKFILL_ADS:
        ja = {j for j, _ in todo}
        for jid, v in ck.items():
            c = (v.get("r") or {}).get("ctwa") or {}
            if c and not c.get("ad_id") and jid not in ja:
                todo.append((jid, v.get("lmts") or 0))
        print(f"backfill ads: {len(todo)} chats na fila")
    print(f"chats a processar: {len(todo)} (de {len(chats)})")

    results = {}
    errs = [0]
    def work(item):
        jid, lmts = item
        a = analyze_chat(jid)
        if a is None:
            errs[0] += 1
            return
        results[jid] = (lmts, a)
        if len(results) % 100 == 0:
            print(f"  progresso {len(results)}/{len(todo)}", flush=True)

    with ThreadPoolExecutor(max_workers=10) as ex:
        list(ex.map(work, todo))
    print(f"processados: {len(results)} | erros: {errs[0]}")

    for jid, (lmts, a) in results.items():
        ck[jid] = {"lmts": lmts, "r": a}
    json.dump(ck, open(CHECKPOINT, "w"))

    rows = []
    for jid, v in ck.items():
        a = v.get("r") or {}
        first = a.get("first") or {}
        code = a.get("code") or {}
        ctwa = a.get("ctwa") or {}
        origem = "Meta CTWA (anuncio direto)" if ctwa else code.get("origem", "Direto/organico (sem marcacao)")
        rows.append({
            "telefone": first.get("phone", ""), "jid": jid,
            "nome_whatsapp": first.get("push", ""),
            "primeiro_contato": first.get("ts", ""),
            "origem": origem,
            "codigo_site": code.get("codigo", ""),
            "campanha_titulo": ctwa.get("titulo", ""),
            "criativo_url": ctwa.get("criativo_url", ""),
            "ad_id": ctwa.get("ad_id", ""),
            "headline": ctwa.get("headline", ""),
            "primeira_msg": (first.get("txt") or "").replace("\n", " "),
        })

    ad_map = resolve_ads({r["ad_id"] for r in rows})
    for r in rows:
        info = ad_map.get(r["ad_id"]) or {}
        r["campanha_meta"] = info.get("campanha", "")
        r["campanha_meta_status"] = info.get("campanha_status", "")
        r["conjunto_meta"] = info.get("conjunto", "")
        r["anuncio_meta"] = info.get("anuncio", "")
    rows.sort(key=lambda r: r["primeiro_contato"], reverse=True)

    os.makedirs(os.path.dirname(OUT_CSV), exist_ok=True)
    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else ["telefone"])
        w.writeheader()
        w.writerows(rows)

    ctwa_n = sum(1 for r in rows if r["origem"].startswith("Meta CTWA"))
    code_n = sum(1 for r in rows if r["codigo_site"])
    camp_n = sum(1 for r in rows if r["campanha_meta"])
    print(f"\nCSV: {OUT_CSV}")
    print(f"total leads: {len(rows)} | com codigo site: {code_n} | Meta CTWA: {ctwa_n} | com campanha resolvida: {camp_n}")


if __name__ == "__main__":
    main()
