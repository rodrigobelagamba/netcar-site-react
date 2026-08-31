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
import json, re, sys, os, datetime, statistics, tempfile
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from zoneinfo import ZoneInfo

from offline_config import (
    ConfigError,
    atomic_write_json,
    chmod_private,
    load_env_file,
    private_path,
    redact_text,
    required_env,
    service_url,
)


load_env_file()
BASE_URL = service_url(
    "EVO_BASE_URL",
    allow_insecure_flag="EVO_ALLOW_INSECURE_HTTP",
    allow_loopback_when_env="EVO_SSH_TARGET",
)
API_KEY = required_env("EVO_API_KEY")
INSTANCE = required_env("EVO_INSTANCE")
OUTDIR = private_path("IAN_AUDIT_OUTPUT_DIR", "auditoria_ian")
OUTDIR.mkdir(parents=True, exist_ok=True)
try:
    OUTDIR.chmod(0o700)
except OSError:
    pass

N_CHATS = int(next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--chats=")), 150))
DIAS    = int(next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--dias=")), 60))
LOCAL_TIMEZONE = ZoneInfo(os.environ.get("ATTRIBUTION_SOURCE_TIMEZONE", "America/Sao_Paulo"))
CUTOFF_EPOCH = int(
    (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=DIAS)).timestamp()
)

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
    payload = json.dumps(body).encode("utf-8") if body is not None else None
    request = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=payload,
        method="POST" if payload is not None else "GET",
        headers={"apikey": API_KEY, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read().decode("utf-8", "replace")
    return json.loads(raw)


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
        instance_path = urllib.parse.quote(INSTANCE, safe="")
        r = api(f"/chat/findMessages/{instance_path}",
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
        if not ts or ts < CUTOFF_EPOCH:
            continue
        dt = datetime.datetime.fromtimestamp(ts, LOCAL_TIMEZONE)
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
    instance_path = urllib.parse.quote(INSTANCE, safe="")
    chats = api(f"/chat/findChats/{instance_path}", {}, timeout=240)
    cand = []
    for ch in chats:
        jid = ch.get("remoteJid") or ""
        lmts = int((ch.get("lastMessage") or {}).get("messageTimestamp") or 0)
        if not jid or "@" not in jid or jid.endswith("@g.us") or not lmts:
            continue
        if lmts < CUTOFF_EPOCH:
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
    if not results:
        raise RuntimeError("nenhuma conversa valida; saidas anteriores preservadas")

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

    conversations_path = OUTDIR / "conversas_ian.jsonl"
    fd, temporary = tempfile.mkstemp(
        prefix=f".{conversations_path.name}.", dir=str(conversations_path.parent)
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            for result in results:
                handle.write(json.dumps(result, ensure_ascii=False) + "\n")
        os.chmod(temporary, 0o600)
        os.replace(temporary, conversations_path)
        chmod_private(conversations_path)
    except Exception:
        try:
            os.unlink(temporary)
        except OSError:
            pass
        raise
    atomic_write_json(OUTDIR / "metricas_ian.json", agg, indent=1)
    print(json.dumps(agg, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    try:
        main()
    except (ConfigError, RuntimeError, urllib.error.URLError, json.JSONDecodeError) as exc:
        print(f"erro: {redact_text(exc)}", file=sys.stderr)
        sys.exit(1)
