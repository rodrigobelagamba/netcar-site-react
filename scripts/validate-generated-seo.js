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
const expectedEmail = "contato@netcarmultimarcas.com.br";
const cities = JSON.parse(
  readFileSync(join(root, "src/data/seo/cities.json"), "utf8"),
);
const contentPages = JSON.parse(
  readFileSync(join(root, "src/data/seo/content-pages.json"), "utf8"),
);
const landings = JSON.parse(
  readFileSync(join(root, "src/data/seo/landings.json"), "utf8"),
);
const regionalInventorySlugs = [
  "suv",
  "hatch",
  "automaticos-ate-100-mil",
  "carros-ate-100-mil",
  "jeep-compass",
  "honda-hr-v",
];
const expectedRegionalInventoryHrefs = regionalInventorySlugs
  .map((slug) => landings.find((landing) => landing.slug === slug))
  .filter((landing) => landing?.indexable && landing.count > 0)
  .map((landing) => `${site}/comprar-${landing.slug}`);
const expectedNearbyMarketHrefs = cities
  .filter((city) => city.priorityMarket)
  .sort((left, right) => left.distanceKm - right.distanceKm)
  .slice(0, 4)
  .map((city) => `${site}/seminovos-${city.slug}`);
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
const tractionRecoverySlugs = new Set([
  "canoas",
  "sao-leopoldo",
  "gravatai",
  "cachoeirinha",
  "estancia-velha",
]);
const organizationId = `${site}/#organization`;
const expectedDealers = {
  [`${site}/#loja-1`]: {
    url: `${site}/contato#loja-1`,
    branchCode: "Loja1",
    telephone: "+55-51-3473-7900",
    streetAddress: "Av. Presidente Vargas, 740",
    postalCode: "93260-490",
    latitude: -29.8380385,
    longitude: -51.1702399,
    hasMap: "https://maps.google.com/maps?cid=9144067949621682127",
  },
  [`${site}/#loja-2`]: {
    url: `${site}/contato#loja-2`,
    branchCode: "Loja2",
    telephone: "+55-51-3033-3900",
    streetAddress: "Av. Presidente Vargas, 1106",
    postalCode: "93260-048",
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
      errors.push(`${label}: JSON-LD inválido no HTML gerado`);
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
    rootOrganization.taxID !== "02.237.969/0001-06" ||
    rootOrganization.email !== expectedEmail
  ) {
    errors.push(`${label}: entidade legal/CNPJ/e-mail da Organization divergente`);
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
      dealer.email !== expectedEmail ||
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

  if (
    contactSource.includes("contato@netcar-rc.com.br") ||
    crawlerHome.includes("contato@netcar-rc.com.br") ||
    !contactSource.includes(`mailto:${expectedEmail}`) ||
    !crawlerHome.includes(`mailto:${expectedEmail}`)
  ) {
    errors.push(`${label}: e-mail antigo ou contato oficial ausente nas superfícies`);
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
  if (variant === "buy") {
    const inventoryHrefs = hrefs.filter((href) =>
      href.startsWith(`${site}/comprar-`),
    );
    if (
      JSON.stringify(inventoryHrefs) !==
      JSON.stringify(expectedRegionalInventoryHrefs)
    ) {
      errors.push(`${label}: seleções de estoque regional incompletas`);
    }
  }
  if (variant === "buy" && tractionRecoverySlugs.has(city.slug)) {
    if (
      occurrences(html, `<h2>${escapeHtml(city.contentHeading || "")}</h2>`) !==
      1
    ) {
      errors.push(`${label}: H2 editorial de recuperação ausente`);
    }
    for (const path of ["/comparar", "/financiamento", "/compra"]) {
      if (!hrefs.includes(`${site}${path}`)) {
        errors.push(`${label}: atalho contextual ausente para ${path}`);
      }
    }
  }
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
  if (variant === "buy" && city.routeOrigins?.length) {
    if (!html.includes(`Planeje a visita saindo de ${escapeHtml(city.name)}`)) {
      errors.push(`${label}: planejador de visita ausente no HTML estático`);
    }
    const routeCount = occurrences(
      html,
      "https://www.google.com/maps/dir/?api=1&amp;origin=",
    );
    const expectedRouteCount = city.routeOrigins.length * 2;
    if (routeCount !== expectedRouteCount) {
      errors.push(
        `${label}: esperado ${expectedRouteCount} links de rota no HTML estático; encontrado ${routeCount}`,
      );
    }
    for (const origin of city.routeOrigins) {
      if (!html.includes(`<strong>${escapeHtml(origin.label)}:</strong>`)) {
        errors.push(
          `${label}: origem ${origin.label} ausente no planejador estático`,
        );
      }
    }
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

const landingTitles = new Set();
const landingDescriptions = new Set();
const landingH1s = new Set();
const landingSlugs = new Set();
const permanentDemandContracts = {
  volkswagen: { type: "marca", filters: { marca: "VOLKSWAGEN" } },
  jeep: { type: "marca", filters: { marca: "JEEP" } },
  hyundai: { type: "marca", filters: { marca: "HYUNDAI" } },
  fiat: { type: "marca", filters: { marca: "FIAT" } },
  honda: { type: "marca", filters: { marca: "HONDA" } },
  nissan: { type: "marca", filters: { marca: "NISSAN" } },
  chevrolet: { type: "marca", filters: { marca: "CHEVROLET" } },
  chery: { type: "marca", filters: { marca: "CHERY" } },
  suv: { type: "categoria", filters: { categoria: "SUV" } },
  hatch: { type: "categoria", filters: { categoria: "HATCH" } },
  sedan: { type: "categoria", filters: { categoria: "SEDAN" } },
  "jeep-compass": {
    type: "modelo",
    filters: { marca: "JEEP", modelo: "COMPASS" },
  },
  "honda-hr-v": {
    type: "modelo",
    filters: { marca: "HONDA", modelo: "HRV" },
  },
  "volkswagen-t-cross": {
    type: "modelo",
    filters: { marca: "VOLKSWAGEN", modelo: "T CROSS" },
  },
  "chevrolet-tracker": {
    type: "modelo",
    filters: { marca: "CHEVROLET", modelo: "TRACKER" },
  },
  "volkswagen-nivus": {
    type: "modelo",
    filters: { marca: "VOLKSWAGEN", modelo: "NIVUS" },
  },
  "hyundai-creta": {
    type: "modelo",
    filters: { marca: "HYUNDAI", modelo: "CRETA" },
  },
  "nissan-kicks": {
    type: "modelo",
    filters: { marca: "NISSAN", modelo: "KICKS" },
  },
  "jeep-renegade": {
    type: "modelo",
    filters: { marca: "JEEP", modelo: "RENEGADE" },
  },
  "carros-ate-80-mil": {
    type: "faixa",
    filters: { precoMax: 80000 },
  },
  "carros-ate-100-mil": {
    type: "faixa",
    filters: { precoMax: 100000 },
  },
  "automaticos-ate-100-mil": {
    type: "faixa",
    filters: { cambio: "AUTOMATICO", precoMax: 100000 },
  },
  "suv-ate-100-mil": {
    type: "faixa",
    filters: { categoria: "SUV", precoMax: 100000 },
  },
  "carros-de-100-a-150-mil": {
    type: "faixa",
    filters: { precoMin: 100000, precoMax: 150000 },
  },
  hibridos: {
    type: "combustivel",
    filters: { combustivel: "HIBRIDO" },
  },
};
const validLandingTypes = new Set([
  "marca",
  "categoria",
  "modelo",
  "faixa",
  "combustivel",
]);

function normalizedSeoText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function addUniqueSeoValue(set, value, label, field) {
  const normalized = normalizedSeoText(value);
  if (!normalized) {
    errors.push(`${label}: ${field} vazio`);
  } else if (set.has(normalized)) {
    errors.push(`${label}: ${field} duplicado entre landings transacionais`);
  }
  set.add(normalized);
}

function validateDemandLanding(landing) {
  const label = `comprar-${landing.slug}`;
  const canonical = `${site}/${label}`;
  let html;
  try {
    html = readFileSync(
      join(root, "public/seo-static", `landing-${landing.slug}.html`),
      "utf8",
    );
  } catch {
    errors.push(`${label}: HTML gerado ausente`);
    return;
  }

  if (!/^[a-z0-9-]+$/.test(landing.slug)) {
    errors.push(`${label}: slug inválido`);
  }
  if (landingSlugs.has(landing.slug)) {
    errors.push(`${label}: slug duplicado`);
  }
  landingSlugs.add(landing.slug);
  if (!validLandingTypes.has(landing.type)) {
    errors.push(`${label}: tipo de landing inválido`);
  }
  if (!landing.filters || typeof landing.filters !== "object") {
    errors.push(`${label}: filtros ausentes`);
  }
  const expectedIndexable =
    landing.type === "modelo"
      ? Number(landing.count) >= 2
      : landing.type === "faixa"
        ? Number(landing.count) >= 4
        : landing.type === "combustivel"
          ? Number(landing.count) >= 3
          : Number(landing.count) >= 3;
  if (Boolean(landing.indexable) !== expectedIndexable) {
    errors.push(`${label}: indexabilidade diverge do limiar do tipo`);
  }
  if (
    !Array.isArray(landing.relatedSlugs) ||
    new Set(landing.relatedSlugs).size !== landing.relatedSlugs.length ||
    landing.relatedSlugs.length > 4 ||
    landing.relatedSlugs.includes(landing.slug)
  ) {
    errors.push(`${label}: relatedSlugs inválidos`);
  }
  addUniqueSeoValue(landingTitles, landing.title, label, "title");
  addUniqueSeoValue(
    landingDescriptions,
    landing.description,
    label,
    "description",
  );
  addUniqueSeoValue(landingH1s, landing.h1, label, "H1");

  if (occurrences(html, `<title>${escapeHtml(landing.title)}</title>`) !== 1) {
    errors.push(`${label}: title incorreto`);
  }
  if (
    occurrences(
      html,
      `<meta name="description" content="${escapeHtml(landing.description)}" />`,
    ) !== 1
  ) {
    errors.push(`${label}: description incorreta`);
  }
  if (occurrences(html, `<link rel="canonical" href="${canonical}" />`) !== 1) {
    errors.push(`${label}: canonical incorreto`);
  }
  if (
    occurrences(html, `<meta property="og:url" content="${canonical}" />`) !== 1
  ) {
    errors.push(`${label}: og:url diverge do canonical`);
  }
  if (occurrences(html, `<h1>${escapeHtml(landing.h1)}</h1>`) !== 1) {
    errors.push(`${label}: precisa ter exatamente um H1 esperado`);
  }
  if (canonicals.has(canonical)) errors.push(`${label}: canonical duplicado`);
  canonicals.add(canonical);

  const robotsTags = html.match(/<meta\s+name=["']robots["'][^>]*>/gi) || [];
  if (robotsTags.length !== 1) {
    errors.push(`${label}: deve ter exatamente uma meta robots`);
  } else {
    const directives = attributeValue(robotsTags[0], "content")
      .toLowerCase()
      .split(",")
      .map((value) => value.trim());
    const expectedIndex = landing.indexable ? "index" : "noindex";
    for (const directive of [
      expectedIndex,
      "follow",
      "max-image-preview:large",
    ]) {
      if (!directives.includes(directive)) {
        errors.push(`${label}: meta robots sem ${directive}`);
      }
    }
    if (landing.indexable && directives.includes("noindex")) {
      errors.push(`${label}: landing com estoque não pode ter noindex`);
    }
  }

  const schemas = parsedSchemas(html, label);
  const nodes = schemas.flatMap((schema) => schemaNodes(schema));
  const types = schemaTypes(schemas);
  for (const expected of [
    "Organization",
    "AutoDealer",
    "CollectionPage",
    "ItemList",
    "FAQPage",
    "BreadcrumbList",
  ]) {
    if (!types.has(expected))
      errors.push(`${label}: schema ${expected} ausente`);
  }
  validateOrganizationGraph(nodes, label);

  const collection = nodes.find(
    (node) =>
      node["@type"] === "CollectionPage" &&
      node["@id"] === `${canonical}#webpage`,
  );
  const itemList = collection?.mainEntity;
  if (Number(itemList?.numberOfItems) !== Number(landing.count)) {
    errors.push(`${label}: ItemList/count divergem do estoque gerado`);
  }
  if (
    !Array.isArray(itemList?.itemListElement) ||
    itemList.itemListElement.length !== Math.min(Number(landing.count), 12)
  ) {
    errors.push(`${label}: ItemList deve conter até 12 veículos reais`);
  }

  const hrefs = anchorHrefs(html);
  const vehicleHrefs = hrefs.filter((href) =>
    href.startsWith(`${site}/veiculo/`),
  );
  if (landing.indexable && vehicleHrefs.length < 1) {
    errors.push(`${label}: landing indexável sem veículo real no HTML`);
  }
  if (vehicleHrefs.length > 12) {
    errors.push(
      `${label}: vitrine excede 12 veículos e pode degradar performance`,
    );
  }
  const itemListUrls = Array.isArray(itemList?.itemListElement)
    ? itemList.itemListElement.map((item, index) => {
        if (Number(item?.position) !== index + 1) {
          errors.push(`${label}: posição inválida no ItemList`);
        }
        return String(item?.url || "");
      })
    : [];
  if (JSON.stringify(itemListUrls) !== JSON.stringify(vehicleHrefs)) {
    errors.push(`${label}: ItemList diverge dos cards visíveis da vitrine`);
  }
  const relatedHrefs = hrefs.filter((href) =>
    href.startsWith(`${site}/comprar-`),
  );
  const expectedRelated = landing.relatedSlugs.map(
    (slug) => `${site}/comprar-${slug}`,
  );
  if (landing.relatedSlugs.length > 4) {
    errors.push(`${label}: mais de 4 landings relacionadas`);
  }
  if (JSON.stringify(relatedHrefs) !== JSON.stringify(expectedRelated)) {
    errors.push(`${label}: malha interna diverge de relatedSlugs`);
  }
  if (relatedHrefs.includes(canonical)) {
    errors.push(`${label}: landing aponta para si mesma`);
  }
  const nearbyMarketHrefs = hrefs.filter((href) =>
    href.startsWith(`${site}/seminovos-`),
  );
  if (
    JSON.stringify(nearbyMarketHrefs) !==
    JSON.stringify(expectedNearbyMarketHrefs)
  ) {
    errors.push(`${label}: mercados regionais próximos incompletos`);
  }

  const sitemapCount = occurrences(sitemap, `<loc>${canonical}</loc>`);
  if (landing.indexable && sitemapCount !== 1) {
    errors.push(`${label}: URL indexável ausente ou duplicada no sitemap`);
  }
  if (!landing.indexable && sitemapCount !== 0) {
    errors.push(`${label}: URL noindex não pode entrar no sitemap`);
  }
}

function sortedFlatObject(value) {
  return Object.fromEntries(
    Object.entries(value || {}).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
}

for (const [requiredSlug, contract] of Object.entries(
  permanentDemandContracts,
)) {
  const landing = landings.find((item) => item.slug === requiredSlug);
  if (!landing) {
    errors.push(`manifesto de demanda: hub permanente ausente ${requiredSlug}`);
    continue;
  }
  if (
    landing.type !== contract.type ||
    JSON.stringify(sortedFlatObject(landing.filters)) !==
      JSON.stringify(sortedFlatObject(contract.filters))
  ) {
    errors.push(
      `manifesto de demanda: contrato semântico inválido em ${requiredSlug}`,
    );
  }
}

for (const landing of landings) validateDemandLanding(landing);

const landingBySlug = new Map(
  landings.map((landing) => [landing.slug, landing]),
);
for (const landing of landings) {
  for (const relatedSlug of landing.relatedSlugs || []) {
    const related = landingBySlug.get(relatedSlug);
    if (!related || !related.indexable) {
      errors.push(
        `comprar-${landing.slug}: relatedSlug ausente ou não indexável ${relatedSlug}`,
      );
    }
  }
  if (landing.indexable) {
    const inbound = landings.some(
      (source) =>
        source.indexable &&
        Array.isArray(source.relatedSlugs) &&
        source.relatedSlugs.includes(landing.slug),
    );
    if (!inbound && !landing.footerPriority) {
      errors.push(
        `comprar-${landing.slug}: landing indexável sem link interno de entrada`,
      );
    }
  }
}

const sitemapDemandUrls = new Set(
  [
    ...sitemap.matchAll(
      /<loc>(https:\/\/www\.netcarmultimarcas\.com\.br\/comprar-[^<]+)<\/loc>/g,
    ),
  ].map((match) => match[1]),
);
const expectedDemandUrls = new Set(
  landings
    .filter((landing) => landing.indexable)
    .map((landing) => `${site}/comprar-${landing.slug}`),
);
for (const url of sitemapDemandUrls) {
  if (!expectedDemandUrls.has(url)) {
    errors.push(`sitemap de demanda: URL órfã ${url}`);
  }
}
for (const url of expectedDemandUrls) {
  if (!sitemapDemandUrls.has(url)) {
    errors.push(`sitemap de demanda: URL ausente ${url}`);
  }
}

function validateComparator() {
  const label = "comparar";
  const canonical = `${site}/comparar`;
  const title = "Comparar carros seminovos lado a lado | Netcar";
  const description =
    "Compare até 4 carros seminovos lado a lado: preço, ano, câmbio, motor e características. Use o estoque atual da Netcar em Esteio/RS.";
  const h1 = "Comparar carros seminovos lado a lado";
  let html;
  try {
    html = readFileSync(
      join(root, "public/seo-static/page-comparar.html"),
      "utf8",
    );
  } catch {
    errors.push("comparar: HTML gerado ausente");
    return;
  }

  for (const [needle, problem] of [
    [`<title>${title}</title>`, "title incorreto"],
    [
      `<meta name="description" content="${description}" />`,
      "description incorreta",
    ],
    [`<link rel="canonical" href="${canonical}" />`, "canonical incorreto"],
    [`<meta property="og:url" content="${canonical}" />`, "og:url incorreto"],
    [`<h1>${h1}</h1>`, "H1 incorreto"],
  ]) {
    if (occurrences(html, needle) !== 1) errors.push(`${label}: ${problem}`);
  }
  const robots = html.match(/<meta\s+name=["']robots["'][^>]*>/gi) || [];
  const robotDirectives =
    robots.length === 1
      ? attributeValue(robots[0], "content")
          .toLowerCase()
          .split(",")
          .map((value) => value.trim())
      : [];
  if (
    robots.length !== 1 ||
    !["index", "follow", "max-image-preview:large"].every((directive) =>
      robotDirectives.includes(directive),
    ) ||
    robotDirectives.includes("noindex") ||
    robotDirectives.includes("nofollow")
  ) {
    errors.push("comparar: meta robots indexável inválida");
  }
  const schemas = parsedSchemas(html, label);
  const nodes = schemas.flatMap((schema) => schemaNodes(schema));
  const types = schemaTypes(schemas);
  for (const expected of [
    "Organization",
    "AutoDealer",
    "WebPage",
    "WebApplication",
    "BreadcrumbList",
  ]) {
    if (!types.has(expected))
      errors.push(`${label}: schema ${expected} ausente`);
  }
  validateOrganizationGraph(nodes, label);
  const webpage = nodes.find(
    (node) =>
      node["@type"] === "WebPage" && node["@id"] === `${canonical}#webpage`,
  );
  if (webpage?.mainEntity?.["@id"] !== `${canonical}#app`) {
    errors.push("comparar: WebPage não referencia o WebApplication");
  }
  if (
    anchorHrefs(html).filter((href) => href.startsWith(`${site}/veiculo/`))
      .length < 2
  ) {
    errors.push("comparar: exemplos/estoque real ausentes do HTML");
  }
  if (!anchorHrefs(html).includes(`${site}/seminovos`)) {
    errors.push("comparar: link para o estoque ausente");
  }
  if (occurrences(sitemap, `<loc>${canonical}</loc>`) !== 1) {
    errors.push("comparar: URL ausente ou duplicada no sitemap");
  }
}

validateComparator();

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
  "estancia-velha",
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
  `SEO gerado válido: ${cities.length} páginas regionais de compra, ${cities.filter((city) => city.sell).length} de venda, ${landings.length} landings transacionais e comparador.`,
);
