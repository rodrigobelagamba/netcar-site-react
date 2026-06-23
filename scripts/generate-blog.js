#!/usr/bin/env node

/**
 * AUTOMAÇÃO DE BLOG — gera posts COMPLETOS e PUBLICA automaticamente.
 *
 * Sem validação manual: escreve src/data/seo/blog-auto.json com artigos
 * prontos (título, seções, FAQ, CTA), datados de forma escalonada para
 * manter o blog "fresco". O loader (data/seo/index.ts) mescla esses posts
 * com os manuais de blog-posts.json (manuais têm prioridade no slug).
 *
 * Os artigos são parametrizados por DADOS REAIS do estoque (marca/categoria
 * mais fortes, faixas de preço) para terem substância e não virar texto vazio.
 *
 * Roda no build, antes de generate-seo-assets.js. Se a API cair, mantém o
 * blog-auto.json anterior.
 *
 * Uso: node scripts/generate-blog.js
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const OUT = join(rootDir, "src", "data", "seo", "blog-auto.json");
const MANUAL = join(rootDir, "src", "data", "seo", "blog-posts.json");

const SITE = "https://www.netcarmultimarcas.com.br";
const API_URL = `${SITE}/api/v1/veiculos.php?limit=500`;
const YEAR = new Date().getFullYear();

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
function titleCase(s) {
  return String(s || "").toLowerCase().replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase()).trim();
}
function brl(n) {
  return "R$ " + Math.round(n).toLocaleString("pt-BR");
}
// Data escalonada: post i publicado há (i*4) dias, para o blog parecer contínuo.
function staggeredDate(i) {
  const d = new Date();
  d.setDate(d.getDate() - i * 4);
  return d.toISOString().slice(0, 10);
}

const H2 = (text) => ({ type: "h2", text });
const P = (text) => ({ type: "p", text });
const UL = (items) => ({ type: "ul", items });

// ---- Artigos parametrizados (cada um recebe o resumo do estoque) ----

function postMarca(stock, idx) {
  if (!stock.topMarca) return null;
  const m = titleCase(stock.topMarca.name);
  const count = stock.topMarca.count;
  return {
    slug: slugify(`${m} usado em esteio vale a pena ${YEAR}`),
    title: `${m} usado em Esteio vale a pena em ${YEAR}?`,
    description: `Guia para quem procura ${m} seminovo em Esteio e região: modelos, o que verificar, faixas de preço e financiamento. Estoque real na Netcar.`,
    publishedAt: staggeredDate(idx),
    readMinutes: 6,
    sections: [
      P(`Se você está pesquisando um ${m} usado na região metropolitana de Porto Alegre, provavelmente já percebeu que a oferta é grande — e a qualidade varia muito. Este guia ajuda a escolher um ${m} seminovo com procedência, sem pagar a mais e sem levar problema para casa.`),
      H2(`Por que o ${m} é uma boa escolha de seminovo`),
      P(`O ${m} é uma das marcas mais procuradas por quem compra usado no Rio Grande do Sul. Peças acessíveis, rede de assistência ampla e boa revenda fazem dele uma aposta segura para quem quer previsibilidade de custo no dia a dia.`),
      P(`Na Netcar, em Esteio, o ${m} costuma ter saída rápida justamente por isso. Hoje temos ${count} ${m} disponíveis no estoque, todos preparados pela Fábrica de Valor antes de irem para a vitrine.`),
      H2(`O que verificar antes de comprar um ${m} usado`),
      UL([
        "Histórico de manutenção e procedência do veículo",
        "Estado de motor, câmbio e suspensão (peça o laudo)",
        "Quilometragem compatível com o ano",
        "Documentação em dia, sem restrição ou pendência",
        "Sinais de batida na lataria e alinhamento da pintura",
      ]),
      P(`Comprar de uma revenda com processo de preparação reduz bastante o risco em comparação à compra de particular: o carro passa por checklist técnico e ainda conta com pós-venda.`),
      H2(`Quanto custa um ${m} seminovo hoje`),
      P(`O preço depende de modelo, ano e versão. No estoque atual da Netcar, os valores partem de ${brl(stock.minPrice)} e vão até ${brl(stock.maxPrice)} considerando todas as marcas. Para ver os ${m} disponíveis com preço atualizado, confira a página da marca.`),
      H2(`Financiamento e troca`),
      P(`Dá para financiar o ${m} em até 60x, com simulação na hora, e usar seu carro atual como entrada na troca — inclusive se ainda estiver financiado, mediante avaliação. O ideal é simular antes de visitar para já chegar com a parcela definida.`),
      H2(`Conclusão`),
      P(`Um ${m} usado vale a pena quando você compra com procedência, revisão e condições claras de pagamento. Veja os ${m} disponíveis na Netcar e fale com um consultor pelo WhatsApp para separar os modelos do seu perfil.`),
    ],
    ctaLabel: `Ver ${m} no estoque`,
    ctaHref: `/comprar-${slugify(stock.topMarca.name)}`,
  };
}

function postCategoria(stock, idx) {
  if (!stock.topCategoria) return null;
  const c = stock.topCategoria.name;
  const cl = c.toLowerCase();
  const count = stock.topCategoria.count;
  return {
    slug: slugify(`melhor ${cl} seminovo esteio ${YEAR}`),
    title: `Melhor ${cl} seminovo para famílias em Esteio (${YEAR})`,
    description: `Como escolher um ${cl} seminovo com bom custo-benefício em Esteio e região: espaço, consumo, manutenção e faixas de preço. Estoque real na Netcar.`,
    publishedAt: staggeredDate(idx),
    readMinutes: 6,
    sections: [
      P(`O ${cl} virou a categoria preferida das famílias brasileiras — e na região de Esteio não é diferente. Se você quer espaço, posição de dirigir elevada e bom valor de revenda, este guia mostra como escolher um ${cl} seminovo sem errar.`),
      H2(`Por que o ${cl} é tão procurado`),
      P(`O ${cl} combina porta-malas grande, conforto para viagem e robustez para o dia a dia. É a escolha natural de quem tem família, viaja com frequência ou simplesmente quer mais segurança e visibilidade no trânsito.`),
      P(`Na Netcar, o ${cl} é a categoria que mais sai: são ${count} ${cl} no estoque agora, de várias marcas e faixas de preço.`),
      H2(`O que olhar num ${cl} usado`),
      UL([
        "Consumo real de combustível (modelos maiores pesam no bolso)",
        "Custo de manutenção e preço de peças da marca",
        "Estado de pneus, freios e suspensão — itens que sofrem mais",
        "Histórico de revisões e procedência",
        "Espaço interno e porta-malas para a sua necessidade",
      ]),
      H2(`Automático ou manual?`),
      P(`A maioria dos ${cl} seminovos hoje é automática, o que valoriza na revenda e facilita no trânsito. O manual ainda aparece em versões de entrada e costuma sair um pouco mais barato. Avalie o quanto roda em cidade antes de decidir.`),
      H2(`Faixas de preço`),
      P(`No estoque atual, os valores vão de ${brl(stock.minPrice)} a ${brl(stock.maxPrice)} entre todas as categorias. Para ver os ${cl} com preço atualizado e foto, acesse a página da categoria.`),
      H2(`Conclusão`),
      P(`O melhor ${cl} seminovo é aquele que cabe no seu orçamento, tem procedência e foi revisado antes da venda. Veja os ${cl} disponíveis na Netcar e fale com um consultor para test drive.`),
    ],
    ctaLabel: `Ver ${cl} no estoque`,
    ctaHref: `/comprar-${slugify(c)}`,
  };
}

function postPrecos(stock, idx) {
  return {
    slug: slugify(`quanto custa seminovo esteio ${YEAR}`),
    title: `Quanto custa um seminovo em Esteio em ${YEAR}?`,
    description: `Faixas de preço reais de seminovos em Esteio e região: do carro de entrada ao SUV. Veja quanto custa e como financiar na Netcar.`,
    publishedAt: staggeredDate(idx),
    readMinutes: 5,
    sections: [
      P(`"Quanto custa um seminovo?" é a primeira pergunta de quem vai trocar de carro. A resposta depende de marca, ano, categoria e estado — mas dá para ter uma boa referência olhando o estoque real de uma revenda da região.`),
      H2(`Faixas de preço no estoque atual`),
      P(`Na Netcar, em Esteio, os seminovos disponíveis hoje vão de ${brl(stock.minPrice)} a ${brl(stock.maxPrice)}. A maior parte do estoque se concentra na faixa intermediária, que é onde costuma estar o melhor custo-benefício.`),
      UL([
        `Entrada: a partir de ${brl(stock.minPrice)} — hatches e carros mais rodados`,
        `Intermediária: a faixa com mais opções de SUV e sedan revisados`,
        `Topo: até ${brl(stock.maxPrice)} — modelos mais novos e completos`,
      ]),
      H2(`O que faz o preço variar`),
      P(`Ano e quilometragem pesam, mas não são tudo. Procedência, histórico de manutenção, número de donos e a preparação do veículo influenciam diretamente o valor — e, principalmente, o risco da compra.`),
      H2(`Vale a pena financiar?`),
      P(`Com financiamento em até 60x, dá para sair com o carro pagando uma parcela que cabe no orçamento. Simule antes de visitar: assim você já sabe a faixa de preço viável e ganha tempo na loja.`),
      H2(`Conclusão`),
      P(`O preço de um seminovo em Esteio varia bastante, mas há opção para cada orçamento. Veja o estoque completo da Netcar com preços atualizados e fale com um consultor para simular o financiamento.`),
    ],
    ctaLabel: "Ver estoque com preços",
    ctaHref: "/seminovos",
  };
}

function postFinanciamento(idx) {
  return {
    slug: slugify(`como financiar carro usado rs ${YEAR}`),
    title: `Como financiar um carro usado no RS sem cair em furada`,
    description: `Passo a passo para financiar seminovo no Rio Grande do Sul: documentos, entrada, prazo e erros que encarecem a parcela. Simule na Netcar.`,
    publishedAt: staggeredDate(idx),
    readMinutes: 6,
    sections: [
      P(`Financiar um carro usado assusta quem nunca fez, mas o processo é mais simples do que parece quando você entende entrada, prazo e taxa. Veja o passo a passo para não pagar juros à toa.`),
      H2("Documentos que você vai precisar"),
      UL([
        "Documento de identidade e CPF",
        "Comprovante de residência atualizado",
        "Comprovante de renda (holerite, extrato ou declaração)",
        "Carteira de motorista (em alguns casos)",
      ]),
      H2("Entrada, prazo e parcela"),
      P("Quanto maior a entrada, menor a parcela e os juros totais. O prazo costuma ir até 60x; prazos mais longos reduzem a parcela mas aumentam o custo final. O equilíbrio ideal depende do seu orçamento mensal."),
      H2("Dá para financiar autônomo ou com nome restrito?"),
      P("Sim, em muitos casos. Autônomos comprovam renda por extrato bancário, e há linhas para quem tem restrição, geralmente com entrada maior. O consultor avalia o melhor caminho conforme o seu perfil."),
      H2("Erros que encarecem o financiamento"),
      UL([
        "Não comparar a taxa entre bancos antes de assinar",
        "Escolher o prazo mais longo só para baixar a parcela",
        "Ignorar tarifas e seguros embutidos no contrato",
        "Não simular antes de ir à loja",
      ]),
      H2("Conclusão"),
      P("Financiar seminovo no RS é seguro quando você entende as condições e simula antes. Faça a simulação com a Netcar e chegue à loja já sabendo a parcela que cabe no seu bolso."),
    ],
    ctaLabel: "Simular financiamento",
    ctaHref: "/seminovos",
  };
}

function postChecklist(idx) {
  return {
    slug: slugify("checklist comprar seminovo o que verificar"),
    title: "Checklist: 10 itens para conferir antes de comprar um seminovo",
    description: "Os 10 pontos que separam um bom negócio de uma dor de cabeça na compra de carro usado. Guia prático da Netcar, em Esteio/RS.",
    publishedAt: staggeredDate(idx),
    readMinutes: 5,
    sections: [
      P("Comprar seminovo de particular tem risco. Este checklist reúne os 10 itens que você deve conferir antes de fechar negócio — e mostra por que a preparação de uma revenda faz diferença."),
      H2("Documentação e histórico"),
      UL([
        "Documento sem restrição, multas ou IPVA atrasado",
        "Histórico de donos e procedência do veículo",
        "Número do chassi batendo com o documento",
      ]),
      H2("Mecânica"),
      UL([
        "Motor sem ruído anormal e sem vazamento",
        "Câmbio engatando suave (teste em movimento)",
        "Suspensão sem barulho em lombadas",
      ]),
      H2("Estrutura e segurança"),
      UL([
        "Lataria e pintura sem sinais de batida mal reparada",
        "Pneus e freios em bom estado",
        "Itens de segurança funcionando (airbag, ABS, cintos)",
        "Test drive em diferentes velocidades",
      ]),
      H2("Por que comprar de revenda reduz risco"),
      P("Numa revenda com processo de preparação, o carro já passou por checklist técnico antes de ir à vitrine, e você conta com pós-venda. Isso elimina boa parte das surpresas da compra entre particulares."),
      H2("Conclusão"),
      P("Use este checklist em qualquer compra de usado. Na Netcar, todo seminovo passa pela Fábrica de Valor com mais de 60 itens verificados — veja o estoque revisado."),
    ],
    ctaLabel: "Ver estoque revisado",
    ctaHref: "/seminovos",
  };
}

function postTroca(idx) {
  return {
    slug: slugify("vender carro usado ou dar na troca"),
    title: "Vender o usado por conta própria ou dar na troca?",
    description: "A conta real entre vender seu carro sozinho e dar na troca: quanto você recebe, tempo, risco e burocracia. Avalie seu carro na Netcar.",
    publishedAt: staggeredDate(idx),
    readMinutes: 5,
    sections: [
      P("Na hora de trocar de carro, surge a dúvida: vender o usado por conta própria para tentar tirar mais, ou dar na troca e resolver tudo de uma vez? Veja a conta real de cada opção."),
      H2("Quanto você realmente recebe"),
      P("A venda particular pode render um pouco mais no valor de tabela, mas custa tempo, anúncios e o risco de receber estranhos. A troca entrega praticidade e abate na hora do valor do seu próximo carro."),
      H2("Tempo, risco e burocracia"),
      UL([
        "Venda particular: anúncios, contatos, test drives com desconhecidos e transferência por sua conta",
        "Troca: avaliação na loja, sem exposição, com a documentação conduzida pela revenda",
      ]),
      H2("Carro financiado: dá para trocar?"),
      P("Sim. A revenda calcula a quitação do saldo devedor e o valor líquido entra como entrada no seminovo escolhido. Você resolve a troca sem precisar quitar o financiamento antes do próprio bolso."),
      H2("Quando a troca compensa"),
      P("A troca compensa quando você valoriza tempo e segurança, ou quando já encontrou o próximo carro. Se a diferença de valor for pequena, a praticidade costuma pesar mais."),
      H2("Conclusão"),
      P("Não existe resposta única — depende de quanto você valoriza tempo e tranquilidade. Avalie seu carro na Netcar sem compromisso e compare com o esforço da venda particular."),
    ],
    ctaLabel: "Avaliar meu carro",
    ctaHref: "/compra",
  };
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
  const marcas = tally("marca");
  const cats = tally("categoria");
  return {
    total: v.length,
    minPrice: prices.length ? Math.min(...prices) : 30000,
    maxPrice: prices.length ? Math.max(...prices) : 150000,
    topMarca: marcas[0] ? { name: marcas[0][0], count: marcas[0][1] } : null,
    topCategoria: cats[0] ? { name: cats[0][0], count: cats[0][1] } : null,
  };
}

async function main() {
  let stock = { total: 0, minPrice: 30000, maxPrice: 150000, topMarca: null, topCategoria: null };
  try {
    stock = await fetchStock();
  } catch (err) {
    console.warn(`Aviso: API indisponível (${err.message}). blog-auto.json mantido.`);
    return;
  }

  // slugs manuais têm prioridade — não duplicar tema
  let manualSlugs = new Set();
  try {
    manualSlugs = new Set(JSON.parse(readFileSync(MANUAL, "utf-8")).map((p) => p.slug));
  } catch {
    /* sem manuais */
  }

  const candidates = [
    postMarca(stock, 0),
    postCategoria(stock, 1),
    postPrecos(stock, 2),
    postFinanciamento(3),
    postChecklist(4),
    postTroca(5),
  ].filter(Boolean);

  const posts = candidates.filter((p) => !manualSlugs.has(p.slug));

  writeFileSync(OUT, JSON.stringify(posts, null, 2) + "\n", "utf-8");
  console.log(`Blog auto-publicado: ${posts.length} posts em blog-auto.json (estoque: ${stock.total} veículos)`);
}

main().catch((err) => {
  console.error("Erro ao gerar blog:", err);
  try {
    readFileSync(OUT);
    console.warn("blog-auto.json anterior preservado.");
  } catch {
    writeFileSync(OUT, "[]\n", "utf-8");
  }
});
