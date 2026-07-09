/**
 * Mapeamento estoque Netcar → linhas do catálogo Meta Commerce (E-commerce).
 * Usado pelo gerador estático (CSV/XML) e espelhado no endpoint PHP ao vivo.
 */

import { generateVehicleSlug } from "./vehicle-sitemap-urls.js";

export const SITE_URL = "https://www.netcarmultimarcas.com.br";
export const API_URL = `${SITE_URL}/api/v1/veiculos.php?limit=500`;

export const CSV_HEADERS = [
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
];

/** Meta aceita melhor JPG/PNG; AVIF/WebP costuma falhar no feed. */
export function isMetaFriendlyImage(url) {
  const path = String(url).split("?")[0].toLowerCase();
  return /\.(jpe?g|png|gif)$/.test(path);
}

export function encodeUrlPath(absoluteUrl) {
  try {
    const u = new URL(absoluteUrl);
    u.pathname = u.pathname
      .split("/")
      .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
      .join("/");
    return u.toString();
  } catch {
    return absoluteUrl.replace(/ /g, "%20");
  }
}

export function normalizeImageUrl(url) {
  if (!url) return "";

  let normalized = String(url)
    .replace(/^\.\\?\/+/, "")
    .replace(/\\/g, "/")
    .trim();

  if (!normalized) return "";

  let absolute;
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    absolute = normalized;
  } else if (normalized.startsWith("/")) {
    absolute = `${SITE_URL}${normalized}`;
  } else {
    absolute = `${SITE_URL}/${normalized}`;
  }

  return encodeUrlPath(absolute);
}

export function escapeCsvField(value) {
  const str = String(value ?? "");
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function formatPrice(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${n.toFixed(2)} BRL`;
}

function formatKm(km) {
  const n = Number(km);
  if (!Number.isFinite(n) || n < 0) return null;
  return `${n.toLocaleString("pt-BR")} km`;
}

export function buildTitle(vehicle) {
  const parts = [vehicle.marca, vehicle.modelo, vehicle.ano]
    .map((p) => (p == null ? "" : String(p).trim()))
    .filter(Boolean);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function buildDescription(vehicle) {
  const bits = [];
  const km = formatKm(vehicle.km);
  if (km) bits.push(km);
  if (vehicle.motor) bits.push(`Motor ${String(vehicle.motor).trim()}`);
  if (vehicle.cambio) bits.push(String(vehicle.cambio).trim());
  if (vehicle.combustivel) bits.push(String(vehicle.combustivel).trim());
  if (vehicle.cor) bits.push(`Cor ${String(vehicle.cor).trim()}`);

  const specs = bits.join(" · ");
  const base =
    "Seminovo vistoriado na Netcar Multimarcas (Esteio/RS). Financiamento e avaliação na troca.";
  return specs ? `${specs}. ${base}` : base;
}

export function collectImageUrls(vehicle) {
  const urls = [];
  const site = vehicle.imagens_site || {};
  const imagens = vehicle.imagens || {};

  const candidates = [
    site.capa,
    site.capa_opengraph,
    ...(Array.isArray(imagens.full) ? imagens.full : []),
    ...(Array.isArray(imagens.thumb) ? imagens.thumb : []),
    ...(Array.isArray(site.galeria) ? site.galeria : []),
  ];

  const friendly = [];
  const fallback = [];

  for (const candidate of candidates) {
    const absolute = normalizeImageUrl(candidate);
    if (!absolute) continue;
    if (isMetaFriendlyImage(absolute)) {
      if (!friendly.includes(absolute)) friendly.push(absolute);
    } else if (!fallback.includes(absolute)) {
      fallback.push(absolute);
    }
  }

  for (const absolute of [...friendly, ...fallback]) {
    if (!urls.includes(absolute)) urls.push(absolute);
    if (urls.length >= 10) break;
  }

  return urls;
}

export function isAvailable(vehicle) {
  if (Number(vehicle.valor) <= 0) return false;
  if (String(vehicle.valor_formatado || "").trim().toLowerCase() === "vendido") {
    return false;
  }
  return true;
}

export function toCatalogRow(vehicle) {
  const title = buildTitle(vehicle);
  const description = buildDescription(vehicle);
  const price = formatPrice(vehicle.valor);
  const images = collectImageUrls(vehicle);
  const imageLink = images[0] || "";
  const additional = images.slice(1, 10).join(",");

  if (!title || !description || !price || !imageLink) {
    return null;
  }

  const slug = generateVehicleSlug(vehicle);

  return {
    id: String(vehicle.id),
    title,
    description,
    availability: "in stock",
    condition: "used",
    price,
    link: `${SITE_URL}/veiculo/${slug}`,
    image_link: imageLink,
    brand: String(vehicle.marca || "").trim(),
    additional_image_link: additional,
  };
}

export function buildCatalogRows(vehicles) {
  const rows = [];
  let skipped = 0;

  for (const vehicle of vehicles) {
    if (!isAvailable(vehicle)) {
      skipped += 1;
      continue;
    }
    const row = toCatalogRow(vehicle);
    if (!row) {
      skipped += 1;
      continue;
    }
    rows.push(row);
  }

  return { rows, skipped };
}

export function rowsToCsv(rows) {
  const lines = [CSV_HEADERS.join(",")];
  for (const row of rows) {
    lines.push(CSV_HEADERS.map((key) => escapeCsvField(row[key])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

/** RSS/Atom-style product feed aceito pelo Commerce Manager (item + g:). */
export function rowsToXml(rows) {
  const items = rows
    .map((row) => {
      const extraImages = String(row.additional_image_link || "")
        .split(",")
        .map((u) => u.trim())
        .filter(Boolean)
        .map((u) => `      <g:additional_image_link>${escapeXml(u)}</g:additional_image_link>`)
        .join("\n");

      return [
        "    <item>",
        `      <g:id>${escapeXml(row.id)}</g:id>`,
        `      <g:title>${escapeXml(row.title)}</g:title>`,
        `      <g:description>${escapeXml(row.description)}</g:description>`,
        `      <g:availability>${escapeXml(row.availability)}</g:availability>`,
        `      <g:condition>${escapeXml(row.condition)}</g:condition>`,
        `      <g:price>${escapeXml(row.price)}</g:price>`,
        `      <g:link>${escapeXml(row.link)}</g:link>`,
        `      <g:image_link>${escapeXml(row.image_link)}</g:image_link>`,
        `      <g:brand>${escapeXml(row.brand)}</g:brand>`,
        extraImages,
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    "  <channel>",
    "    <title>Netcar Seminovos</title>",
    `    <link>${SITE_URL}</link>`,
    "    <description>Estoque de seminovos Netcar Multimarcas para WhatsApp Catalog</description>",
    items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

export async function fetchVehicles() {
  const response = await fetch(API_URL, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`API retornou HTTP ${response.status}`);
  }

  const json = await response.json();
  if (!json.success || !Array.isArray(json.data)) {
    throw new Error("Resposta da API inválida");
  }

  return json.data;
}
