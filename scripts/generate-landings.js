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

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const OUT = join(rootDir, "src", "data", "seo", "landings.json");

const SITE = "https://www.netcarmultimarcas.com.br";
const API_URL = `${SITE}/api/v1/veiculos.php?limit=500`;

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

function marcaLanding(name, count) {
  const nice = titleCase(name);
  return {
    slug: slugify(name),
    type: "marca",
    name: nice,
    count,
    filterKey: "marca",
    filterValue: name,
    title: `${nice} usados e seminovos em Esteio/RS | Netcar Multimarcas`,
    description: `${nice} seminovos revisados em Esteio/RS na Netcar. Estoque com procedência, financiamento em até 60x e troca com avaliação na hora. Veja os ${nice} disponíveis.`,
    h1: `${nice} seminovos em Esteio/RS`,
    intro: `Procurando um ${nice} usado com procedência na região metropolitana de Porto Alegre? A Netcar reúne ${nice} seminovos revisados pela Fábrica de Valor em duas lojas na Av. Getúlio Vargas, em Esteio.`,
    paragraphs: [
      `Cada ${nice} do nosso estoque passa por checklist técnico antes de ir para a vitrine. Você compara versões, simula financiamento em até 60x e avalia seu usado na troca — tudo na mesma visita.`,
      `Atendemos clientes de Esteio, Canoas, Sapucaia do Sul, São Leopoldo, Gravataí e toda a região metropolitana. Comece pelo WhatsApp com o iAN: diga o ${nice} que procura e a faixa de parcela, e chegue na loja com os carros separados.`,
    ],
    faq: [
      {
        q: `A Netcar tem ${nice} em estoque agora?`,
        a: `Sim. O estoque é atualizado diariamente no site. Os ${nice} disponíveis aparecem nesta página com foto e preço — confirme a disponibilidade pelo WhatsApp antes de visitar.`,
      },
      {
        q: `Posso financiar um ${nice} usado na Netcar?`,
        a: `Sim, com financiamento em até 60x e simulação na hora. Aceitamos troca, inclusive de carro com financiamento em aberto, mediante avaliação.`,
      },
      {
        q: `Os ${nice} passam por revisão antes da venda?`,
        a: `Todos os seminovos passam pela Fábrica de Valor, com mais de 60 itens técnicos e funcionais verificados, e contam com pós-venda NetHelp.`,
      },
    ],
  };
}

function categoriaLanding(name, count) {
  const nice = name.toUpperCase() === name ? name : titleCase(name);
  const lower = String(name).toLowerCase();
  return {
    slug: slugify(name),
    type: "categoria",
    name: nice,
    count,
    filterKey: "categoria",
    filterValue: name,
    title: `${nice} seminovos em Esteio/RS | Netcar Multimarcas`,
    description: `${nice} seminovos revisados em Esteio/RS na Netcar. Estoque multimarcas com procedência, financiamento facilitado e troca. Veja os ${lower} disponíveis.`,
    h1: `${nice} seminovos em Esteio/RS`,
    intro: `Quer um ${lower} seminovo com procedência perto de Porto Alegre? A Netcar concentra ${lower} multimarcas revisados pela Fábrica de Valor em duas lojas na Av. Getúlio Vargas, em Esteio.`,
    paragraphs: [
      `No nosso estoque você encontra ${lower} de várias marcas e faixas de preço, todos com checklist técnico antes da vitrine. Compare modelos, simule financiamento em até 60x e avalie seu usado na troca.`,
      `Atendemos toda a região metropolitana — Esteio, Canoas, Sapucaia do Sul, São Leopoldo, Gravataí e mais. Fale com o iAN no WhatsApp, diga o ${lower} que procura, e já deixamos as opções separadas para sua visita.`,
    ],
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
  for (const [name, count] of marcas) {
    const l = marcaLanding(name, count);
    if (l.slug && !seen.has(l.slug)) { landings.push(l); seen.add(l.slug); }
  }

  // Categorias (SUV, Hatch, Sedan...)
  const cats = [...tally(vehicles, "categoria").entries()]
    .filter(([, c]) => c >= MIN_CATEGORIA)
    .sort((a, b) => b[1] - a[1]);
  for (const [name, count] of cats) {
    const l = categoriaLanding(name, count);
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
