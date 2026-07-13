#!/usr/bin/env node

/**
 * AUTOMAÇÃO DE BLOG — publica automaticamente, com ROTAÇÃO e ACÚMULO.
 *
 * Linha editorial: 8 formatos distintos (guia passo a passo, mitos, erros,
 * ranking, FAQ, comparativo, perfil, jornada) — inspirados em blogs automotivos.
 * Cada pauta de marca/categoria recebe um formato estável pelo slug; carros reais
 * entram em posições diferentes conforme o formato.
 *
 * A cada execução (1 pauta nova/semana, MAX_NEW_PER_RUN):
 *   - Mantém os posts já publicados e ATUALIZA dados dinâmicos (preços, carros).
 *   - Publica a próxima pauta ainda não usada do pool (derivado do estoque real).
 *
 * Ângulo/abertura/veredito variam por slug (determinístico — não muda a cada
 * rodada, evitando churn no git) para nenhuma matéria ficar igual à outra.
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
import {
  buildSubjectArticle,
  buildPrecosArticle,
  buildChecklistArticle,
  buildTrocaArticle,
  buildAutomaticoArticle,
  buildPrimeiroCarroArticle,
  buildRegionalStockArticle,
  buildFaixaPrecoArticle,
  buildModeloArticle,
  buildUsoArticle,
} from "./lib/blog-formats.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const OUT = join(rootDir, "src", "data", "seo", "blog-auto.json");
const MANUAL = join(rootDir, "src", "data", "seo", "blog-posts.json");
const TOPICS = join(rootDir, "src", "data", "seo", "blog-topics.json");

const SITE = "https://www.netcarmultimarcas.com.br";
const API_URL = `${SITE}/api/v1/veiculos.php?limit=500`;
const YEAR = new Date().getFullYear();

// 2/semana: fila longa de SEO orgânico (modelos, faixas, regionais, uso).
const MAX_NEW_PER_RUN = 2;
const INITIAL_BATCH = 6; // lote inicial quando não há histórico
const FEATURED = 2; // carros embutidos por matéria
const MIN_MODELO_COUNT = 2; // volume mínimo pra pauta de modelo

/**
 * Slugs do pool auto que colidem em INTENÇÃO com manuais já publicados
 * ou com pautas manuais prioritárias (pendente/publicado). Não republicar.
 */
const TOPIC_BLOCKLIST = new Set([
  "checklist-comprar-seminovo-o-que-verificar",
  "melhor-primeiro-carro-seminovo-esteio",
  "cambio-automatico-vale-a-pena-seminovo",
  "vender-carro-usado-ou-dar-na-troca",
  "seminovos-vale-dos-sinos-estoque-e-procedencia-2026",
  "comprar-seminovo-a-distancia-serra-gaucha-2026",
  "melhor-suv-seminovo-esteio-2026",
  // Evita overlap com manuais / topics (mesmo com slug diferente)
  "seminovo-ate-100-mil-esteio-2026",
  "carro-aplicativo-grande-poa-2026",
  "picape-seminova-regiao-metropolitana-2026",
]);

function readTopicBlocklist() {
  const blocked = new Set(TOPIC_BLOCKLIST);
  for (const t of readJson(TOPICS, [])) {
    // Pautas manuais ativas ou já publicadas: auto não gera slug igual
    if (t.slug && t.status !== "cancelado") blocked.add(t.slug);
  }
  return blocked;
}

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
// Hash determinístico (FNV-1a) para escolher variantes de forma estável por slug.
function hashStr(s) {
  let h = 2166136261;
  const str = String(s);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function pick(arr, seed) {
  return arr[hashStr(seed) % arr.length];
}


// ---------- Estoque real → cards de carro ----------

function imgUrl(p) {
  if (!p) return undefined;
  const s = String(p).replace(/^\.\//, "").replace(/^\//, "");
  return `${SITE}/${encodeURI(s)}`;
}
// valor_formatado da API pode vir com HTML (<span>R$</span>) — tira tags.
function cleanPrice(s) {
  return String(s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}
// Replica src/lib/slug.ts (maskPlate + generateVehicleSlug) para gerar a URL
// interna real do app: /veiculo/{modelo}-{ano}-{placa}-{id}.
function maskPlate(placa) {
  if (!placa) return "";
  const clean = String(placa).replace(/\s/g, "").toUpperCase().replace(/-/g, "");
  if (clean.length < 5) return clean;
  const prefixo = clean.substring(0, 3);
  const digs = clean.match(/\d/g);
  const ult = digs && digs.length >= 2 ? digs.slice(-2).join("") : clean.slice(-2);
  return `${prefixo}-xx${ult}`;
}
function vehicleSlug(v) {
  const parts = [];
  if (v.modelo) {
    let modelo = String(v.modelo).trim();
    if (v.marca && modelo.toLowerCase().startsWith(String(v.marca).toLowerCase())) {
      modelo = modelo.substring(String(v.marca).length).trim();
    }
    const mslug = modelo
      .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (mslug) parts.push(mslug);
  }
  if (v.ano) parts.push(String(v.ano));
  if (v.placa) {
    const pslug = maskPlate(v.placa).toLowerCase();
    if (pslug) parts.push(pslug);
  }
  if (v.id) parts.push(String(v.id));
  return parts.join("-");
}
function carUrl(v) {
  if (!v.id) return `${SITE}/seminovos`;
  return `${SITE}/veiculo/${encodeURI(vehicleSlug(v))}`;
}
function carCard(v) {
  const marca = titleCase(v.marca);
  const modelo = `${marca} ${titleCase(v.modelo)}`.replace(/\s+/g, " ").trim();
  const ano =
    v.ano_fabricacao && v.ano && Number(v.ano_fabricacao) !== Number(v.ano)
      ? `${v.ano_fabricacao}/${v.ano}`
      : `${v.ano || ""}`;
  return {
    modelo,
    ano: ano.trim(),
    km: v.km > 0 ? `${v.km.toLocaleString("pt-BR")} km` : "",
    preco: v.valor > 0 ? cleanPrice(v.valor_formatado) || brl(v.valor) : "",
    cambio: v.cambio ? titleCase(v.cambio) : undefined,
    combustivel: v.combustivel || undefined,
    destaque: v.destaque || undefined,
    url: carUrl(v),
    img: imgUrl(v.capa),
  };
}
// Seleciona até n carros que batem o filtro, priorizando com foto e menor km.
function featuredCars(list, pred, n = FEATURED) {
  const arr = list.filter(pred).slice();
  arr.sort((a, b) => {
    const ia = a.capa ? 0 : 1;
    const ib = b.capa ? 0 : 1;
    if (ia !== ib) return ia - ib;
    return (a.km || 1e12) - (b.km || 1e12);
  });
  return arr.slice(0, n).map(carCard);
}
const sameMarca = (name) => (v) => v.marca.toLowerCase() === String(name).toLowerCase();
const sameCategoria = (name) => (v) => v.categoria.toLowerCase() === String(name).toLowerCase();
const isAuto = (v) => /autom/i.test(v.cambio);

// ---------- Pool de temas (formatos em scripts/lib/blog-formats.js) ----------

function wrap(priority, article) {
  return { priority, ...article };
}

function temaMarca(name, stock, priority) {
  const m = titleCase(name);
  const slug = slugify(`${m} usado em esteio vale a pena ${YEAR}`);
  return wrap(
    priority,
    buildSubjectArticle({
      slug,
      label: m,
      kind: "marca",
      cars: featuredCars(stock.cars, sameMarca(name)),
      stock,
      year: YEAR,
      brl,
      hashStr,
      ctaHref: `/comprar-${slugify(name)}`,
      ctaLabel: `Ver ${m} no estoque`,
    })
  );
}

function temaCategoria(name, stock, priority) {
  const c = name;
  const cl = name.toLowerCase();
  const slug = slugify(`melhor ${cl} seminovo esteio ${YEAR}`);
  return wrap(
    priority,
    buildSubjectArticle({
      slug,
      label: titleCase(c),
      kind: "categoria",
      cars: featuredCars(stock.cars, sameCategoria(name)),
      stock,
      year: YEAR,
      brl,
      hashStr,
      ctaHref: `/comprar-${slugify(c)}`,
      ctaLabel: `Ver ${cl} no estoque`,
    })
  );
}

function temaPrecos(stock, priority) {
  const slug = slugify(`quanto custa seminovo esteio ${YEAR}`);
  return wrap(
    priority,
    buildPrecosArticle({
      slug,
      cars: featuredCars(stock.cars, (v) => v.valor > 0),
      stock: { ...stock, year: YEAR },
      brl,
      ctaHref: "/seminovos",
      ctaLabel: "Ver estoque com preços",
    })
  );
}

function temaChecklist(stock, priority) {
  const slug = slugify("checklist comprar seminovo o que verificar");
  return wrap(
    priority,
    buildChecklistArticle({
      slug,
      cars: featuredCars(stock.cars, (v) => v.valor > 0),
      ctaHref: "/seminovos",
      ctaLabel: "Ver estoque revisado",
    })
  );
}

function temaTroca(priority) {
  const slug = slugify("vender carro usado ou dar na troca");
  return wrap(
    priority,
    buildTrocaArticle({
      slug,
      ctaHref: "/compra",
      ctaLabel: "Avaliar meu carro",
    })
  );
}

function temaAutomatico(stock, priority) {
  const slug = slugify("cambio automatico vale a pena seminovo");
  return wrap(
    priority,
    buildAutomaticoArticle({
      slug,
      cars: featuredCars(stock.cars, isAuto),
      ctaHref: "/seminovos-automaticos",
      ctaLabel: "Ver automáticos",
    })
  );
}

function temaPrimeiroCarro(stock, priority) {
  const slug = slugify("melhor primeiro carro seminovo esteio");
  const baratos = stock.cars
    .filter((v) => v.valor > 0)
    .slice()
    .sort((a, b) => a.valor - b.valor)
    .slice(0, 6);
  return wrap(
    priority,
    buildPrimeiroCarroArticle({
      slug,
      cars: featuredCars(baratos, () => true),
      hashStr,
      ctaHref: "/seminovos",
      ctaLabel: "Ver estoque",
    })
  );
}

function temaRegional(stock, priority, config) {
  const slug = slugify(`${config.topic} ${YEAR}`);
  return wrap(
    priority,
    buildRegionalStockArticle({
      slug,
      region: config.region,
      cities: config.cities,
      angle: config.angle,
      cars: featuredCars(stock.cars, (v) => v.valor > 0),
      ctaHref: "/seminovos",
      ctaLabel: "Ver estoque atualizado",
    })
  );
}

function temaFaixa(stock, priority, maxPrice, label) {
  const slug = slugify(`seminovo ate ${label} esteio ${YEAR}`);
  const cars = stock.cars.filter((v) => v.valor > 0 && v.valor <= maxPrice);
  if (cars.length < 2) return null;
  return wrap(
    priority,
    buildFaixaPrecoArticle({
      slug,
      maxPrice,
      label,
      cars: featuredCars(cars, () => true),
      hashStr,
      ctaHref: "/seminovos",
      ctaLabel: `Ver até ${label}`,
    })
  );
}

function temaModelo(stock, priority, modelo) {
  const slug = slugify(`${modelo} seminovo esteio ${YEAR}`);
  const cars = stock.cars.filter(
    (v) => v.modelo && v.modelo.toLowerCase() === modelo.toLowerCase() && v.valor > 0
  );
  if (cars.length < MIN_MODELO_COUNT) return null;
  return wrap(
    priority,
    buildModeloArticle({
      slug,
      modelo: titleCase(modelo),
      cars: featuredCars(cars, () => true),
      hashStr,
      ctaHref: "/seminovos",
      ctaLabel: `Ver ${titleCase(modelo)}`,
    })
  );
}

function temaUso(stock, priority, uso, topic) {
  const slug = slugify(`${topic} ${YEAR}`);
  let filter = (v) => v.valor > 0;
  if (uso === "familia") {
    filter = (v) =>
      v.valor > 0 && /suv|sedan|minivan|utilitario/i.test(v.categoria || "");
  } else if (uso === "baixa-km") {
    filter = (v) => v.valor > 0 && v.km > 0 && v.km <= 60000;
  } else if (uso === "cidade") {
    filter = (v) => v.valor > 0 && /hatch|sedan/i.test(v.categoria || "");
  } else if (uso === "viagem") {
    filter = (v) => v.valor > 0 && /suv|sedan/i.test(v.categoria || "");
  }
  const cars = stock.cars.filter(filter);
  if (cars.length < 2) return null;
  return wrap(
    priority,
    buildUsoArticle({
      slug,
      uso,
      cars: featuredCars(cars, () => true),
      hashStr,
      ctaHref: "/seminovos",
      ctaLabel: "Ver estoque",
    })
  );
}

function pushTema(pool, tema) {
  if (tema) pool.push(tema);
}

function buildPool(stock) {
  const pool = [];
  let p = 100;
  pool.push(temaPrecos(stock, p++));
  pool.push(temaChecklist(stock, p++));
  pool.push(
    temaRegional(stock, p++, {
      topic: "seminovos vale dos sinos estoque e procedencia",
      region: "Vale dos Sinos",
      cities: ["São Leopoldo", "Novo Hamburgo", "Campo Bom", "Estância Velha"],
      angle: "estoque",
    })
  );
  pool.push(
    temaRegional(stock, p++, {
      topic: "comprar seminovo a distancia serra gaucha",
      region: "Serra Gaúcha",
      cities: ["Caxias do Sul", "Bento Gonçalves", "Farroupilha"],
      angle: "remoto",
    })
  );
  // Regionais extras (não cobertos por manuais Vale dos Sinos / Grande POA distância)
  pool.push(
    temaRegional(stock, p++, {
      topic: "seminovos grande porto alegre estoque e procedencia",
      region: "Grande Porto Alegre",
      cities: ["Porto Alegre", "Canoas", "Gravataí", "Cachoeirinha"],
      angle: "estoque",
    })
  );
  pool.push(
    temaRegional(stock, p++, {
      topic: "seminovos vale do cai procedencia",
      region: "Vale do Caí",
      cities: ["Montenegro", "São Sebastião do Caí", "Harmonia"],
      angle: "estoque",
    })
  );
  pool.push(
    temaRegional(stock, p++, {
      topic: "seminovos paranhana igrejinha taquara",
      region: "Paranhana",
      cities: ["Igrejinha", "Taquara", "Parobé"],
      angle: "estoque",
    })
  );
  pool.push(
    temaRegional(stock, p++, {
      topic: "comprar seminovo a distancia litoral norte rs",
      region: "Litoral Norte RS",
      cities: ["Tramandaí", "Capão da Canoa", "Osório"],
      angle: "remoto",
    })
  );

  if (stock.topMarca) pool.push(temaMarca(stock.topMarca.name, stock, p++));
  if (stock.topCategoria) pool.push(temaCategoria(stock.topCategoria.name, stock, p++));
  pool.push(temaPrimeiroCarro(stock, p++));
  pool.push(temaTroca(p++));
  pool.push(temaAutomatico(stock, p++));

  // Faixas de preço (evita 100 mil — overlap com SUV manual)
  pushTema(pool, temaFaixa(stock, p++, 60000, "60 mil"));
  pushTema(pool, temaFaixa(stock, p++, 80000, "80 mil"));
  pushTema(pool, temaFaixa(stock, p++, 120000, "120 mil"));
  pushTema(pool, temaFaixa(stock, p++, 150000, "150 mil"));

  // Uso / intenção
  pushTema(pool, temaUso(stock, p++, "familia", "carro familia seminovo esteio"));
  pushTema(pool, temaUso(stock, p++, "baixa-km", "seminovo baixa km esteio"));
  pushTema(pool, temaUso(stock, p++, "cidade", "hatch seminovo cidade esteio"));
  pushTema(pool, temaUso(stock, p++, "viagem", "seminovo para viagem serra rs"));

  for (const [name] of stock.marcas.slice(1)) {
    pool.push(temaMarca(name, stock, p++));
  }
  for (const [name] of stock.categorias.slice(1)) {
    pool.push(temaCategoria(name, stock, p++));
  }
  for (const [name] of stock.modelos || []) {
    pushTema(pool, temaModelo(stock, p++, name));
  }

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
  const modelos = tally("modelo").filter(([, c]) => c >= MIN_MODELO_COUNT);
  const cars = v.map((x) => ({
    id: x.id,
    placa: x.placa,
    marca: (x.marca || "").trim(),
    modelo: (x.modelo || "").trim(),
    ano: x.ano,
    ano_fabricacao: x.ano_fabricacao,
    valor: Number(x.valor) || 0,
    valor_formatado: x.valor_formatado,
    km: Number(x.km) || 0,
    cambio: (x.cambio || "").trim(),
    combustivel: (x.combustivel || "").trim(),
    categoria: (x.categoria || "").trim(),
    capa: (x.imagens_site && (x.imagens_site.capa || x.imagens_site.capa_opengraph)) || null,
    destaque:
      Array.isArray(x.diferenciais) && x.diferenciais[0] ? x.diferenciais[0].descricao : null,
  }));
  return {
    total: v.length,
    minPrice: prices.length ? Math.min(...prices) : 30000,
    maxPrice: prices.length ? Math.max(...prices) : 150000,
    marcas,
    categorias,
    modelos,
    cars,
    topMarca: marcas[0] ? { name: marcas[0][0], count: marcas[0][1] } : null,
    topCategoria: categorias[0] ? { name: categorias[0][0], count: categorias[0][1] } : null,
  };
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return fallback;
  }
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
  const topicBlock = readTopicBlocklist();
  const existing = readJson(OUT, []);
  const existingBySlug = new Map(existing.map((p) => [p.slug, p]));

  // Pool completo (sem manuais) atualiza posts já publicados.
  // Blocklist só impede TEMA NOVO com intenção colidente.
  const pool = buildPool(stock).filter((t) => !manualSlugs.has(t.slug));
  const poolForNew = pool.filter((t) => !topicBlock.has(t.slug));

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
    poolForNew.slice(0, INITIAL_BATCH).forEach((tema, i) => {
      out.push(finalize(tema, daysAgo(i * 4)));
    });
    console.log(`Primeira execução: ${out.length} posts iniciais.`);
  } else {
    let added = 0;
    for (const tema of pool) {
      if (existingBySlug.has(tema.slug)) {
        out.push(finalize(tema, existingBySlug.get(tema.slug).publishedAt));
      }
    }
    for (const tema of poolForNew) {
      if (!existingBySlug.has(tema.slug) && added < MAX_NEW_PER_RUN) {
        out.push(finalize(tema, today()));
        added++;
      }
    }
    console.log(`Rodada: ${added} tema(s) novo(s) publicado(s), ${out.length} no total.`);
  }

  out.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const json = JSON.stringify(out, null, 2) + "\n";
  const wrote = writeTextFile(OUT, json);
  const pendentes = poolForNew.filter((t) => !out.some((p) => p.slug === t.slug)).length;
  console.log(
    `Blog: ${out.length} publicados | ${pendentes} pauta(s) na fila | estoque ${stock.total}${wrote ? "" : " (sem alteração no arquivo)"}.`
  );
}

main().catch((err) => {
  console.error("Erro ao gerar blog:", err);
  process.exit(0);
});
