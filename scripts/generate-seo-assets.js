#!/usr/bin/env node

/**
 * Gera sitemap.xml e HTML estático para crawlers (blog + páginas locais).
 * Roda no postbuild antes do deploy.
 */

import { readFileSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { writeTextFile } from "./lib/write-text-file.js";
import {
  fetchVehicleSitemapUrls,
  generateVehicleSlug,
} from "./lib/vehicle-sitemap-urls.js";
import { readFreshSeoStockCache } from "./lib/seo-stock-cache.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const publicDir = join(rootDir, "public");
const seoStaticDir = join(publicDir, "seo-static");

const SITE = "https://www.netcarmultimarcas.com.br";
const STOCK_API_URL =
  process.env.NETCAR_SEO_STOCK_API_URL ||
  `${SITE}/api/v1/veiculos.php?limit=500`;
const WHATSAPP_IAN = "5551997293118";
const today = new Date().toISOString().slice(0, 10);

const SITE_WHATSAPP_PREFIX = "Estava olhando o site da Netcar e";

function siteWhatsAppMessage(body) {
  const trimmed = body.trim();
  if (!trimmed) {
    return `${SITE_WHATSAPP_PREFIX} gostaria de mais informações.`;
  }
  if (trimmed.startsWith(SITE_WHATSAPP_PREFIX)) {
    return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
  }
  const normalized = trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
  return `${SITE_WHATSAPP_PREFIX} ${normalized.endsWith(".") ? normalized : `${normalized}.`}`;
}

function cityWhatsAppLink(cityName) {
  const text = siteWhatsAppMessage(
    `moro em ${cityName} e estou procurando um seminovo.`,
  );
  return `https://wa.me/${WHATSAPP_IAN}?text=${encodeURIComponent(text)}`;
}

function landingWhatsAppLink(name) {
  const text = siteWhatsAppMessage(
    `estou procurando um ${name} seminovo em Esteio.`,
  );
  return `https://wa.me/${WHATSAPP_IAN}?text=${encodeURIComponent(text)}`;
}

function comparatorWhatsAppLink() {
  const text = siteWhatsAppMessage(
    "quero ajuda para comparar os seminovos que escolhi.",
  );
  return `https://wa.me/${WHATSAPP_IAN}?text=${encodeURIComponent(text)}`;
}

// Gera config PHP a partir do .env.production, para o index.php não duplicar
// a URL da API. O .env não vai para o servidor; este arquivo gerado vai.
try {
  const envFile = readFileSync(join(rootDir, ".env.production"), "utf-8");
  const apiBaseMatch = envFile.match(/^VITE_API_BASE_URL=(.+)$/m);
  const apiBaseUrl = apiBaseMatch
    ? apiBaseMatch[1].trim().replace(/^["']|["']$/g, "")
    : "";
  if (apiBaseUrl) {
    writeTextFile(
      join(publicDir, "netcar-config.php"),
      `<?php\n// Gerado no build a partir de .env.production — nao editar manualmente.\ndefine('NETCAR_API_BASE_URL', '${apiBaseUrl.replace(/'/g, "\\'")}');\n`,
    );
    console.log(`netcar-config.php gerado (API: ${apiBaseUrl})`);
  }
} catch {
  console.warn(
    "Aviso: .env.production não encontrado; netcar-config.php não gerado.",
  );
}

// Quem assina o blog. Antes o author era a própria Netcar Multimarcas, o que
// não diz nada sobre quem escreve nem sob qual critério: texto sem responsável
// identificável é o que o Google separa de conteúdo com supervisão editorial.
// A url aponta para a página que descreve o processo, incluindo o uso de
// geração automática a partir do estoque.
const EDITORIAL_AUTHOR = {
  "@type": "Organization",
  name: "Equipe editorial Netcar",
  url: `${SITE}/politica-editorial`,
};

function formatDateBr(isoDate) {
  const [year, month, day] = String(isoDate).split("-");
  return `${day}/${month}/${year}`;
}

// Entidade institucional + um LocalBusiness por endereço físico. Mantém o
// mesmo grafo de seo_org_schema() e do JSON-LD inicial em index.html.
const OPENING_HOURS_SCHEMA = [
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
];

const ORG_ROOT_SCHEMA = {
  "@type": "Organization",
  "@id": `${SITE}/#organization`,
  name: "Netcar Multimarcas",
  alternateName: "Netcar Veículos",
  legalName: "R&C Veículos Ltda",
  taxID: "02.237.969/0001-06",
  foundingDate: "1997",
  description:
    "Loja de seminovos em Esteio/RS. Carros com garantia, vistoriados e financiamento facilitado. 2 lojas na Av. Presidente Vargas. Compra de usados, mesmo financiados.",
  url: SITE,
  logo: {
    "@type": "ImageObject",
    "@id": `${SITE}/#logo`,
    url: `${SITE}/images/Logotipo7_1768863597989.png`,
  },
  brand: {
    "@type": "Brand",
    "@id": `${SITE}/#brand`,
    name: "Netcar Multimarcas",
    logo: { "@id": `${SITE}/#logo` },
  },
  image: [`${SITE}/images/loja1.jpg`, `${SITE}/images/loja2.jpg`],
  email: "contato@netcarmultimarcas.com.br",
  subOrganization: [{ "@id": `${SITE}/#loja-1` }, { "@id": `${SITE}/#loja-2` }],
  sameAs: [
    "https://www.instagram.com/netcar_rc",
    "https://www.facebook.com/NetcarRC",
  ],
};

const ORG_SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    ORG_ROOT_SCHEMA,
    {
      "@type": "AutoDealer",
      "@id": `${SITE}/#loja-1`,
      name: "Netcar Multimarcas - Loja 1",
      branchCode: "Loja1",
      url: `${SITE}/contato#loja-1`,
      image: `${SITE}/images/loja1.jpg`,
      logo: { "@id": `${SITE}/#logo` },
      telephone: "+55-51-3473-7900",
      email: "contato@netcarmultimarcas.com.br",
      parentOrganization: { "@id": `${SITE}/#organization` },
      address: {
        "@type": "PostalAddress",
        streetAddress: "Av. Presidente Vargas, 740",
        addressLocality: "Esteio",
        addressRegion: "RS",
        postalCode: "93260-048",
        addressCountry: "BR",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: -29.8380385,
        longitude: -51.1702399,
      },
      hasMap: "https://maps.google.com/maps?cid=9144067949621682127",
      openingHoursSpecification: OPENING_HOURS_SCHEMA,
      priceRange: "R$ 40.000 - R$ 300.000",
    },
    {
      "@type": "AutoDealer",
      "@id": `${SITE}/#loja-2`,
      name: "Netcar Multimarcas - Loja 2",
      branchCode: "Loja2",
      url: `${SITE}/contato#loja-2`,
      image: `${SITE}/images/loja2.jpg`,
      logo: { "@id": `${SITE}/#logo` },
      telephone: "+55-51-3033-3900",
      email: "contato@netcarmultimarcas.com.br",
      parentOrganization: { "@id": `${SITE}/#organization` },
      address: {
        "@type": "PostalAddress",
        streetAddress: "Av. Presidente Vargas, 1106",
        addressLocality: "Esteio",
        addressRegion: "RS",
        postalCode: "93260-001",
        addressCountry: "BR",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: -29.8411446,
        longitude: -51.1721442,
      },
      hasMap: "https://maps.google.com/maps?cid=10839197980729051544",
      openingHoursSpecification: OPENING_HOURS_SCHEMA,
      priceRange: "R$ 40.000 - R$ 300.000",
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

// Trilha Home > seção > página. Ajuda o Google a entender a hierarquia e pode
// renderizar breadcrumb no resultado no lugar da URL crua.
function breadcrumbSchema(items, id) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    ...(id ? { "@id": id } : {}),
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

function regionalPageSchema(city, variant, canonical) {
  const isBuy = variant === "buy";
  const page = isBuy ? city : city.sell;
  return {
    "@context": "https://schema.org",
    "@type": isBuy ? "CollectionPage" : "WebPage",
    "@id": `${canonical}#webpage`,
    url: canonical,
    name: page.h1,
    description: page.description,
    inLanguage: "pt-BR",
    isPartOf: {
      "@type": "CollectionPage",
      "@id": `${SITE}/regioes-atendidas#webpage`,
      url: `${SITE}/regioes-atendidas`,
      name: "Regiões atendidas pela Netcar",
    },
    breadcrumb: { "@id": `${canonical}#breadcrumb` },
    mainEntity: { "@id": `${canonical}#service` },
  };
}

function regionalServiceSchema(city, variant, canonical) {
  const isBuy = variant === "buy";
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${canonical}#service`,
    name: isBuy
      ? `Atendimento para compra de seminovos para ${city.name}`
      : `Pré-avaliação de carro para clientes de ${city.name}`,
    serviceType: isBuy
      ? "Pesquisa online e atendimento para compra presencial de carro seminovo"
      : "Pré-avaliação remota e compra presencial de veículo usado",
    areaServed: { "@type": "City", name: city.name },
    provider: { "@id": `${SITE}/#organization` },
    availableChannel: {
      "@type": "ServiceChannel",
      serviceUrl: canonical,
      availableLanguage: "pt-BR",
    },
  };
}

const HOME_CRUMB = { name: "Home", url: SITE };

const manualBlogPosts = JSON.parse(
  readFileSync(join(rootDir, "src/data/seo/blog-posts.json"), "utf-8"),
);
let autoBlogPosts = [];
try {
  autoBlogPosts = JSON.parse(
    readFileSync(join(rootDir, "src/data/seo/blog-auto.json"), "utf-8"),
  );
} catch {
  /* sem posts automáticos ainda */
}
// Manuais têm prioridade no slug
const blogPosts = [
  ...manualBlogPosts,
  ...autoBlogPosts.filter(
    (a) => !manualBlogPosts.some((m) => m.slug === a.slug),
  ),
];
const cities = JSON.parse(
  readFileSync(join(rootDir, "src/data/seo/cities.json"), "utf-8"),
);
ORG_ROOT_SCHEMA.areaServed = [
  { "@type": "City", name: "Esteio" },
  ...cities.map((city) => ({ "@type": "City", name: city.name })),
  {
    "@type": "AdministrativeArea",
    name: "Região Metropolitana de Porto Alegre",
  },
];
writeTextFile(
  join(publicDir, "seo", "cities.json"),
  `${JSON.stringify(
    cities.map((city) => city.name),
    null,
    2,
  )}\n`,
);
let landings = [];
try {
  landings = JSON.parse(
    readFileSync(join(rootDir, "src/data/seo/landings.json"), "utf-8"),
  );
} catch {
  console.warn(
    "Aviso: landings.json não encontrado; landings de marca/categoria ignoradas.",
  );
}
writeTextFile(
  join(publicDir, "seo", "landings.json"),
  `${JSON.stringify(landings, null, 2)}\n`,
);
let contentPages = [];
try {
  contentPages = JSON.parse(
    readFileSync(join(rootDir, "src/data/seo/content-pages.json"), "utf-8"),
  );
} catch {
  console.warn("Aviso: content-pages.json não encontrado.");
}

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
      if (section.type === "cars" && section.cars) {
        return `<div class="blog-cars">${section.cars
          .map((car) => {
            const specs = [car.ano, car.km, car.cambio]
              .filter(Boolean)
              .map(escapeHtml)
              .join(" &middot; ");
            const img = car.img
              ? `<img src="${escapeHtml(car.img)}" alt="${escapeHtml(car.modelo)}" loading="lazy" />`
              : "";
            const preco = car.preco
              ? `<strong>${escapeHtml(car.preco)}</strong>`
              : "";
            const selo = car.destaque
              ? `<span class="selo">${escapeHtml(car.destaque)}</span>`
              : "";
            return `<a class="blog-car" href="${escapeHtml(car.url)}">${img}<span class="blog-car__info"><b>${escapeHtml(car.modelo)}</b><small>${specs}</small>${preco}${selo}</span></a>`;
          })
          .join("")}</div>`;
      }
      return "";
    })
    .join("\n");
}

// Estoque real para as vitrines das landings de cidade/marca. Sem isso, as
// páginas que o crawler recebe falam da cidade mas não mostram nenhum carro —
// nem geram link interno para as fichas.
async function fetchStock() {
  try {
    const apiUrl = new URL(STOCK_API_URL);
    const pageSize = Math.max(
      Number(apiUrl.searchParams.get("limit")) || 0,
      500,
    );
    const vehicles = [];
    const seenIds = new Set();
    let offset = 0;

    while (true) {
      apiUrl.searchParams.set("limit", String(pageSize));
      apiUrl.searchParams.set("offset", String(offset));
      const res = await fetch(apiUrl, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success || !Array.isArray(json.data))
        throw new Error("resposta inválida");

      const page = json.data;
      let added = 0;
      for (const vehicle of page) {
        const id = String(vehicle.id);
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        vehicles.push(vehicle);
        added += 1;
      }

      if (page.length < pageSize || added === 0) break;
      offset += page.length;
    }

    return vehicles;
  } catch (error) {
    const cached = readFreshSeoStockCache(rootDir, { includeSold: true });
    if (cached?.vehicles.length) {
      const ageMinutes = Math.max(0, Math.round(cached.ageMs / 60000));
      console.warn(
        `Aviso: estoque indisponível (${error.message}); usando cache de ${ageMinutes} min com ${cached.vehicles.length} veículos.`,
      );
      return cached.vehicles;
    }
    console.warn(
      `Aviso: estoque indisponível (${error.message}) e cache recente ausente; validação interromperá o build.`,
    );
    return [];
  }
}

const completeStock = await fetchStock();
// Todas as vitrines SEO continuam transacionais. O conjunto completo existe
// apenas para o showroom humano de /seminovos e nunca alimenta sitemap,
// landings, Home, comparador ou feeds.
const stock = completeStock.filter((vehicle) => Number(vehicle.valor) > 0);
const showroomStock = [
  ...stock,
  ...completeStock.filter((vehicle) => Number(vehicle.valor) <= 0),
];

function normalizedFilterValue(value) {
  return String(value || "")
    .trim()
    .toLocaleUpperCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function compactFilterValue(value) {
  return normalizedFilterValue(value).replace(/\s+/g, "");
}

function resolvedVehicleCategory(vehicle) {
  const brand = normalizedFilterValue(vehicle.marca);
  const model = normalizedFilterValue(vehicle.modelo || vehicle.name);
  if (/\b(RENEGADE|KICKS)\b/.test(model)) return "SUV";
  if (brand === "HONDA" && /^CITY\b/.test(model) && !/\bHATCH\b/.test(model)) {
    return "SEDAN";
  }
  return normalizedFilterValue(vehicle.categoria);
}

/** Mantém exatamente o mesmo contrato de filtros da landing React. */
function matchesLandingFilters(vehicle, filters = {}) {
  const price = Number(vehicle.valor || vehicle.price || 0);
  if (
    filters.marca &&
    normalizedFilterValue(vehicle.marca) !==
      normalizedFilterValue(filters.marca)
  )
    return false;
  if (
    filters.modelo &&
    !compactFilterValue(vehicle.modelo).includes(
      compactFilterValue(filters.modelo),
    )
  )
    return false;
  if (
    filters.categoria &&
    resolvedVehicleCategory(vehicle) !==
      normalizedFilterValue(filters.categoria)
  )
    return false;
  if (
    filters.cambio &&
    normalizedFilterValue(vehicle.cambio) !==
      normalizedFilterValue(filters.cambio)
  )
    return false;
  if (
    filters.combustivel &&
    normalizedFilterValue(vehicle.combustivel) !==
      normalizedFilterValue(filters.combustivel)
  )
    return false;
  if (filters.precoMin !== undefined && price < filters.precoMin) return false;
  if (filters.precoMax !== undefined && price > filters.precoMax) return false;
  return price > 0;
}

function normalizeBootstrapImage(raw) {
  if (!raw) return "";
  const value = String(raw)
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "");
  if (/^https?:\/\//i.test(value)) return value.replace(/^http:/i, "https:");
  return `${SITE}/${value.replace(/^\/+/, "")}`;
}

// O endpoint completo do estoque passa perto de 1 MB. Entregar no HTML apenas os
// campos usados no primeiro paint elimina a espera pela API sem expor chassi,
// Renavam ou observações administrativas. O React atualiza os detalhes depois,
// fora da janela crítica do LCP.
function toBootstrapVehicle(vehicle) {
  const thumb = Array.isArray(vehicle?.imagens?.thumb)
    ? vehicle.imagens.thumb.slice(0, 1).map(normalizeBootstrapImage)
    : [];
  const siteImages = vehicle?.imagens_site || {};

  return {
    id: String(vehicle.id),
    name: [vehicle.marca, vehicle.modelo].filter(Boolean).join(" "),
    slug: String(vehicle.link || vehicle.id),
    price: Number(vehicle.valor || 0),
    preco_com_troca: Number(vehicle.preco_com_troca || 0),
    year: Number(vehicle.ano || 0),
    anoFabricacao: vehicle.ano_fabricacao
      ? Number(vehicle.ano_fabricacao)
      : undefined,
    km: Number(vehicle.km || 0),
    images: thumb,
    imagens_site: {
      capa: siteImages.capa ? normalizeBootstrapImage(siteImages.capa) : null,
      capa_thumb: siteImages.capa_thumb
        ? normalizeBootstrapImage(siteImages.capa_thumb)
        : null,
      capa_opengraph: siteImages.capa_opengraph
        ? normalizeBootstrapImage(siteImages.capa_opengraph)
        : null,
      galeria: [],
      tem_fotos: siteImages.tem_fotos,
    },
    marca: String(vehicle.marca || ""),
    modelo: String(vehicle.modelo || ""),
    cor: String(vehicle.cor || ""),
    motor: String(vehicle.motor || ""),
    combustivel: String(vehicle.combustivel || ""),
    cambio: String(vehicle.cambio || ""),
    potencia: String(vehicle.potencia || ""),
    placa: String(vehicle.placa || ""),
    portas: Number(vehicle.portas || 0),
    lugares: Number(vehicle.lugares || 0),
    valor_formatado: String(vehicle.valor_formatado || ""),
    preco_com_troca_formatado: String(vehicle.preco_com_troca_formatado || ""),
    categoria: String(vehicle.categoria || ""),
    opcionais: [],
    diferenciais: [],
    pdf: vehicle.pdf ? String(vehicle.pdf) : undefined,
    pdf_url: vehicle.pdf_url
      ? normalizeBootstrapImage(vehicle.pdf_url)
      : undefined,
    destaque: Number(vehicle.destaque || 0),
    promocao: Number(vehicle.promocao || 0),
  };
}

const stockBootstrap = stock.map(toBootstrapVehicle);
const showroomStockBootstrap = showroomStock.map(toBootstrapVehicle);

writeTextFile(
  join(publicDir, "seo", "stock-bootstrap.json"),
  `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    vehicles: stockBootstrap,
    showroomVehicles: showroomStockBootstrap,
  })}\n`,
);

function byHomePriority(a, b) {
  const destaqueDiff = Number(b?.destaque === 1) - Number(a?.destaque === 1);
  if (destaqueDiff !== 0) return destaqueDiff;
  return (Number(b?.id) || 0) - (Number(a?.id) || 0);
}

function hasHomePhoto(vehicle) {
  const temFotos = vehicle?.imagens_site?.tem_fotos;
  return (
    Number(vehicle?.valor) > 0 &&
    temFotos !== 0 &&
    temFotos !== undefined &&
    temFotos !== null
  );
}

function normalizeHomeImage(raw) {
  if (!raw) return "";
  const normalized = String(raw)
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "");
  if (/^https?:\/\//i.test(normalized))
    return normalized.replace(/^http:/i, "https:");
  return `/${normalized.replace(/^\/+/, "")}`;
}

// Mantém o primeiro carro da Home estável e grava a imagem para o PHP iniciar
// seu download no HTML, antes de React e da consulta de estoque.
const orderedHomeStock = stock.filter(hasHomePhoto).sort(byHomePriority);
const featuredHomeVehicle = orderedHomeStock[0];
const homeHeroVehicle = orderedHomeStock
  .filter(
    (vehicle) => String(vehicle.id) !== String(featuredHomeVehicle?.id || ""),
  )
  .filter((vehicle) => Number(vehicle.valor) > 80000)
  .filter((vehicle) =>
    /\.png(?:$|[?#])/i.test(String(vehicle?.imagens_site?.capa || "")),
  )[0];
const homeLcp = homeHeroVehicle
  ? {
      id: String(homeHeroVehicle.id),
      image: normalizeHomeImage(homeHeroVehicle.imagens_site.capa),
      brand: String(homeHeroVehicle.marca || "").trim(),
      model: String(
        homeHeroVehicle.modelo || homeHeroVehicle.name || "",
      ).trim(),
      year: Number(homeHeroVehicle.ano || homeHeroVehicle.year || 0),
      price: Number(homeHeroVehicle.valor || homeHeroVehicle.price || 0),
      valor_formatado: String(homeHeroVehicle.valor_formatado || "").trim(),
      preco_com_troca: Number(homeHeroVehicle.preco_com_troca || 0),
      preco_com_troca_formatado: String(
        homeHeroVehicle.preco_com_troca_formatado || "",
      ).trim(),
      tag: [homeHeroVehicle.combustivel, homeHeroVehicle.motor]
        .filter(Boolean)
        .join(" "),
      marca: String(homeHeroVehicle.marca || "").trim(),
      modelo: String(homeHeroVehicle.modelo || "").trim(),
      placa: String(homeHeroVehicle.placa || "").trim(),
      combustivel: String(homeHeroVehicle.combustivel || "").trim(),
      cambio: String(homeHeroVehicle.cambio || "").trim(),
    }
  : null;
writeTextFile(
  join(publicDir, "seo", "home-lcp.json"),
  `${JSON.stringify(homeLcp, null, 2)}\n`,
);

function titleCase(text) {
  return String(text || "")
    .toLowerCase()
    .replace(
      /(^|[\s-])(\p{L})/gu,
      (_, sep, letter) => sep + letter.toUpperCase(),
    );
}

// Carro sem foto cadastrada recebe um banner genérico do CMS no lugar da capa.
const isBannerPlaceholder = (path) =>
  /\/imagens\/banner\//i.test(String(path || ""));

function vehicleCardImage(vehicle) {
  const raw = [
    vehicle?.imagens_site?.capa_opengraph,
    vehicle?.imagens_site?.capa,
    vehicle?.imagens?.thumb?.[0],
  ].find((candidate) => candidate && !isBannerPlaceholder(candidate));
  if (!raw) return "";
  const img = String(raw)
    .trim()
    .replace(/^\.\/+/, "")
    .replace(/ /g, "%20")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
  if (/^https?:\/\//i.test(img)) return img.replace(/^http:/i, "https:");
  return `${SITE}/${img.replace(/^\/+/, "")}`;
}

function vehicleDisplayName(vehicle) {
  let modelo = String(vehicle.modelo || "").trim();
  const marca = String(vehicle.marca || "").trim();
  if (modelo && marca && modelo.toUpperCase().startsWith(marca.toUpperCase())) {
    modelo = modelo.slice(marca.length).trim();
  }
  return [titleCase(marca), titleCase(modelo), vehicle.ano]
    .filter(Boolean)
    .join(" ");
}

function showcaseVehicleOrder(vehicles) {
  return [
    ...vehicles.filter((vehicle) => vehicleCardImage(vehicle)),
    ...vehicles.filter((vehicle) => !vehicleCardImage(vehicle)),
  ];
}

/** Vitrine de estoque em HTML, reaproveitando os cards de carro do blog. */
function stockShowcase({ heading, vehicles, limit = 8, ctaLabel, ctaHref }) {
  if (!vehicles.length) return "";
  // Carro com foto real na frente: vitrine sem imagem converte muito pior.
  const ordered = showcaseVehicleOrder(vehicles);
  const cars = ordered.slice(0, limit).map((vehicle) => ({
    modelo: vehicleDisplayName(vehicle),
    url: `${SITE}/veiculo/${generateVehicleSlug(vehicle)}`,
    ano: vehicle.ano ? String(vehicle.ano) : "",
    km:
      Number(vehicle.km) > 0
        ? `${Number(vehicle.km).toLocaleString("pt-BR")} km`
        : "",
    cambio: vehicle.cambio ? titleCase(vehicle.cambio) : "",
    preco: `R$ ${Number(vehicle.valor).toLocaleString("pt-BR")}`,
    img: vehicleCardImage(vehicle),
  }));
  const cta = ctaHref
    ? `<p><a href="${ctaHref}">${escapeHtml(ctaLabel || "Ver estoque completo")}</a></p>`
    : "";
  return `<h2>${escapeHtml(heading)}</h2>
      ${renderSections([{ type: "cars", cars }])}
      ${cta}`;
}

function landingCollectionSchema(landing, canonical, vehicles) {
  const ordered = showcaseVehicleOrder(vehicles);
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${canonical}#webpage`,
    url: canonical,
    name: landing.h1,
    description: landing.description,
    inLanguage: "pt-BR",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: vehicles.length,
      itemListElement: ordered.slice(0, 12).map((vehicle, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${SITE}/veiculo/${generateVehicleSlug(vehicle)}`,
        name: vehicleDisplayName(vehicle),
      })),
    },
  };
}

function pageShell({
  title,
  description,
  canonical,
  body,
  schemas = [],
  ogImage,
  robots = "index, follow, max-image-preview:large",
}) {
  const schemaTags = schemas.length
    ? "\n" +
      schemas
        .map(
          (schema) =>
            `  <script type="application/ld+json">${JSON.stringify(schema)}</script>`,
        )
        .join("\n")
    : "";
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="${escapeHtml(robots)}" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Netcar Multimarcas" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${escapeHtml(ogImage || `${SITE}/images/loja1.jpg`)}" />${schemaTags}
  <style>
    .blog-cars{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;margin:32px 0}
    .blog-car{display:flex;flex-direction:column;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;text-decoration:none;color:inherit;background:#fff;transition:box-shadow .2s}
    .blog-car:hover{box-shadow:0 10px 30px rgba(0,0,0,.08)}
    .blog-car img{display:block;width:100%;height:180px;object-fit:cover;background:#f3f4f6}
    .blog-car__info{display:flex;flex-direction:column;padding:18px;flex:1}
    .blog-car__info b{font-size:16px;line-height:1.3}
    .blog-car__info small{color:#6b7280;margin:6px 0}
    .blog-car__info strong{color:#111827;font-size:20px;margin-top:auto}
    .blog-car .selo{display:inline-block;margin-top:8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;background:#fee2e2;color:#b91c1c;padding:3px 10px;border-radius:999px;align-self:flex-start}
  </style>
</head>
<body>
  <header>
    <p><strong>Netcar Multimarcas</strong> — Seminovos em Esteio/RS</p>
    <nav>
      <a href="${SITE}/">Home</a>
      <a href="${SITE}/seminovos">Seminovos</a>
      <a href="${SITE}/regioes-atendidas">Regiões atendidas</a>
      <a href="${SITE}/blog">Blog</a>
      <a href="${SITE}/contato">Contato</a>
    </nav>
  </header>
  <main>${body}</main>
  <footer>
    <p>Netcar Multimarcas — Av. Presidente Vargas, 740 e 1106, Esteio/RS</p>
    <p><a href="tel:+555134737900">Ligar: (51) 3473-7900</a> · <a href="https://wa.me/5551997293118?text=Ol%C3%A1%21%20Vim%20pelo%20site%20da%20Netcar%20e%20quero%20mais%20informa%C3%A7%C3%B5es.">WhatsApp: (51) 99729-3118</a></p>
  </footer>
</body>
</html>`;
}

mkdirSync(seoStaticDir, { recursive: true });

// O sitemap preserva lastmod para não fingir atualização em todo deploy. Quando
// o HTML realmente muda (copy, estoque exibido, links ou schema), esta coleção
// permite atualizar somente a URL afetada.
const changedSeoUrls = new Set();

function writeSeoPage(filePath, canonical, content) {
  const changed = writeTextFile(filePath, content);
  if (changed) changedSeoUrls.add(canonical);
  return changed;
}

const regionsHubCanonical = `${SITE}/regioes-atendidas`;
const regionalGroups = cities.reduce((groups, city) => {
  groups[city.regionName] = [...(groups[city.regionName] || []), city];
  return groups;
}, {});
const regionsHubLinks = Object.entries(regionalGroups)
  .map(
    ([region, regionCities]) => `<section>
      <h2>${escapeHtml(region)}</h2>
      <ul>${regionCities
        .map(
          (city) => `<li>
            <strong>${escapeHtml(city.name)}</strong> — cerca de ${city.distanceKm} km, ${escapeHtml(city.travelTime)}:
            <a href="${SITE}/seminovos-${city.slug}">seminovos perto de ${escapeHtml(city.name)}</a>
            ·
            <a href="${SITE}/vender-carro-${city.slug}">vender carro em ${escapeHtml(city.name)}</a>
          </li>`,
        )
        .join("")}</ul>
    </section>`,
  )
  .join("");
const regionsHubBody = `
  <article>
    <h1>Seminovos para Grande Porto Alegre, Vales e Serra Gaúcha</h1>
    <p>Consulte estoque, preços e condições antes de viajar. Simulação de financiamento e pré-avaliação da troca podem começar remotamente.</p>
    <p>A Netcar possui lojas físicas somente na Av. Presidente Vargas, em Esteio. Test drive, vistoria e fechamento são presenciais.</p>
    <h2>Como planejar a visita</h2>
    <ol>
      <li>Pesquise veículos, fotos e preços no estoque online.</li>
      <li>Adiante simulação e envie dados completos do usado.</li>
      <li>Confirme disponibilidade e agenda antes de ir a Esteio.</li>
    </ol>
    <h2>Cidades atendidas</h2>
    ${regionsHubLinks}
    <p><a href="${SITE}/seminovos">Ver estoque atual</a> · <a href="${SITE}/compra">Pré-avaliar meu carro</a></p>
  </article>`;
writeSeoPage(
  join(seoStaticDir, "regions-hub.html"),
  regionsHubCanonical,
  pageShell({
    title: "Seminovos na região de Porto Alegre e Serra | Netcar",
    description:
      "Consulte seminovos e pré-avaliação para cidades da Grande Porto Alegre, Vale dos Sinos, Paranhana e Serra Gaúcha. Lojas Netcar somente em Esteio.",
    canonical: regionsHubCanonical,
    body: regionsHubBody,
    schemas: [
      ORG_SCHEMA,
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "@id": `${regionsHubCanonical}#webpage`,
        url: regionsHubCanonical,
        name: "Regiões atendidas pela Netcar Multimarcas",
        description:
          "Seminovos e pré-avaliação para cidades da Grande Porto Alegre, Vales e Serra Gaúcha, com lojas físicas em Esteio.",
        hasPart: cities.flatMap((city) => [
          {
            "@type": "CollectionPage",
            url: `${SITE}/seminovos-${city.slug}`,
            name: city.h1,
          },
          {
            "@type": "WebPage",
            url: `${SITE}/vender-carro-${city.slug}`,
            name: city.sell.h1,
          },
        ]),
      },
      breadcrumbSchema([
        HOME_CRUMB,
        { name: "Regiões atendidas", url: regionsHubCanonical },
      ]),
    ],
  }),
);

// Palavras-chave do slug para achar posts relacionados. Stopwords de intenção
// (seminovo, esteio, 2026) não distinguem nada — o que liga dois posts é o
// assunto (financiamento, troca, suv, documento).
const POST_STOPWORDS = new Set([
  "seminovo",
  "seminovos",
  "usado",
  "usados",
  "esteio",
  "rs",
  "2026",
  "2025",
  "carro",
  "carros",
  "netcar",
  "como",
  "qual",
  "quanto",
  "custa",
  "vale",
  "pena",
  "guia",
  "completo",
  "grande",
  "porto",
  "alegre",
  "regiao",
  "o",
  "a",
  "de",
  "do",
  "da",
  "em",
  "e",
  "ou",
  "para",
  "com",
  "um",
  "uma",
  "no",
  "na",
]);

function postKeywords(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !POST_STOPWORDS.has(w));
}

// Slug sozinho é pobre demais para casar posts (cada um tem vocabulário
// próprio). Usa slug + título e, se mesmo assim não houver par, completa com
// os posts mais recentes — link interno fraco é melhor que nenhum.
function relatedPosts(current, all, limit = 3) {
  const currentKw = new Set([
    ...postKeywords(current.slug),
    ...postKeywords(current.title),
  ]);
  const scored = all
    .filter((p) => p.slug !== current.slug)
    .map((p) => {
      const kw = new Set([...postKeywords(p.slug), ...postKeywords(p.title)]);
      const shared = [...currentKw].filter((w) => kw.has(w)).length;
      return { post: p, score: shared };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.post.publishedAt.localeCompare(a.post.publishedAt),
    );
  const strong = scored.filter((r) => r.score > 0).map((r) => r.post);
  if (strong.length >= limit) return strong.slice(0, limit);
  const strongSlugs = new Set(strong.map((p) => p.slug));
  const recent = scored
    .filter((r) => !strongSlugs.has(r.post.slug))
    .map((r) => r.post);
  return [...strong, ...recent].slice(0, limit);
}

// Capa do post: primeira imagem real do estoque citado nas seções "cars", ou
// a primeira do estoque geral. Post sem nenhuma imagem no HTML é snippet sem
// thumbnail no Discover e nas redes.
function postCoverImage(post, fallbackStock) {
  for (const section of post.sections || []) {
    if (section.type === "cars" && Array.isArray(section.cars)) {
      const withImg = section.cars.find((car) => car.img);
      if (withImg) return withImg.img;
    }
  }
  const firstWithImg = fallbackStock.find((v) => vehicleCardImage(v));
  return firstWithImg
    ? vehicleCardImage(firstWithImg)
    : `${SITE}/images/loja1.jpg`;
}

for (const post of blogPosts) {
  const canonical = `${SITE}/blog/${post.slug}`;
  const updatedAt = post.updatedAt ?? post.publishedAt;
  const cover = postCoverImage(post, stock);
  const related = relatedPosts(post, blogPosts);
  const relatedHtml = related.length
    ? `<nav aria-label="Leia também"><h2>Leia também</h2><ul>${related
        .map(
          (r) =>
            `<li><a href="${SITE}/blog/${r.slug}">${escapeHtml(r.title)}</a></li>`,
        )
        .join("")}</ul></nav>`
    : "";
  const byline = `
      <p>Por <a href="${SITE}/politica-editorial">${EDITORIAL_AUTHOR.name}</a> · Publicado em ${formatDateBr(post.publishedAt)}${
        updatedAt !== post.publishedAt
          ? ` · Atualizado em ${formatDateBr(updatedAt)}`
          : ""
      } · ${post.readMinutes} min de leitura</p>`;
  const body = `
    <article>
      <h1>${escapeHtml(post.title)}</h1>${byline}
      ${cover ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(post.title)}" loading="lazy" style="width:100%;border-radius:16px;margin:16px 0" />` : ""}
      <p>${escapeHtml(post.description)}</p>
      ${renderSections(post.sections)}
      <p><a href="${SITE}${post.ctaHref}">${escapeHtml(post.ctaLabel)}</a></p>
      ${relatedHtml}
    </article>`;
  const blogPostingSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: updatedAt,
    mainEntityOfPage: canonical,
    url: canonical,
    image: cover ? [cover] : undefined,
    author: EDITORIAL_AUTHOR,
    publisher: {
      "@type": "Organization",
      name: "Netcar Multimarcas",
      url: SITE,
      logo: {
        "@type": "ImageObject",
        url: `${SITE}/images/Logotipo7_1768863597989.png`,
      },
    },
  };
  writeSeoPage(
    join(seoStaticDir, `blog-${post.slug}.html`),
    canonical,
    pageShell({
      title: post.title,
      description: post.description,
      canonical,
      body,
      schemas: [
        ORG_SCHEMA,
        blogPostingSchema,
        breadcrumbSchema([
          HOME_CRUMB,
          { name: "Blog", url: `${SITE}/blog` },
          { name: post.title, url: canonical },
        ]),
      ],
      ogImage: cover,
    }),
  );
}

function relatedCitiesHtml(currentSlug) {
  const current = cities.find((city) => city.slug === currentSlug);
  const citiesBySlug = new Map(cities.map((city) => [city.slug, city]));
  const links = (current?.relatedSlugs || [])
    .map((slug) => citiesBySlug.get(slug))
    .filter(Boolean)
    .map(
      (c) =>
        `<li><a href="${SITE}/seminovos-${c.slug}">Seminovos perto de ${escapeHtml(c.name)}</a></li>`,
    )
    .join("");
  return `<nav aria-label="Seminovos em outras regiões atendidas"><h2>Seminovos em outras regiões atendidas</h2><p><a href="${SITE}/vender-carro-${current.slug}">Vender carro em ${escapeHtml(current.name)}</a> · <a href="${SITE}/regioes-atendidas">Ver todas as regiões atendidas</a></p><ul>${links}</ul></nav>`;
}

function relatedSellCitiesHtml(currentSlug) {
  const current = cities.find((city) => city.slug === currentSlug);
  const citiesBySlug = new Map(cities.map((city) => [city.slug, city]));
  const links = (current?.relatedSlugs || [])
    .map((slug) => citiesBySlug.get(slug))
    .filter((city) => city?.sell)
    .map(
      (c) =>
        `<li><a href="${SITE}/vender-carro-${c.slug}">Vender carro em ${escapeHtml(c.name)}</a></li>`,
    )
    .join("");
  return `<nav aria-label="Vender carro em outras regiões atendidas"><h2>Vender carro em outras regiões atendidas</h2><p><a href="${SITE}/seminovos-${current.slug}">Ver seminovos perto de ${escapeHtml(current.name)}</a> · <a href="${SITE}/regioes-atendidas">Ver todas as regiões atendidas</a></p><ul>${links}</ul></nav>`;
}

for (const city of cities) {
  const canonical = `${SITE}/seminovos-${city.slug}`;
  const faqHtml = city.faq
    .map((item) => `<h3>${escapeHtml(item.q)}</h3><p>${escapeHtml(item.a)}</p>`)
    .join("");
  const paragraphs = city.paragraphs
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");
  const body = `
    <nav aria-label="Navegação estrutural"><ol><li><a href="${SITE}/">Home</a></li><li><a href="${SITE}/regioes-atendidas">Regiões atendidas</a></li><li>Seminovos perto de ${escapeHtml(city.name)}</li></ol></nav>
    <article>
      <h1>${escapeHtml(city.h1)}</h1>
      <p>${escapeHtml(city.intro)}</p>
      ${paragraphs}
      ${city.routeNote ? `<p><strong>Referência de trajeto:</strong> ${escapeHtml(city.routeNote)}</p>` : ""}
      ${stockShowcase({
        heading: `Seminovos para quem vem de ${city.name}`,
        vehicles: stock,
        limit: 8,
        ctaLabel: "Ver todo o estoque de seminovos",
        ctaHref: `${SITE}/seminovos`,
      })}
      <h2>Da pesquisa à visita em Esteio</h2>
      <ol>
        <li>Consulte fotos, preços e versões no estoque online.</li>
        <li>Adiante simulação e pré-avaliação da troca.</li>
        <li>${escapeHtml(city.visitPlanning || "Confirme disponibilidade e visite as lojas da Av. Presidente Vargas, em Esteio.")}</li>
      </ol>
      <p>A Netcar possui lojas físicas somente em Esteio.</p>
      ${faqHtml}
      <p>
        <a href="${SITE}/seminovos">Ver estoque</a>
        ·
        <a href="${cityWhatsAppLink(city.name)}">Falar com o iAN · 24/7</a>
      </p>
      ${relatedCitiesHtml(city.slug)}
    </article>`;
  writeSeoPage(
    join(seoStaticDir, `city-${city.slug}.html`),
    canonical,
    pageShell({
      title: city.title,
      description: city.description,
      canonical,
      body,
      schemas: [
        ORG_SCHEMA,
        regionalPageSchema(city, "buy", canonical),
        regionalServiceSchema(city, "buy", canonical),
        faqSchema(city.faq),
        breadcrumbSchema(
          [
            HOME_CRUMB,
            { name: "Regiões atendidas", url: `${SITE}/regioes-atendidas` },
            { name: `Seminovos perto de ${city.name}`, url: canonical },
          ],
          `${canonical}#breadcrumb`,
        ),
      ],
    }),
  );

  if (city.sell) {
    const sellCanonical = `${SITE}/vender-carro-${city.slug}`;
    const sellFaqHtml = city.sell.faq
      .map(
        (item) => `<h3>${escapeHtml(item.q)}</h3><p>${escapeHtml(item.a)}</p>`,
      )
      .join("");
    const sellParagraphs = city.sell.paragraphs
      .map((p) => `<p>${escapeHtml(p)}</p>`)
      .join("");
    const sellBody = `
    <nav aria-label="Navegação estrutural"><ol><li><a href="${SITE}/">Home</a></li><li><a href="${SITE}/regioes-atendidas">Regiões atendidas</a></li><li>Vender carro em ${escapeHtml(city.name)}</li></ol></nav>
    <article>
      <h1>${escapeHtml(city.sell.h1)}</h1>
      <p>${escapeHtml(city.sell.intro)}</p>
      ${sellParagraphs}
      <p><strong>Referência para a vistoria:</strong> ${escapeHtml(city.routeNote)}</p>
      <h2>Pré-avaliação remota, vistoria em Esteio</h2>
      <ol>
        <li>Envie modelo, versão, ano, quilometragem, fotos e histórico.</li>
        <li>Receba uma orientação inicial, que não representa proposta final.</li>
        <li>Agende vistoria e conferência documental na Av. Presidente Vargas, em Esteio.</li>
      </ol>
      <p>A Netcar não possui unidade ou ponto de coleta em ${escapeHtml(city.name)}.</p>
      ${stockShowcase({
        heading: `Seminovos disponíveis para usar seu carro na troca`,
        vehicles: stock,
        limit: 8,
        ctaLabel: "Ver todo o estoque para troca",
        ctaHref: `${SITE}/seminovos`,
      })}
      ${sellFaqHtml}
      <p><a href="${SITE}/compra">Iniciar pré-avaliação</a> · <a href="${SITE}/seminovos">Ver estoque para troca</a></p>
      ${relatedSellCitiesHtml(city.slug)}
    </article>`;
    writeSeoPage(
      join(seoStaticDir, `sell-city-${city.slug}.html`),
      sellCanonical,
      pageShell({
        title: city.sell.title,
        description: city.sell.description,
        canonical: sellCanonical,
        body: sellBody,
        schemas: [
          ORG_SCHEMA,
          regionalPageSchema(city, "sell", sellCanonical),
          regionalServiceSchema(city, "sell", sellCanonical),
          faqSchema(city.sell.faq),
          breadcrumbSchema(
            [
              HOME_CRUMB,
              { name: "Regiões atendidas", url: `${SITE}/regioes-atendidas` },
              { name: `Vender carro em ${city.name}`, url: sellCanonical },
            ],
            `${sellCanonical}#breadcrumb`,
          ),
        ],
      }),
    );
  }
}

// Landings de marca/categoria (HTML estático p/ crawler) — geradas do estoque real.
function relatedLandingsHtml(currentSlug) {
  const current = landings.find((landing) => landing.slug === currentSlug);
  const bySlug = new Map(landings.map((landing) => [landing.slug, landing]));
  const links = (current?.relatedSlugs || [])
    .map((slug) => bySlug.get(slug))
    .filter((landing) => landing?.indexable)
    .map(
      (l) =>
        `<li><a href="${SITE}/comprar-${l.slug}">${escapeHtml(l.h1)}</a></li>`,
    )
    .join("");
  if (!links) return "";
  return `<nav aria-label="Outros seminovos"><h2>Veja também</h2><ul>${links}</ul></nav>`;
}

for (const landing of landings) {
  const canonical = `${SITE}/comprar-${landing.slug}`;
  const faqHtml = landing.faq
    .map((item) => `<h3>${escapeHtml(item.q)}</h3><p>${escapeHtml(item.a)}</p>`)
    .join("");
  const paragraphs = landing.paragraphs
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");
  const landingStock = stock.filter((vehicle) =>
    matchesLandingFilters(vehicle, landing.filters),
  );
  const availability = landingStock.length
    ? stockShowcase({
        heading: `${landing.name} em estoque agora na Netcar`,
        vehicles: landingStock,
        limit: 12,
        ctaLabel: "Ver todo o estoque de seminovos",
        ctaHref: `${SITE}/seminovos`,
      })
    : `<h2>Estoque em atualização</h2><p>Não há uma unidade deste recorte anunciada agora. Veja as seleções relacionadas ou fale com a Netcar para receber alternativas reais do estoque.</p>`;
  const body = `
    <article>
      <h1>${escapeHtml(landing.h1)}</h1>
      <p>${escapeHtml(landing.intro)}</p>
      ${paragraphs}
      ${availability}
      ${faqHtml}
      <p>
        <a href="${SITE}/seminovos">Ver estoque completo</a>
        ·
        <a href="${landingWhatsAppLink(landing.name)}">Falar com o iAN · 24/7</a>
      </p>
      ${relatedLandingsHtml(landing.slug)}
    </article>`;
  writeSeoPage(
    join(seoStaticDir, `landing-${landing.slug}.html`),
    canonical,
    pageShell({
      title: landing.title,
      description: landing.description,
      canonical,
      body,
      schemas: [
        ORG_SCHEMA,
        landingCollectionSchema(landing, canonical, landingStock),
        faqSchema(landing.faq),
        breadcrumbSchema([
          HOME_CRUMB,
          { name: "Seminovos", url: `${SITE}/seminovos` },
          { name: landing.name, url: canonical },
        ]),
      ],
      robots: landing.indexable
        ? "index, follow, max-image-preview:large"
        : "noindex, follow, max-image-preview:large",
    }),
  );
}

const comparatorCanonical = `${SITE}/comparar`;
const comparatorTitle = "Comparar carros seminovos lado a lado | Netcar";
const comparatorDescription =
  "Compare até 4 carros seminovos lado a lado: preço, ano, câmbio, motor e características. Use o estoque atual da Netcar em Esteio/RS.";
const comparisonDefinitions = [
  ["Jeep Compass", "JEEP", "COMPASS", "Honda HR-V", "HONDA", "HRV"],
  [
    "Chevrolet Tracker",
    "CHEVROLET",
    "TRACKER",
    "Hyundai Creta",
    "HYUNDAI",
    "CRETA",
  ],
  [
    "Volkswagen Nivus",
    "VOLKSWAGEN",
    "NIVUS",
    "Fiat Fastback",
    "FIAT",
    "FASTBACK",
  ],
  [
    "Volkswagen Tera",
    "VOLKSWAGEN",
    "TERA",
    "Volkswagen T-Cross",
    "VOLKSWAGEN",
    "T CROSS",
  ],
];

function closestPricePair(left, right) {
  let best = null;
  for (const a of left) {
    for (const b of right) {
      const difference = Math.abs(Number(a.valor || 0) - Number(b.valor || 0));
      if (!best || difference < best.difference) best = { a, b, difference };
    }
  }
  return best;
}

const comparisonExamples = comparisonDefinitions
  .map(
    ([leftName, leftBrand, leftModel, rightName, rightBrand, rightModel]) => {
      const left = stock.filter((vehicle) =>
        matchesLandingFilters(vehicle, { marca: leftBrand, modelo: leftModel }),
      );
      const right = stock.filter((vehicle) =>
        matchesLandingFilters(vehicle, {
          marca: rightBrand,
          modelo: rightModel,
        }),
      );
      const pair = closestPricePair(left, right);
      return pair ? { leftName, rightName, ...pair } : null;
    },
  )
  .filter(Boolean);

const comparisonExamplesHtml = comparisonExamples.length
  ? `<ul>${comparisonExamples
      .map(
        ({ leftName, rightName, a, b }) =>
          `<li><strong>${escapeHtml(leftName)} x ${escapeHtml(rightName)}</strong>: <a href="${SITE}/veiculo/${generateVehicleSlug(a)}">${escapeHtml(vehicleDisplayName(a))}</a> e <a href="${SITE}/veiculo/${generateVehicleSlug(b)}">${escapeHtml(vehicleDisplayName(b))}</a></li>`,
      )
      .join("")}</ul>`
  : "<p>Escolha dois veículos do estoque atual para começar a comparação.</p>";
const comparatorBody = `
  <nav aria-label="Navegação estrutural"><ol><li><a href="${SITE}/">Home</a></li><li><a href="${SITE}/seminovos">Seminovos</a></li><li>Comparar carros</li></ol></nav>
  <article>
    <h1>Comparar carros seminovos lado a lado</h1>
    <p>Escolha de dois a quatro veículos disponíveis e veja preço, ano, câmbio, motor, combustível, potência, portas, cor e categoria na mesma tela.</p>
    <h2>Comparações com carros do estoque atual</h2>
    ${comparisonExamplesHtml}
    <h2>Como usar o comparador</h2>
    <ol>
      <li>Busque uma marca ou um modelo e selecione o primeiro carro.</li>
      <li>Adicione outros veículos que resolvam o mesmo tipo de uso.</li>
      <li>Compare ficha e preço; depois abra os detalhes e confirme a disponibilidade.</li>
    </ol>
    ${stockShowcase({
      heading: "Carros disponíveis para comparar agora",
      vehicles: stock,
      limit: 10,
      ctaLabel: "Abrir o comparador interativo",
      ctaHref: comparatorCanonical,
    })}
    <p><a href="${SITE}/seminovos">Ver estoque completo</a> · <a href="${comparatorWhatsAppLink()}">Pedir ajuda para comparar</a></p>
  </article>`;
writeSeoPage(
  join(seoStaticDir, "page-comparar.html"),
  comparatorCanonical,
  pageShell({
    title: comparatorTitle,
    description: comparatorDescription,
    canonical: comparatorCanonical,
    body: comparatorBody,
    schemas: [
      ORG_SCHEMA,
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": `${comparatorCanonical}#webpage`,
        url: comparatorCanonical,
        name: "Comparar carros seminovos lado a lado",
        description: comparatorDescription,
        mainEntity: { "@id": `${comparatorCanonical}#app` },
      },
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "@id": `${comparatorCanonical}#app`,
        name: "Comparador de seminovos Netcar",
        url: comparatorCanonical,
        applicationCategory: "ShoppingApplication",
        operatingSystem: "Qualquer navegador",
        isAccessibleForFree: true,
        featureList: [
          "Comparar até quatro seminovos",
          "Preço e ano lado a lado",
          "Câmbio, motor e combustível",
          "Link para a ficha de cada veículo",
        ],
      },
      breadcrumbSchema([
        HOME_CRUMB,
        { name: "Seminovos", url: `${SITE}/seminovos` },
        { name: "Comparar carros", url: comparatorCanonical },
      ]),
    ],
  }),
);

// Páginas de conteúdo SEO (financiamento, atendimento) — HTML estático p/ crawler
function renderContentSections(sections) {
  return sections
    .map((s) => {
      if (s.type === "h2") return `<h2>${escapeHtml(s.text)}</h2>`;
      if (s.type === "p") return `<p>${escapeHtml(s.text)}</p>`;
      if (s.type === "ul" && s.items)
        return `<ul>${s.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
      if (s.type === "ol" && s.items)
        return `<ol>${s.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ol>`;
      return "";
    })
    .join("\n");
}

for (const page of contentPages) {
  const canonical = `${SITE}/${page.slug}`;
  const faqHtml = (page.faq || [])
    .map((item) => `<h3>${escapeHtml(item.q)}</h3><p>${escapeHtml(item.a)}</p>`)
    .join("");
  const pageStock = page.stock
    ? stock.filter((vehicle) =>
        new RegExp(page.stock.match, "i").test(
          String(vehicle[page.stock.field] || ""),
        ),
      )
    : [];
  const body = `
    <article>
      <h1>${escapeHtml(page.h1)}</h1>
      <p>${escapeHtml(page.intro)}</p>
      ${renderContentSections(page.sections || [])}
      ${stockShowcase({
        heading: page.stock?.heading || "Em estoque agora",
        vehicles: pageStock,
        limit: 12,
        ctaLabel: "Ver todo o estoque de seminovos",
        ctaHref: `${SITE}/seminovos`,
      })}
      ${faqHtml}
      <p><a href="${SITE}${page.secondHref}">${escapeHtml(page.secondLabel)}</a></p>
    </article>`;
  writeSeoPage(
    join(seoStaticDir, `page-${page.slug}.html`),
    canonical,
    pageShell({
      title: page.title,
      description: page.description,
      canonical,
      body,
      schemas: [
        ORG_SCHEMA,
        faqSchema(page.faq || []),
        breadcrumbSchema([HOME_CRUMB, { name: page.h1, url: canonical }]),
      ],
    }),
  );
}

const staticPages = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/seminovos", priority: "0.9", changefreq: "daily" },
  { path: "/regioes-atendidas", priority: "0.85", changefreq: "monthly" },
  { path: "/sobre", priority: "0.8", changefreq: "monthly" },
  { path: "/contato", priority: "0.8", changefreq: "monthly" },
  { path: "/compra", priority: "0.85", changefreq: "weekly" },
  { path: "/blog", priority: "0.8", changefreq: "weekly" },
  // Páginas de intenção (antes fora do sitemap)
  { path: "/financiamento", priority: "0.85", changefreq: "monthly" },
  { path: "/move-brasil", priority: "0.85", changefreq: "weekly" },
  { path: "/atendimento-24h", priority: "0.7", changefreq: "monthly" },
  { path: "/comparar", priority: "0.7", changefreq: "weekly" },
  { path: "/seminovos-automaticos", priority: "0.8", changefreq: "weekly" },
  // Não vende nada, mas é a página que o blog cita como autor e onde o processo
  // editorial fica explícito. Precisa ser rastreável para valer como sinal.
  { path: "/politica-editorial", priority: "0.4", changefreq: "yearly" },
];

// Preserva URLs de veículos no sitemap. No build, generate-sitemap.js roda antes
// e grava o sitemap local com os veículos da API — usamos esse como fonte primária.
// Fallback: sitemap em produção (sem isso, o upload apagaria as URLs de veículo indexadas).
function extractVehicleUrls(xml) {
  const matches = [
    ...xml.matchAll(/<loc>(https?:\/\/[^<]*\/veiculo\/[^<]+)<\/loc>/g),
  ];
  return matches.map((m) => m[1]);
}

async function getVehicleUrls() {
  try {
    const apiUrls = await fetchVehicleSitemapUrls();
    if (apiUrls.length > 0) return apiUrls;
  } catch (error) {
    console.warn(
      `Aviso: API de veículos indisponível (${error.message}); tentando sitemap local.`,
    );
  }

  try {
    const localXml = readFileSync(join(publicDir, "sitemap.xml"), "utf-8");
    const localUrls = extractVehicleUrls(localXml);
    if (localUrls.length > 0) return localUrls;
  } catch {
    // sem sitemap local; tenta produção
  }

  let productionUrls = [];
  try {
    const res = await fetch(`${SITE}/sitemap.xml`, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      productionUrls = extractVehicleUrls(await res.text());
    }
  } catch {
    console.warn("Aviso: não foi possível buscar sitemap de produção.");
  }

  if (productionUrls.length > 0) return productionUrls;

  // Sem nenhuma fonte de veículos, gravar o sitemap removeria o estoque inteiro
  // do índice — e o próprio sitemap zerado viraria a fonte do build seguinte.
  throw new Error(
    "Nenhuma URL de veículo encontrada (API, sitemap local e produção falharam). " +
      "Build interrompido para não publicar sitemap sem estoque.",
  );
}

function parseSitemapLastmods(xml) {
  const map = new Map();
  for (const match of xml.matchAll(
    /<loc>([^<]+)<\/loc>\s*\n\s*<lastmod>([^<]+)<\/lastmod>/g,
  )) {
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
  ...landings
    .filter((landing) => landing.indexable)
    .map((landing) => ({
      loc: `${SITE}/comprar-${landing.slug}`,
      priority: "0.8",
      changefreq: "weekly",
    })),
];

let previousLastmods = new Map();
try {
  previousLastmods = parseSitemapLastmods(
    readFileSync(join(publicDir, "sitemap.xml"), "utf-8"),
  );
} catch {
  // sem sitemap anterior
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${changedSeoUrls.has(url.loc) ? today : (previousLastmods.get(url.loc) ?? today)}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;

writeTextFile(join(publicDir, "sitemap.xml"), sitemap);

// Página que sai da fonte de dados precisa sumir do disco também. O gerador só
// escrevia, então o HTML de um slug removido continuava servido ao crawler com
// 200 — fora do sitemap e sem nada apontando para ele. Foi assim que sobraram
// blog-ford e blog-ix35-gl depois que os posts saíram do JSON.
const expectedFiles = new Set([
  "regions-hub.html",
  "page-comparar.html",
  ...blogPosts.map((post) => `blog-${post.slug}.html`),
  ...cities.map((city) => `city-${city.slug}.html`),
  ...cities
    .filter((city) => city.sell)
    .map((city) => `sell-city-${city.slug}.html`),
  ...landings.map((landing) => `landing-${landing.slug}.html`),
  ...contentPages.map((page) => `page-${page.slug}.html`),
]);
const orphans = readdirSync(seoStaticDir).filter(
  (file) => file.endsWith(".html") && !expectedFiles.has(file),
);
for (const file of orphans) {
  unlinkSync(join(seoStaticDir, file));
  console.log(`Removido órfão: seo-static/${file}`);
}

// Os 301 de consolidação editorial mandam marca e categoria para /comprar-{slug},
// mas landing só é gerada com estoque mínimo. Se a marca esvazia, o redirect
// passa a apontar para uma página que não existe mais e o crawler recebe o shell
// do SPA — soft 404 no fim de um 301. Avisa antes que isso aconteça calado.
const landingSlugs = new Set(landings.map((landing) => landing.slug));
const redirectTargets = new Set();
for (const [, pattern, target] of readFileSync(
  join(publicDir, ".htaccess"),
  "utf-8",
).matchAll(/^\s*RewriteRule\s+(\S+)\s+\/comprar-(\S+)\s/gm)) {
  if (target === "$1") {
    // Destino vem do grupo de captura da origem: /comprar-$1 com ^blog/(a|b|c)-…
    const group = pattern.match(/\(([^)]+)\)/);
    if (group)
      for (const slug of group[1].split("|")) redirectTargets.add(slug);
  } else {
    redirectTargets.add(target);
  }
}
const brokenTargets = [...redirectTargets].filter(
  (slug) => !landingSlugs.has(slug),
);
if (brokenTargets.length > 0) {
  console.warn(
    `Aviso: 301 em .htaccess aponta para landing inexistente: ${brokenTargets
      .map((slug) => `/comprar-${slug}`)
      .join(", ")}. Redirecionar para /seminovos enquanto não houver estoque.`,
  );
}

const sellPages = cities.filter((city) => city.sell).length;
console.log(
  `SEO assets gerados: ${blogPosts.length} posts, ${cities.length} cidades compra, ${sellPages} cidades venda, ${landings.length} landings marca/categoria, ${contentPages.length} páginas de conteúdo, ${vehicleUrls.length} veículos preservados, sitemap com ${urls.length} URLs`,
);
