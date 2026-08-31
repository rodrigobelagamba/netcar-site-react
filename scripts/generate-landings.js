#!/usr/bin/env node

/**
 * AUTOMAÇÃO SEO — landings transacionais a partir do estoque REAL.
 *
 * Lê a API de veículos, descobre quais marcas, categorias, modelos e recortes
 * suficiente e gera src/data/seo/landings.json. Hubs permanentes continuam
 * disponíveis quando o estoque gira, mas ficam noindex até recuperarem oferta.
 *
 * Roda no build ANTES de generate-seo-assets.js (que gera o HTML estático
 * para crawlers e o sitemap). Se a API falhar, usa primeiro o cache efêmero e
 * depois o último manifesto completo versionado. Sem nenhuma fonte válida, a
 * falha interrompe a publicação para não misturar fotografias do estoque.
 *
 * Uso: node scripts/generate-landings.js
 */

import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  readFreshSeoStockCache,
  readVersionedSeoStock,
  writeSeoBuildStockSnapshot,
  writeSeoStockCache,
} from "./lib/seo-stock-cache.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const OUT = join(rootDir, "src", "data", "seo", "landings.json");

const SITE = "https://www.netcarmultimarcas.com.br";
const API_URL =
  process.env.NETCAR_SEO_STOCK_API_URL ||
  `${SITE}/api/v1/veiculos.php?limit=500`;

// Limiar mínimo para uma landing entrar no índice (evita página fraca).
const MIN_MARCA = 3;
const MIN_CATEGORIA = 3;
const MIN_MODELO = 2;
const MIN_FAIXA = 4;
const MIN_COMBUSTIVEL = 3;
const BRAND_HUBS = [
  "VOLKSWAGEN",
  "JEEP",
  "HYUNDAI",
  "FIAT",
  "HONDA",
  "NISSAN",
  "CHEVROLET",
  "CHERY",
];
const CATEGORY_HUBS = ["SUV", "HATCH", "SEDAN"];

const MODEL_HUBS = [
  {
    slug: "jeep-compass",
    marca: "JEEP",
    modelo: "COMPASS",
    name: "Jeep Compass",
  },
  { slug: "honda-hr-v", marca: "HONDA", modelo: "HRV", name: "Honda HR-V" },
  {
    slug: "volkswagen-t-cross",
    marca: "VOLKSWAGEN",
    modelo: "T CROSS",
    name: "Volkswagen T-Cross",
  },
  {
    slug: "chevrolet-tracker",
    marca: "CHEVROLET",
    modelo: "TRACKER",
    name: "Chevrolet Tracker",
  },
  {
    slug: "volkswagen-nivus",
    marca: "VOLKSWAGEN",
    modelo: "NIVUS",
    name: "Volkswagen Nivus",
  },
  {
    slug: "hyundai-creta",
    marca: "HYUNDAI",
    modelo: "CRETA",
    name: "Hyundai Creta",
  },
  {
    slug: "nissan-kicks",
    marca: "NISSAN",
    modelo: "KICKS",
    name: "Nissan Kicks",
  },
  {
    slug: "jeep-renegade",
    marca: "JEEP",
    modelo: "RENEGADE",
    name: "Jeep Renegade",
  },
];

const STOCK_CUTS = [
  {
    slug: "carros-ate-80-mil",
    name: "Carros até R$ 80 mil",
    filters: { precoMax: 80000 },
    title: "Carros seminovos até R$ 80 mil em Esteio/RS | Netcar",
    h1: "Carros seminovos até R$ 80 mil",
    intent: "um seminovo até R$ 80 mil",
  },
  {
    slug: "carros-ate-100-mil",
    name: "Carros até R$ 100 mil",
    filters: { precoMax: 100000 },
    title: "Carros seminovos até R$ 100 mil em Esteio/RS | Netcar",
    h1: "Carros seminovos até R$ 100 mil",
    intent: "um seminovo até R$ 100 mil",
  },
  {
    slug: "automaticos-ate-100-mil",
    name: "Automáticos até R$ 100 mil",
    filters: { cambio: "AUTOMATICO", precoMax: 100000 },
    title: "Carros automáticos até R$ 100 mil em Esteio/RS | Netcar",
    h1: "Carros automáticos até R$ 100 mil",
    intent: "um carro automático até R$ 100 mil",
  },
  {
    slug: "suv-ate-100-mil",
    name: "SUVs até R$ 100 mil",
    filters: { categoria: "SUV", precoMax: 100000 },
    title: "SUVs seminovos até R$ 100 mil em Esteio/RS | Netcar",
    h1: "SUVs seminovos até R$ 100 mil",
    intent: "um SUV até R$ 100 mil",
  },
  {
    slug: "carros-de-100-a-150-mil",
    name: "Carros de R$ 100 mil a R$ 150 mil",
    filters: { precoMin: 100000, precoMax: 150000 },
    title: "Seminovos de R$ 100 mil a R$ 150 mil em Esteio/RS | Netcar",
    h1: "Seminovos de R$ 100 mil a R$ 150 mil",
    intent: "um seminovo de R$ 100 mil a R$ 150 mil",
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

function compact(value) {
  return normalized(value).replace(/\s+/g, "");
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
    !compact(vehicle.modelo).includes(compact(filters.modelo))
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

// A moldura institucional (Fábrica de Valor, financiamento, região) é a mesma
// em toda landing — se repetida na íntegra, o texto fica idêntico trocando só a
// marca. Aqui cada marca cai numa das três redações pelo slug, e o dado do
// estoque (preço, ano, km) muda o conteúdo de verdade.
// A moldura institucional é curta de propósito: o que diferencia uma landing
// da outra é o dado do estoque (preço, ano, km), não uma redação longa que se
// repetiria trocando só a marca. Cada variante tem estrutura e vocabulário
// próprios para que duas marcas nunca compartilhem o mesmo esqueleto.
// Três redações com ESTRUTURA e VOCABULÁRIO distintos, não o mesmo esqueleto
// com a marca trocada. Cada uma abre, desenvolve e fecha de um jeito, e o dado
// do estoque entra em posição e forma diferentes. É o que impede que duas
// marcas da mesma variante virem o mesmo texto.
// Uma redação por marca: com 9 marcas e menos variantes que isso, duas marcas
// sempre dividem o mesmo esqueleto e o texto fica quase igual. Cada variante
// abre, desenvolve e fecha de um jeito, com o dado do estoque em posição e
// forma próprias. Se entrar marca nova, o índice recicla (index % length) e a
// similaridade volta a subir — sinal para escrever mais uma redação.
const MARCA_INTROS = [
  (n, p) => `Veja os ${n} disponíveis nas duas lojas da Netcar, em Esteio.`,
  (n, p) =>
    `Esta página reúne os ${n} anunciados no estoque da Netcar em Esteio.`,
  (n, p) =>
    `Compare ano, versão, quilometragem e preço dos ${n} disponíveis na Netcar.`,
  (n, p) =>
    `Consulte aqui os ${n} que estão anunciados nas lojas da Netcar em Esteio.`,
  (n, p) =>
    `Quem procura ${n} usado na região pode começar pelo estoque online da Netcar.`,
  (n, p) =>
    `Confira fotos, preço e ficha dos ${n} disponíveis na Netcar, em Esteio.`,
  (n, p) =>
    `Abra os anúncios dos ${n}, compare as unidades e confirme a disponibilidade antes da visita.`,
  (n, p) =>
    `O estoque de ${n} das duas lojas da Netcar aparece reunido nesta página.`,
  (n, p) =>
    `Veja quais ${n} estão disponíveis hoje na Netcar e compare cada anúncio.`,
];
const MARCA_PARAGRAFOS = [
  (n, p) =>
    `Os ${n} anunciados vão de ${p.minPrice} a ${p.maxPrice}, com anos entre ${p.minYear} e ${p.maxYear}. Abra cada ficha para comparar versão, quilometragem, fotos e itens disponíveis.`,
  (n, p) =>
    `Há ${n} de ${p.minYear} a ${p.maxYear}, com preços entre ${p.minPrice} e ${p.maxPrice}. Os veículos passam pela Fábrica de Valor antes da vitrine.`,
  (n, p) =>
    `Os preços dos ${n} em estoque partem de ${p.minPrice} e chegam a ${p.maxPrice}, cobrindo os anos ${p.minYear} a ${p.maxYear}. Quilometragem, versão e itens variam de uma unidade para outra.`,
  (n, p) =>
    `De ${p.minYear} a ${p.maxYear}, os ${n} disponíveis custam entre ${p.minPrice} e ${p.maxPrice}. Cada carro passa pela rotina de preparação da Netcar antes da vitrine.`,
  (n, p) =>
    `Entre ${p.minPrice} e ${p.maxPrice}, há ${n} de ${p.minYear} a ${p.maxYear} anunciados. Compare as fichas e confirme os finalistas antes de ir à loja.`,
  (n, p) =>
    `Os ${n} em estoque custam de ${p.minPrice} a ${p.maxPrice} e são de ${p.minYear} a ${p.maxYear}. Fotos, versão e quilometragem aparecem em cada anúncio.`,
  (n, p) =>
    `Com anos de ${p.minYear} a ${p.maxYear} e preços de ${p.minPrice} a ${p.maxPrice}, os ${n} disponíveis podem ser comparados pela ficha de cada unidade.`,
  (n, p) =>
    `Os ${n} vão de ${p.minPrice} a ${p.maxPrice}, com anos entre ${p.minYear} e ${p.maxYear}. Use as fotos e os dados do anúncio para montar sua lista.`,
  (n, p) =>
    `O estoque tem ${n} de ${p.minYear} a ${p.maxYear}, com preços entre ${p.minPrice} e ${p.maxPrice}. Confirme pelo WhatsApp os carros que deseja conhecer.`,
];
const MARCA_FECHO = [
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

// A variante vem da POSIÇÃO da marca no ranking de estoque, não de hash do
// slug: com poucas marcas qualquer hash concentra várias na mesma redação, e
// aí o texto volta a ser igual. index % N garante spread perfeito e muda
// quando o ranking muda, o que é aceitável porque o conteúdo já muda junto.
function pickVariant(arr, index) {
  return arr[index % arr.length];
}

function marcaLanding(name, count, profile, variantIndex) {
  const nice = titleCase(name);
  const slug = slugify(name);
  const hasStock = count >= MIN_MARCA;
  const hasData =
    profile.minPrice && profile.maxPrice && profile.minYear && profile.maxYear;
  const intro = hasStock
    ? pickVariant(MARCA_INTROS, variantIndex)(nice, profile)
    : `Veja nesta página os ${nice} que estiverem disponíveis na Netcar. Quando houver variedade suficiente no estoque, as unidades aparecem com foto, preço e ficha para comparação.`;
  const paragrafos =
    hasStock && hasData
      ? [
          pickVariant(MARCA_PARAGRAFOS, variantIndex)(nice, profile),
          pickVariant(MARCA_FECHO, variantIndex)(nice),
        ]
      : [
          `A disponibilidade de ${nice} muda conforme as entradas e vendas do estoque. As unidades anunciadas passam por checklist técnico antes da vitrine; enquanto houver poucas opções, você também pode comparar modelos equivalentes e outras marcas.`,
          pickVariant(MARCA_FECHO, variantIndex)(nice),
        ];
  return {
    slug,
    type: "marca",
    name: nice,
    count,
    indexable: hasStock,
    footerPriority: hasStock && variantIndex < 5,
    filters: { marca: name },
    relatedSlugs: [],
    title: `${nice} usados e seminovos em Esteio/RS | Netcar Multimarcas`,
    description: hasStock
      ? `Veja os ${nice} seminovos disponíveis na Netcar em Esteio/RS. Compare fotos, ano, km e preço e consulte troca ou financiamento.`
      : `${nice} seminovos na Netcar em Esteio/RS. Acompanhe novas entradas e compare modelos, marcas e faixas de preço disponíveis no estoque.`,
    h1: `${nice} seminovos em Esteio/RS`,
    intro,
    paragraphs: paragrafos,
    faq: hasStock
      ? pickVariant(
          [
            [
              {
                q: `A Netcar tem ${nice} em estoque agora?`,
                a: `Sim. O estoque muda conforme entradas e vendas, e os ${nice} disponíveis aparecem nesta página com foto e preço. Confirme a disponibilidade pelo WhatsApp antes de visitar.`,
              },
              {
                q: `Posso financiar um ${nice} usado na Netcar?`,
                a: `Sim. A simulação pode ser iniciada pelo WhatsApp e o prazo pode chegar a 60x, sempre sujeito à análise. O usado também pode ser avaliado na troca.`,
              },
              {
                q: `Os ${nice} passam por revisão antes da venda?`,
                a: `Todos os seminovos passam pela Fábrica de Valor, com mais de 60 itens técnicos e funcionais verificados antes da vitrine.`,
              },
            ],
            [
              {
                q: `Quais ${nice} estão disponíveis hoje?`,
                a: `A lista desta página reflete o estoque atual, com foto, ano e preço de cada unidade. Como seminovo é item único, confirme pelo WhatsApp antes de se deslocar.`,
              },
              {
                q: `Dá para dar meu carro na troca de um ${nice}?`,
                a: `Sim. A proposta depende da vistoria do usado. Se houver financiamento em aberto, o saldo para quitação entra no cálculo.`,
              },
              {
                q: `O ${nice} é revisado antes de ser vendido?`,
                a: `Sim. Cada seminovo passa pela Fábrica de Valor, que confere mais de 60 itens antes de o carro ir para a vitrine.`,
              },
            ],
            [
              {
                q: `Como sei se o ${nice} ainda está disponível?`,
                a: `O estoque muda conforme entradas e vendas. Os ${nice} desta página estão anunciados com foto e preço; o WhatsApp confirma a disponibilidade antes da sua visita.`,
              },
              {
                q: `Qual a entrada para financiar um ${nice}?`,
                a: `A entrada mínima é de 20% e o saldo pode ir em até 60x, sempre sujeito à análise de crédito. Seu usado pode compor a entrada, mediante avaliação.`,
              },
              {
                q: `O que é a Fábrica de Valor?`,
                a: `É o processo de preparação da Netcar: mais de 60 itens técnicos e funcionais são verificados antes de o carro ir para a vitrine.`,
              },
            ],
            [
              {
                q: `O ${nice} ainda está no estoque?`,
                a: `A lista desta página acompanha os ${nice} anunciados, com foto e preço. Como seminovo é item único, confirme pelo WhatsApp antes de ir.`,
              },
              {
                q: `Posso trocar meu carro num ${nice}?`,
                a: `Sim. O valor depende da vistoria. Carros com financiamento em aberto também podem ser analisados, com o saldo de quitação incluído na negociação.`,
              },
              {
                q: `O ${nice} é revisado antes da venda?`,
                a: `Sim. Todo seminovo passa pela Fábrica de Valor, que confere mais de 60 itens antes da vitrine.`,
              },
            ],
            [
              {
                q: `Quais ${nice} estão à venda agora?`,
                a: `Os ${nice} desta página refletem o estoque atual, com foto, ano e preço. Confirme a disponibilidade pelo WhatsApp antes de se deslocar.`,
              },
              {
                q: `Qual a entrada para um ${nice}?`,
                a: `A entrada mínima é de 20% e o restante pode ir em até 60x, sujeito à análise de crédito. Seu usado pode compor a entrada, mediante avaliação.`,
              },
              {
                q: `O que a Fábrica de Valor verifica?`,
                a: `Mais de 60 itens técnicos e funcionais antes de o carro ir para a vitrine.`,
              },
            ],
            [
              {
                q: `A Netcar tem ${nice} disponíveis?`,
                a: `Sim. O estoque muda conforme entradas e vendas, e os ${nice} aparecem nesta página com foto e preço. Confirme pelo WhatsApp antes de visitar.`,
              },
              {
                q: `Como financiar um ${nice} usado?`,
                a: `A simulação pode ser iniciada pelo WhatsApp e o prazo pode chegar a 60x, sujeito à análise. O usado também pode ser avaliado na troca.`,
              },
              {
                q: `Os ${nice} são revisados?`,
                a: `Todos passam pela Fábrica de Valor, com mais de 60 itens verificados antes da vitrine.`,
              },
            ],
            [
              {
                q: `Quais ${nice} há no estoque?`,
                a: `A lista desta página mostra os ${nice} disponíveis hoje, com foto, ano e preço. Como seminovo é item único, confirme pelo WhatsApp antes de ir.`,
              },
              {
                q: `Dá para dar meu usado na troca de um ${nice}?`,
                a: `Sim. O valor entra na negociação depois da vistoria. Se houver financiamento em aberto, o saldo para quitação é considerado.`,
              },
              {
                q: `O ${nice} passa por revisão?`,
                a: `Sim. Cada seminovo passa pela Fábrica de Valor, que confere mais de 60 itens antes da vitrine.`,
              },
            ],
            [
              {
                q: `Como confirmar se o ${nice} está disponível?`,
                a: `O estoque muda conforme entradas e vendas. Os ${nice} desta página estão anunciados com foto e preço; o WhatsApp confirma antes da sua visita.`,
              },
              {
                q: `Qual a entrada mínima para um ${nice}?`,
                a: `20% de entrada e o saldo em até 60x, sujeito à análise de crédito. Seu usado pode compor a entrada, mediante avaliação.`,
              },
              {
                q: `O que é a Fábrica de Valor da Netcar?`,
                a: `É o processo de preparação que verifica mais de 60 itens técnicos e funcionais antes de o carro ir para a vitrine.`,
              },
            ],
            [
              {
                q: `O ${nice} ainda está à venda?`,
                a: `A lista desta página acompanha os ${nice} anunciados, com foto e preço. Confirme pelo WhatsApp antes de se deslocar.`,
              },
              {
                q: `Posso trocar meu carro por um ${nice}?`,
                a: `Sim. O valor depende da vistoria. Se houver financiamento em aberto, o saldo para quitação entra na negociação.`,
              },
              {
                q: `O ${nice} é inspecionado antes da venda?`,
                a: `Sim. Todo seminovo passa pela Fábrica de Valor, com mais de 60 itens verificados antes da vitrine.`,
              },
            ],
          ],
          variantIndex,
        )
      : [
          {
            q: `Como acompanho novos ${nice} na Netcar?`,
            a: `Esta página permanece ativa e mostra as unidades anunciadas quando entram no estoque. A disponibilidade pode mudar; confirme pelo WhatsApp antes de visitar.`,
          },
          {
            q: `Posso financiar um ${nice} quando houver disponibilidade?`,
            a: `Sim. A Netcar compara condições entre bancos e financeiras parceiras, com prazo de até 60x, sempre sujeito à análise de crédito.`,
          },
          {
            q: `Posso comparar um ${nice} com modelos de outras marcas?`,
            a: `Sim. Consulte o estoque completo ou use o comparador para avaliar ano, preço, quilometragem e ficha das opções disponíveis.`,
          },
        ],
  };
}

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

function categoriaLanding(name, count, profile, variantIndex) {
  const nice = name.toUpperCase() === name ? name : titleCase(name);
  const lower = String(name).toLowerCase();
  const slug = slugify(name);
  const hasStock = count >= MIN_CATEGORIA;
  const hasData =
    profile.minPrice && profile.maxPrice && profile.minYear && profile.maxYear;
  const intro = hasStock
    ? pickVariant(CATEGORIA_INTROS, variantIndex)(lower, profile)
    : `Acompanhe nesta página quando houver variedade de ${lower} no estoque da Netcar. Enquanto isso, compare categorias e faixas de preço disponíveis.`;
  const paragrafos = hasData
    ? [
        pickVariant(CATEGORIA_PARAGRAFOS, variantIndex)(lower, profile),
        pickVariant(MARCA_FECHO, variantIndex)(lower),
      ]
    : [
        `No estoque você encontra ${lower} de diferentes marcas e faixas de preço. Compare os anúncios e confirme a disponibilidade antes da visita.`,
        pickVariant(MARCA_FECHO, variantIndex)(lower),
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

function modelLanding(config, vehicles) {
  const filters = { marca: config.marca, modelo: config.modelo };
  const profile = stockProfile(vehicles, filters);
  const hasStock = profile.count >= MIN_MODELO;
  const versions = profile.versions.slice(0, 4).map(titleCase).join(", ");
  const transmissions = profile.transmissions.map(titleCase).join(" e ");
  const fuels = profile.fuels.map(titleCase).join(" e ");
  const stockSummary = hasStock
    ? `${profile.count} opções de ${profile.minYear} a ${profile.maxYear}, entre ${profile.minPrice} e ${profile.maxPrice}; versões atuais: ${versions}`
    : "estoque que muda conforme entradas e vendas e alternativas do mesmo perfil";

  return {
    slug: config.slug,
    type: "modelo",
    name: config.name,
    count: profile.count,
    indexable: hasStock,
    footerPriority: hasStock,
    filters,
    relatedSlugs: [],
    title: `${config.name} seminovo em Esteio/RS: preço e estoque | Netcar`,
    description: `${config.name} seminovo em Esteio/RS, com preço e estoque atualizados. Compare versões, ano e km; simule financiamento e avalie sua troca na Netcar.`,
    h1: `${config.name} seminovo em Esteio/RS`,
    intro: hasStock
      ? `Compare ${config.name} disponíveis na Netcar sem depender de um anúncio isolado. A seleção reúne ${stockSummary}.`
      : `Acompanhe nesta página quando um ${config.name} entrar no estoque da Netcar e veja alternativas reais sem perder a referência deste modelo.`,
    paragraphs: [
      hasStock
        ? `Nesta seleção, a quilometragem vai de ${Number(profile.minKm).toLocaleString("pt-BR")} a ${Number(profile.maxKm).toLocaleString("pt-BR")} km, com câmbio ${transmissions || "informado em cada ficha"} e combustível ${fuels || "informado em cada ficha"}. Abra os anúncios, compare os exemplares e confirme a disponibilidade antes de visitar as lojas de Esteio.`
        : `No momento não há uma unidade anunciada. O estoque de seminovos é rotativo; use os atalhos de alternativas ou peça pelo WhatsApp opções de porte e faixa de preço semelhantes.`,
      `Seu usado pode entrar na troca, inclusive com financiamento em aberto, mediante avaliação. A simulação do saldo em até 60x depende da análise de crédito dos bancos e financeiras parceiras.`,
    ],
    faq: [
      {
        q: `Quais versões do ${config.name} estão disponíveis agora?`,
        a: hasStock
          ? `As ${profile.count} unidades atuais aparecem nesta página com ano, preço e ficha individual. Como cada seminovo é único, confirme a disponibilidade pelo WhatsApp.`
          : `Nenhuma unidade está anunciada agora. A página é mantida para você acompanhar novas entradas e encontrar alternativas do mesmo perfil.`,
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

function priceLanding(config, vehicles, variantIndex) {
  const profile = stockProfile(vehicles, config.filters);
  const hasStock = profile.count >= MIN_FAIXA;
  const openings = [
    `Filtre o orçamento antes da marca: hoje há ${profile.count} opções reais nessa faixa na Netcar, em Esteio.`,
    `Esta seleção reúne ${profile.count} seminovos do estoque atual para comparar preço, ano e quilometragem sem misturar anúncios fora do orçamento.`,
    `Quem começa pela faixa de preço encontra aqui ${profile.count} carros disponíveis agora, com fichas e valores atualizados.`,
    `Do uso urbano ao familiar, há ${profile.count} alternativas dentro deste recorte no estoque atual da Netcar.`,
    `Compare ${profile.count} seminovos entre ${profile.minPrice} e ${profile.maxPrice}, todos anunciados com preço e ficha individual.`,
  ];
  return {
    slug: config.slug,
    type: "faixa",
    name: config.name,
    count: profile.count,
    indexable: hasStock,
    footerPriority:
      hasStock &&
      [
        "carros-ate-100-mil",
        "automaticos-ate-100-mil",
        "suv-ate-100-mil",
        "carros-de-100-a-150-mil",
      ].includes(config.slug),
    filters: config.filters,
    relatedSlugs: [],
    title: config.title,
    description: hasStock
      ? `${config.h1} na Netcar, em Esteio/RS. ${profile.count} opções no estoque atual, com preço, fotos, troca e simulação de financiamento.`
      : `${config.h1} na Netcar, em Esteio/RS. Acompanhe novas entradas e veja alternativas reais do estoque por preço, perfil e categoria.`,
    h1: config.h1,
    intro: hasStock
      ? openings[variantIndex % openings.length]
      : "Esta seleção é permanente, mas ainda não reúne opções suficientes para entrar no índice. Consulte alternativas reais do estoque e acompanhe novas entradas.",
    paragraphs: [
      hasStock
        ? `Os veículos deste recorte vão de ${profile.minPrice} a ${profile.maxPrice} e de ${profile.minYear} a ${profile.maxYear}. Compare o custo total, a versão e o histórico — não apenas a parcela.`
        : "O estoque é rotativo. Enquanto este recorte não tiver variedade suficiente, use as seleções relacionadas para comparar alternativas disponíveis sem inventar oferta.",
      `Escolha candidatos concretos, use o comparador lado a lado e confirme a disponibilidade. Entrada, prazo e parcela dependem do perfil e da análise de crédito dos bancos e financeiras parceiras.`,
    ],
    faq: [
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

function hybridLanding(vehicles) {
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
    description: hasStock
      ? `${profile.count} carros híbridos seminovos no estoque atual da Netcar em Esteio/RS. Compare ano, preço, km e ficha de cada veículo.`
      : "Carros híbridos seminovos na Netcar, em Esteio/RS. Acompanhe novas entradas e compare alternativas eletrificadas disponíveis no estoque.",
    h1: "Carros híbridos seminovos em Esteio/RS",
    intro: hasStock
      ? `A seleção atual tem ${profile.count} híbridos de ${profile.minYear} a ${profile.maxYear}, entre ${profile.minPrice} e ${profile.maxPrice}. Veja cada ficha antes de decidir.`
      : "A página permanece disponível para acompanhar novas entradas de híbridos. Enquanto a seleção não tiver variedade suficiente, veja alternativas reais do estoque.",
    paragraphs: [
      `Híbridos não são todos iguais: arquitetura, bateria, motor a combustão e forma de recarga variam por modelo. Confirme histórico, manutenção prevista e cobertura do fabricante para a unidade escolhida.`,
      `Alguns veículos eletrificados podem atender programas específicos de crédito, mas elegibilidade depende do ano, tecnologia, valor e regras vigentes. A Netcar não promete enquadramento ou aprovação.`,
    ],
    faq: [
      {
        q: "Quais híbridos estão disponíveis agora?",
        a: `As ${profile.count} unidades atuais aparecem nesta página com ano, preço e ficha individual. Confirme a disponibilidade antes da visita.`,
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
    if (landing.filters.marca) candidates.push(slugify(landing.filters.marca));
    if (landing.filters.categoria === "SUV" || landing.type === "modelo") {
      candidates.push("suv");
    }
    const peers = indexable.filter(
      (candidate) => candidate.type === landing.type,
    );
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
    candidates.push(...highIntent);
    landing.relatedSlugs = [...new Set(candidates)]
      .filter((slug) => slug !== landing.slug && available.has(slug))
      .slice(0, 4);
  }
}

async function fetchVehicles() {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(API_URL, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`API HTTP ${res.status}`);
      const json = await res.json();
      if (
        !json.success ||
        !Array.isArray(json.data) ||
        json.data.length === 0
      ) {
        throw new Error("resposta inválida");
      }
      return json.data;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }
  throw lastError;
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
  let snapshotSource = "api";
  let snapshotSourceAgeMs = 0;
  try {
    allVehicles = await fetchVehicles();
    writeSeoStockCache(rootDir, allVehicles);
  } catch (err) {
    const cached =
      readFreshSeoStockCache(rootDir, { includeSold: true }) ??
      readVersionedSeoStock(rootDir, { includeSold: true });
    if (!cached?.vehicles.length) {
      throw new Error(
        `API indisponível (${err.message}) e estoque de contingência válido ausente; build interrompido para evitar contagens divergentes`,
      );
    }

    const ageMinutes = Math.max(0, Math.round(cached.ageMs / 60000));
    const sourceLabel =
      cached.source === "versioned-bootstrap"
        ? "manifesto versionado"
        : "cache efêmero";
    allVehicles = cached.vehicles;
    snapshotSource = cached.source;
    snapshotSourceAgeMs = cached.ageMs;
    const activeCount = allVehicles.filter(
      (vehicle) => Number(vehicle.valor) > 0,
    ).length;
    console.warn(
      `Aviso: API indisponível (${err.message}); landings regeneradas pelo ${sourceLabel} de ${ageMinutes} min com ${activeCount} veículos ativos.`,
    );
  }

  writeSeoBuildStockSnapshot(rootDir, allVehicles, {
    source: snapshotSource,
    sourceAgeMs: snapshotSourceAgeMs,
  });
  const vehicles = allVehicles.filter((vehicle) => Number(vehicle.valor) > 0);

  const landings = [];
  const seen = new Set();

  // Marcas já publicadas são hubs permanentes: sem variedade continuam 200,
  // mas saem do índice. Novas marcas só nascem com estoque suficiente.
  const brandCounts = tally(vehicles, "marca");
  const brandNames = new Set(BRAND_HUBS);
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

  for (const [index, config] of STOCK_CUTS.entries()) {
    const landing = priceLanding(config, vehicles, index);
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

main().catch((err) => {
  console.error("Erro ao gerar landings:", err);
  process.exitCode = 1;
});
