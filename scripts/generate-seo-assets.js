#!/usr/bin/env node

/**
 * Gera sitemap.xml e HTML estático para crawlers (blog + páginas locais).
 * Roda no postbuild antes do deploy.
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const publicDir = join(rootDir, "public");
const seoStaticDir = join(publicDir, "seo-static");

const SITE = "https://www.netcarmultimarcas.com.br";
const today = new Date().toISOString().slice(0, 10);

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

function pageShell({ title, description, canonical, body }) {
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
  <meta property="og:image" content="${SITE}/images/loja1.jpg" />
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
  writeFileSync(
    join(seoStaticDir, `blog-${post.slug}.html`),
    pageShell({ title: post.title, description: post.description, canonical, body })
  );
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
      <p><a href="${SITE}/seminovos">Ver estoque</a></p>
    </article>`;
  writeFileSync(
    join(seoStaticDir, `city-${city.slug}.html`),
    pageShell({ title: city.title, description: city.description, canonical, body })
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
    writeFileSync(
      join(seoStaticDir, `sell-city-${city.slug}.html`),
      pageShell({
        title: city.sell.title,
        description: city.sell.description,
        canonical: sellCanonical,
        body: sellBody,
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
  { path: "/financiamento-sem-entrada", priority: "0.8", changefreq: "monthly" },
  { path: "/seminovos-automaticos", priority: "0.8", changefreq: "daily" },
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

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;

writeFileSync(join(publicDir, "sitemap.xml"), sitemap);

const sellPages = cities.filter((city) => city.sell).length;
console.log(
  `SEO assets gerados: ${blogPosts.length} posts, ${cities.length} cidades compra, ${sellPages} cidades venda, ${vehicleUrls.length} veículos preservados, sitemap com ${urls.length} URLs`
);
