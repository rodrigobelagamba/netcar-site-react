#!/usr/bin/env node

/**
 * Gera sitemap.xml com páginas estáticas + veículos disponíveis na API.
 * Uso: node scripts/generate-sitemap.js
 * Integrado ao npm run build.
 */

import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const SITE_URL = "https://www.netcarmultimarcas.com.br";
const API_URL = `${SITE_URL}/api/v1/veiculos.php?limit=500`;

const STATIC_PAGES = [
  { loc: "/", changefreq: "daily", priority: "1.0" },
  { loc: "/seminovos", changefreq: "daily", priority: "0.9" },
  { loc: "/sobre", changefreq: "monthly", priority: "0.8" },
  { loc: "/contato", changefreq: "monthly", priority: "0.8" },
  { loc: "/compra", changefreq: "monthly", priority: "0.7" },
  { loc: "/blog", changefreq: "weekly", priority: "0.6" },
];

function maskPlate(placa) {
  if (!placa) return "";
  const clean = placa.replace(/\s/g, "").toUpperCase().replace(/-/g, "");
  if (clean.length < 5) return clean.toLowerCase();
  const prefix = clean.substring(0, 3);
  const digits = clean.match(/\d/g);
  const suffix = digits && digits.length >= 2 ? digits.slice(-2).join("") : clean.slice(-2);
  return `${prefix.toLowerCase()}-xx${suffix}`;
}

function generateVehicleSlug(vehicle) {
  const parts = [];

  if (vehicle.modelo) {
    let modelo = vehicle.modelo.trim();
    if (vehicle.marca && modelo.toLowerCase().startsWith(vehicle.marca.toLowerCase())) {
      modelo = modelo.substring(vehicle.marca.length).trim();
    }
    const modeloSlug = modelo
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (modeloSlug) parts.push(modeloSlug);
  }

  if (vehicle.ano) parts.push(String(vehicle.ano));
  if (vehicle.placa) {
    const placaSlug = maskPlate(vehicle.placa);
    if (placaSlug) parts.push(placaSlug);
  }
  parts.push(String(vehicle.id));

  return parts.join("-");
}

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

  return json.data.filter((vehicle) => Number(vehicle.valor) > 0);
}

async function main() {
  console.log("Gerando sitemap.xml...");

  let vehicles = [];
  try {
    vehicles = await fetchAvailableVehicles();
    console.log(`  ${vehicles.length} veículos disponíveis encontrados`);
  } catch (error) {
    console.warn(`  Aviso: não foi possível buscar veículos (${error.message}). Sitemap terá só páginas estáticas.`);
  }

  const today = new Date().toISOString().split("T")[0];
  const entries = [];

  for (const page of STATIC_PAGES) {
    entries.push(buildUrlEntry(`${SITE_URL}${page.loc}`, page.changefreq, page.priority, today));
  }

  for (const vehicle of vehicles) {
    const slug = generateVehicleSlug(vehicle);
    const loc = `${SITE_URL}/veiculo/${slug}`;
    const lastmod = vehicle.data_atualizacao
      ? String(vehicle.data_atualizacao).split(" ")[0]
      : today;
    entries.push(buildUrlEntry(loc, "weekly", "0.8", lastmod));
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries.join("\n"),
    "</urlset>",
    "",
  ].join("\n");

  const outputPath = join(rootDir, "public", "sitemap.xml");
  writeFileSync(outputPath, xml, "utf-8");
  console.log(`  Salvo em ${outputPath} (${STATIC_PAGES.length + vehicles.length} URLs)`);
}

main().catch((error) => {
  console.error("Erro ao gerar sitemap:", error);
  process.exit(1);
});
