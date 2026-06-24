#!/usr/bin/env node

/**
 * AUTOMAÇÃO DE BLOG — publica automaticamente, com ROTAÇÃO e ACÚMULO.
 *
 * Pool grande de pautas (uma por marca, uma por categoria + perenes). A cada
 * execução:
 *   - Mantém todos os posts já publicados (não some nada) e ATUALIZA os dados
 *     dinâmicos deles (preços, contagem do estoque).
 *   - Publica os PRÓXIMOS temas ainda não usados, com data de hoje.
 *
 * Primeira execução (sem histórico): publica um lote inicial com datas
 * escalonadas para o blog já nascer com conteúdo. Depois, cada rodada semanal
 * adiciona MAX_NEW_PER_RUN tema(s) novo(s) — o blog cresce sozinho ao longo
 * do tempo sem repetir pauta.
 *
 * Histórico vive em src/data/seo/blog-auto.json (precisa persistir entre
 * execuções — ver docs/AUTOMACAO-SEO.md, seção VPS/Docker).
 *
 * Uso: node scripts/generate-blog.js
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { writeTextFile } from "./lib/write-text-file.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const OUT = join(rootDir, "src", "data", "seo", "blog-auto.json");
const MANUAL = join(rootDir, "src", "data", "seo", "blog-posts.json");

const SITE = "https://www.netcarmultimarcas.com.br";
const API_URL = `${SITE}/api/v1/veiculos.php?limit=500`;
const YEAR = new Date().getFullYear();

// Quantos temas novos publicar por execução (depois do lote inicial).
const MAX_NEW_PER_RUN = 1;
// Tamanho do lote inicial quando ainda não há histórico.
const INITIAL_BATCH = 6;

function slugify(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
function titleCase(s) {
  return String(s || "").toLowerCase().replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase()).trim();
}
function brl(n) {
  return "R$ " + Math.round(n).toLocaleString("pt-BR");
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const H2 = (text) => ({ type: "h2", text });
const P = (text) => ({ type: "p", text });
const UL = (items) => ({ type: "ul", items });

// ---------- Pool de temas (cada um retorna {slug,title,...,sections}) ----------
// Prioridade menor = publicado antes.

function temaMarca(name, count, stock, priority) {
  const m = titleCase(name);
  return {
    priority,
    slug: slugify(`${m} usado em esteio vale a pena ${YEAR}`),
    title: `${m} usado em Esteio vale a pena em ${YEAR}?`,
    description: `Guia para quem procura ${m} seminovo em Esteio e região: modelos, o que verificar, faixas de preço e financiamento. Estoque real na Netcar.`,
    readMinutes: 6,
    sections: [
      P(`Se você procura um ${m} usado na região metropolitana de Porto Alegre, a oferta é grande — e a qualidade varia muito. Este guia ajuda a escolher um ${m} seminovo com procedência, sem pagar a mais.`),
      H2(`Por que o ${m} é uma boa escolha de seminovo`),
      P(`O ${m} é uma das marcas mais procuradas por quem compra usado no Rio Grande do Sul: peças acessíveis, rede de assistência ampla e boa revenda. Na Netcar, em Esteio, costuma ter saída rápida.`),
      H2(`O que verificar antes de comprar um ${m} usado`),
      UL([
        "Histórico de manutenção e procedência",
        "Estado de motor, câmbio e suspensão (peça o laudo)",
        "Quilometragem compatível com o ano",
        "Documentação em dia, sem restrição",
        "Sinais de batida na lataria e alinhamento da pintura",
      ]),
      H2(`Quanto custa um ${m} seminovo hoje`),
      P(`O valor depende de modelo, ano e versão. No estoque atual da Netcar os preços vão de ${brl(stock.minPrice)} a ${brl(stock.maxPrice)} entre todas as marcas. Veja os ${m} disponíveis na página da marca.`),
      H2(`Financiamento e troca`),
      P(`Dá para financiar o ${m} em até 60x com simulação na hora e usar seu carro como entrada na troca — inclusive financiado, mediante avaliação. Simule antes de visitar.`),
      H2(`Conclusão`),
      P(`Um ${m} usado vale a pena quando você compra com procedência, revisão e condições claras. Veja os ${m} na Netcar e fale com um consultor pelo WhatsApp.`),
    ],
    ctaLabel: `Ver ${m} no estoque`,
    ctaHref: `/comprar-${slugify(name)}`,
  };
}

function temaCategoria(name, count, stock, priority) {
  const c = name;
  const cl = name.toLowerCase();
  return {
    priority,
    slug: slugify(`melhor ${cl} seminovo esteio ${YEAR}`),
    title: `Melhor ${cl} seminovo para famílias em Esteio (${YEAR})`,
    description: `Como escolher um ${cl} seminovo com bom custo-benefício em Esteio e região: espaço, consumo, manutenção e faixas de preço. Estoque real na Netcar.`,
    readMinutes: 6,
    sections: [
      P(`O ${cl} é uma das categorias preferidas das famílias na região de Esteio. Se você quer espaço, conforto e bom valor de revenda, veja como escolher um ${cl} seminovo sem errar.`),
      H2(`Por que o ${cl} é tão procurado`),
      P(`O ${cl} combina porta-malas, conforto de viagem e robustez no dia a dia. Na Netcar é uma das categorias que mais saem, com opções de várias marcas e faixas de preço.`),
      H2(`O que olhar num ${cl} usado`),
      UL([
        "Consumo real de combustível",
        "Custo de manutenção e preço de peças",
        "Estado de pneus, freios e suspensão",
        "Histórico de revisões e procedência",
        "Espaço interno e porta-malas para sua necessidade",
      ]),
      H2(`Automático ou manual?`),
      P(`A maioria dos ${cl} seminovos hoje é automática, o que valoriza na revenda e facilita no trânsito. O manual aparece em versões de entrada e sai um pouco mais barato.`),
      H2(`Faixas de preço`),
      P(`No estoque atual os valores vão de ${brl(stock.minPrice)} a ${brl(stock.maxPrice)}. Veja os ${cl} com preço atualizado e foto na página da categoria.`),
      H2(`Conclusão`),
      P(`O melhor ${cl} é o que cabe no seu orçamento, tem procedência e foi revisado antes da venda. Veja os ${cl} na Netcar e agende um test drive.`),
    ],
    ctaLabel: `Ver ${cl} no estoque`,
    ctaHref: `/comprar-${slugify(c)}`,
  };
}

function temaPrecos(stock, priority) {
  return {
    priority,
    slug: slugify(`quanto custa seminovo esteio ${YEAR}`),
    title: `Quanto custa um seminovo em Esteio em ${YEAR}?`,
    description: `Faixas de preço reais de seminovos em Esteio: do carro de entrada ao SUV. Veja quanto custa e como financiar na Netcar.`,
    readMinutes: 5,
    sections: [
      P(`"Quanto custa um seminovo?" é a primeira pergunta de quem vai trocar de carro. Dá para ter boa referência olhando o estoque real de uma revenda da região.`),
      H2(`Faixas de preço no estoque atual`),
      P(`Na Netcar, em Esteio, os seminovos disponíveis vão de ${brl(stock.minPrice)} a ${brl(stock.maxPrice)}. A maior parte está na faixa intermediária, onde costuma estar o melhor custo-benefício.`),
      H2(`O que faz o preço variar`),
      P(`Ano e quilometragem pesam, mas procedência, histórico de manutenção, número de donos e a preparação do veículo influenciam o valor — e o risco da compra.`),
      H2(`Vale a pena financiar?`),
      P(`Com financiamento em até 60x, dá para sair com o carro pagando parcela que cabe no orçamento. Simule antes de visitar para já saber a faixa viável.`),
      H2(`Conclusão`),
      P(`Há opção para cada orçamento. Veja o estoque completo da Netcar com preços atualizados e fale com um consultor para simular.`),
    ],
    ctaLabel: "Ver estoque com preços",
    ctaHref: "/seminovos",
  };
}

function temaFinanciamento(priority) {
  return {
    priority,
    slug: slugify(`como financiar carro usado rs`),
    title: "Como financiar um carro usado no RS sem cair em furada",
    description: "Passo a passo para financiar seminovo no RS: documentos, entrada, prazo e erros que encarecem a parcela. Simule na Netcar.",
    readMinutes: 6,
    sections: [
      P("Financiar um carro usado é mais simples do que parece quando você entende entrada, prazo e taxa. Veja o passo a passo para não pagar juros à toa."),
      H2("Documentos que você vai precisar"),
      UL(["Identidade e CPF", "Comprovante de residência", "Comprovante de renda", "CNH (em alguns casos)"]),
      H2("Entrada, prazo e parcela"),
      P("Quanto maior a entrada, menor a parcela e os juros totais. O prazo vai até 60x; prazos longos reduzem a parcela mas aumentam o custo final."),
      H2("Autônomo ou nome restrito?"),
      P("Em muitos casos é possível. Autônomos comprovam renda por extrato; há linhas para quem tem restrição, geralmente com entrada maior."),
      H2("Erros que encarecem"),
      UL(["Não comparar taxa entre bancos", "Escolher o prazo mais longo só pela parcela", "Ignorar tarifas e seguros embutidos", "Não simular antes de ir à loja"]),
      H2("Conclusão"),
      P("Financiar seminovo no RS é seguro quando você simula antes. Faça a simulação com a Netcar e chegue sabendo a parcela que cabe no bolso."),
    ],
    ctaLabel: "Simular financiamento",
    ctaHref: "/seminovos",
  };
}

function temaChecklist(priority) {
  return {
    priority,
    slug: slugify("checklist comprar seminovo o que verificar"),
    title: "Checklist: 10 itens para conferir antes de comprar um seminovo",
    description: "Os 10 pontos que separam um bom negócio de uma dor de cabeça na compra de usado. Guia prático da Netcar, em Esteio/RS.",
    readMinutes: 5,
    sections: [
      P("Comprar seminovo de particular tem risco. Este checklist reúne os 10 itens para conferir antes de fechar negócio."),
      H2("Documentação e histórico"),
      UL(["Documento sem restrição/multas", "Histórico de donos e procedência", "Chassi batendo com o documento"]),
      H2("Mecânica"),
      UL(["Motor sem ruído/vazamento", "Câmbio engatando suave", "Suspensão sem barulho"]),
      H2("Estrutura e segurança"),
      UL(["Lataria/pintura sem batida mal reparada", "Pneus e freios em bom estado", "Airbag, ABS e cintos funcionando", "Test drive em diferentes velocidades"]),
      H2("Por que revenda reduz risco"),
      P("Numa revenda com preparação, o carro já passou por checklist técnico e há pós-venda — elimina boa parte das surpresas."),
      H2("Conclusão"),
      P("Na Netcar, todo seminovo passa pela Fábrica de Valor com mais de 60 itens verificados. Veja o estoque revisado."),
    ],
    ctaLabel: "Ver estoque revisado",
    ctaHref: "/seminovos",
  };
}

function temaTroca(priority) {
  return {
    priority,
    slug: slugify("vender carro usado ou dar na troca"),
    title: "Vender o usado por conta própria ou dar na troca?",
    description: "A conta real entre vender seu carro sozinho e dar na troca: quanto você recebe, tempo, risco e burocracia. Avalie na Netcar.",
    readMinutes: 5,
    sections: [
      P("Vender o usado sozinho para tentar tirar mais, ou dar na troca e resolver de uma vez? Veja a conta real de cada opção."),
      H2("Quanto você realmente recebe"),
      P("A venda particular pode render um pouco mais, mas custa tempo, anúncios e risco. A troca entrega praticidade e abate na hora do próximo carro."),
      H2("Tempo, risco e burocracia"),
      UL(["Particular: anúncios, contatos e transferência por sua conta", "Troca: avaliação na loja, sem exposição, documentação conduzida pela revenda"]),
      H2("Carro financiado dá para trocar?"),
      P("Sim. A revenda calcula a quitação do saldo e o valor líquido entra como entrada no seminovo escolhido."),
      H2("Quando a troca compensa"),
      P("Quando você valoriza tempo e segurança, ou já encontrou o próximo carro. Se a diferença de valor for pequena, a praticidade pesa mais."),
      H2("Conclusão"),
      P("Depende de quanto você valoriza tempo e tranquilidade. Avalie seu carro na Netcar sem compromisso."),
    ],
    ctaLabel: "Avaliar meu carro",
    ctaHref: "/compra",
  };
}

function temaAutomatico(priority) {
  return {
    priority,
    slug: slugify("cambio automatico vale a pena seminovo"),
    title: "Câmbio automático vale a pena num seminovo?",
    description: "Automático x manual num carro usado: consumo, manutenção, revenda e conforto. Entenda qual escolher na hora de comprar um seminovo.",
    readMinutes: 5,
    sections: [
      P("O automático dominou o mercado, mas num seminovo a decisão tem nuances de custo e manutenção. Veja o que pesa de verdade."),
      H2("Vantagens do automático"),
      UL(["Mais conforto no trânsito de cidade", "Melhor valor de revenda", "Tendência de mercado — mais procura"]),
      H2("Quando o manual ainda compensa"),
      UL(["Preço de compra menor", "Manutenção geralmente mais barata", "Versões de entrada mais acessíveis"]),
      H2("Manutenção: o ponto de atenção"),
      P("No usado, verifique o histórico do câmbio automático (trocas de óleo em dia). Um automático bem cuidado é tão confiável quanto o manual."),
      H2("Conclusão"),
      P("Se você roda muito em cidade e pensa em revenda, o automático compensa. Veja os automáticos revisados na Netcar."),
    ],
    ctaLabel: "Ver automáticos",
    ctaHref: "/seminovos-automaticos",
  };
}

function temaPrimeiroCarro(priority) {
  return {
    priority,
    slug: slugify("melhor primeiro carro seminovo esteio"),
    title: "Qual o melhor primeiro carro seminovo para começar?",
    description: "Guia para o primeiro carro: modelos econômicos, baratos de manter e seguros para começar. Opções de seminovo na Netcar, em Esteio/RS.",
    readMinutes: 5,
    sections: [
      P("O primeiro carro precisa ser econômico, barato de manter e fácil de revender. Veja como escolher um bom seminovo para começar."),
      H2("O que priorizar no primeiro carro"),
      UL(["Consumo baixo de combustível", "Seguro e manutenção acessíveis", "Peças fáceis de encontrar", "Boa revenda para a próxima troca"]),
      H2("Hatch é a melhor porta de entrada"),
      P("Compactos são mais baratos para comprar, abastecer e estacionar — ideais para quem está começando a dirigir."),
      H2("Financiamento para o primeiro carro"),
      P("Com entrada e prazo ajustados, a parcela cabe no orçamento de quem está começando. Simule antes de escolher."),
      H2("Conclusão"),
      P("O melhor primeiro carro é o econômico e revisado. Veja as opções de entrada no estoque da Netcar."),
    ],
    ctaLabel: "Ver estoque",
    ctaHref: "/seminovos",
  };
}

function buildPool(stock) {
  const pool = [];
  let p = 100;
  // Perenes de maior valor primeiro
  pool.push(temaFinanciamento(p++));
  pool.push(temaPrecos(stock, p++));
  pool.push(temaChecklist(p++));
  // Marca/categoria top entram cedo
  if (stock.topMarca) pool.push(temaMarca(stock.topMarca.name, stock.topMarca.count, stock, p++));
  if (stock.topCategoria) pool.push(temaCategoria(stock.topCategoria.name, stock.topCategoria.count, stock, p++));
  pool.push(temaTroca(p++));
  pool.push(temaAutomatico(p++));
  pool.push(temaPrimeiroCarro(p++));
  // Demais marcas (rotação ao longo das semanas)
  for (const [name, count] of stock.marcas.slice(1)) {
    pool.push(temaMarca(name, count, stock, p++));
  }
  // Demais categorias
  for (const [name, count] of stock.categorias.slice(1)) {
    pool.push(temaCategoria(name, count, stock, p++));
  }
  // Dedup por slug mantendo menor prioridade
  const bySlug = new Map();
  for (const t of pool.sort((a, b) => a.priority - b.priority)) {
    if (!bySlug.has(t.slug)) bySlug.set(t.slug, t);
  }
  return [...bySlug.values()];
}

async function fetchStock() {
  const res = await fetch(API_URL, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`API HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success || !Array.isArray(json.data)) throw new Error("resposta inválida");
  const v = json.data.filter((x) => Number(x.valor) > 0);
  const tally = (field) => {
    const m = new Map();
    for (const x of v) {
      const k = (x[field] || "").trim();
      if (k) m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const prices = v.map((x) => Number(x.valor)).filter((n) => n > 0);
  const marcas = tally("marca").filter(([, c]) => c >= 3);
  const categorias = tally("categoria").filter(([, c]) => c >= 3);
  return {
    total: v.length,
    minPrice: prices.length ? Math.min(...prices) : 30000,
    maxPrice: prices.length ? Math.max(...prices) : 150000,
    marcas,
    categorias,
    topMarca: marcas[0] ? { name: marcas[0][0], count: marcas[0][1] } : null,
    topCategoria: categorias[0] ? { name: categorias[0][0], count: categorias[0][1] } : null,
  };
}

function readJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, "utf-8")); } catch { return fallback; }
}

async function main() {
  let stock;
  try {
    stock = await fetchStock();
  } catch (err) {
    console.warn(`Aviso: API indisponível (${err.message}). blog-auto.json mantido.`);
    return;
  }

  const manualSlugs = new Set(readJson(MANUAL, []).map((p) => p.slug));
  const existing = readJson(OUT, []); // posts já publicados (com publishedAt)
  const existingBySlug = new Map(existing.map((p) => [p.slug, p]));

  const pool = buildPool(stock).filter((t) => !manualSlugs.has(t.slug));

  const finalize = (tema, publishedAt) => ({
    slug: tema.slug,
    title: tema.title,
    description: tema.description,
    publishedAt,
    readMinutes: tema.readMinutes,
    sections: tema.sections,
    ctaLabel: tema.ctaLabel,
    ctaHref: tema.ctaHref,
  });

  const out = [];

  if (existing.length === 0) {
    // Primeira vez: lote inicial com datas escalonadas retroativas
    pool.slice(0, INITIAL_BATCH).forEach((tema, i) => {
      out.push(finalize(tema, daysAgo(i * 4)));
    });
    console.log(`Primeira execução: ${out.length} posts iniciais.`);
  } else {
    let added = 0;
    for (const tema of pool) {
      if (existingBySlug.has(tema.slug)) {
        // Já publicado: mantém data original, atualiza conteúdo (dados frescos)
        out.push(finalize(tema, existingBySlug.get(tema.slug).publishedAt));
      } else if (added < MAX_NEW_PER_RUN) {
        // Novo tema desta rodada
        out.push(finalize(tema, today()));
        added++;
      }
      // demais ficam pendentes para próximas rodadas
    }
    console.log(`Rodada: ${added} tema(s) novo(s) publicado(s), ${out.length} no total.`);
  }

  out.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const json = JSON.stringify(out, null, 2) + "\n";
  const wrote = writeTextFile(OUT, json);
  const pendentes = pool.length - out.length;
  console.log(
    `Blog: ${out.length} publicados | ${pendentes} pauta(s) na fila | estoque ${stock.total}${wrote ? "" : " (sem alteração no arquivo)"}.`
  );
}

main().catch((err) => {
  console.error("Erro ao gerar blog:", err);
  process.exit(0);
});
