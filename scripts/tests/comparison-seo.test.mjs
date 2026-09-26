import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { generateVehicleSlug } from "../lib/vehicle-sitemap-urls.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const site = "https://www.netcarmultimarcas.com.br";
const comparison = JSON.parse(
  readFileSync(join(root, "src/data/seo/comparison.json"), "utf8"),
);
const comparisonPages = JSON.parse(
  readFileSync(join(root, "src/data/seo/comparisons.json"), "utf8"),
);
const generator = readFileSync(
  join(root, "scripts/generate-seo-assets.js"),
  "utf8",
);
const guide = readFileSync(
  join(root, "src/modules/seo/components/ComparisonGuide.tsx"),
  "utf8",
);

function sourceBetween(start, end) {
  const startIndex = generator.indexOf(start);
  const endIndex = generator.indexOf(end, startIndex);
  assert.ok(
    startIndex >= 0 && endIndex > startIndex,
    `Missing section: ${start}`,
  );
  return generator.slice(startIndex, endIndex);
}

// Run the production page shell and comparator section without fetching stock,
// generating other pages, or writing any repository data.
function renderCrawlerPages(
  data = comparison,
  vehicles = [],
  pairPages = comparisonPages,
) {
  const pages = [];
  const context = {
    SITE: site,
    rootDir: root,
    seoStaticDir: join(root, "public/seo-static"),
    join,
    readFileSync(path) {
      if (path === join(root, "src/data/seo/comparison.json"))
        return JSON.stringify(data);
      assert.equal(path, join(root, "src/data/seo/comparisons.json"));
      return JSON.stringify(pairPages);
    },
    stock: vehicles,
    generateVehicleSlug,
    ORG_SCHEMA: { "@type": "Organization", name: "Netcar Multimarcas" },
    HOME_CRUMB: { name: "Home", url: `${site}/` },
    breadcrumbSchema: (items) => ({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: item.url,
      })),
    }),
    stockShowcase: () => "",
    comparatorWhatsAppLink: () => "https://wa.me/5551997293118",
    writeSeoPage: (path, canonical, html) =>
      pages.push({ path, canonical, html }),
  };
  runInNewContext(
    [
      sourceBetween("function escapeHtml(value)", "function renderSections("),
      sourceBetween(
        "function normalizedFilterValue(value)",
        "function normalizeBootstrapImage(",
      ),
      sourceBetween(
        "function titleCase(text)",
        "function showcaseVehicleOrder(",
      ),
      sourceBetween("function pageShell({", "mkdirSync(seoStaticDir"),
      sourceBetween(
        "const comparatorPage =",
        "// Mesma fonte da página React:",
      ),
    ].join("\n"),
    context,
  );
  assert.equal(pages.length, 1 + pairPages.length);
  assert.equal(
    pages[0].path,
    join(root, "public/seo-static/page-comparar.html"),
  );
  assert.equal(pages[0].canonical, `${site}/comparar`);
  return pages;
}

function renderCrawlerPage(data = comparison) {
  return renderCrawlerPages(data)[0].html;
}

function renderGuide(data = comparison) {
  const dependencies = {
    "react/jsx-runtime": jsxRuntime,
    "@/data/seo/comparison.json": data,
    "@tanstack/react-router": {
      Link: ({ to, children, ...props }) =>
        createElement("a", { ...props, href: to }, children),
    },
    "lucide-react": { ArrowUpRight: "svg" },
  };
  const { outputText } = ts.transpileModule(guide, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  const exports = {};
  runInNewContext(outputText, {
    exports,
    require(name) {
      assert.ok(name in dependencies, `Unexpected guide dependency: ${name}`);
      return dependencies[name];
    },
  });
  return renderToStaticMarkup(createElement(exports.ComparisonGuide));
}

function escaped(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function assertSharedGuideContent(html, data) {
  for (const value of [
    data.guideTitle,
    data.guideIntro,
    ...data.criteria.flatMap(({ title, text }) => [title, text]),
    ...data.links.map(({ label }) => label),
  ]) {
    assert.ok(html.includes(escaped(value)), `Content not rendered: ${value}`);
  }
  assert.match(html, /<h2[^>]*id="comparison-guide-title"/);
  for (const { label, path } of data.links) {
    assert.ok(
      html.includes(`href="${path}"`) || html.includes(`href="${site}${path}"`),
      `Missing crawlable destination: ${label}`,
    );
  }
}

test("crawler metadata, canonical and application schema use the shared comparator content", () => {
  const html = renderCrawlerPage();
  assert.ok(html.includes(`<title>${escaped(comparison.title)}</title>`));
  assert.ok(
    html.includes(
      `<meta name="description" content="${escaped(comparison.description)}" />`,
    ),
  );
  assert.ok(html.includes(`<h1>${escaped(comparison.h1)}</h1>`));
  assert.ok(html.includes(`<p>${escaped(comparison.intro)}</p>`));
  assert.equal((html.match(/<h1>/g) || []).length, 1);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
  assert.ok(html.includes(`<link rel="canonical" href="${site}/comparar" />`));
  assert.ok(
    html.includes(`<meta property="og:url" content="${site}/comparar" />`),
  );

  const schemas = [
    ...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g),
  ].map((match) => JSON.parse(match[1]));
  const webpage = schemas.find((schema) => schema["@type"] === "WebPage");
  assert.equal(webpage.name, comparison.h1);
  assert.equal(webpage.description, comparison.description);
  assert.equal(webpage.mainEntity["@id"], `${site}/comparar#app`);
  assert.ok(schemas.some((schema) => schema["@type"] === "WebApplication"));
  assert.ok(schemas.some((schema) => schema["@type"] === "BreadcrumbList"));
  assert.ok(!schemas.some((schema) => schema["@type"] === "FAQPage"));
});

test("React and crawler render every guide criterion and research link from the shared source", () => {
  assert.equal(comparison.criteria.length, 3);
  assertSharedGuideContent(renderGuide(), comparison);
  assertSharedGuideContent(renderCrawlerPage(), comparison);
  assert.doesNotMatch(
    JSON.stringify(comparison),
    /quilometragem|\bkm\b|ranking/i,
  );
});

test("shared guide edits reach both renderers and are escaped as text", () => {
  const changed = structuredClone(comparison);
  changed.guideTitle = 'Pesquisa & comparação <segura> "Netcar"';
  changed.criteria[0].text = "Dados de teste <img src=x> & detalhes";
  changed.links[0].label = "SUVs & opções";
  for (const html of [renderGuide(changed), renderCrawlerPage(changed)]) {
    assertSharedGuideContent(html, changed);
    assert.ok(!html.includes("<img src=x>"));
  }
});

test("research destinations resolve to existing inventory selections and content pages", () => {
  const routes = readFileSync(join(root, "src/app/router/routes.tsx"), "utf8");
  const landings = JSON.parse(
    readFileSync(join(root, "src/data/seo/landings.json"), "utf8"),
  );
  const contentPages = JSON.parse(
    readFileSync(join(root, "src/data/seo/content-pages.json"), "utf8"),
  );
  assert.equal(
    new Set(comparison.links.map(({ path }) => path)).size,
    comparison.links.length,
  );
  for (const { path } of comparison.links) {
    assert.match(path, /^\/[a-z0-9-]+$/);
    if (path.startsWith("/comprar-")) {
      assert.ok(routes.includes('path: "/comprar-{$landingSlug}"'));
      assert.ok(
        landings.some(({ slug }) => path === `/comprar-${slug}`),
        path,
      );
    } else {
      assert.ok(routes.includes(`path: "${path}"`), path);
      assert.ok(
        contentPages.some(({ slug }) => path === `/${slug}`),
        path,
      );
    }
  }
});

function assertPairPage(html, page) {
  const canonical = `${site}/comparar/${page.slug}`;
  for (const value of [
    `<title>${escaped(page.title)}</title>`,
    `<meta name="description" content="${escaped(page.description)}" />`,
    `<link rel="canonical" href="${canonical}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<h1>${escaped(page.h1)}</h1>`,
    `<p>${escaped(page.intro)}</p>`,
    `<p>${escaped(page.stockNote)}</p>`,
    ...page.sections.flatMap(({ title, text }) => [
      escaped(title),
      escaped(text),
    ]),
    ...page.checks.map(escaped),
  ]) {
    assert.ok(html.includes(value), `${page.slug}: missing ${value}`);
  }
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
  assert.match(
    html,
    /<meta name="robots" content="index, follow, max-image-preview:large"/,
  );
  assert.ok(html.includes(`href="${site}/comparar"`));
  for (const other of comparisonPages.filter(
    ({ slug }) => slug !== page.slug,
  )) {
    assert.ok(html.includes(`href="${site}/comparar/${other.slug}"`));
  }
  const schemas = [
    ...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g),
  ].map((match) => JSON.parse(match[1]));
  const webpage = schemas.find((schema) => schema["@type"] === "WebPage");
  assert.equal(webpage.url, canonical);
  assert.equal(webpage.name, page.h1);
  assert.equal(webpage.description, page.description);
  assert.equal(webpage.isPartOf["@id"], `${site}/comparar#webpage`);
  const breadcrumb = schemas.find(
    (schema) => schema["@type"] === "BreadcrumbList",
  );
  assert.equal(breadcrumb.itemListElement.at(-1).item, canonical);
  assert.ok(!schemas.some((schema) => schema["@type"] === "FAQPage"));
}

test("four permanent pair pages remain complete and discoverable when stock is empty", () => {
  const expectedSlugs = [
    "jeep-compass-x-honda-hr-v",
    "chevrolet-tracker-x-hyundai-creta",
    "volkswagen-nivus-x-fiat-fastback",
    "volkswagen-tera-x-volkswagen-t-cross",
  ];
  assert.deepEqual(
    comparisonPages.map(({ slug }) => slug),
    expectedSlugs,
  );
  for (const field of ["title", "description", "h1", "intro"]) {
    assert.equal(new Set(comparisonPages.map((page) => page[field])).size, 4);
  }
  assert.equal(
    new Set(
      comparisonPages.flatMap((page) => page.sections.map(({ text }) => text)),
    ).size,
    16,
  );
  const pages = renderCrawlerPages();
  for (const page of comparisonPages) {
    assert.ok(pages[0].html.includes(`href="${site}/comparar/${page.slug}"`));
    const rendered = pages.find(({ canonical }) =>
      canonical.endsWith(`/${page.slug}`),
    );
    assert.equal(
      rendered.path,
      join(root, `public/seo-static/comparison-${page.slug}.html`),
    );
    assertPairPage(rendered.html, page);
    assert.match(rendered.html, /data-comparison-stock="empty"/);
    assert.match(rendered.html, /anunciadas para formar este par/);
    assert.ok(!rendered.html.includes("<table>"));
    assert.ok(!rendered.html.includes("data-comparison-vehicle="));
  }
});

function fixtureVehicle(id, model, value, overrides = {}) {
  return {
    id,
    marca: model.brand,
    modelo: `${model.model} TESTE`,
    valor: value,
    ano: 2023,
    cambio: "AUTOMATICO",
    combustivel: "FLEX",
    motor: "1.0",
    categoria: "SUV",
    km: 54321,
    imagens_site: { capa: `/images/test-${id}.png` },
    ...overrides,
  };
}

test("pair tables choose actual units by the smallest price difference and omit unprovided specifications", () => {
  for (const page of comparisonPages) {
    const vehicles = [
      fixtureVehicle("left-far", page.left, 75000),
      fixtureVehicle("left-near", page.left, 100000, { motor: "" }),
      fixtureVehicle("right-near", page.right, 101000),
      fixtureVehicle("right-far", page.right, 150000),
      fixtureVehicle("no-price", page.left, 0),
    ];
    const html = renderCrawlerPages(comparison, vehicles).find(
      ({ canonical }) => canonical.endsWith(`/${page.slug}`),
    ).html;
    assertPairPage(html, page);
    assert.match(html, /data-comparison-stock="complete"/);
    assert.deepEqual(
      [...html.matchAll(/data-comparison-vehicle="([^"]+)"/g)].map(
        (match) => match[1],
      ),
      ["left-near", "right-near"],
    );
    assert.ok(
      html.includes(
        'src="https://www.netcarmultimarcas.com.br/images/test-left-near.png"',
      ),
    );
    assert.ok(
      html.includes(
        'src="https://www.netcarmultimarcas.com.br/images/test-right-near.png"',
      ),
    );
    assert.ok(html.includes(`<td>R$ 100.000</td>`));
    assert.ok(html.includes(`<td>R$ 101.000</td>`));
    assert.ok(
      html.includes(
        `<th scope="row">Motor</th><td>Não informado</td><td>1.0</td>`,
      ),
    );
    assert.ok(!html.includes("54321"));
    assert.ok(!html.includes("75.000"));
    assert.ok(!html.includes("150.000"));
    assert.equal((html.match(/<table>/g) || []).length, 1);
  }
});

test("a missing model leaves the available car visible without a fictional comparison", () => {
  const page = comparisonPages[0];
  const vehicle = fixtureVehicle("only-left", page.left, 100000, {
    imagens_site: { capa: "/imagens/banner/generic.jpg" },
  });
  const html = renderCrawlerPages(comparison, [vehicle]).find(({ canonical }) =>
    canonical.endsWith(`/${page.slug}`),
  ).html;
  assertPairPage(html, page);
  assert.match(html, /data-comparison-stock="partial"/);
  assert.match(html, /não há unidades de Honda HR-V anunciadas/);
  assert.match(html, /data-comparison-vehicle="only-left"/);
  assert.ok(!html.includes("<table>"));
  assert.ok(
    !html.includes(
      '<img src="https://www.netcarmultimarcas.com.br/imagens/banner/',
    ),
  );
  assert.ok(html.includes("Foto indisponível no momento."));
});

test("pair editorial changes reach generated HTML safely without modifying data files", () => {
  const changed = structuredClone(comparisonPages);
  changed[0].sections[0].text = 'Texto revisado <img src=x> & "conteúdo"';
  changed[0].checks[0] = "Conferir ano & versão";
  const html = renderCrawlerPages(comparison, [], changed).find(
    ({ canonical }) => canonical.endsWith(`/${changed[0].slug}`),
  ).html;
  assertPairPage(html, changed[0]);
  assert.ok(!html.includes("<img src=x>"));
});

test("crawler and React choose the same vehicle IDs from the existing stock snapshot", (t) => {
  const runtimeSource = readFileSync(
    join(root, "src/lib/vehicleComparisons.ts"),
    "utf8",
  );
  const { outputText } = ts.transpileModule(runtimeSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });
  const exports = {};
  runInNewContext(outputText, {
    exports,
    require(name) {
      assert.equal(name, "../data/seo/comparisons.json");
      return comparisonPages;
    },
  });
  const { vehicles } = JSON.parse(
    readFileSync(join(root, "public/seo/stock-bootstrap.json"), "utf8"),
  );
  const rawVehicles = vehicles.map((vehicle) => ({
    ...vehicle,
    valor: vehicle.price,
    ano: vehicle.year,
  }));
  const pages = renderCrawlerPages(comparison, rawVehicles);
  for (const page of comparisonPages) {
    const left = exports.comparisonCandidates(vehicles, page.left);
    const right = exports.comparisonCandidates(vehicles, page.right);
    const pair = exports.closestComparisonPair(left, right);
    const expected = (
      pair ? [pair.left, pair.right] : [left[0], right[0]].filter(Boolean)
    ).map((vehicle) => String(vehicle.id));
    const html = pages.find(({ canonical }) =>
      canonical.endsWith(`/${page.slug}`),
    ).html;
    const rendered = [
      ...html.matchAll(/data-comparison-vehicle="([^"]+)"/g),
    ].map((match) => match[1]);
    assert.deepEqual(rendered, expected, page.slug);
    t.diagnostic(`${page.slug}: ${rendered.join(" / ") || "sem estoque"}`);
  }
});

test("both sitemap generators retain the four permanent comparison URLs regardless of stock", () => {
  const initialSitemap = readFileSync(
    join(root, "scripts/generate-sitemap.js"),
    "utf8",
  );
  const start = initialSitemap.indexOf("const STATIC_PAGES =");
  const end = initialSitemap.indexOf("function escapeXml", start);
  const initialContext = { comparisonPages };
  runInNewContext(
    `${initialSitemap.slice(start, end)};globalThis.urls = STATIC_PAGES.map(page => page.loc);`,
    initialContext,
  );
  const context = {
    SITE: site,
    comparisonPages,
    staticPages: [],
    vehicleUrls: [],
    blogPosts: [],
    cities: [],
    landings: [],
  };
  runInNewContext(
    `${sourceBetween("const urls = [", "let previousLastmods =")};globalThis.savedUrls = urls.map(page => page.loc);`,
    context,
  );
  for (const page of comparisonPages) {
    const path = `/comparar/${page.slug}`;
    assert.equal(initialContext.urls.filter((url) => url === path).length, 1);
    assert.equal(
      context.savedUrls.filter((url) => url === `${site}${path}`).length,
      1,
    );
  }
  const keepContext = {
    comparisonPages,
    blogPosts: [],
    cities: [],
    landings: [],
    contentPages: [],
  };
  runInNewContext(
    `${sourceBetween("const expectedFiles =", "const orphans =")};globalThis.files = [...expectedFiles];`,
    keepContext,
  );
  for (const page of comparisonPages) {
    assert.ok(keepContext.files.includes(`comparison-${page.slug}.html`));
  }
});

if (process.env.NETCAR_VERIFY_GENERATED_SEO === "1") {
  test("the saved crawler page contains the same guide and canonical after the build", () => {
    const html = readFileSync(
      join(root, "public/seo-static/page-comparar.html"),
      "utf8",
    );
    assertSharedGuideContent(html, comparison);
    assert.ok(html.includes(`<title>${escaped(comparison.title)}</title>`));
    assert.ok(html.includes(`<h1>${escaped(comparison.h1)}</h1>`));
    assert.ok(
      html.includes(`<link rel="canonical" href="${site}/comparar" />`),
    );
  });
  test("saved comparison pages and sitemap preserve every permanent guide after the build", () => {
    const sitemap = readFileSync(join(root, "public/sitemap.xml"), "utf8");
    for (const page of comparisonPages) {
      const html = readFileSync(
        join(root, `public/seo-static/comparison-${page.slug}.html`),
        "utf8",
      );
      assertPairPage(html, page);
      assert.equal(
        sitemap.split(`<loc>${site}/comparar/${page.slug}</loc>`).length - 1,
        1,
      );
    }
  });
}
