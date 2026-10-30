#!/usr/bin/env node

/**
 * AUTOMAÇÃO SEO — landings transacionais a partir do estoque REAL.
 *
 * Lê a API de veículos, descobre quais marcas, categorias, modelos e recortes
 * suficiente e gera src/data/seo/landings.json. Hubs permanentes continuam
 * disponíveis quando o estoque gira, mas ficam noindex até recuperarem oferta.
 *
 * Roda no build ANTES de generate-seo-assets.js (que gera o HTML estático
 * para crawlers e o sitemap). Só aceita leitura completa e estável da API;
 * qualquer falha interrompe a publicação e preserva o estoque já publicado.
 *
 * Uso: node scripts/generate-landings.js
 */

import { writeFileSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { LANDING_PROFILE_TOKENS } from "../src/lib/landingStockCopy.mjs";
import { MODEL_BUYER_GUIDES } from "./lib/model-buyer-guides.mjs";
import { MODEL_HUBS } from "./lib/stock-model-hubs.mjs";
import { BRAND_BUYER_GUIDES } from "./lib/brand-buyer-guides.mjs";
import { matchesLandingModel } from "../src/lib/landingModelMatch.mjs";
import {
  clearSeoBuildStockSnapshot,
  readSeoBuildStockSnapshot,
  writeSeoBuildStockSnapshot,
  writeSeoStockCache,
} from "./lib/seo-stock-cache.js";
import {
  configureSeoStockNetwork,
  fetchCompleteSeoStock,
  validateSeoStockVehicles,
} from "./lib/seo-stock-source.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const OUT = join(rootDir, "src", "data", "seo", "landings.json");

const SITE = "https://www.netcarmultimarcas.com.br";
const API_URL =
  process.env.NETCAR_SEO_STOCK_API_URL ||
  `${SITE}/api/v1/veiculos.php?limit=500`;

// Uma marca/modelo com oferta real e guia próprio pode ser útil mesmo com uma
// unidade. O número de carros não é um requisito de indexação do Google.
const MIN_MARCA = 1;
const MIN_CATEGORIA = 3;
const MIN_MODELO = 1;
const MIN_FAIXA = 4;
const MIN_COMBUSTIVEL = 3;
const CATEGORY_HUBS = ["SUV", "HATCH", "SEDAN"];

const STOCK_CUTS = [
  {
    slug: "carros-ate-80-mil",
    name: "Carros até R$ 80 mil",
    filters: { precoMax: 80000 },
    title: "Carros seminovos até R$ 80 mil em Esteio/RS | Netcar",
    h1: "Carros seminovos até R$ 80 mil",
    intent: "um seminovo até R$ 80 mil",
    intro:
      "Veja os seminovos anunciados por até R$ 80 mil na Netcar, em Esteio. Compare fotos, versões e preço antes de escolher quais carros conhecer.",
    guide:
      "Defina quanto pretende investir no carro e abra as fichas das opções que cabem nesse valor. Ano, versão e equipamentos ajudam a decidir entre os modelos da seleção.",
  },
  {
    slug: "carros-ate-100-mil",
    name: "Carros até R$ 100 mil",
    filters: { precoMax: 100000 },
    title: "Carros seminovos até R$ 100 mil em Esteio/RS | Netcar",
    h1: "Carros seminovos até R$ 100 mil",
    intent: "um seminovo até R$ 100 mil",
    intro:
      "Encontre no estoque da Netcar os seminovos com preço anunciado de até R$ 100 mil. Compare os modelos e consulte a troca ou o financiamento do carro que escolher.",
    guide:
      "Com um limite de R$ 100 mil, compare o que cada carro oferece pelo preço anunciado. Uma versão mais equipada e um carro de ano mais recente podem ter valores próximos; confira a ficha de cada um.",
  },
  {
    slug: "automaticos-ate-100-mil",
    name: "Automáticos até R$ 100 mil",
    filters: { cambio: "AUTOMATICO", precoMax: 100000 },
    title: "Carros automáticos até R$ 100 mil em Esteio/RS | Netcar",
    h1: "Carros automáticos até R$ 100 mil",
    intent: "um carro automático até R$ 100 mil",
    intro:
      "Veja os carros automáticos com preço anunciado de até R$ 100 mil na Netcar, em Esteio. Abra a ficha para conferir a versão, o câmbio e as fotos de cada opção.",
    guide:
      "A seleção combina câmbio automático e preço de até R$ 100 mil. Confirme na ficha o tipo de câmbio, o motor e os equipamentos da versão; esses detalhes podem mudar entre carros do mesmo modelo.",
  },
  {
    slug: "suv-ate-100-mil",
    name: "SUVs até R$ 100 mil",
    filters: { categoria: "SUV", precoMax: 100000 },
    title: "SUVs seminovos até R$ 100 mil em Esteio/RS | Netcar",
    h1: "SUVs seminovos até R$ 100 mil",
    intent: "um SUV até R$ 100 mil",
    intro:
      "Compare os SUVs anunciados por até R$ 100 mil nas duas lojas da Netcar, em Esteio. Veja preço, versão e fotos para escolher os carros que deseja conhecer.",
    guide:
      "Além do preço, confira câmbio, versão e equipamentos dos SUVs que chamaram sua atenção. Na visita, veja se o espaço para passageiros e bagagem atende ao seu uso.",
  },
  {
    slug: "carros-de-100-a-150-mil",
    name: "Carros de R$ 100 mil a R$ 150 mil",
    filters: { precoMin: 100000, precoMax: 150000 },
    title: "Seminovos de R$ 100 mil a R$ 150 mil em Esteio/RS | Netcar",
    h1: "Seminovos de R$ 100 mil a R$ 150 mil",
    intent: "um seminovo de R$ 100 mil a R$ 150 mil",
    intro:
      "Veja os seminovos com preço anunciado entre R$ 100 mil e R$ 150 mil na Netcar. Compare os modelos da seleção e fale com a equipe sobre o carro que escolher.",
    guide:
      "Nesta faixa, vale comparar versões e equipamentos junto com o ano do carro. Abra as fichas dos seus favoritos e use o comparador para conferir os dados lado a lado.",
  },
  {
    slug: "automaticos-ate-80-mil",
    name: "Automáticos até R$ 80 mil",
    filters: { cambio: "AUTOMATICO", precoMax: 80000 },
    title: "Carros automáticos até 80 mil: seminovos em Esteio | Netcar",
    h1: "Carros automáticos usados até R$ 80 mil",
    intent: "um carro automático usado até R$ 80 mil",
    intro:
      "Veja os carros automáticos usados com preço anunciado de até R$ 80 mil na Netcar, em Esteio. Confira as fotos e a versão de cada carro antes de combinar a visita.",
    guide:
      "Para escolher um automático até R$ 80 mil, confira o tipo de câmbio e o histórico de manutenção de cada opção. Os equipamentos variam conforme o ano e a versão; abra a ficha e tire as dúvidas sobre o carro que escolher.",
    faq: [
      {
        q: "Todos os carros desta seleção são automáticos e custam até R$ 80 mil?",
        a: "Sim. A seleção aplica os dois critérios ao estoque publicado: câmbio automático e preço anunciado de até R$ 80 mil. Abra a ficha para conferir a versão, as características do câmbio e a disponibilidade atual.",
      },
      {
        q: "Como escolher um automático com preço acessível?",
        a: "Comece pelo valor total que pretende investir e compare ano, quilometragem, manutenção e equipamentos. Nas fichas, confira os detalhes dos exemplares que cabem no orçamento e combine a visita para conhecer o carro antes de decidir.",
      },
    ],
  },
];

function titleCase(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/(^|\s|-)\p{L}/gu, (m) => m.toUpperCase())
    .trim();
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalized(value) {
  return String(value || "")
    .trim()
    .toLocaleUpperCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function resolvedVehicleCategory(vehicle) {
  const brand = normalized(vehicle.marca);
  const model = normalized(vehicle.modelo || vehicle.name);
  if (/\b(RENEGADE|KICKS)\b/.test(model)) return "SUV";
  if (brand === "HONDA" && /^CITY\b/.test(model) && !/\bHATCH\b/.test(model)) {
    return "SEDAN";
  }
  return normalized(vehicle.categoria);
}

function matchesFilters(vehicle, filters) {
  const price = Number(vehicle.valor || vehicle.price || 0);
  if (filters.marca && normalized(vehicle.marca) !== normalized(filters.marca))
    return false;
  if (
    filters.modelo &&
    !matchesLandingModel(vehicle.modelo || vehicle.name, filters.modelo, vehicle.marca)
  )
    return false;
  if (
    filters.categoria &&
    resolvedVehicleCategory(vehicle) !== normalized(filters.categoria)
  )
    return false;
  if (
    filters.cambio &&
    normalized(vehicle.cambio) !== normalized(filters.cambio)
  )
    return false;
  if (
    filters.combustivel &&
    normalized(vehicle.combustivel) !== normalized(filters.combustivel)
  )
    return false;
  if (filters.precoMin !== undefined && price < filters.precoMin) return false;
  if (filters.precoMax !== undefined && price > filters.precoMax) return false;
  return price > 0;
}

// Faixa de preço, anos e km saem do estoque real de cada recorte.
// É o que diferencia uma landing da outra: sem isso o texto era o mesmo com
// o nome trocado, e o Google tratava as páginas como duplicadas.
function stockProfile(vehicles, filters) {
  const list = vehicles.filter((vehicle) => matchesFilters(vehicle, filters));
  const prices = list.map((v) => Number(v.valor)).filter((n) => n > 0);
  const years = list.map((v) => Number(v.ano)).filter((n) => n > 0);
  const kms = list.map((v) => Number(v.km)).filter((n) => n > 0);
  const uniqueValues = (field) => [
    ...new Set(
      list
        .map((vehicle) => String(vehicle[field] || "").trim())
        .filter(Boolean),
    ),
  ];
  const fmt = (n) => "R$ " + Math.round(n).toLocaleString("pt-BR");
  return {
    minPrice: prices.length ? fmt(Math.min(...prices)) : null,
    maxPrice: prices.length ? fmt(Math.max(...prices)) : null,
    minYear: years.length ? Math.min(...years) : null,
    maxYear: years.length ? Math.max(...years) : null,
    minKm: kms.length ? Math.min(...kms) : null,
    maxKm: kms.length ? Math.max(...kms) : null,
    versions: uniqueValues("modelo"),
    transmissions: uniqueValues("cambio"),
    fuels: uniqueValues("combustivel"),
    count: list.length,
  };
}

function pickVariant(arr, index) {
  return arr[index % arr.length];
}

export function marcaLanding(name, count, profile, variantIndex) {
  const guide = BRAND_BUYER_GUIDES[name];
  const nice = guide?.name || titleCase(name);
  const hasStock = count >= MIN_MARCA;
  // A new brand may be browsed, but only reviewed brand copy enters the index.
  const indexable =
    hasStock && Object.hasOwn(BRAND_BUYER_GUIDES, name) && Boolean(guide);
  const paragraphs = guide?.paragraphs || [
    `Abra os anúncios de ${nice} para conferir ano, versão e preço de cada carro. Pelo WhatsApp da ficha, você pode consultar a disponibilidade e combinar a visita às lojas de Esteio.`,
  ];
  return {
    slug: slugify(name),
    type: "marca",
    name: nice,
    count,
    indexable,
    footerPriority: indexable,
    filters: { marca: name },
    relatedSlugs: [],
    modelSlugs: [],
    title: `${nice} seminovos na Grande Porto Alegre | Netcar`,
    description: `Veja os ${nice} usados e seminovos da Netcar em Esteio, na Região Metropolitana de Porto Alegre. Fotos, preços e contato sobre cada carro.`,
    h1: `${nice} usados e seminovos em Esteio/RS`,
    intro: guide?.intro || `Escolha um ${nice} no estoque da Netcar. Veja as fotos e os detalhes de cada carro e fale com a equipe sobre o que chamou sua atenção.`,
    guideTitle: guide?.guideTitle || `Como escolher seu ${nice}`,
    paragraphs,
    paragraphTemplates: [
      `Os ${nice} anunciados nesta seleção são de {{years}}, com valores de {{prices}}. Confira versão e fotos na ficha de cada unidade.`,
      ...paragraphs,
    ],
    faq: [
      {
        q: `Quais modelos da ${nice} estão à venda na Netcar?`,
        a: `Os modelos e as unidades anunciadas aparecem nesta página. A disponibilidade acompanha as entradas e vendas; confirme o carro escolhido com a equipe antes da visita.`,
      },
      ...(guide?.faq || []),
      {
        q: `Posso dar meu carro na troca por um ${nice}?`,
        a: "Sim. Envie os dados e as fotos do seu usado para iniciar a avaliação. Se houver financiamento em aberto, a equipe também analisa o saldo de quitação na negociação.",
      },
    ],
  };
}

const CATEGORIA_FECHO = [
  (n) =>
    `Fale pelo WhatsApp, diga qual ${n} chamou sua atenção e confirme a disponibilidade antes de visitar as lojas em Esteio.`,
  (n) =>
    `As duas lojas ficam na Av. Presidente Vargas, em Esteio. Envie o link do ${n} pelo WhatsApp para continuar o atendimento.`,
  (n) =>
    `Informe pelo WhatsApp qual ${n} procura, a faixa de preço e se tem usado na troca. A equipe confirma os próximos passos.`,
  (n) =>
    `A Netcar tem duas unidades na Av. Presidente Vargas, em Esteio. Confirme o ${n} escolhido antes de organizar a visita.`,
  (n) =>
    `Quem vem de outra cidade pode enviar o link do ${n}, pedir uma simulação e confirmar onde o carro está antes de sair.`,
  (n) =>
    `O atendimento presencial é em Esteio. Pelo WhatsApp, você pode consultar o ${n}, a troca e uma simulação antes da visita.`,
  (n) =>
    `Antes de ir à Av. Presidente Vargas, envie pelo WhatsApp o ${n} que deseja conhecer e confirme a disponibilidade.`,
  (n) =>
    `Diga pelo WhatsApp qual ${n} procura e a faixa de preço. A equipe consulta o estoque e continua a conversa.`,
  (n) =>
    `O estoque das duas lojas aparece junto no site. Confirme pelo WhatsApp em qual unidade está o ${n} escolhido.`,
];

const CATEGORIA_INTROS = [
  (l, p) =>
    `Veja os ${l} disponíveis no estoque das duas lojas da Netcar em Esteio.`,
  (l, p) =>
    `Esta página reúne os ${l} anunciados pela Netcar, com fotos, preço e ficha de cada unidade.`,
  (l, p) =>
    `Compare os ${l} do estoque por ano, preço, quilometragem e versão antes de visitar a loja.`,
];
const CATEGORIA_PARAGRAFOS = [
  (l, p) =>
    `A seleção reúne ${l} de ${p.minPrice} a ${p.maxPrice}, com anos entre ${p.minYear} e ${p.maxYear}. Abra as fichas para comparar fotos, versão e quilometragem.`,
  (l, p) =>
    `O estoque de ${l} vai de ${p.minPrice} a ${p.maxPrice} e cobre anos de ${p.minYear} a ${p.maxYear}. Cada unidade passa pela preparação da Netcar antes da vitrine.`,
  (l, p) =>
    `Entre os ${l} disponíveis, os preços partem de ${p.minPrice} e chegam a ${p.maxPrice}, com anos entre ${p.minYear} e ${p.maxYear}. Compare os anúncios e confirme os finalistas pelo WhatsApp.`,
];

const CATEGORY_ACRONYMS = new Set(["SUV"]);

export function categoriaLanding(name, count, profile, variantIndex) {
  const acronym = CATEGORY_ACRONYMS.has(String(name).toUpperCase());
  const nice = acronym ? String(name).toUpperCase() : titleCase(name);
  const lower = acronym ? nice : String(name).toLowerCase();
  const slug = slugify(name);
  const hasStock = count >= MIN_CATEGORIA;
  const intro = hasStock
    ? pickVariant(CATEGORIA_INTROS, variantIndex)(lower, profile)
    : `Acompanhe nesta página quando houver variedade de ${lower} no estoque da Netcar. Enquanto isso, compare categorias e faixas de preço disponíveis.`;
  const paragrafos = [
    `Consulte os anúncios de ${lower}, compare as fichas e confirme a disponibilidade antes da visita.`,
    pickVariant(CATEGORIA_FECHO, variantIndex)(lower),
  ];
  return {
    slug,
    type: "categoria",
    name: nice,
    count,
    indexable: hasStock,
    footerPriority: hasStock,
    filters: { categoria: name },
    relatedSlugs: [],
    title: `${nice} seminovos em Esteio/RS | Netcar Multimarcas`,
    description: hasStock
      ? `Veja os ${lower} seminovos disponíveis na Netcar em Esteio/RS. Compare fotos, ano, km e preço e consulte troca ou financiamento.`
      : `${nice} seminovos na Netcar em Esteio/RS. Acompanhe novas entradas e compare categorias, modelos e faixas de preço disponíveis no estoque.`,
    h1: `${nice} seminovos em Esteio/RS`,
    intro,
    paragraphs: paragrafos,
    paragraphTemplates: [
      pickVariant(CATEGORIA_PARAGRAFOS, variantIndex)(lower, LANDING_PROFILE_TOKENS),
      paragrafos[1],
    ],
    faq: [
      {
        q: `Quais ${lower} a Netcar tem em estoque?`,
        a: hasStock
          ? `O estoque é multimarcas e muda conforme entradas e vendas. Os ${lower} disponíveis aparecem nesta página com foto e preço; confirme pelo WhatsApp antes de ir à loja.`
          : `Ainda não há variedade suficiente para indexar esta seleção. O estoque muda conforme entradas e vendas; acompanhe novas opções ou compare as categorias disponíveis.`,
      },
      {
        q: `Dá para financiar um ${lower} usado?`,
        a: `Sim. A simulação pode ser iniciada pelo WhatsApp e o prazo pode chegar a 60x, sujeito à análise. O usado também pode ser avaliado na troca.`,
      },
      {
        q: `Os ${lower} são revisados?`,
        a: `Sim. Todo seminovo passa pela Fábrica de Valor, com mais de 60 itens verificados antes da vitrine.`,
      },
    ],
  };
}

export function modelLanding(config, vehicles) {
  const filters = { marca: config.marca, modelo: config.modelo, ...(config.categoria ? { categoria: config.categoria } : {}) };
  const profile = stockProfile(vehicles, filters);
  const hasStock = profile.count >= MIN_MODELO;
  const guide = MODEL_BUYER_GUIDES[config.slug];

  return {
    slug: config.slug,
    type: "modelo",
    name: config.name,
    count: profile.count,
    indexable: hasStock,
    footerPriority: hasStock && ["jeep-compass", "honda-hr-v", "volkswagen-t-cross", "chevrolet-tracker", "volkswagen-nivus", "hyundai-creta", "nissan-kicks", "jeep-renegade"].includes(config.slug),
    category: config.category,
    filters,
    relatedSlugs: [],
    title: guide?.title ?? `${config.name} seminovo em Esteio/RS: preço e estoque | Netcar`,
    description: guide?.description ?? `${config.name} seminovo na Netcar, em Esteio/RS. Consulte os anúncios, compare preço e versão e fale sobre troca ou financiamento.`,
    h1: `${config.name} seminovo em Esteio/RS`,
    intro: guide?.intro ?? `Veja os anúncios de ${config.name} da Netcar, em Esteio. Confira o preço, as fotos e a versão de cada carro e confirme com a equipe qual deseja conhecer.`,
    ...(guide ? {
      guideTitle: guide.guideTitle,
      guideLinks: guide.guideLinks || [],
      paragraphTemplates: [
        `Veja as opções de ${config.name} de ${LANDING_PROFILE_TOKENS.years} nesta seleção. O preço e os detalhes de cada unidade estão nos anúncios acima.`,
        ...guide.paragraphs,
      ],
    } : {}),
    paragraphs: guide ? guide.paragraphs : [
      `Ao escolher um ${config.name}, compare ano, versão, motor e equipamentos na ficha de cada unidade. Pelo botão de WhatsApp do anúncio, você pode tirar dúvidas sobre aquele carro e confirmar em qual das duas lojas de Esteio ele está.`,
      `Seu usado pode entrar na troca, mediante avaliação. Se houver financiamento em aberto, a equipe analisa o saldo de quitação na negociação. Para financiar a compra, entrada, prazo e parcela dependem da análise de crédito.`,
    ],
    faq: [
      ...(guide?.faq ?? []),
      {
        q: `Quais versões do ${config.name} estão disponíveis agora?`,
        a: `Os anúncios desta seleção mostram a versão, o ano e o preço de cada ${config.name}. A disponibilidade muda com as entradas e vendas; confirme pelo WhatsApp antes da visita. Se a seleção estiver vazia, veja as opções relacionadas ou consulte a equipe.`,
      },
      {
        q: `Posso comparar dois ${config.name} lado a lado?`,
        a: `Sim. Abra o comparador da Netcar e escolha até quatro carros do estoque para conferir preço, ano, câmbio, motor e outros dados na mesma tela.`,
      },
      {
        q: `A Netcar aceita meu carro na troca por um ${config.name}?`,
        a: `Sim. A avaliação considera estado, documentos e mercado. Veículo com financiamento em aberto também pode ser analisado, com quitação do saldo na negociação.`,
      },
    ],
  };
}

export function priceLanding(config, vehicles) {
  const profile = stockProfile(vehicles, config.filters);
  const hasStock = profile.count >= MIN_FAIXA;
  return {
    slug: config.slug,
    type: "faixa",
    name: config.name,
    count: profile.count,
    indexable: hasStock,
    footerPriority:
      hasStock &&
      [
        "automaticos-ate-80-mil",
        "carros-ate-100-mil",
        "automaticos-ate-100-mil",
        "suv-ate-100-mil",
        "carros-de-100-a-150-mil",
      ].includes(config.slug),
    filters: config.filters,
    relatedSlugs: [],
    title: config.title,
    description: `${config.h1} na Netcar, em Esteio/RS. Veja preço total, fotos e ficha dos carros da seleção e consulte troca ou financiamento.`,
    h1: config.h1,
    intro:
      config.intro ||
      `Confira os anúncios de ${config.name.toLowerCase()} da Netcar, em Esteio. Veja o preço e a ficha de cada carro antes de combinar a visita.`,
    paragraphs: [
      "O filtro considera o preço total anunciado do carro. Se pretende financiar, a entrada e as parcelas serão calculadas em uma simulação, sujeita à análise de crédito.",
      ...(config.guide ? [config.guide] : []),
      "Pelo WhatsApp de cada anúncio, você pode consultar a disponibilidade, pedir uma simulação ou falar sobre seu usado na troca. Confirme em qual das duas lojas de Esteio está o carro antes de sair.",
    ],
    faq: [
      ...(config.faq || []),
      {
        q: `Quantos ${config.name.toLowerCase()} estão disponíveis?`,
        a: `Esta página reúne os veículos que atendem ao recorte. O número e os preços acompanham o estoque publicado pela Netcar.`,
      },
      {
        q: `O preço exibido é o valor atual do anúncio?`,
        a: `Sim. Cada ficha mostra o preço publicado no estoque atual. Como seminovo é item único, confirme a disponibilidade antes de se deslocar.`,
      },
      {
        q: `Posso usar meu carro como entrada?`,
        a: `Sim. Seu usado pode compor a entrada após avaliação, inclusive quando existe financiamento em aberto, mediante análise e quitação do saldo.`,
      },
    ],
  };
}

export function hybridLanding(vehicles) {
  const filters = { combustivel: "HIBRIDO" };
  const profile = stockProfile(vehicles, filters);
  const hasStock = profile.count >= MIN_COMBUSTIVEL;
  return {
    slug: "hibridos",
    type: "combustivel",
    name: "Híbridos seminovos",
    count: profile.count,
    indexable: hasStock,
    footerPriority: hasStock,
    filters,
    relatedSlugs: [],
    title: "Carros híbridos seminovos em Esteio/RS | Netcar",
    description: "Carros híbridos seminovos na Netcar, em Esteio/RS. Consulte os anúncios e compare ano, preço, km e ficha de cada veículo.",
    h1: "Carros híbridos seminovos em Esteio/RS",
    intro: "Consulte os híbridos anunciados pela Netcar. Veja ano, preço e ficha de cada unidade antes de decidir.",
    paragraphTemplates: [
      "A seleção atual tem {{count}} híbridos de {{minYear}} a {{maxYear}}, entre {{minPrice}} e {{maxPrice}}. Veja cada ficha antes de decidir.",
      "Híbridos não são todos iguais: arquitetura, bateria, motor a combustão e forma de recarga variam por modelo. Confirme histórico, manutenção prevista e cobertura do fabricante para a unidade escolhida.",
      "Alguns veículos eletrificados podem atender programas específicos de crédito, mas elegibilidade depende do ano, tecnologia, valor e regras vigentes. A Netcar não promete enquadramento ou aprovação.",
    ],
    paragraphs: [
      `Híbridos não são todos iguais: arquitetura, bateria, motor a combustão e forma de recarga variam por modelo. Confirme histórico, manutenção prevista e cobertura do fabricante para a unidade escolhida.`,
      `Alguns veículos eletrificados podem atender programas específicos de crédito, mas elegibilidade depende do ano, tecnologia, valor e regras vigentes. A Netcar não promete enquadramento ou aprovação.`,
    ],
    faq: [
      {
        q: "Quais híbridos estão disponíveis agora?",
        a: "Os híbridos disponíveis aparecem nesta página com ano, preço e ficha individual. Confirme a disponibilidade antes da visita.",
      },
      {
        q: "O que conferir em um híbrido seminovo?",
        a: "Verifique histórico de manutenção, diagnóstico do sistema, condições de garantia da fabricante e funcionamento conjunto dos motores. Os detalhes variam por marca e versão.",
      },
      {
        q: "Todo híbrido entra no Move Brasil?",
        a: "Não. O enquadramento depende das regras oficiais vigentes, incluindo público elegível, ano, tecnologia e teto de valor. Consulte a página do programa e a instituição financeira.",
      },
    ],
  };
}

function assignRelatedSlugs(landings) {
  const indexable = landings.filter((landing) => landing.indexable);
  const available = new Set(indexable.map((landing) => landing.slug));
  const highIntent = [
    "automaticos-ate-80-mil",
    "carros-ate-100-mil",
    "automaticos-ate-100-mil",
    "suv-ate-100-mil",
    "hibridos",
    "jeep-compass",
    "honda-hr-v",
    "chevrolet-tracker",
    "hyundai-creta",
  ];

  for (const landing of landings) {
    const candidates = [];
    // Quem escolheu uma marca encontra primeiro os modelos dela em estoque.
    // Os pares de marcas e recortes abaixo continuam preenchendo os demais links.
    if (landing.type === "marca") {
      landing.modelSlugs = indexable.filter((candidate) => candidate.type === "modelo" && normalized(candidate.filters.marca) === normalized(landing.filters.marca)).map((candidate) => candidate.slug);
      candidates.push(
        ...indexable
          .filter(
            (candidate) =>
              candidate.type === "modelo" &&
              normalized(candidate.filters.marca) ===
                normalized(landing.filters.marca),
          )
          .map((candidate) => candidate.slug),
      );
    }
    if (landing.filters.marca) candidates.push(slugify(landing.filters.marca));
    const category = landing.category || landing.filters.categoria;
    if (category) candidates.push(slugify(category));
    const peers = indexable.filter((candidate) => {
      if (candidate.type !== landing.type) return false;
      if (landing.type !== "modelo") return true;
      // Um hatch deve sugerir outros hatches, não o vizinho no registro.
      const candidateCategory = candidate.category || candidate.filters.categoria;
      return candidate.slug === landing.slug || (!!category && candidateCategory === category);
    });
    const peerIndex = peers.findIndex(
      (candidate) => candidate.slug === landing.slug,
    );
    if (peerIndex >= 0 && peers.length > 1) {
      for (let distance = 1; distance <= 2; distance += 1) {
        candidates.push(
          peers[(peerIndex + distance) % peers.length].slug,
          peers[(peerIndex - distance + peers.length) % peers.length].slug,
        );
      }
    }
    if (landing.type !== "modelo") candidates.push(...highIntent);
    landing.relatedSlugs = [...new Set(candidates)]
      .filter((slug) => slug !== landing.slug && available.has(slug))
      .slice(0, 4);
  }
}

function tally(vehicles, field) {
  const map = new Map();
  for (const v of vehicles) {
    const raw =
      field === "categoria"
        ? resolvedVehicleCategory(v)
        : String(v[field] || "").trim();
    if (!raw) continue;
    map.set(raw, (map.get(raw) || 0) + 1);
  }
  return map;
}

async function main() {
  let allVehicles;
  if (process.env.NETCAR_REUSE_SEO_BUILD_STOCK === "1") {
    const snapshot = readSeoBuildStockSnapshot(rootDir, { includeSold: true });
    if (!snapshot || snapshot.source !== "api-complete") {
      throw new Error(
        "Estoque SEO: snapshot completo da reconciliação ausente ou expirado; build interrompido",
      );
    }
    validateSeoStockVehicles(snapshot.vehicles, { rootDir });
    allVehicles = snapshot.vehicles;
  } else {
    clearSeoBuildStockSnapshot(rootDir);
    const accepted = await fetchCompleteSeoStock({ rootDir, apiUrl: API_URL });
    allVehicles = accepted.vehicles;
    writeSeoStockCache(rootDir, allVehicles);
    writeSeoBuildStockSnapshot(rootDir, allVehicles, {
      source: accepted.source,
      sourceAgeMs: accepted.sourceAgeMs,
    });
  }
  const vehicles = allVehicles.filter((vehicle) => Number(vehicle.valor) > 0);

  const landings = [];
  const seen = new Set();

  // Marcas publicadas mantêm a URL. Uma nova marca entra com oferta real;
  // sem estoque, a página fica fora do índice até uma nova entrada.
  const brandCounts = tally(vehicles, "marca");
  const brandNames = new Set(Object.keys(BRAND_BUYER_GUIDES));
  for (const [name, count] of brandCounts) {
    if (count >= MIN_MARCA) brandNames.add(name);
  }
  const marcas = [...brandNames]
    .map((name) => [name, brandCounts.get(name) || 0])
    .sort((a, b) => b[1] - a[1]);
  for (const [i, [name, count]] of marcas.entries()) {
    const l = marcaLanding(
      name,
      count,
      stockProfile(vehicles, { marca: name }),
      i,
    );
    if (l.slug && !seen.has(l.slug)) {
      landings.push(l);
      seen.add(l.slug);
    }
  }

  // SUVs, hatches e sedãs são hubs permanentes: sem variedade continuam 200,
  // mas saem do índice. Outras categorias só nascem com estoque suficiente.
  const categoryCounts = tally(vehicles, "categoria");
  const categoryNames = new Set(CATEGORY_HUBS);
  for (const [name, count] of categoryCounts) {
    if (count >= MIN_CATEGORIA) categoryNames.add(name);
  }
  const cats = [...categoryNames]
    .map((name) => [name, categoryCounts.get(name) || 0])
    .sort((a, b) => b[1] - a[1]);
  for (const [i, [name, count]] of cats.entries()) {
    const l = categoriaLanding(
      name,
      count,
      stockProfile(vehicles, { categoria: name }),
      i,
    );
    // slug "automaticos" já tem página própria (/seminovos-automaticos); evitar colisão de tema
    if (l.slug && !seen.has(l.slug)) {
      landings.push(l);
      seen.add(l.slug);
    }
  }

  // Hubs permanentes: com estoque entram no índice; zerados continuam 200,
  // ficam noindex e oferecem alternativas, sem perder a URL a cada giro.
  for (const config of MODEL_HUBS) {
    const landing = modelLanding(config, vehicles);
    if (!seen.has(landing.slug)) {
      landings.push(landing);
      seen.add(landing.slug);
    }
  }

  for (const config of STOCK_CUTS) {
    const landing = priceLanding(config, vehicles);
    if (!seen.has(landing.slug)) {
      landings.push(landing);
      seen.add(landing.slug);
    }
  }

  const hybrid = hybridLanding(vehicles);
  if (!seen.has(hybrid.slug)) {
    landings.push(hybrid);
    seen.add(hybrid.slug);
  }

  assignRelatedSlugs(landings);

  writeFileSync(OUT, JSON.stringify(landings, null, 2) + "\n", "utf-8");
  console.log(
    `Landings geradas: ${landings.length} (${marcas.length} marcas, ${cats.length} categorias, ${MODEL_HUBS.length} modelos, ${landings.filter((landing) => landing.type === "faixa").length} faixas, 1 híbridos) de ${vehicles.length} veículos`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  configureSeoStockNetwork();
  main().catch((err) => {
    console.error("Erro ao gerar landings:", err);
    process.exitCode = 1;
  });
}
