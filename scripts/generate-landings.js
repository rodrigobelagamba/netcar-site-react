#!/usr/bin/env node

/**
 * AUTOMAÇÃO SEO — landings de marca e categoria a partir do estoque REAL.
 *
 * Lê a API de veículos, descobre quais marcas/categorias têm estoque
 * suficiente e gera src/data/seo/landings.json. Páginas só existem para
 * filtros com carros de verdade — nunca cria página vazia (thin content).
 *
 * Roda no build ANTES de generate-seo-assets.js (que gera o HTML estático
 * para crawlers e o sitemap). Se a API falhar, mantém o JSON existente.
 *
 * Uso: node scripts/generate-landings.js
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { writeSeoStockCache } from "./lib/seo-stock-cache.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const OUT = join(rootDir, "src", "data", "seo", "landings.json");

const SITE = "https://www.netcarmultimarcas.com.br";
const API_URL =
  process.env.NETCAR_SEO_STOCK_API_URL ||
  `${SITE}/api/v1/veiculos.php?limit=500`;

// Limiar mínimo de carros para uma landing existir (evita página fraca).
const MIN_MARCA = 3;
const MIN_CATEGORIA = 3;

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

// Faixa de preço, anos e km saem do estoque real daquela marca/categoria.
// É o que diferencia uma landing da outra: sem isso o texto era o mesmo com
// o nome trocado, e o Google tratava as páginas como duplicadas.
function stockProfile(vehicles, filterKey, filterValue) {
  const list = vehicles.filter(
    (v) => String(v[filterKey] || "").toLowerCase() === String(filterValue).toLowerCase()
  );
  const prices = list.map((v) => Number(v.valor)).filter((n) => n > 0);
  const years = list.map((v) => Number(v.ano)).filter((n) => n > 0);
  const kms = list.map((v) => Number(v.km)).filter((n) => n > 0);
  const fmt = (n) => "R$ " + Math.round(n).toLocaleString("pt-BR");
  return {
    minPrice: prices.length ? fmt(Math.min(...prices)) : null,
    maxPrice: prices.length ? fmt(Math.max(...prices)) : null,
    minYear: years.length ? Math.min(...years) : null,
    maxYear: years.length ? Math.max(...years) : null,
    maxKm: kms.length ? Math.max(...kms) : null,
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
  const hasData = profile.minPrice && profile.maxPrice && profile.minYear && profile.maxYear;
  const intro = pickVariant(MARCA_INTROS, variantIndex)(nice, profile);
  const paragrafos = hasData
    ? [pickVariant(MARCA_PARAGRAFOS, variantIndex)(nice, profile), pickVariant(MARCA_FECHO, variantIndex)(nice)]
    : [
        `Cada ${nice} do nosso estoque passa por checklist técnico antes de ir para a vitrine. Você compara versões, simula financiamento em até 60x e avalia seu usado na troca — tudo na mesma visita.`,
        pickVariant(MARCA_FECHO, variantIndex)(nice),
      ];
  return {
    slug,
    type: "marca",
    name: nice,
    count,
    filterKey: "marca",
    filterValue: name,
    title: `${nice} usados e seminovos em Esteio/RS | Netcar Multimarcas`,
    description: `${nice} seminovos revisados em Esteio/RS na Netcar. Estoque com procedência, financiamento em até 60x e troca com avaliação na hora. Veja os ${nice} disponíveis.`,
    h1: `${nice} seminovos em Esteio/RS`,
    intro,
    paragraphs: paragrafos,
    faq: pickVariant(
      [
        [
          {
            q: `A Netcar tem ${nice} em estoque agora?`,
            a: `Sim. O estoque é atualizado diariamente e os ${nice} disponíveis aparecem nesta página com foto e preço. Confirme a disponibilidade pelo WhatsApp antes de visitar.`,
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
            a: `O estoque muda diariamente. Os ${nice} desta página estão anunciados com foto e preço; o WhatsApp confirma a disponibilidade antes da sua visita.`,
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
            a: `A lista desta página é atualizada todos os dias com os ${nice} disponíveis, com foto e preço. Como seminovo é item único, confirme pelo WhatsApp antes de ir.`,
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
            a: `Sim. O estoque é atualizado diariamente e os ${nice} aparecem nesta página com foto e preço. Confirme pelo WhatsApp antes de visitar.`,
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
            a: `O estoque muda diariamente. Os ${nice} desta página estão anunciados com foto e preço; o WhatsApp confirma antes da sua visita.`,
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
            a: `A lista desta página é atualizada todos os dias com os ${nice} disponíveis, com foto e preço. Confirme pelo WhatsApp antes de se deslocar.`,
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
      variantIndex
    ),
  };
}

const CATEGORIA_INTROS = [
  (l, p) =>
    `Escolher um ${l} seminovo fica mais fácil quando o estoque está num lugar só. A Netcar concentra ${l} multimarcas revisados em Esteio, na Av. Presidente Vargas, perto de Porto Alegre.`,
  (l, p) =>
    `Um ${l} seminovo com procedência começa por um estoque confiável. Em Esteio, a Netcar reúne ${l} que passaram pela Fábrica de Valor, a duas quadras da BR-116.`,
  (l, p) =>
    `Para quem está em Porto Alegre ou na região, ver ${l} seminovos em Esteio evita rodar de loja em loja. A Netcar mantém o estoque revisado na Av. Presidente Vargas.`,
];
const CATEGORIA_PARAGRAFOS = [
  (l, p) =>
    `Hoje há ${l} de ${p.minPrice} a ${p.maxPrice}, de ${p.minYear} a ${p.maxYear}. Todos passam por checklist técnico antes da vitrine. Compare modelos, simule financiamento em até 60x e avalie seu usado na troca.`,
  (l, p) =>
    `O estoque de ${l} vai de ${p.minPrice} a ${p.maxPrice} e cobre anos de ${p.minYear} a ${p.maxYear}. Cada unidade é revisada antes de ser anunciada. Financiamento em até 60x e avaliação da troca saem na hora.`,
  (l, p) =>
    `Entre os ${l} disponíveis, os preços partem de ${p.minPrice} e chegam a ${p.maxPrice}, com modelos de ${p.minYear} a ${p.maxYear}. O que diferencia um de outro é km, versão e estado — a visita com os carros separados resolve. Financiamento em até 60x e troca com avaliação completam a negociação.`,
];

function categoriaLanding(name, count, profile, variantIndex) {
  const nice = name.toUpperCase() === name ? name : titleCase(name);
  const lower = String(name).toLowerCase();
  const slug = slugify(name);
  const hasData = profile.minPrice && profile.maxPrice && profile.minYear && profile.maxYear;
  const intro = pickVariant(CATEGORIA_INTROS, variantIndex)(lower, profile);
  const paragrafos = hasData
    ? [pickVariant(CATEGORIA_PARAGRAFOS, variantIndex)(lower, profile), pickVariant(MARCA_FECHO, variantIndex)(lower)]
    : [
        `No nosso estoque você encontra ${lower} de várias marcas e faixas de preço, todos com checklist técnico antes da vitrine. Compare modelos, simule financiamento em até 60x e avalie seu usado na troca.`,
        pickVariant(MARCA_FECHO, variantIndex)(lower),
      ];
  return {
    slug,
    type: "categoria",
    name: nice,
    count,
    filterKey: "categoria",
    filterValue: name,
    title: `${nice} seminovos em Esteio/RS | Netcar Multimarcas`,
    description: `${nice} seminovos revisados em Esteio/RS na Netcar. Estoque multimarcas com procedência, financiamento facilitado e troca. Veja os ${lower} disponíveis.`,
    h1: `${nice} seminovos em Esteio/RS`,
    intro,
    paragraphs: paragrafos,
    faq: [
      {
        q: `Quais ${lower} a Netcar tem em estoque?`,
        a: `O estoque é multimarcas e atualizado diariamente. Os ${lower} disponíveis aparecem nesta página com foto e preço; confirme pelo WhatsApp antes de ir à loja.`,
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

async function fetchVehicles() {
  const res = await fetch(API_URL, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`API HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success || !Array.isArray(json.data)) throw new Error("resposta inválida");
  return json.data.filter((v) => Number(v.valor) > 0);
}

function tally(vehicles, field) {
  const map = new Map();
  for (const v of vehicles) {
    const raw = (v[field] || "").trim();
    if (!raw) continue;
    map.set(raw, (map.get(raw) || 0) + 1);
  }
  return map;
}

async function main() {
  let vehicles;
  try {
    vehicles = await fetchVehicles();
    writeSeoStockCache(rootDir, vehicles);
  } catch (err) {
    console.warn(`Aviso: API indisponível (${err.message}). landings.json mantido como está.`);
    return;
  }

  const landings = [];
  const seen = new Set();

  // Marcas com estoque relevante
  const marcas = [...tally(vehicles, "marca").entries()]
    .filter(([, c]) => c >= MIN_MARCA)
    .sort((a, b) => b[1] - a[1]);
  for (const [i, [name, count]] of marcas.entries()) {
    const l = marcaLanding(name, count, stockProfile(vehicles, "marca", name), i);
    if (l.slug && !seen.has(l.slug)) { landings.push(l); seen.add(l.slug); }
  }

  // Categorias (SUV, Hatch, Sedan...)
  const cats = [...tally(vehicles, "categoria").entries()]
    .filter(([, c]) => c >= MIN_CATEGORIA)
    .sort((a, b) => b[1] - a[1]);
  for (const [i, [name, count]] of cats.entries()) {
    const l = categoriaLanding(name, count, stockProfile(vehicles, "categoria", name), i);
    // slug "automaticos" já tem página própria (/seminovos-automaticos); evitar colisão de tema
    if (l.slug && !seen.has(l.slug)) { landings.push(l); seen.add(l.slug); }
  }

  writeFileSync(OUT, JSON.stringify(landings, null, 2) + "\n", "utf-8");
  console.log(
    `Landings geradas: ${landings.length} (${marcas.length} marcas, ${cats.length} categorias) de ${vehicles.length} veículos`
  );
}

main().catch((err) => {
  console.error("Erro ao gerar landings:", err);
  // Não derruba o build: mantém JSON existente
  try {
    readFileSync(OUT);
    console.warn("landings.json anterior preservado.");
  } catch {
    writeFileSync(OUT, "[]\n", "utf-8");
    console.warn("landings.json criado vazio (sem estoque).");
  }
});
