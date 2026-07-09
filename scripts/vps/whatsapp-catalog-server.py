#!/usr/bin/env python3
"""Feed ao vivo Netcar → Meta Commerce / WhatsApp Catalog (CSV + XML).

Roda na VPS (ex.: 191.252.212.86:3099). Fonte: API JSON do site.
"""

from __future__ import annotations

import json
import re
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, unquote, urlparse, urlsplit, urlunsplit

SITE_URL = "https://www.netcarmultimarcas.com.br"
API_URL = f"{SITE_URL}/api/v1/veiculos.php?limit=500"
CACHE_TTL = 300
PORT = 3099

_cache = {"ts": 0.0, "data": []}


def fetch_vehicles():
    now = time.time()
    if _cache["data"] and now - _cache["ts"] < CACHE_TTL:
        return _cache["data"]
    req = urllib.request.Request(API_URL, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    if not payload.get("success") or not isinstance(payload.get("data"), list):
        raise RuntimeError("Resposta da API inválida")
    _cache["data"] = payload["data"]
    _cache["ts"] = now
    return _cache["data"]


def encode_url_path(url: str) -> str:
    parts = urlsplit(url)
    path = "/".join(
        quote(unquote(seg), safe="") if seg else "" for seg in parts.path.split("/")
    )
    return urlunsplit((parts.scheme, parts.netloc, path, parts.query, parts.fragment))


def normalize_image_url(url: str | None) -> str:
    if not url:
        return ""
    normalized = str(url).replace("\\", "/").strip()
    normalized = re.sub(r"^\./+", "", normalized)
    if not normalized:
        return ""
    if normalized.startswith("http://") or normalized.startswith("https://"):
        absolute = normalized
    elif normalized.startswith("/"):
        absolute = f"{SITE_URL}{normalized}"
    else:
        absolute = f"{SITE_URL}/{normalized}"
    return encode_url_path(absolute)


def is_meta_friendly(url: str) -> bool:
    path = url.split("?", 1)[0].lower()
    return bool(re.search(r"\.(jpe?g|png|gif)$", path))


def mask_plate(placa: str) -> str:
    clean = re.sub(r"[\s-]", "", placa).upper()
    if len(clean) < 5:
        return clean.lower()
    prefix = clean[:3].lower()
    digits = re.findall(r"\d", clean)
    suffix = "".join(digits[-2:]) if len(digits) >= 2 else clean[-2:]
    return f"{prefix}-xx{suffix}"


def slugify_modelo(modelo: str, marca: str) -> str:
    modelo = modelo.strip()
    if marca and modelo.lower().startswith(marca.lower()):
        modelo = modelo[len(marca) :].strip()
    modelo = modelo.lower()
    modelo = re.sub(r"[^a-z0-9\s-]", "", modelo)
    modelo = re.sub(r"\s+", "-", modelo)
    modelo = re.sub(r"-+", "-", modelo).strip("-")
    return modelo


def generate_slug(v: dict) -> str:
    parts = []
    modelo = str(v.get("modelo") or "")
    marca = str(v.get("marca") or "")
    if modelo:
        s = slugify_modelo(modelo, marca)
        if s:
            parts.append(s)
    if v.get("ano"):
        parts.append(str(v["ano"]))
    if v.get("placa"):
        parts.append(mask_plate(str(v["placa"])))
    parts.append(str(v.get("id") or ""))
    return "-".join(parts)


def collect_images(v: dict) -> list[str]:
    site = v.get("imagens_site") or {}
    imagens = v.get("imagens") or {}
    candidates = []
    for key in ("capa", "capa_opengraph"):
        if site.get(key):
            candidates.append(site[key])
    for key in ("full", "thumb"):
        vals = imagens.get(key) or []
        if isinstance(vals, list):
            candidates.extend(vals)
    galeria = site.get("galeria") or []
    if isinstance(galeria, list):
        candidates.extend(galeria)

    friendly, fallback = [], []
    for c in candidates:
        absolute = normalize_image_url(c if isinstance(c, str) else None)
        if not absolute:
            continue
        if is_meta_friendly(absolute):
            if absolute not in friendly:
                friendly.append(absolute)
        elif absolute not in fallback:
            fallback.append(absolute)

    urls = []
    for absolute in friendly + fallback:
        if absolute not in urls:
            urls.append(absolute)
        if len(urls) >= 10:
            break
    return urls


def is_available(v: dict) -> bool:
    try:
        if float(v.get("valor") or 0) <= 0:
            return False
    except (TypeError, ValueError):
        return False
    return str(v.get("valor_formatado") or "").strip().lower() != "vendido"


def build_title(v: dict) -> str:
    parts = [v.get("marca"), v.get("modelo"), v.get("ano")]
    return " ".join(str(p).strip() for p in parts if p is not None and str(p).strip())


def build_description(v: dict) -> str:
    bits = []
    try:
        km = int(v.get("km"))
        if km >= 0:
            bits.append(f"{km:,}".replace(",", ".") + " km")
    except (TypeError, ValueError):
        pass
    if v.get("motor"):
        bits.append(f"Motor {str(v['motor']).strip()}")
    if v.get("cambio"):
        bits.append(str(v["cambio"]).strip())
    if v.get("combustivel"):
        bits.append(str(v["combustivel"]).strip())
    if v.get("cor"):
        bits.append(f"Cor {str(v['cor']).strip()}")
    base = (
        "Seminovo vistoriado na Netcar Multimarcas (Esteio/RS). "
        "Financiamento e avaliação na troca."
    )
    return f"{' · '.join(bits)}. {base}" if bits else base


def to_row(v: dict) -> dict | None:
    if not is_available(v):
        return None
    title = build_title(v)
    description = build_description(v)
    try:
        price_n = float(v.get("valor") or 0)
    except (TypeError, ValueError):
        return None
    if price_n <= 0:
        return None
    price = f"{price_n:.2f} BRL"
    images = collect_images(v)
    if not title or not description or not images:
        return None
    return {
        "id": str(v.get("id") or ""),
        "title": title,
        "description": description,
        "availability": "in stock",
        "condition": "used",
        "price": price,
        "link": f"{SITE_URL}/veiculo/{generate_slug(v)}",
        "image_link": images[0],
        "brand": str(v.get("marca") or "").strip(),
        "additional_image_link": ",".join(images[1:10]),
    }


def escape_csv(value) -> str:
    s = str(value or "")
    if re.search(r'[",\n\r]', s):
        return '"' + s.replace('"', '""') + '"'
    return s


def rows_to_csv(rows: list[dict]) -> str:
    headers = [
        "id",
        "title",
        "description",
        "availability",
        "condition",
        "price",
        "link",
        "image_link",
        "brand",
        "additional_image_link",
    ]
    lines = [",".join(headers)]
    for row in rows:
        lines.append(",".join(escape_csv(row.get(h, "")) for h in headers))
    return "\n".join(lines) + "\n"


def escape_xml(value) -> str:
    return (
        str(value or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def rows_to_xml(rows: list[dict]) -> str:
    items = []
    for row in rows:
        extras = []
        for u in str(row.get("additional_image_link") or "").split(","):
            u = u.strip()
            if u:
                extras.append(
                    f"      <g:additional_image_link>{escape_xml(u)}</g:additional_image_link>"
                )
        block = [
            "    <item>",
            f"      <g:id>{escape_xml(row['id'])}</g:id>",
            f"      <g:title>{escape_xml(row['title'])}</g:title>",
            f"      <g:description>{escape_xml(row['description'])}</g:description>",
            f"      <g:availability>{escape_xml(row['availability'])}</g:availability>",
            f"      <g:condition>{escape_xml(row['condition'])}</g:condition>",
            f"      <g:price>{escape_xml(row['price'])}</g:price>",
            f"      <g:link>{escape_xml(row['link'])}</g:link>",
            f"      <g:image_link>{escape_xml(row['image_link'])}</g:image_link>",
            f"      <g:brand>{escape_xml(row['brand'])}</g:brand>",
            *extras,
            "    </item>",
        ]
        items.append("\n".join(block))
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n'
        "  <channel>\n"
        "    <title>Netcar Seminovos</title>\n"
        f"    <link>{escape_xml(SITE_URL)}</link>\n"
        "    <description>Estoque de seminovos Netcar Multimarcas para WhatsApp Catalog</description>\n"
        + "\n".join(items)
        + "\n  </channel>\n</rss>\n"
    )


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        qs = parse_qs(parsed.query)
        try:
            if path in ("/", "/health"):
                body = b"ok netcar-whatsapp-catalog\n"
                self.send_response(200)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return

            allowed = {
                "/feeds/whatsapp-catalog",
                "/feeds/whatsapp-catalog.csv",
                "/feeds/whatsapp-catalog.xml",
                "/whatsapp-catalog.csv",
                "/whatsapp-catalog.xml",
            }
            fmt = "csv"
            if path.endswith(".xml") or qs.get("format", [""])[0].lower() == "xml":
                fmt = "xml"
            elif path.endswith(".csv") or qs.get("format", [""])[0].lower() == "csv":
                fmt = "csv"
            elif path not in allowed:
                self.send_error(404, "Not found")
                return

            vehicles = fetch_vehicles()
            rows = []
            for v in vehicles:
                if isinstance(v, dict):
                    row = to_row(v)
                    if row:
                        rows.append(row)

            if fmt == "xml":
                text = rows_to_xml(rows)
                ctype = "application/xml; charset=utf-8"
            else:
                text = rows_to_csv(rows)
                ctype = "text/csv; charset=utf-8"

            body = text.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "public, max-age=60")
            self.send_header("X-Robots-Tag", "noindex")
            self.end_headers()
            self.wfile.write(body)
        except Exception as exc:  # noqa: BLE001
            msg = f"Feed indisponivel: {exc}\n".encode("utf-8")
            self.send_response(502)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"netcar-whatsapp-catalog listening on :{PORT}", flush=True)
    server.serve_forever()
