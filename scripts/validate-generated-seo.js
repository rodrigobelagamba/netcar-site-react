#!/usr/bin/env node

/**
 * Valida o HTML que o Apache entrega aos crawlers depois da geração.
 * Complementa validate-regional-seo.js, que verifica apenas a fonte JSON.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const site = "https://www.netcarmultimarcas.com.br";
const cities = JSON.parse(
  readFileSync(join(root, "src/data/seo/cities.json"), "utf8"),
);
const sitemap = readFileSync(join(root, "public/sitemap.xml"), "utf8");
const errors = [];
const canonicals = new Set();

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function occurrences(text, value) {
  return text.split(value).length - 1;
}

function schemaTypes(html) {
  const types = new Set();
  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const schema = JSON.parse(match[1]);
      const type = schema?.["@type"];
      if (Array.isArray(type)) type.forEach((item) => types.add(item));
      else if (type) types.add(type);
    } catch {
      errors.push("JSON-LD inválido em HTML regional gerado");
    }
  }
  return types;
}

function validatePage({ file, canonical, title, description, h1, label, requireStock }) {
  let html;
  try {
    html = readFileSync(join(root, "public/seo-static", file), "utf8");
  } catch {
    errors.push(`${label}: HTML gerado ausente (${file})`);
    return;
  }

  if (!html.includes(`<title>${escapeHtml(title)}</title>`)) {
    errors.push(`${label}: title incorreto no HTML gerado`);
  }
  if (!html.includes(`<meta name="description" content="${escapeHtml(description)}" />`)) {
    errors.push(`${label}: description incorreta no HTML gerado`);
  }
  if (!html.includes(`<link rel="canonical" href="${canonical}" />`)) {
    errors.push(`${label}: canonical incorreto no HTML gerado`);
  }
  if (occurrences(html, `<h1>${escapeHtml(h1)}</h1>`) !== 1) {
    errors.push(`${label}: precisa ter exatamente um H1 esperado`);
  }
  if (canonicals.has(canonical)) errors.push(`${label}: canonical duplicado`);
  canonicals.add(canonical);

  const types = schemaTypes(html);
  for (const expected of ["AutoDealer", "FAQPage", "BreadcrumbList"]) {
    if (!types.has(expected)) errors.push(`${label}: schema ${expected} ausente`);
  }

  if (!html.includes(`${site}/regioes-atendidas`)) {
    errors.push(`${label}: link para o hub regional ausente`);
  }
  if (!html.includes(`${site}/seminovos`)) {
    errors.push(`${label}: link para o estoque ausente`);
  }
  if (requireStock && !html.includes(`${site}/veiculo/`)) {
    errors.push(`${label}: vitrine de estoque real ausente`);
  }

  const sitemapEntry = `<loc>${canonical}</loc>`;
  if (occurrences(sitemap, sitemapEntry) !== 1) {
    errors.push(`${label}: URL ausente ou duplicada no sitemap`);
  }
}

for (const city of cities) {
  validatePage({
    file: `city-${city.slug}.html`,
    canonical: `${site}/seminovos-${city.slug}`,
    title: city.title,
    description: city.description,
    h1: city.h1,
    label: `seminovos-${city.slug}`,
    requireStock: true,
  });

  if (city.sell) {
    validatePage({
      file: `sell-city-${city.slug}.html`,
      canonical: `${site}/vender-carro-${city.slug}`,
      title: city.sell.title,
      description: city.sell.description,
      h1: city.sell.h1,
      label: `vender-carro-${city.slug}`,
      requireStock: true,
    });
  }
}

if (sitemap.includes("<loc>https://www.netcarmultimarcas.com.br/index.php</loc>")) {
  errors.push("sitemap não pode conter /index.php");
}
for (const match of sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(match[1])) {
    errors.push(`lastmod inválido no sitemap: ${match[1]}`);
  }
}

if (errors.length) {
  console.error("SEO gerado inválido:\n");
  for (const error of [...new Set(errors)]) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `SEO gerado válido: ${cities.length} páginas de compra e ${cities.filter((city) => city.sell).length} de venda.`,
);
