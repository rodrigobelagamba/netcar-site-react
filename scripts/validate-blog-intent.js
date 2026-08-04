#!/usr/bin/env node

/**
 * Trava de duplicação editorial do blog.
 *
 * Em 04/08/2026 o pool automático tinha 40+ posts gerados pelo mesmo template
 * trocando só a entidade (marca, categoria, modelo, faixa de preço). Entre
 * irmãos a similaridade textual chegava a 0,99. Isso não cobre 40 keywords:
 * o Google mantém uma URL e trata as outras como duplicadas, e o efeito
 * demora semanas para aparecer no Search Console — quando já custou rastreio.
 *
 * Aqui a comparação é por Jaccard de trigramas de palavras: mede quanto do
 * texto é literalmente o mesmo, que é o sinal que importa para duplicidade.
 * Título e descrição entram porque são o que o Google exibe e compara primeiro.
 *
 * Uso: node scripts/validate-blog-intent.js
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seoDir = join(__dirname, "..", "src", "data", "seo");

// Limiares medidos, não arbitrados. No blog anterior à consolidação, os 31
// pares gerados pelo template por entidade ficavam todos em 0,45 ou acima
// (o pior, seminovo-ate-80-mil contra seminovo-ate-150-mil, dava 0,900).
// No blog consolidado o par mais parecido dá 0,331 — dois regionais que
// dividem boilerplate mas respondem a regiões e intenções distintas.
// 0,45 separa os dois grupos com folga; 0,30 avisa antes de virar problema.
const FAIL_AT = 0.45;
const WARN_AT = 0.3;

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return fallback;
  }
}

function postText(post) {
  const parts = [post.title, post.description];
  for (const section of post.sections || []) {
    if (section.text) parts.push(section.text);
    if (section.items) parts.push(...section.items);
  }
  return parts
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function trigrams(words) {
  const set = new Set();
  for (let i = 0; i + 2 < words.length; i++) {
    set.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }
  return set;
}

function jaccard(a, b) {
  let shared = 0;
  for (const gram of a) if (b.has(gram)) shared++;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

const manual = readJson(join(seoDir, "blog-posts.json"), []);
const auto = readJson(join(seoDir, "blog-auto.json"), []);
const manualSlugs = new Set(manual.map((p) => p.slug));
const posts = [...manual, ...auto.filter((p) => !manualSlugs.has(p.slug))];

const grams = new Map(posts.map((post) => [post.slug, trigrams(postText(post))]));

const failures = [];
const warnings = [];
for (let i = 0; i < posts.length; i++) {
  for (let j = i + 1; j < posts.length; j++) {
    const a = posts[i].slug;
    const b = posts[j].slug;
    const score = jaccard(grams.get(a), grams.get(b));
    if (score >= FAIL_AT) failures.push({ score, a, b });
    else if (score >= WARN_AT) warnings.push({ score, a, b });
  }
}

const fmt = ({ score, a, b }) => `  ${score.toFixed(3)}  ${a}  <->  ${b}`;

for (const w of warnings.sort((x, y) => y.score - x.score)) {
  console.warn(`Aviso: posts parecidos demais\n${fmt(w)}`);
}

if (failures.length > 0) {
  console.error(
    `\nBlog: ${failures.length} par(es) de posts respondem à mesma intenção (Jaccard >= ${FAIL_AT}):`
  );
  for (const f of failures.sort((x, y) => y.score - x.score)) console.error(fmt(f));
  console.error(
    "\nDuas URLs para a mesma busca diluem o sinal em vez de cobri-lo.\n" +
      "Consolide na página mais forte e adicione o 301 em public/.htaccess.\n" +
      "Ver docs/blog-editorial.md."
  );
  process.exit(1);
}

console.log(`Blog: ${posts.length} posts, nenhuma duplicação de intenção detectada.`);
