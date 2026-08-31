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
import json, re, csv, sys, os, datetime, time, hashlib
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from offline_config import (
    ConfigError,
    atomic_write_json,
    chmod_private,
    env_int,
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

OUT_CSV = private_path("EVOLUTION_OUTPUT_CSV", "atribuicao_whatsapp_leads.csv")
CHECKPOINT = private_path(
    "EVOLUTION_CHECKPOINT_PATH", "evolution_checkpoint.json"
)
AD_CACHE = private_path("META_AD_CACHE_PATH", "meta_ad_map.json")
RETENTION_DAYS = env_int("ATTRIBUTION_RETENTION_DAYS", 365, minimum=1)
SESSION_GAP_HOURS = env_int("ATTRIBUTION_SESSION_GAP_HOURS", 168, minimum=1)
MESSAGE_LIMIT = env_int("EVOLUTION_MESSAGE_LIMIT", 1000, minimum=50)
MAX_FAILURE_RATE_PERCENT = env_int(
    "EVOLUTION_MAX_FAILURE_RATE_PERCENT", 10, minimum=0
)
if MAX_FAILURE_RATE_PERCENT > 99:
    raise ConfigError("EVOLUTION_MAX_FAILURE_RATE_PERCENT deve estar entre 0 e 99")
COLLECTION_AUDIT = private_path(
    "EVOLUTION_AUDIT_JSON", "evolution_attribution_audit.json"
)
FULL = "--full" in sys.argv
BACKFILL_ADS = "--backfill-ads" in sys.argv  # reprocessa chats CTWA sem ad_id salvo
_since = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--since=")), None)
SINCE = datetime.datetime.strptime(_since, "%Y-%m-%d") if _since else None

# Novo: fonte + 7 Crockford Base32. Legados: 1–5 digitos ou 4 alfanumericos.
CROCKFORD_7 = r"[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{7}"
WA_REF_PATTERN = rf"[MGODSRU](?:{CROCKFORD_7}|\d{{1,5}}|[A-Z2-9]{{4}})"
CODPAT = re.compile(rf"\(({WA_REF_PATTERN})\)", re.I)
LETRA = {
    "M": "Meta (via site)",
    "G": "Google Ads",
    "O": "Organico",
    "D": "Direto",
    "S": "Social",
    "R": "Referral",
    "U": "Outro/desconhecido",
}


def api(path, body=None, timeout=60):
    """Chama Evolution sem colocar a chave na linha de comando ou na URL."""
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


def ts_to_iso(t):
    return (
        datetime.datetime.fromtimestamp(int(t), datetime.timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z")
        if t
        else ""
    )


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


def infer_message_context(text):
    """Extrai apenas contexto comercial de templates conhecidos, sem PII."""
    normalized = re.sub(r"\s+", " ", text or "").strip()
    lower = normalized.lower()
    if "financ" in lower or "entrada e parcelas" in lower:
        intent = "finance"
    elif "troca" in lower:
        intent = "trade_in"
    elif "vender meu carro" in lower or "venda direta" in lower:
        intent = "sell_evaluation"
    elif "agendar uma visita" in lower or "test drive" in lower:
        intent = "visit"
    elif "compar" in lower:
        intent = "comparison"
    elif "opções parecidas" in lower or "opcoes parecidas" in lower:
        intent = "similar_vehicle"
    else:
        intent = "vehicle_inquiry" if "seminovo" in lower or "carro" in lower else "general"

    city = ""
    city_match = re.search(r"\bmoro em ([^,.\n-]{2,80})", normalized, re.I)
    if city_match:
        city = city_match.group(1).strip()

    vehicle_name = ""
    suffix = rf"(?:\s+-\s+\({WA_REF_PATTERN}\)|[.!?]|$)"
    vehicle_patterns = (
        rf"(?:mais informações sobre|mais informacoes sobre|interesse n[oa]|troca d[oa])\s+(.+?){suffix}",
        rf"(?:financiamento d[oa]|parcelas d[oa])\s+(.+?){suffix}",
    )
    for pattern in vehicle_patterns:
        match = re.search(pattern, normalized, re.I)
        if match:
            vehicle_name = match.group(1).strip()[:160]
            break
    return {"intent": intent, "city": city, "vehicle_name": vehicle_name}


def message_text(message):
    msg = message.get("message") or {}
    return (
        msg.get("conversation")
        or (msg.get("extendedTextMessage") or {}).get("text")
        or (msg.get("imageMessage") or {}).get("caption")
        or ""
    )


def ctwa_context(message):
    msg = message.get("message") or {}
    contexts = []
    if isinstance(message.get("contextInfo"), dict):
        contexts.append(message["contextInfo"])
    for value in msg.values():
        if isinstance(value, dict) and isinstance(value.get("contextInfo"), dict):
            contexts.append(value["contextInfo"])
    for context in contexts:
        external = context.get("externalAdReply") or {}
        if external or context.get("conversionSource"):
            return {
                "fonte": context.get("conversionSource") or "ads",
                "titulo": (external.get("title") or "")[:100],
                "criativo_url": (external.get("sourceUrl") or "")[:150],
                "ad_id": str(external.get("sourceId") or ""),
                "ctwa_clid": (external.get("ctwaClid") or "")[:80],
                "media_url": (external.get("mediaUrl") or "")[:150],
                "headline": (external.get("body") or "").split("\n")[0][:120],
                "ts": ts_to_iso(message.get("messageTimestamp")),
            }
    return None


def ctwa_signature(value):
    if not value:
        return ""
    return "|".join(
        str(value.get(key) or "")
        for key in ("ctwa_clid", "ad_id", "criativo_url", "fonte", "titulo")
    )


def session_id(jid, session):
    first = session.get("first") or {}
    code = session.get("code") or {}
    ctwa = session.get("ctwa") or {}
    material = "|".join(
        (
            jid,
            str(first.get("ts_epoch") or ""),
            str(code.get("codigo") or ""),
            ctwa_signature(ctwa),
        )
    )
    return "evs_" + hashlib.sha256(material.encode("utf-8")).hexdigest()[:20]


def analyze_chat(jid):
    """Retorna sessoes de lead separadas por marcador novo ou inatividade."""
    try:
        instance_path = urllib.parse.quote(INSTANCE, safe="")
        r = api(
            f"/chat/findMessages/{instance_path}",
            {"where": {"key": {"remoteJid": jid}}, "limit": MESSAGE_LIMIT},
            timeout=40,
        )
        recs = (r.get("messages") or {}).get("records") or []
    except Exception:
        return None
    recs = [
        m
        for m in recs
        if isinstance(m, dict)
        and str(m.get("messageTimestamp") or "").isdigit()
        and int(m.get("messageTimestamp") or 0) > 0
    ]
    recs.sort(key=lambda m: int(m.get("messageTimestamp") or 0))

    sessions = []
    current = None
    next_reason = "first_inbound"
    gap_seconds = SESSION_GAP_HOURS * 3600
    for m in recs:
        key = m.get("key") or {}
        timestamp = int(m.get("messageTimestamp") or 0)
        inbound = not key.get("fromMe")
        txt = message_text(m) if inbound else ""
        code_match = CODPAT.search(txt) if inbound else None
        code_value = code_match.group(1).upper() if code_match else ""
        ctwa_value = ctwa_context(m) if inbound else None

        boundary_reason = ""
        if current and timestamp and current.get("last_ts"):
            if timestamp - int(current["last_ts"]) > gap_seconds:
                boundary_reason = "inactivity_gap"
        if inbound and current and code_value:
            current_code = ((current.get("code") or {}).get("codigo") or "")
            if current_code != code_value:
                boundary_reason = "new_wa_ref"
        if inbound and current and ctwa_value:
            current_signature = ctwa_signature(current.get("ctwa"))
            incoming_signature = ctwa_signature(ctwa_value)
            if not current_signature or current_signature != incoming_signature:
                boundary_reason = "new_ctwa"

        if boundary_reason and current:
            if current.get("first"):
                current["lead_session_id"] = session_id(jid, current)
                sessions.append(current)
            current = None
            next_reason = boundary_reason

        if inbound and current is None:
            current = {
                "first": {
                    "ts": ts_to_iso(timestamp),
                    "ts_epoch": timestamp,
                    "txt": txt[:200],
                    "phone": phone_of(jid, recs),
                    "push": m.get("pushName") or "",
                },
                "code": None,
                "ctwa": None,
                "started_reason": next_reason,
                "last_ts": timestamp,
            }
            next_reason = "first_inbound"

        if current:
            current["last_ts"] = max(int(current.get("last_ts") or 0), timestamp)
            if inbound and code_value and not current.get("code"):
                current["code"] = {
                    "codigo": code_value,
                    "origem": LETRA.get(code_value[0], "?"),
                }
            if inbound and ctwa_value and not current.get("ctwa"):
                current["ctwa"] = ctwa_value

    if current and current.get("first"):
        current["lead_session_id"] = session_id(jid, current)
        sessions.append(current)
    if not sessions:
        return {"vazio": True}
    return {"sessions": sessions}


def result_sessions(result):
    """Le checkpoint antigo como uma sessao unica durante a migracao."""
    if not isinstance(result, dict) or result.get("vazio"):
        return []
    if isinstance(result.get("sessions"), list):
        return [value for value in result["sessions"] if isinstance(value, dict)]
    if result.get("first"):
        legacy = dict(result)
        legacy.setdefault("last_ts", (legacy.get("first") or {}).get("ts_epoch") or 0)
        return [legacy]
    return []


def merge_result(jid, previous, current):
    merged = {}
    for session in [*result_sessions(previous), *result_sessions(current)]:
        identifier = session.get("lead_session_id") or session_id(jid, session)
        session["lead_session_id"] = identifier
        merged[identifier] = session
    return {"sessions": sorted(merged.values(), key=lambda item: int(item.get("last_ts") or 0))}


def meta_token():
    return os.environ.get("META_ACCESS_TOKEN", "").strip()


def _graph(idv, fields, tok):
    query = urllib.parse.urlencode({"fields": fields})
    url = f"https://graph.facebook.com/v22.0/{urllib.parse.quote(str(idv), safe='')}?{query}"
    request = urllib.request.Request(
        url, headers={"Authorization": f"Bearer {tok}", "Accept": "application/json"}
    )
    return json.load(urllib.request.urlopen(request, timeout=30))


def resolve_ads(ad_ids):
    """ad_id -> campanha/conjunto/anuncio via Meta API. Cache em .ad_map.json."""
    cache = json.loads(AD_CACHE.read_text(encoding="utf-8")) if AD_CACHE.exists() else {}
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
                    cache[aid] = {"erro": redact_text(e)[:100]}
                if i and i % 20 == 0:
                    print(f"  ads resolvidos {i}/{len(missing)}", flush=True)
                time.sleep(0.2)
            atomic_write_json(AD_CACHE, cache)
    return cache


def main():
    instance_path = urllib.parse.quote(INSTANCE, safe="")
    chats = api(f"/chat/findChats/{instance_path}", {}, timeout=240)
    print(f"chats na instancia: {len(chats)}")

    # Mesmo em --full, preserve o ultimo checkpoint valido: falhas parciais de
    # rede nao podem apagar sessoes ja publicadas.
    ck = (
        json.loads(CHECKPOINT.read_text(encoding="utf-8"))
        if CHECKPOINT.exists()
        else {}
    )
    retention_cutoff = int(
        (
            datetime.datetime.now(datetime.timezone.utc)
            - datetime.timedelta(days=RETENTION_DAYS)
        ).timestamp()
    )
    before_prune = len(ck)
    ck = {
        jid: value
        for jid, value in ck.items()
        if str(value.get("lmts") or "").isdigit()
        and int(value.get("lmts") or 0) >= retention_cutoff
    }
    pruned = before_prune - len(ck)
    if pruned:
        print(f"checkpoint: {pruned} chats removidos antes da coleta")
    todo = []
    for ch in chats:
        jid = ch.get("remoteJid") or ""
        lmts = (ch.get("lastMessage") or {}).get("messageTimestamp") or 0
        if not jid or "@" not in jid or jid.endswith("@g.us"):
            continue
        if not str(lmts).isdigit() or int(lmts) < retention_cutoff:
            continue
        if SINCE and (not lmts or datetime.datetime.utcfromtimestamp(int(lmts)) < SINCE):
            continue
        if FULL or str(lmts) != str(ck.get(jid, {}).get("lmts")):
            todo.append((jid, lmts))
    if BACKFILL_ADS:
        ja = {j for j, _ in todo}
        for jid, v in ck.items():
            sessions = result_sessions((v.get("r") or {}))
            needs_backfill = any(
                session.get("ctwa") and not (session.get("ctwa") or {}).get("ad_id")
                for session in sessions
            )
            if needs_backfill and jid not in ja:
                todo.append((jid, v.get("lmts") or 0))
        print(f"backfill ads: {len(todo)} chats na fila")
    print(f"chats a processar: {len(todo)} (de {len(chats)})")

    results = {}

    def work(item):
        jid, lmts = item
        a = analyze_chat(jid)
        return jid, lmts, a

    processed = 0
    with ThreadPoolExecutor(max_workers=10) as ex:
        for jid, lmts, analyzed in ex.map(work, todo):
            processed += 1
            if analyzed is not None:
                results[jid] = (lmts, analyzed)
            if processed % 100 == 0:
                print(f"  progresso {processed}/{len(todo)}", flush=True)

    succeeded = len(results)
    failed = len(todo) - succeeded
    failure_rate = (failed * 100.0 / len(todo)) if todo else 0.0
    print(
        "processados: "
        f"{succeeded} | erros: {failed} | taxa de falha: {failure_rate:.2f}%"
    )

    audit = {
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "queued": len(todo),
        "succeeded": succeeded,
        "failed": failed,
        "failure_rate_percent": round(failure_rate, 4),
        "max_failure_rate_percent": MAX_FAILURE_RATE_PERCENT,
        "checkpoint_updated": False,
        "checkpoint_entries_before_prune": before_prune,
        "checkpoint_entries_pruned": pruned,
        "status": "ok",
    }

    # Se nenhuma conversa da fila pôde ser analisada, não publique uma coleta
    # vazia nem avance o checkpoint. A próxima execução deve tentar tudo de novo.
    if todo and failed == len(todo):
        audit["status"] = "total_failure"
        atomic_write_json(COLLECTION_AUDIT, audit, indent=2)
        print(
            "erro: todas as conversas da fila falharam; checkpoint preservado",
            file=sys.stderr,
        )
        return 1

    for jid, (lmts, a) in results.items():
        previous = (ck.get(jid) or {}).get("r") or {}
        ck[jid] = {"lmts": lmts, "r": merge_result(jid, previous, a)}
    atomic_write_json(CHECKPOINT, ck)
    audit["checkpoint_updated"] = True

    rows = []
    for jid, v in ck.items():
        for session in result_sessions((v.get("r") or {})):
            if int(session.get("last_ts") or 0) < retention_cutoff:
                continue
            first = session.get("first") or {}
            code = session.get("code") or {}
            ctwa = session.get("ctwa") or {}
            context = infer_message_context(first.get("txt") or "")
            wa_ref = code.get("codigo", "")
            origem = "Meta CTWA (anuncio direto)" if ctwa else code.get("origem", "Direto/organico (sem marcacao)")
            rows.append({
                "lead_session_id": session.get("lead_session_id") or session_id(jid, session),
                "session_started_reason": session.get("started_reason", "legacy_checkpoint"),
                "session_last_contact_epoch": session.get("last_ts", ""),
                "telefone": first.get("phone", ""), "jid": jid,
                "nome_whatsapp": first.get("push", ""),
                "primeiro_contato": first.get("ts", ""),
                "primeiro_contato_epoch": first.get("ts_epoch", ""),
                "origem": origem,
                "codigo_site": wa_ref,
                "wa_ref": wa_ref,
                # O click_id forte vive no log proprio do site. Ele so e preenchido
                # depois que o enriquecimento concilia este wa_ref com esse log.
                "click_id": "",
                "wa_source": code.get("origem", "") if code else (ctwa.get("fonte") or ""),
                "intent": context["intent"],
                "city": context["city"],
                "vehicle_id": "",
                "vehicle_name": context["vehicle_name"],
                "store": "",
                "salesperson": "",
                "campanha_titulo": ctwa.get("titulo", ""),
                "criativo_url": ctwa.get("criativo_url", ""),
                "ad_id": ctwa.get("ad_id", ""),
                "ctwa_clid": ctwa.get("ctwa_clid", ""),
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

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    temp_csv = OUT_CSV.with_name(f".{OUT_CSV.name}.tmp")
    with open(temp_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else ["telefone"])
        w.writeheader()
        w.writerows(rows)
    os.replace(temp_csv, OUT_CSV)
    chmod_private(OUT_CSV)

    ctwa_n = sum(1 for r in rows if r["origem"].startswith("Meta CTWA"))
    code_n = sum(1 for r in rows if r["codigo_site"])
    camp_n = sum(1 for r in rows if r["campanha_meta"])
    print(f"\nCSV: {OUT_CSV}")
    print(f"total leads: {len(rows)} | com codigo site: {code_n} | Meta CTWA: {ctwa_n} | com campanha resolvida: {camp_n}")

    if failed and failure_rate > MAX_FAILURE_RATE_PERCENT:
        audit["status"] = "partial_failure_threshold_exceeded"
    elif failed:
        audit["status"] = "partial_failure_within_threshold"
    atomic_write_json(COLLECTION_AUDIT, audit, indent=2)

    if audit["status"] == "partial_failure_threshold_exceeded":
        print(
            "erro: taxa de falha parcial da Evolution "
            f"({failure_rate:.2f}%) excedeu o limite "
            f"({MAX_FAILURE_RATE_PERCENT}%); resultados validos foram preservados",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ConfigError, urllib.error.URLError, json.JSONDecodeError) as exc:
        print(f"erro: {redact_text(exc)}", file=sys.stderr)
        sys.exit(1)
