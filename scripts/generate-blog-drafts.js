#!/usr/bin/env node

/**
 * AUTOMAÇÃO DE PAUTA — gera RASCUNHOS de blog a partir do estoque real e de
 * perguntas de intenção de compra (queries não-marca que clientes buscam).
 *
 * IMPORTANTE: NÃO publica nada. Escreve src/data/seo/blog-drafts.json com
 * outline + parágrafos-semente. Um humano (ou LLM) revisa, melhora e só então
 * move o post aprovado para blog-posts.json. Isso evita "AI slop" indexável.
 *
 * Fluxo:
 *   node scripts/generate-blog-drafts.js   -> atualiza blog-drafts.json
 *   (revisar/editar)                        -> copiar post pronto p/ blog-posts.json
 *
 * Uso: node scripts/generate-blog-drafts.js
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const OUT = join(rootDir, "src", "data", "seo", "blog-drafts.json");
const PUBLISHED = join(rootDir, "src", "data", "seo", "blog-posts.json");

const SITE = "https://www.netcarmultimarcas.com.br";
const API_URL = `${SITE}/api/v1/veiculos.php?limit=500`;

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

// Pautas-base de alto valor para SEO local de revenda (intenção de compra).
// {topic} é preenchido com dados reais do estoque.
function pautasFrom(stock) {
  const out = [];

  // 1. Marca mais forte do estoque -> guia de compra
  if (stock.topMarca) {
    const m = titleCase(stock.topMarca.name);
    out.push({
      angle: "guia-marca",
      title: `Vale a pena comprar um ${m} usado em ${new Date().getFullYear()}?`,
      intent: `${stock.topMarca.name.toLowerCase()} usado vale a pena`,
      outline: [
        `Por que o ${m} é procurado na região metropolitana de Porto Alegre`,
        `Modelos de ${m} que aparecem com mais frequência no estoque de seminovos`,
        `O que verificar num ${m} usado antes de fechar negócio`,
        `Quanto custa um ${m} seminovo hoje na Netcar (faixas de preço)`,
        `Financiamento e troca para ${m}`,
      ],
      seed: `O ${m} está entre as marcas mais buscadas por quem procura seminovo em Esteio e região. Hoje temos ${stock.topMarca.count} ${m} no estoque — este guia ajuda a escolher a versão certa pelo melhor custo.`,
      cta: { label: `Ver ${m} no estoque`, href: `/comprar-${slugify(stock.topMarca.name)}` },
    });
  }

  // 2. Categoria dominante -> comparativo de categoria
  if (stock.topCategoria) {
    const c = stock.topCategoria.name;
    const cl = c.toLowerCase();
    out.push({
      angle: "guia-categoria",
      title: `Melhores ${cl} seminovos para famílias na região de Esteio`,
      intent: `melhor ${cl} seminovo custo beneficio`,
      outline: [
        `Por que o ${cl} virou a categoria mais procurada`,
        `O que olhar num ${cl} usado (espaço, consumo, manutenção)`,
        `Faixas de preço de ${cl} seminovo no estoque atual`,
        `${c} automático x manual: qual escolher`,
        `Como simular financiamento de um ${cl}`,
      ],
      seed: `${c} é a categoria que mais sai na Netcar — são ${stock.topCategoria.count} ${cl} disponíveis agora. Veja como escolher o ${cl} certo para o seu perfil sem pagar a mais.`,
      cta: { label: `Ver ${cl} no estoque`, href: `/comprar-${slugify(c)}` },
    });
  }

  // 3. Pautas perenes de intenção (não dependem de estoque)
  out.push(
    {
      angle: "financiamento",
      title: "Como financiar um carro usado no RS sem cair em furada",
      intent: "como financiar carro usado rs",
      outline: [
        "Documentos necessários para aprovar o financiamento",
        "Entrada, prazo e como a parcela é calculada",
        "Financiar com nome restrito ou autônomo: o que dá pra fazer",
        "Erros comuns que encarecem o financiamento",
        "Como simular antes de ir à loja",
      ],
      seed: "Financiar seminovo no Rio Grande do Sul é mais simples do que parece quando você entende entrada, prazo e taxa. Veja o passo a passo para não pagar juros à toa.",
      cta: { label: "Simular financiamento", href: "/seminovos" },
    },
    {
      angle: "checklist",
      title: "Checklist: 10 itens para conferir antes de comprar um seminovo",
      intent: "o que verificar antes de comprar carro usado",
      outline: [
        "Documentação e histórico do veículo",
        "Estado mecânico: motor, câmbio, suspensão",
        "Lataria, pintura e sinais de batida",
        "Pneus, freios e itens de segurança",
        "Por que comprar de revenda com preparação reduz risco",
      ],
      seed: "Comprar seminovo de particular tem risco. Este checklist mostra os 10 pontos que separam um bom negócio de uma dor de cabeça — e por que a preparação da loja importa.",
      cta: { label: "Ver estoque revisado", href: "/seminovos" },
    },
    {
      angle: "troca",
      title: "Vale mais vender o usado por conta própria ou dar na troca?",
      intent: "vender carro usado ou dar na troca",
      outline: [
        "Quanto você realmente recebe em cada opção",
        "Tempo, risco e burocracia da venda particular",
        "Como funciona a avaliação na troca",
        "Carro financiado: dá para trocar?",
        "Quando a troca compensa",
      ],
      seed: "Vender o carro sozinho pode render um pouco mais, mas custa tempo e risco. Veja a conta real entre venda particular e troca na revenda.",
      cta: { label: "Avaliar meu carro", href: "/compra" },
    }
  );

  return out;
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
  const marcas = tally("marca");
  const cats = tally("categoria");
  return {
    total: v.length,
    topMarca: marcas[0] ? { name: marcas[0][0], count: marcas[0][1] } : null,
    topCategoria: cats[0] ? { name: cats[0][0], count: cats[0][1] } : null,
  };
}

async function main() {
  let stock = { total: 0, topMarca: null, topCategoria: null };
  try {
    stock = await fetchStock();
  } catch (err) {
    console.warn(`Aviso: API indisponível (${err.message}). Gerando só pautas perenes.`);
  }

  let publishedSlugs = new Set();
  try {
    const pub = JSON.parse(readFileSync(PUBLISHED, "utf-8"));
    publishedSlugs = new Set(pub.map((p) => p.slug));
  } catch {
    /* sem blog-posts ainda */
  }

  const drafts = pautasFrom(stock)
    .map((d) => ({
      status: "draft",
      slug: slugify(d.title),
      title: d.title,
      angle: d.angle,
      targetQuery: d.intent,
      description: d.seed.slice(0, 155),
      suggestedOutline: d.outline,
      seedParagraph: d.seed,
      suggestedCta: d.cta,
      note: "RASCUNHO automático. Revisar/expandir antes de mover para blog-posts.json.",
    }))
    // não sugerir pauta de algo já publicado
    .filter((d) => !publishedSlugs.has(d.slug));

  writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), drafts }, null, 2) + "\n", "utf-8");
  console.log(`Rascunhos de blog gerados: ${drafts.length} em ${OUT}`);
  console.log("Revise e copie os aprovados para blog-posts.json (não publica sozinho).");
}

main().catch((err) => {
  console.error("Erro ao gerar rascunhos:", err);
  process.exit(0); // nunca derruba pipeline; é ferramenta auxiliar
});
