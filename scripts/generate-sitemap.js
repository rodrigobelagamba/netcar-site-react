#!/usr/bin/env node

/**
 * Gera sitemap.xml com páginas estáticas + veículos disponíveis na API.
 * Uso: node scripts/generate-sitemap.js
 * Integrado ao npm run build.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { writeTextFile } from "./lib/write-text-file.js";
import { fetchVehicleSitemapUrls } from "./lib/vehicle-sitemap-urls.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const SITE_URL = "https://www.netcarmultimarcas.com.br";

const STATIC_PAGES = [
  { loc: "/", changefreq: "daily", priority: "1.0" },
  { loc: "/seminovos", changefreq: "daily", priority: "0.9" },
  { loc: "/sobre", changefreq: "monthly", priority: "0.8" },
  { loc: "/contato", changefreq: "monthly", priority: "0.8" },
  { loc: "/compra", changefreq: "monthly", priority: "0.7" },
  { loc: "/blog", changefreq: "weekly", priority: "0.6" },
];

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildUrlEntry(loc, changefreq, priority, lastmod) {
  const lines = [
    "  <url>",
    `    <loc>${escapeXml(loc)}</loc>`,
  ];
  if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);
  lines.push(`    <changefreq>${changefreq}</changefreq>`);
  lines.push(`    <priority>${priority}</priority>`);
  lines.push("  </url>");
  return lines.join("\n");
}

async function fetchAvailableVehicles() {
  const urls = await fetchVehicleSitemapUrls();
  return urls.map((loc) => ({ loc }));
}

function parseSitemapLastmods(xml) {
  const map = new Map();
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>\s*\n\s*<lastmod>([^<]+)<\/lastmod>/g)) {
    map.set(match[1], match[2]);
  }
  return map;
}

async function main() {
  console.log("Gerando sitemap.xml...");

  let vehicleUrls = [];
  try {
    vehicleUrls = await fetchAvailableVehicles();
    console.log(`  ${vehicleUrls.length} veículos disponíveis encontrados`);
  } catch (error) {
    console.warn(`  Aviso: não foi possível buscar veículos (${error.message}). Sitemap terá só páginas estáticas.`);
  }

  const today = new Date().toISOString().split("T")[0];
  const outputPath = join(rootDir, "public", "sitemap.xml");
  let previousLastmods = new Map();
  try {
    previousLastmods = parseSitemapLastmods(readFileSync(outputPath, "utf-8"));
  } catch {
    // primeiro build
  }

  const entries = [];

  for (const page of STATIC_PAGES) {
    const loc = `${SITE_URL}${page.loc}`;
    const lastmod = previousLastmods.get(loc) ?? today;
    entries.push(buildUrlEntry(loc, page.changefreq, page.priority, lastmod));
  }

  for (const vehicle of vehicleUrls) {
    const loc = vehicle.loc;
    const lastmod = previousLastmods.get(loc) ?? today;
    entries.push(buildUrlEntry(loc, "weekly", "0.8", lastmod));
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries.join("\n"),
    "</urlset>",
    "",
  ].join("\n");

  const wrote = writeTextFile(outputPath, xml);
  console.log(
    `  ${wrote ? "Salvo" : "Sem alterações"} em ${outputPath} (${STATIC_PAGES.length + vehicleUrls.length} URLs)`
  );
}

main().catch((error) => {
  console.error("Erro ao gerar sitemap:", error);
  process.exit(1);
});
