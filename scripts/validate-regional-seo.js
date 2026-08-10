#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const citiesPath = path.join(root, "src/data/seo/cities.json");
const cities = JSON.parse(fs.readFileSync(citiesPath, "utf8"));

const requiredNewCities = [
  "taquara",
  "igrejinha",
  "gramado",
  "caxias-do-sul",
  "bento-goncalves",
];

const errors = [];
const slugs = new Set();
const titles = new Set();
const descriptions = new Set();
const headings = new Set();

const similarityStopWords = new Set([
  "para", "com", "uma", "das", "dos", "que", "por", "seu", "sua", "sem",
  "netcar", "esteio", "seminovo", "seminovos", "carro", "carros", "vender",
]);

function contentTokens(city, mode) {
  const data = mode === "sell" ? city.sell : city;
  const faq = (data?.faq || []).flatMap((item) => [item.q, item.a]);
  return new Set(
    [data?.intro, ...(data?.paragraphs || []), ...faq]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2 && !similarityStopWords.has(word)),
  );
}

function jaccardSimilarity(left, right) {
  const intersection = [...left].filter((word) => right.has(word)).length;
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}

for (const city of cities) {
  const prefix = city.slug || city.name || "cidade sem identificação";

  if (!city.slug || !city.name) errors.push(`${prefix}: slug/name obrigatórios`);
  if (slugs.has(city.slug)) errors.push(`${prefix}: slug duplicado`);
  slugs.add(city.slug);

  if (!Number.isFinite(city.distanceKm) || city.distanceKm <= 0) {
    errors.push(`${prefix}: distanceKm inválido`);
  }
  if (!city.travelTime) errors.push(`${prefix}: travelTime obrigatório`);
  if (!city.title || !city.description || !city.h1 || !city.intro) {
    errors.push(`${prefix}: metadados/copy de compra incompletos`);
  }
  if (!Array.isArray(city.paragraphs) || city.paragraphs.length < 2) {
    errors.push(`${prefix}: mínimo de 2 parágrafos de compra`);
  }
  if (!Array.isArray(city.faq) || city.faq.length < 2) {
    errors.push(`${prefix}: mínimo de 2 FAQs de compra`);
  }
  if (
    !city.sell?.title ||
    !city.sell?.description ||
    !city.sell?.h1 ||
    !city.sell?.intro ||
    !Array.isArray(city.sell?.paragraphs) ||
    city.sell.paragraphs.length < 2 ||
    !Array.isArray(city.sell?.faq) ||
    city.sell.faq.length < 2
  ) {
    errors.push(`${prefix}: bloco de venda incompleto`);
  }

  if (titles.has(city.title)) errors.push(`${prefix}: title duplicado`);
  titles.add(city.title);
  if (descriptions.has(city.description)) {
    errors.push(`${prefix}: description duplicada`);
  }
  descriptions.add(city.description);
  if (headings.has(city.h1)) errors.push(`${prefix}: h1 duplicado`);
  headings.add(city.h1);

  const serialized = JSON.stringify(city);
  if (/Get[uú]lio Vargas/i.test(serialized)) {
    errors.push(`${prefix}: endereço incorreto; usar Av. Presidente Vargas`);
  }
}

// Landing local precisa ter utilidade própria, não ser uma doorway page com o
// nome da cidade trocado. O limite deixa a moldura institucional se repetir,
// mas bloqueia regressões de conteúdo excessivamente semelhante.
for (let i = 0; i < cities.length; i += 1) {
  for (let j = i + 1; j < cities.length; j += 1) {
    for (const mode of ["buy", "sell"]) {
      const similarity = jaccardSimilarity(
        contentTokens(cities[i], mode),
        contentTokens(cities[j], mode),
      );
      if (similarity > 0.5) {
        errors.push(
          `${cities[i].slug}/${cities[j].slug}: conteúdo ${mode} muito semelhante (${similarity.toFixed(2)})`,
        );
      }
    }
  }
}

for (const slug of requiredNewCities) {
  if (!slugs.has(slug)) errors.push(`cidade planejada ausente: ${slug}`);
}

if (errors.length) {
  console.error("SEO regional inválido:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `SEO regional válido: ${cities.length} cidades, ${requiredNewCities.length} novas cidades verificadas.`,
);
