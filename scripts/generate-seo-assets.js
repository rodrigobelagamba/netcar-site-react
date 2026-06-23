#!/usr/bin/env node

/**
 * Gera sitemap.xml e HTML estático para crawlers (blog + páginas locais).
 * Roda no postbuild antes do deploy.
 */

import { readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { writeTextFile } from "./lib/write-text-file.js";
import { fetchVehicleSitemapUrls } from "./lib/vehicle-sitemap-urls.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const publicDir = join(rootDir, "public");
const seoStaticDir = join(publicDir, "seo-static");

const SITE = "https://www.netcarmultimarcas.com.br";
const WHATSAPP_IAN = "5551997293118";
const today = new Date().toISOString().slice(0, 10);

function cityWhatsAppLink(cityName) {
  const text = `Oi iAN! Moro em ${cityName} e estou procurando um seminovo.`;
  return `https://wa.me/${WHATSAPP_IAN}?text=${encodeURIComponent(text)}`;
}

// Gera config PHP a partir do .env.production, para o index.php não duplicar
// a URL da API. O .env não vai para o servidor; este arquivo gerado vai.
try {
  const envFile = readFileSync(join(rootDir, ".env.production"), "utf-8");
  const apiBaseMatch = envFile.match(/^VITE_API_BASE_URL=(.+)$/m);
  const apiBaseUrl = apiBaseMatch ? apiBaseMatch[1].trim().replace(/^["']|["']$/g, "") : "";
  if (apiBaseUrl) {
    writeTextFile(
      join(publicDir, "netcar-config.php"),
      `<?php\n// Gerado no build a partir de .env.production — nao editar manualmente.\ndefine('NETCAR_API_BASE_URL', '${apiBaseUrl.replace(/'/g, "\\'")}');\n`
    );
    console.log(`netcar-config.php gerado (API: ${apiBaseUrl})`);
  }
} catch {
  console.warn("Aviso: .env.production não encontrado; netcar-config.php não gerado.");
}

// AutoDealer (LocalBusiness) — mesmos dados de seo_org_schema() em public/seo/helpers.php.
// Sem AggregateRating/reviews.
const ORG_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "AutoDealer",
  "@id": `${SITE}/#organization`,
  name: "Netcar Multimarcas",
  alternateName: "Netcar Veículos",
  legalName: "Netcar Veículos Ltda",
  foundingDate: "1997",
  description:
    "Loja de seminovos em Esteio/RS. Carros com garantia, vistoriados e financiamento facilitado. 2 lojas na Av. Getúlio Vargas. Compra de usados, mesmo financiados.",
  url: SITE,
  logo: {
    "@type": "ImageObject",
    url: `${SITE}/images/Logotipo7_1768863597989.png`,
  },
  image: [`${SITE}/images/loja1.jpg`, `${SITE}/images/loja2.jpg`],
  telephone: "+55-51-3473-7900",
  email: "contato@netcarmultimarcas.com.br",
  address: [
    {
      "@type": "PostalAddress",
      name: "Matriz",
      streetAddress: "Av. Getúlio Vargas, 740",
      addressLocality: "Esteio",
      addressRegion: "RS",
      postalCode: "93265-000",
      addressCountry: "BR",
    },
    {
      "@type": "PostalAddress",
      name: "Filial",
      streetAddress: "Av. Getúlio Vargas, 1106",
      addressLocality: "Esteio",
      addressRegion: "RS",
      postalCode: "93265-000",
      addressCountry: "BR",
    },
  ],
  geo: {
    "@type": "GeoCoordinates",
    latitude: "-29.837920",
    longitude: "-51.170236",
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "18:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: "Saturday",
      opens: "09:00",
      closes: "16:30",
    },
  ],
};

function faqSchema(faq) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

const blogPosts = JSON.parse(
  readFileSync(join(rootDir, "src/data/seo/blog-posts.json"), "utf-8")
);
const cities = JSON.parse(
  readFileSync(join(rootDir, "src/data/seo/cities.json"), "utf-8")
);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderSections(sections) {
  return sections
    .map((section) => {
      if (section.type === "h2") {
        return `<h2>${escapeHtml(section.text)}</h2>`;
      }
      if (section.type === "p") {
        return `<p>${escapeHtml(section.text)}</p>`;
      }
      if (section.type === "ul" && section.items) {
        return `<ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
      }
      if (section.type === "ol" && section.items) {
        return `<ol>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`;
      }
      return "";
    })
    .join("\n");
}

function pageShell({ title, description, canonical, body, schemas = [] }) {
  const schemaTags = schemas.length
    ? "\n" +
      schemas
        .map(
          (schema) =>
            `  <script type="application/ld+json">${JSON.stringify(schema)}</script>`
        )
        .join("\n")
    : "";
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Netcar Multimarcas" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${SITE}/images/loja1.jpg" />${schemaTags}
</head>
<body>
  <header>
    <p><strong>Netcar Multimarcas</strong> — Seminovos em Esteio/RS</p>
    <nav>
      <a href="${SITE}/">Home</a>
      <a href="${SITE}/seminovos">Seminovos</a>
      <a href="${SITE}/blog">Blog</a>
      <a href="${SITE}/contato">Contato</a>
    </nav>
  </header>
  <main>${body}</main>
  <footer><p>Netcar Multimarcas — Av. Getúlio Vargas, Esteio/RS</p></footer>
</body>
</html>`;
}

mkdirSync(seoStaticDir, { recursive: true });

for (const post of blogPosts) {
  const canonical = `${SITE}/blog/${post.slug}`;
  const body = `
    <article>
      <h1>${escapeHtml(post.title)}</h1>
      <p>${escapeHtml(post.description)}</p>
      ${renderSections(post.sections)}
      <p><a href="${SITE}${post.ctaHref}">${escapeHtml(post.ctaLabel)}</a></p>
    </article>`;
  writeTextFile(
    join(seoStaticDir, `blog-${post.slug}.html`),
    pageShell({ title: post.title, description: post.description, canonical, body })
  );
}

function relatedCitiesHtml(currentSlug) {
  const links = cities
    .filter((c) => c.slug !== currentSlug)
    .map(
      (c) =>
        `<li><a href="${SITE}/seminovos-${c.slug}">Seminovos perto de ${escapeHtml(c.name)}</a></li>`
    )
    .join("");
  return `<nav aria-label="Seminovos em outras cidades"><h2>Seminovos em outras cidades</h2><ul>${links}</ul></nav>`;
}

for (const city of cities) {
  const canonical = `${SITE}/seminovos-${city.slug}`;
  const faqHtml = city.faq
    .map(
      (item) =>
        `<h3>${escapeHtml(item.q)}</h3><p>${escapeHtml(item.a)}</p>`
    )
    .join("");
  const paragraphs = city.paragraphs
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");
  const body = `
    <article>
      <h1>${escapeHtml(city.h1)}</h1>
      <p>${escapeHtml(city.intro)}</p>
      ${paragraphs}
      ${faqHtml}
      <p>
        <a href="${SITE}/seminovos">Ver estoque</a>
        ·
        <a href="${cityWhatsAppLink(city.name)}">Falar com consultor · 24/7</a>
      </p>
      ${relatedCitiesHtml(city.slug)}
    </article>`;
  writeTextFile(
    join(seoStaticDir, `city-${city.slug}.html`),
    pageShell({
      title: city.title,
      description: city.description,
      canonical,
      body,
      schemas: [ORG_SCHEMA, faqSchema(city.faq)],
    })
  );

  if (city.sell) {
    const sellCanonical = `${SITE}/vender-carro-${city.slug}`;
    const sellFaqHtml = city.sell.faq
      .map((item) => `<h3>${escapeHtml(item.q)}</h3><p>${escapeHtml(item.a)}</p>`)
      .join("");
    const sellParagraphs = city.sell.paragraphs
      .map((p) => `<p>${escapeHtml(p)}</p>`)
      .join("");
    const sellBody = `
    <article>
      <h1>${escapeHtml(city.sell.h1)}</h1>
      <p>${escapeHtml(city.sell.intro)}</p>
      ${sellParagraphs}
      ${sellFaqHtml}
      <p><a href="${SITE}/compra">Avaliar meu carro</a></p>
    </article>`;
    writeTextFile(
      join(seoStaticDir, `sell-city-${city.slug}.html`),
      pageShell({
        title: city.sell.title,
        description: city.sell.description,
        canonical: sellCanonical,
        body: sellBody,
        schemas: [ORG_SCHEMA, faqSchema(city.sell.faq)],
      })
    );
  }
}

const staticPages = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/seminovos", priority: "0.9", changefreq: "daily" },
  { path: "/sobre", priority: "0.8", changefreq: "monthly" },
  { path: "/contato", priority: "0.8", changefreq: "monthly" },
  { path: "/compra", priority: "0.85", changefreq: "weekly" },
  { path: "/compramos-seu-usado", priority: "0.85", changefreq: "weekly" },
  { path: "/vender-meu-carro", priority: "0.85", changefreq: "weekly" },
  { path: "/blog", priority: "0.8", changefreq: "weekly" },
];

// Preserva URLs de veículos no sitemap. No build, generate-sitemap.js roda antes
// e grava o sitemap local com os veículos da API — usamos esse como fonte primária.
// Fallback: sitemap em produção (sem isso, o upload apagaria as URLs de veículo indexadas).
function extractVehicleUrls(xml) {
  const matches = [...xml.matchAll(/<loc>(https?:\/\/[^<]*\/veiculo\/[^<]+)<\/loc>/g)];
  return matches.map((m) => m[1]);
}

async function getVehicleUrls() {
  try {
    const apiUrls = await fetchVehicleSitemapUrls();
    if (apiUrls.length > 0) return apiUrls;
  } catch (error) {
    console.warn(`Aviso: API de veículos indisponível (${error.message}); tentando sitemap local.`);
  }

  try {
    const localXml = readFileSync(join(publicDir, "sitemap.xml"), "utf-8");
    const localUrls = extractVehicleUrls(localXml);
    if (localUrls.length > 0) return localUrls;
  } catch {
    // sem sitemap local; tenta produção
  }

  try {
    const res = await fetch(`${SITE}/sitemap.xml`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    return extractVehicleUrls(await res.text());
  } catch {
    console.warn("Aviso: não foi possível buscar sitemap de produção; veículos ficam de fora.");
    return [];
  }
}

function parseSitemapLastmods(xml) {
  const map = new Map();
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>\s*\n\s*<lastmod>([^<]+)<\/lastmod>/g)) {
    map.set(match[1], match[2]);
  }
  return map;
}

const vehicleUrls = await getVehicleUrls();

const urls = [
  ...staticPages.map((page) => ({ loc: `${SITE}${page.path}`, ...page })),
  ...vehicleUrls.map((loc) => ({
    loc,
    priority: "0.8",
    changefreq: "weekly",
  })),
  ...blogPosts.map((post) => ({
    loc: `${SITE}/blog/${post.slug}`,
    priority: "0.7",
    changefreq: "monthly",
  })),
  ...cities.map((city) => ({
    loc: `${SITE}/seminovos-${city.slug}`,
    priority: "0.8",
    changefreq: "weekly",
  })),
  ...cities
    .filter((city) => city.sell)
    .map((city) => ({
      loc: `${SITE}/vender-carro-${city.slug}`,
      priority: "0.8",
      changefreq: "weekly",
    })),
];

let previousLastmods = new Map();
try {
  previousLastmods = parseSitemapLastmods(readFileSync(join(publicDir, "sitemap.xml"), "utf-8"));
} catch {
  // sem sitemap anterior
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${previousLastmods.get(url.loc) ?? today}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;

writeTextFile(join(publicDir, "sitemap.xml"), sitemap);

const sellPages = cities.filter((city) => city.sell).length;
console.log(
  `SEO assets gerados: ${blogPosts.length} posts, ${cities.length} cidades compra, ${sellPages} cidades venda, ${vehicleUrls.length} veículos preservados, sitemap com ${urls.length} URLs`
);
