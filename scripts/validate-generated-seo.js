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
const contentPages = JSON.parse(
  readFileSync(join(root, "src/data/seo/content-pages.json"), "utf8"),
);
const sitemap = readFileSync(join(root, "public/sitemap.xml"), "utf8");
const crawlerHome = readFileSync(join(root, "public/seo-pagina.php"), "utf8");
const footerSource = readFileSync(
  join(root, "src/design-system/components/layout/Footer.tsx"),
  "utf8",
);
const contactSource = readFileSync(
  join(root, "src/modules/contato/pages/ContatoPage.tsx"),
  "utf8",
);
const locationSource = readFileSync(
  join(root, "src/design-system/components/layout/Localizacao.tsx"),
  "utf8",
);
const errors = [];
const canonicals = new Set();
const organizationId = `${site}/#organization`;
const expectedDealers = {
  [`${site}/#loja-1`]: {
    url: `${site}/contato#loja-1`,
    branchCode: "Loja1",
    telephone: "+55-51-3473-7900",
    streetAddress: "Av. Presidente Vargas, 740",
    postalCode: "93260-048",
    latitude: -29.8380385,
    longitude: -51.1702399,
    hasMap: "https://maps.google.com/maps?cid=9144067949621682127",
  },
  [`${site}/#loja-2`]: {
    url: `${site}/contato#loja-2`,
    branchCode: "Loja2",
    telephone: "+55-51-3033-3900",
    streetAddress: "Av. Presidente Vargas, 1106",
    postalCode: "93260-001",
    latitude: -29.8411446,
    longitude: -51.1721442,
    hasMap: "https://maps.google.com/maps?cid=10839197980729051544",
  },
};

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

function attributeValue(tag, name) {
  return tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"))?.[1] || "";
}

function parsedSchemas(html, label) {
  const schemas = [];
  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      schemas.push(JSON.parse(match[1]));
    } catch {
      errors.push(`${label}: JSON-LD inválido em HTML regional gerado`);
    }
  }
  return schemas;
}

function schemaNodes(value, nodes = []) {
  if (!value || typeof value !== "object") return nodes;
  if (value["@type"]) nodes.push(value);
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach((item) => schemaNodes(item, nodes));
    else if (child && typeof child === "object") schemaNodes(child, nodes);
  }
  return nodes;
}

function schemaTypes(schemas) {
  const types = new Set();
  for (const schema of schemas) {
    for (const node of schemaNodes(schema)) {
      const type = node["@type"];
      if (Array.isArray(type)) type.forEach((item) => types.add(item));
      else if (type) types.add(type);
    }
  }
  return types;
}

function anchorHrefs(html) {
  return [...html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi)].map(
    (match) => match[1],
  );
}

function validateOrganizationGraph(nodes, label) {
  const roots = nodes.filter(
    (node) =>
      node["@type"] === "Organization" && node["@id"] === organizationId,
  );
  if (roots.length !== 1) {
    errors.push(`${label}: precisa ter uma Organization raiz única`);
    return;
  }

  const rootOrganization = roots[0];
  if (
    rootOrganization.url !== site ||
    rootOrganization.legalName !== "R&C Veículos Ltda" ||
    rootOrganization.taxID !== "02.237.969/0001-06"
  ) {
    errors.push(`${label}: entidade legal/CNPJ da Organization divergente`);
  }
  if (
    rootOrganization.logo?.["@id"] !== `${site}/#logo` ||
    rootOrganization.brand?.name !== "Netcar Multimarcas" ||
    rootOrganization.brand?.logo?.["@id"] !== `${site}/#logo`
  ) {
    errors.push(`${label}: marca/logo da Organization divergente`);
  }
  const sameAs = new Set(rootOrganization.sameAs || []);
  for (const socialUrl of [
    "https://www.instagram.com/netcar_rc",
    "https://www.facebook.com/NetcarRC",
  ]) {
    if (!sameAs.has(socialUrl)) {
      errors.push(`${label}: sameAs da Organization sem ${socialUrl}`);
    }
  }

  const expectedDealerIds = Object.keys(expectedDealers).sort();
  const referencedDealerIds = (rootOrganization.subOrganization || [])
    .map((item) => item?.["@id"])
    .filter(Boolean)
    .sort();
  if (
    JSON.stringify(referencedDealerIds) !== JSON.stringify(expectedDealerIds)
  ) {
    errors.push(`${label}: Organization não referencia exatamente as 2 lojas`);
  }

  const servedNames = new Set(
    (rootOrganization.areaServed || [])
      .map((area) => area?.name)
      .filter(Boolean),
  );
  for (const servedCity of ["Esteio", ...cities.map((city) => city.name)]) {
    if (!servedNames.has(servedCity)) {
      errors.push(`${label}: areaServed sem ${servedCity}`);
    }
  }

  const dealers = nodes.filter((node) => node["@type"] === "AutoDealer");
  if (dealers.length !== 2) {
    errors.push(`${label}: precisa ter exatamente 2 AutoDealer, um por loja`);
  }
  const dealerIds = dealers.map((dealer) => dealer["@id"]).sort();
  if (JSON.stringify(dealerIds) !== JSON.stringify(expectedDealerIds)) {
    errors.push(`${label}: @ids das lojas físicas divergentes`);
  }

  for (const [dealerId, expected] of Object.entries(expectedDealers)) {
    const dealer = dealers.find((candidate) => candidate["@id"] === dealerId);
    if (!dealer) continue;
    if (
      dealer.url !== expected.url ||
      dealer.branchCode !== expected.branchCode ||
      dealer.telephone !== expected.telephone ||
      dealer.hasMap !== expected.hasMap ||
      dealer.parentOrganization?.["@id"] !== organizationId
    ) {
      errors.push(
        `${label}: identidade/NAP de ${expected.branchCode} divergente`,
      );
    }

    const address = dealer.address;
    if (
      address?.streetAddress !== expected.streetAddress ||
      address?.addressLocality !== "Esteio" ||
      address?.addressRegion !== "RS" ||
      address?.postalCode !== expected.postalCode ||
      address?.addressCountry !== "BR"
    ) {
      errors.push(`${label}: endereço de ${expected.branchCode} divergente`);
    }
    if (
      Number(dealer.geo?.latitude) !== expected.latitude ||
      Number(dealer.geo?.longitude) !== expected.longitude
    ) {
      errors.push(`${label}: geo de ${expected.branchCode} divergente`);
    }

    const hours = dealer.openingHoursSpecification || [];
    const weekdays = hours.find((item) => Array.isArray(item?.dayOfWeek));
    const saturday = hours.find((item) => item?.dayOfWeek === "Saturday");
    if (
      weekdays?.opens !== "09:00" ||
      weekdays?.closes !== "18:00" ||
      weekdays.dayOfWeek.join(",") !==
        "Monday,Tuesday,Wednesday,Thursday,Friday" ||
      saturday?.opens !== "09:00" ||
      saturday?.closes !== "16:30"
    ) {
      errors.push(`${label}: horários de ${expected.branchCode} divergentes`);
    }
  }

  for (const node of nodes) {
    const addresses = Array.isArray(node.address)
      ? node.address
      : node.address
        ? [node.address]
        : [];
    for (const address of addresses) {
      if (address?.addressLocality !== "Esteio") {
        errors.push(`${label}: schema declara endereço fora de Esteio`);
      }
    }
  }
}

function validatePage({
  file,
  canonical,
  title,
  description,
  h1,
  label,
  requireStock,
  city,
  variant,
}) {
  let html;
  try {
    html = readFileSync(join(root, "public/seo-static", file), "utf8");
  } catch {
    errors.push(`${label}: HTML gerado ausente (${file})`);
    return;
  }

  if (occurrences(html, `<title>${escapeHtml(title)}</title>`) !== 1) {
    errors.push(`${label}: title incorreto no HTML gerado`);
  }
  if (
    occurrences(
      html,
      `<meta name="description" content="${escapeHtml(description)}" />`,
    ) !== 1
  ) {
    errors.push(`${label}: description incorreta no HTML gerado`);
  }
  if (occurrences(html, `<link rel="canonical" href="${canonical}" />`) !== 1) {
    errors.push(`${label}: canonical incorreto no HTML gerado`);
  }
  if (occurrences(html, `<h1>${escapeHtml(h1)}</h1>`) !== 1) {
    errors.push(`${label}: precisa ter exatamente um H1 esperado`);
  }
  if (canonicals.has(canonical)) errors.push(`${label}: canonical duplicado`);
  canonicals.add(canonical);
  if (
    occurrences(html, `<meta property="og:url" content="${canonical}" />`) !== 1
  ) {
    errors.push(
      `${label}: og:url ausente, duplicado ou diferente do canonical`,
    );
  }
  const robotsTags = html.match(/<meta\s+name=["']robots["'][^>]*>/gi) || [];
  if (robotsTags.length !== 1) {
    errors.push(`${label}: deve ter exatamente uma meta robots`);
  } else {
    const robotsContent = attributeValue(robotsTags[0], "content")
      .toLowerCase()
      .split(",")
      .map((value) => value.trim());
    for (const directive of ["index", "follow", "max-image-preview:large"]) {
      if (!robotsContent.includes(directive)) {
        errors.push(`${label}: meta robots sem ${directive}`);
      }
    }
    if (
      robotsContent.includes("noindex") ||
      robotsContent.includes("nofollow")
    ) {
      errors.push(
        `${label}: landing regional não pode conter noindex/nofollow`,
      );
    }
  }

  const schemas = parsedSchemas(html, label);
  const nodes = schemas.flatMap((schema) => schemaNodes(schema));
  const types = schemaTypes(schemas);
  const pageType = variant === "buy" ? "CollectionPage" : "WebPage";
  for (const expected of [
    "Organization",
    "AutoDealer",
    pageType,
    "Service",
    "FAQPage",
    "BreadcrumbList",
  ]) {
    if (!types.has(expected))
      errors.push(`${label}: schema ${expected} ausente`);
  }

  validateOrganizationGraph(nodes, label);

  const service = nodes.find(
    (node) =>
      node["@type"] === "Service" && node["@id"] === `${canonical}#service`,
  );
  if (
    service?.areaServed?.name !== city.name ||
    service?.provider?.["@id"] !== `${site}/#organization`
  ) {
    errors.push(
      `${label}: Service precisa ligar a cidade-alvo à Organization raiz`,
    );
  }

  const breadcrumb = nodes.find(
    (node) =>
      node["@type"] === "BreadcrumbList" &&
      node["@id"] === `${canonical}#breadcrumb`,
  );
  const finalCrumb = breadcrumb?.itemListElement?.at?.(-1);
  if (
    finalCrumb?.item !== canonical ||
    !String(finalCrumb?.name || "").includes(city.name)
  ) {
    errors.push(
      `${label}: breadcrumb final não representa intenção e cidade da URL`,
    );
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

  const hrefs = anchorHrefs(html);
  const relatedPrefix = `${site}/${variant === "buy" ? "seminovos" : "vender-carro"}-`;
  const relatedHrefs = hrefs.filter((href) => href.startsWith(relatedPrefix));
  const expectedRelated = city.relatedSlugs.map(
    (slug) => `${relatedPrefix}${slug}`,
  );
  if (JSON.stringify(relatedHrefs) !== JSON.stringify(expectedRelated)) {
    errors.push(`${label}: links de cidades próximas divergem de relatedSlugs`);
  }
  if (relatedHrefs.includes(canonical)) {
    errors.push(`${label}: página regional aponta para si mesma`);
  }
  const counterpart = `${site}/${variant === "buy" ? "vender-carro" : "seminovos"}-${city.slug}`;
  if (occurrences(hrefs.join("\n"), counterpart) !== 1) {
    errors.push(`${label}: link recíproco compra/venda ausente ou duplicado`);
  }

  if (
    variant === "buy" &&
    !html.includes("possui lojas físicas somente em Esteio")
  ) {
    errors.push(`${label}: aviso de lojas somente em Esteio ausente`);
  }
  if (
    variant === "sell" &&
    !html.includes(
      `não possui unidade ou ponto de coleta em ${escapeHtml(city.name)}`,
    )
  ) {
    errors.push(`${label}: aviso de ausência de unidade na cidade ausente`);
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
    city,
    variant: "buy",
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
      city,
      variant: "sell",
    });
  }
}

const regionsHub = readFileSync(
  join(root, "public/seo-static/regions-hub.html"),
  "utf8",
);
const hubHrefs = anchorHrefs(regionsHub);
for (const city of cities) {
  for (const route of [
    `${site}/seminovos-${city.slug}`,
    `${site}/vender-carro-${city.slug}`,
  ]) {
    if (occurrences(hubHrefs.join("\n"), route) !== 1) {
      errors.push(`hub regional: ${route} precisa aparecer exatamente uma vez`);
    }
  }
}

if (!footerSource.includes("priorityCityPages")) {
  errors.push("footer: seleção curta de mercados prioritários ausente");
}
if (footerSource.includes('to="/vender-carro-{$citySlug}"')) {
  errors.push("footer: não deve repetir todas as páginas regionais de venda");
}
for (const storeId of ["loja-1", "loja-2"]) {
  if (occurrences(contactSource, `id="${storeId}"`) !== 1) {
    errors.push(`contato: fragmento #${storeId} ausente ou duplicado`);
  }
}
if (locationSource.includes("id={`loja-${loja.id}`}")) {
  errors.push("localização: fragments de loja duplicados fora de /contato");
}

const expectedRegionalUrls = new Set(
  cities.flatMap((city) => [
    `${site}/seminovos-${city.slug}`,
    `${site}/vender-carro-${city.slug}`,
  ]),
);
const prefixedContentUrls = new Set(
  contentPages
    .map((page) => `${site}/${page.slug}`)
    .filter(
      (url) =>
        url.startsWith(`${site}/seminovos-`) ||
        url.startsWith(`${site}/vender-carro-`),
    ),
);
const sitemapRegionalUrls = new Set(
  [
    ...sitemap.matchAll(
      /<loc>(https:\/\/www\.netcarmultimarcas\.com\.br\/(seminovos|vender-carro)-([^<]+))<\/loc>/g,
    ),
  ]
    .map((match) => match[1])
    .filter((url) => !prefixedContentUrls.has(url)),
);
for (const url of expectedRegionalUrls) {
  if (!sitemapRegionalUrls.has(url))
    errors.push(`sitemap regional: URL ausente ${url}`);
}
for (const url of sitemapRegionalUrls) {
  if (!expectedRegionalUrls.has(url))
    errors.push(`sitemap regional: URL órfã ${url}`);
  if (/[?#]|\/$/.test(url))
    errors.push(`sitemap regional: URL não canônica ${url}`);
}

if (
  sitemap.includes("<loc>https://www.netcarmultimarcas.com.br/index.php</loc>")
) {
  errors.push("sitemap não pode conter /index.php");
}

for (const slug of [
  "canoas",
  "sapucaia-do-sul",
  "sao-leopoldo",
  "novo-hamburgo",
  "cachoeirinha",
  "gravatai",
  "porto-alegre",
]) {
  if (!crawlerHome.includes(`/seminovos-${slug}`)) {
    errors.push(`home do crawler sem prioridade regional para ${slug}`);
  }
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
