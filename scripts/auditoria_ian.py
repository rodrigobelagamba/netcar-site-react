#!/usr/bin/env python3
"""
Auditoria de atendimento WhatsApp — numero Ian (instancia tester-marcelo)
========================================================================
Puxa conversas recentes da Evolution API, calcula metricas de atendimento
(tempo de resposta, follow-up, cobertura, tom) e salva transcricoes limpas
para analise qualitativa.

Saida:
  docs/auditoria_ian/conversas_ian.jsonl   (transcricoes limpas)
  docs/auditoria_ian/metricas_ian.json     (agregados)

Uso:
    python3 scripts/auditoria_ian.py [--chats=150] [--dias=60]
"""
import json, subprocess, re, sys, os, datetime, statistics
from concurrent.futures import ThreadPoolExecutor

BASE_URL = os.environ.get("EVO_BASE_URL", "http://191.252.212.86:8080")
API_KEY  = os.environ.get("EVO_API_KEY", "429683C4C977415CAAFCCE10F7D57E11")
INSTANCE = os.environ.get("EVO_INSTANCE", "tester-marcelo")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTDIR = os.path.join(ROOT, "docs", "auditoria_ian")

N_CHATS = int(next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--chats=")), 150))
DIAS    = int(next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--dias=")), 60))
CUTOFF  = datetime.datetime.now() - datetime.timedelta(days=DIAS)

INTENT_PAT = re.compile(
    r"financi|entrada|parcela|prestacao|troca|meu carro|valor|preco|disponi|"
    r"test.?drive|agendar|visita|cpf|aprov|score|negativad|simula|carta de credito|"
    r"consorcio|boleto|promissoria|garantia|documento", re.I)
QUALIF_PAT = re.compile(
    r"cpf|renda|salario|entrada|troca|seu carro|nome limpo|restricao|score|"
    r"data de nascimento|nascimento|cep|profissao|trabalha", re.I)
CTA_PAT = re.compile(
    r"agendar|agenda|visita|vem na loja|vir na loja|passa aqui|loja|endereco|"
    r"horario|test.?drive|amanha|hoje a tarde|te espero", re.I)
EMOJI_PAT = re.compile(
    "[\U0001F300-\U0001FAFF\u2600-\u27BF\U0001F000-\U0001F02F]")


def api(path, body=None, timeout=60):
    cmd = ["curl", "-sS", "-m", str(timeout), "-X", "POST" if body is not None else "GET",
           f"{BASE_URL}{path}", "-H", f"apikey: {API_KEY}", "-H", "Content-Type: application/json"]
    if body is not None:
        cmd += ["-d", json.dumps(body)]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 10).stdout
    return json.loads(out)


def msg_text(msg):
    m = msg.get("message") or {}
    for k in ("conversation",):
        if m.get(k):
            return m[k], "text"
    etm = m.get("extendedTextMessage") or {}
    if etm.get("text"):
        return etm["text"], "text"
    for k, tag in (("imageMessage", "img"), ("videoMessage", "video"),
                   ("documentMessage", "doc"), ("documentWithCaptionMessage", "doc")):
        v = m.get(k) or {}
        if isinstance(v, dict) and (v.get("caption") or k in m):
            inner = v.get("message") or v
            cap = (inner.get("caption") or "") if isinstance(inner, dict) else ""
            return (cap or f"[{tag}]"), tag
    if "audioMessage" in m:
        return "[audio]", "audio"
    if "stickerMessage" in m:
        return "[figurinha]", "sticker"
    for k in ("buttonsResponseMessage", "templateButtonReplyMessage", "listResponseMessage"):
        v = m.get(k) or {}
        if v:
            return (v.get("selectedDisplayText") or v.get("title") or f"[{k}]"), "button"
    loc = m.get("locationMessage")
    if loc:
        return "[localizacao]", "loc"
    if m.get("contactMessage") or m.get("contactsArrayMessage"):
        return "[contato]", "contact"
    return "", "other"


def analyze_chat(jid):
    try:
        r = api(f"/chat/findMessages/{INSTANCE}",
                {"where": {"key": {"remoteJid": jid}}, "limit": 400}, timeout=40)
        recs = (r.get("messages") or {}).get("records") or []
    except Exception:
        return None
    recs = [m for m in recs if isinstance(m, dict)]
    recs.sort(key=lambda m: int(m.get("messageTimestamp") or 0))
    if not recs:
        return None

    thread, resp_deltas, first_resp_min = [], [], None
    last_client_ts = None
    n_cli = n_me = 0
    me_texts, cli_texts = [], []
    n_me_qualif = n_me_cta = n_me_emoji = n_me_pergunta = 0
    cli_intent = 0
    tipos = {}
    push = ""

    for m in recs:
        key = m.get("key") or {}
        ts = int(m.get("messageTimestamp") or 0)
        if not ts:
            continue
        dt = datetime.datetime.fromtimestamp(ts)
        txt, tipo = msg_text(m)
        if key.get("fromMe"):
            n_me += 1
            me_texts.append(txt)
            if QUALIF_PAT.search(txt): n_me_qualif += 1
            if CTA_PAT.search(txt): n_me_cta += 1
            if EMOJI_PAT.search(txt): n_me_emoji += 1
            if "?" in txt: n_me_pergunta += 1
            if last_client_ts is not None:
                delta = (ts - last_client_ts) / 60.0
                if 0 <= delta <= 12 * 60:
                    resp_deltas.append(delta)
                if first_resp_min is None:
                    first_resp_min = delta
                last_client_ts = None
            me = True
        else:
            if key.get("remoteJid", "").endswith("@g.us"):
                continue
            n_cli += 1
            cli_texts.append(txt)
            if INTENT_PAT.search(txt): cli_intent += 1
            if not push:
                push = m.get("pushName") or ""
            last_client_ts = ts
            me = False
        tipos[tipo] = tipos.get(tipo, 0) + 1
        thread.append({"t": dt.strftime("%Y-%m-%d %H:%M"), "de": "IAN" if key.get("fromMe") else "CLIENTE", "txt": txt[:600]})

    if n_cli == 0:
        return None

    ultimo_lado = thread[-1]["de"] if thread else ""
    return {
        "jid": jid, "nome": push,
        "inicio": thread[0]["t"], "fim": thread[-1]["t"],
        "n_cliente": n_cli, "n_ian": n_me,
        "cliente_sem_resposta_fim": 1 if ultimo_lado == "CLIENTE" else 0,
        "primeira_resp_min": round(first_resp_min, 1) if first_resp_min is not None else None,
        "mediana_resp_min": round(statistics.median(resp_deltas), 1) if resp_deltas else None,
        "n_resp_pares": len(resp_deltas),
        "ian_qualif_msgs": n_me_qualif, "ian_cta_msgs": n_me_cta,
        "ian_emoji_msgs": n_me_emoji, "ian_pergunta_msgs": n_me_pergunta,
        "cliente_intencao_msgs": cli_intent,
        "tipos": tipos,
        "thread": thread,
        "primeira_msg_cliente": (cli_texts[0] if cli_texts else "")[:300],
    }


def main():
    chats = api(f"/chat/findChats/{INSTANCE}", {}, timeout=240)
    cand = []
    for ch in chats:
        jid = ch.get("remoteJid") or ""
        lmts = int((ch.get("lastMessage") or {}).get("messageTimestamp") or 0)
        if not jid or "@" not in jid or jid.endswith("@g.us") or not lmts:
            continue
        if datetime.datetime.fromtimestamp(lmts) < CUTOFF:
            continue
        cand.append((jid, lmts))
    cand.sort(key=lambda x: x[1], reverse=True)
    cand = cand[:N_CHATS]
    print(f"chats janela {DIAS}d: {len(cand)}")

    results = []
    with ThreadPoolExecutor(max_workers=10) as ex:
        for i, a in enumerate(ex.map(lambda it: analyze_chat(it[0]), cand)):
            if a:
                results.append(a)
            if (i + 1) % 25 == 0:
                print(f"  {i+1}/{len(cand)}", flush=True)
    print(f"analizados: {len(results)}")

    os.makedirs(OUTDIR, exist_ok=True)
    with open(os.path.join(OUTDIR, "conversas_ian.jsonl"), "w", encoding="utf-8") as f:
        for r in results:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    agg = {
        "chats": len(results),
        "msgs_cliente": sum(r["n_cliente"] for r in results),
        "msgs_ian": sum(r["n_ian"] for r in results),
        "cliente_sem_resp_fim_pct": round(100 * sum(r["cliente_sem_resposta_fim"] for r in results) / len(results), 1),
        "primeira_resp_min_mediana": statistics.median([r["primeira_resp_min"] for r in results if r["primeira_resp_min"] is not None]) if any(r["primeira_resp_min"] is not None for r in results) else None,
        "resp_min_mediana": statistics.median([r["mediana_resp_min"] for r in results if r["mediana_resp_min"] is not None]) if any(r["mediana_resp_min"] is not None for r in results) else None,
        "pct_chats_ian_qualificou": round(100 * sum(1 for r in results if r["ian_qualif_msgs"] > 0) / len(results), 1),
        "pct_chats_ian_cta": round(100 * sum(1 for r in results if r["ian_cta_msgs"] > 0) / len(results), 1),
        "pct_chats_ian_pergunta": round(100 * sum(1 for r in results if r["ian_pergunta_msgs"] > 0) / len(results), 1),
        "pct_msgs_ian_emoji": round(100 * sum(r["ian_emoji_msgs"] for r in results) / max(1, sum(r["n_ian"] for r in results)), 1),
        "pct_chats_cliente_intencao": round(100 * sum(1 for r in results if r["cliente_intencao_msgs"] > 0) / len(results), 1),
        "media_msgs_cliente_por_chat": round(sum(r["n_cliente"] for r in results) / len(results), 1),
        "media_msgs_ian_por_chat": round(sum(r["n_ian"] for r in results) / len(results), 1),
    }
    json.dump(agg, open(os.path.join(OUTDIR, "metricas_ian.json"), "w"), ensure_ascii=False, indent=1)
    print(json.dumps(agg, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
