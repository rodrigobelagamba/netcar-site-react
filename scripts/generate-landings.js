#!/usr/bin/env node

/**
 * AUTOMAÇÃO SEO — landings transacionais a partir do estoque REAL.
 *
 * Lê a API de veículos, descobre quais marcas, categorias, modelos e recortes
 * suficiente e gera src/data/seo/landings.json. Hubs permanentes continuam
 * disponíveis quando o estoque gira, mas ficam noindex até recuperarem oferta.
 *
 * Roda no build ANTES de generate-seo-assets.js (que gera o HTML estático
 * para crawlers e o sitemap). Se a API falhar, regenera pelo mesmo cache
 * recente de estoque usado pelos assets estáticos. Sem API nem cache recente,
 * a falha interrompe a publicação para não misturar fotografias do estoque.
 *
 * Uso: node scripts/generate-landings.js
 */

import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  readFreshSeoStockCache,
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
  (n, p) =>
    `Quem procura ${n} usado na região metropolitana encontra na Netcar, em Esteio, unidades revisadas para ver de perto.`,
  (n, p) =>
    `Comprar um ${n} seminovo com procedência evita surpresa depois. A Netcar mantém ${n} revisados em Esteio.`,
  (n, p) =>
    `Saindo de Porto Alegre ou Canoas, dá para conferir ${n} seminovos em Esteio sem perder o dia.`,
  (n, p) =>
    `Na Netcar, em Esteio, o estoque de ${n} seminovos é revisado e está pronto para visita.`,
  (n, p) =>
    `Para quem busca ${n} usado perto de Porto Alegre, a Netcar concentra opções revisadas em Esteio.`,
  (n, p) =>
    `O estoque de ${n} da Netcar, em Esteio, reúne seminovos revisados para quem vem da região metropolitana.`,
  (n, p) =>
    `Ver um ${n} seminovo de perto antes de decidir é o que a Netcar oferece em Esteio, com estoque revisado.`,
  (n, p) =>
    `A Netcar mantém em Esteio um estoque de ${n} seminovos revisados, a poucos minutos de Porto Alegre.`,
  (n, p) =>
    `Se você procura ${n} usado com procedência na Grande Porto Alegre, a Netcar em Esteio tem opções revisadas.`,
];
const MARCA_PARAGRAFOS = [
  (n, p) =>
    `O estoque de ${n} vai de ${p.minPrice} a ${p.maxPrice}, com modelos de ${p.minYear} a ${p.maxYear}. Vale comparar exemplar com exemplar: quilometragem, versão e histórico pesam mais que o preço isolado. Cada unidade passa por checklist técnico, e você simula financiamento em até 60x e avalia a troca na mesma visita.`,
  (n, p) =>
    `Há ${n} de ${p.minYear} a ${p.maxYear}, com preços entre ${p.minPrice} e ${p.maxPrice}. Antes de ser anunciado, cada carro passa por mais de 60 verificações. O financiamento em até 60x e a avaliação do seu usado na troca saem na hora.`,
  (n, p) =>
    `Os preços dos ${n} em estoque partem de ${p.minPrice} e chegam a ${p.maxPrice}, cobrindo os anos ${p.minYear} a ${p.maxYear}. Como km, versão e estado mudam de um exemplar para outro, a visita com os carros separados ajuda a decidir. Financiamento em até 60x e troca com avaliação completam a negociação.`,
  (n, p) =>
    `De ${p.minYear} a ${p.maxYear}, os ${n} disponíveis custam entre ${p.minPrice} e ${p.maxPrice}. Cada um passa por mais de 60 verificações antes da vitrine. Financiamento em até 60x e avaliação da troca acontecem na hora.`,
  (n, p) =>
    `Entre ${p.minPrice} e ${p.maxPrice}, há ${n} de ${p.minYear} a ${p.maxYear} no pátio. Quilometragem, versão e estado variam, então comparar exemplar com exemplar vale a visita. Financiamento em até 60x e troca com avaliação completam a negociação.`,
  (n, p) =>
    `Os ${n} em estoque custam de ${p.minPrice} a ${p.maxPrice} e são de ${p.minYear} a ${p.maxYear}. Cada unidade é revisada antes de ser anunciada. Você simula o financiamento em até 60x e avalia seu usado na troca na mesma visita.`,
  (n, p) =>
    `Com modelos de ${p.minYear} a ${p.maxYear} e preços de ${p.minPrice} a ${p.maxPrice}, os ${n} disponíveis passam por checklist técnico antes da vitrine. O financiamento em até 60x e a avaliação da troca saem na hora.`,
  (n, p) =>
    `Do mais acessível ao mais equipado, os ${n} vão de ${p.minPrice} a ${p.maxPrice}, de ${p.minYear} a ${p.maxYear}. Cada carro é revisado antes de ser anunciado. Financiamento em até 60x e troca com avaliação completam a negociação.`,
  (n, p) =>
    `O pátio tem ${n} de ${p.minYear} a ${p.maxYear}, com preços entre ${p.minPrice} e ${p.maxPrice}. Antes da vitrine, cada um passa por mais de 60 verificações. Financiamento em até 60x e avaliação do usado na troca acontecem na hora.`,
];
const MARCA_FECHO = [
  (n) =>
    `Atendemos Esteio, Canoas, Sapucaia do Sul, São Leopoldo e Gravataí. Fale com o iAN no WhatsApp, diga o ${n} e a faixa de parcela, e chegue com os carros separados.`,
  (n) =>
    `A loja fica na Av. Presidente Vargas, em Esteio, e recebe clientes de toda a Grande Porto Alegre. Chame o iAN no WhatsApp, informe o ${n} e a parcela que cabe no bolso, e a visita já sai com as opções na sua frente.`,
  (n) =>
    `Pelo WhatsApp, o iAN anota o ${n} que você quer e a parcela ideal, e deixa os carros separados antes de você sair de casa — seja de Esteio, Canoas, São Leopoldo ou Gravataí.`,
  (n) =>
    `A Netcar tem duas unidades na Av. Presidente Vargas, em Esteio, e atende a região metropolitana. Escreva para o iAN no WhatsApp com o ${n} e a parcela que você quer, e os carros ficam prontos para a visita.`,
  (n) =>
    `Esteio, Canoas, Sapucaia do Sul, São Leopoldo, Gravataí: a loja recebe clientes de toda a região. No WhatsApp, o iAN separa os ${n} que combinam com a parcela que você informou.`,
  (n) =>
    `A loja fica em Esteio e atende a Grande Porto Alegre. Pelo WhatsApp, o iAN anota o ${n} e a parcela ideal, e deixa os carros separados para a sua visita.`,
  (n) =>
    `Quem vem de Canoas, Sapucaia do Sul ou São Leopoldo encontra a Netcar na Av. Presidente Vargas. Chame o iAN no WhatsApp, diga o ${n} e a parcela, e a visita já sai com as opções separadas.`,
  (n) =>
    `A Netcar recebe clientes de Esteio, Canoas, São Leopoldo e Gravataí. No WhatsApp, o iAN separa os ${n} que cabem na parcela que você informou, antes de você sair de casa.`,
  (n) =>
    `Duas unidades na Av. Presidente Vargas, em Esteio, atendem a região metropolitana. Escreva para o iAN no WhatsApp com o ${n} e a parcela, e os carros ficam prontos para a visita.`,
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
      ? `${nice} seminovos revisados em Esteio/RS na Netcar. Estoque com procedência, financiamento em até 60x e troca com avaliação na hora. Veja os ${nice} disponíveis.`
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
                a: `Sim, com financiamento em até 60x e simulação na hora. Aceitamos troca, inclusive de carro com financiamento em aberto, mediante avaliação.`,
              },
              {
                q: `Os ${nice} passam por revisão antes da venda?`,
                a: `Todos os seminovos passam pela Fábrica de Valor, com mais de 60 itens técnicos verificados, e contam com pós-venda NetHelp.`,
              },
            ],
            [
              {
                q: `Quais ${nice} estão disponíveis hoje?`,
                a: `A lista desta página reflete o estoque atual, com foto, ano e preço de cada unidade. Como seminovo é item único, confirme pelo WhatsApp antes de se deslocar.`,
              },
              {
                q: `Dá para dar meu carro na troca de um ${nice}?`,
                a: `Sim. Avaliamos seu usado na hora e o valor entra na negociação, inclusive se ainda houver financiamento em aberto, mediante análise.`,
              },
              {
                q: `O ${nice} é revisado antes de ser vendido?`,
                a: `Sim. Cada seminovo passa pela Fábrica de Valor, que confere mais de 60 itens, e sai com pós-venda NetHelp.`,
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
                a: `É o processo de preparação da Netcar: mais de 60 itens técnicos e funcionais verificados antes de o carro ir para a vitrine, com pós-venda NetHelp.`,
              },
            ],
            [
              {
                q: `O ${nice} ainda está no estoque?`,
                a: `A lista desta página acompanha os ${nice} anunciados, com foto e preço. Como seminovo é item único, confirme pelo WhatsApp antes de ir.`,
              },
              {
                q: `Posso trocar meu carro num ${nice}?`,
                a: `Sim. Avaliamos seu usado na hora e o valor entra na negociação, inclusive com financiamento em aberto, mediante análise.`,
              },
              {
                q: `O ${nice} é revisado antes da venda?`,
                a: `Sim. Todo seminovo passa pela Fábrica de Valor, que confere mais de 60 itens, e sai com pós-venda NetHelp.`,
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
                a: `Mais de 60 itens técnicos e funcionais antes de o carro ir para a vitrine, com pós-venda NetHelp.`,
              },
            ],
            [
              {
                q: `A Netcar tem ${nice} disponíveis?`,
                a: `Sim. O estoque muda conforme entradas e vendas, e os ${nice} aparecem nesta página com foto e preço. Confirme pelo WhatsApp antes de visitar.`,
              },
              {
                q: `Como financiar um ${nice} usado?`,
                a: `Com financiamento em até 60x e simulação na hora. Aceitamos troca, inclusive com financiamento em aberto, mediante avaliação.`,
              },
              {
                q: `Os ${nice} são revisados?`,
                a: `Todos passam pela Fábrica de Valor, com mais de 60 itens verificados, e têm pós-venda NetHelp.`,
              },
            ],
            [
              {
                q: `Quais ${nice} há no estoque?`,
                a: `A lista desta página mostra os ${nice} disponíveis hoje, com foto, ano e preço. Como seminovo é item único, confirme pelo WhatsApp antes de ir.`,
              },
              {
                q: `Dá para dar meu usado na troca de um ${nice}?`,
                a: `Sim. Avaliamos seu carro na hora e o valor entra na negociação, inclusive com financiamento em aberto, mediante análise.`,
              },
              {
                q: `O ${nice} passa por revisão?`,
                a: `Sim. Cada seminovo passa pela Fábrica de Valor, que confere mais de 60 itens, e sai com pós-venda NetHelp.`,
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
                a: `O processo de preparação que verifica mais de 60 itens técnicos e funcionais antes de o carro ir para a vitrine, com pós-venda NetHelp.`,
              },
            ],
            [
              {
                q: `O ${nice} ainda está à venda?`,
                a: `A lista desta página acompanha os ${nice} anunciados, com foto e preço. Confirme pelo WhatsApp antes de se deslocar.`,
              },
              {
                q: `Posso trocar meu carro por um ${nice}?`,
                a: `Sim. Avaliamos seu usado na hora e o valor entra na negociação, inclusive com financiamento em aberto, mediante análise.`,
              },
              {
                q: `O ${nice} é inspecionado antes da venda?`,
                a: `Sim. Todo seminovo passa pela Fábrica de Valor, com mais de 60 itens verificados, e tem pós-venda NetHelp.`,
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
    `Escolher um ${l} seminovo fica mais fácil quando o estoque está num lugar só. A Netcar concentra ${l} multimarcas revisados em Esteio, na Av. Presidente Vargas, perto de Porto Alegre.`,
  (l, p) =>
    `Um ${l} seminovo com procedência começa por um estoque confiável. Em Esteio, a Netcar reúne ${l} que passaram pela Fábrica de Valor, com acesso pela BR-116.`,
  (l, p) =>
    `Para quem está em Porto Alegre ou na região, ver ${l} seminovos em Esteio evita rodar de loja em loja. A Netcar mantém o estoque revisado na Av. Presidente Vargas.`,
];
const CATEGORIA_PARAGRAFOS = [
  (l, p) =>
    `A seleção reúne ${l} de ${p.minPrice} a ${p.maxPrice}, de ${p.minYear} a ${p.maxYear}. Todos passam por checklist técnico antes da vitrine. Compare modelos, simule financiamento em até 60x e avalie seu usado na troca.`,
  (l, p) =>
    `O estoque de ${l} vai de ${p.minPrice} a ${p.maxPrice} e cobre anos de ${p.minYear} a ${p.maxYear}. Cada unidade é revisada antes de ser anunciada. Financiamento em até 60x e avaliação da troca saem na hora.`,
  (l, p) =>
    `Entre os ${l} disponíveis, os preços partem de ${p.minPrice} e chegam a ${p.maxPrice}, com modelos de ${p.minYear} a ${p.maxYear}. O que diferencia um de outro é km, versão e estado — a visita com os carros separados resolve. Financiamento em até 60x e troca com avaliação completam a negociação.`,
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
        `No nosso estoque você encontra ${lower} de várias marcas e faixas de preço, todos com checklist técnico antes da vitrine. Compare modelos, simule financiamento em até 60x e avalie seu usado na troca.`,
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
      ? `${nice} seminovos revisados em Esteio/RS na Netcar. Estoque multimarcas com procedência, financiamento facilitado e troca. Veja os ${lower} disponíveis.`
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
        a: `Sim, com financiamento em até 60x e simulação na hora. Aceitamos troca, inclusive carro financiado, mediante avaliação.`,
      },
      {
        q: `Os ${lower} são revisados?`,
        a: `Sim. Todo seminovo passa pela Fábrica de Valor, com mais de 60 itens verificados, e tem pós-venda NetHelp.`,
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
  const res = await fetch(API_URL, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`API HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success || !Array.isArray(json.data))
    throw new Error("resposta inválida");
  return json.data;
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
  let vehicles;
  try {
    const allVehicles = await fetchVehicles();
    writeSeoStockCache(rootDir, allVehicles);
    vehicles = allVehicles.filter((vehicle) => Number(vehicle.valor) > 0);
  } catch (err) {
    const cached = readFreshSeoStockCache(rootDir);
    if (!cached?.vehicles.length) {
      throw new Error(
        `API indisponível (${err.message}) e cache recente de estoque ausente; build interrompido para evitar contagens divergentes`,
      );
    }

    const ageMinutes = Math.max(0, Math.round(cached.ageMs / 60000));
    vehicles = cached.vehicles.filter((vehicle) => Number(vehicle.valor) > 0);
    console.warn(
      `Aviso: API indisponível (${err.message}); landings regeneradas pelo cache de ${ageMinutes} min com ${vehicles.length} veículos ativos.`,
    );
  }

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
