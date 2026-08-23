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
const tractionRecoverySlugs = new Set([
  "canoas",
  "nova-santa-rita",
  "sapucaia-do-sul",
  "sao-leopoldo",
  "gravatai",
  "cachoeirinha",
  "porto-alegre",
  "estancia-velha",
]);

const errors = [];
const slugs = new Set();
const normalizedFields = new Map();

function normalize(value) {
  return String(value || "")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function registerUnique(value, label) {
  const normalized = normalize(value);
  const previous = normalizedFields.get(normalized);
  if (previous) errors.push(`${label}: conteúdo duplicado de ${previous}`);
  else normalizedFields.set(normalized, label);
}

const similarityStopWords = new Set([
  "para",
  "com",
  "uma",
  "das",
  "dos",
  "que",
  "por",
  "seu",
  "sua",
  "sem",
  "netcar",
  "esteio",
  "seminovo",
  "seminovos",
  "carro",
  "carros",
  "vender",
]);

function contentTokens(city, mode) {
  const data = mode === "sell" ? city.sell : city;
  const faq = (data?.faq || []).flatMap((item) => [item.q, item.a]);
  const cityTokens = new Set(
    cities.flatMap((item) => normalize(item.name).split(" ")),
  );
  return new Set(
    [data?.intro, ...(data?.paragraphs || []), ...faq]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/)
      .filter(
        (word) =>
          word.length > 2 &&
          !similarityStopWords.has(word) &&
          !cityTokens.has(word),
      ),
  );
}

function jaccardSimilarity(left, right) {
  const intersection = [...left].filter((word) => right.has(word)).length;
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}

for (const city of cities) {
  const prefix = city.slug || city.name || "cidade sem identificação";

  if (!city.slug || !city.name)
    errors.push(`${prefix}: slug/name obrigatórios`);
  if (slugs.has(city.slug)) errors.push(`${prefix}: slug duplicado`);
  slugs.add(city.slug);

  if (!Number.isFinite(city.distanceKm) || city.distanceKm <= 0) {
    errors.push(`${prefix}: distanceKm inválido`);
  }
  if (!city.travelTime) errors.push(`${prefix}: travelTime obrigatório`);
  if (!city.regionName || !city.routeNote || !city.visitPlanning) {
    errors.push(
      `${prefix}: região, rota e planejamento de visita obrigatórios`,
    );
  }
  if (city.routeOrigins !== undefined) {
    if (!Array.isArray(city.routeOrigins) || city.routeOrigins.length < 2) {
      errors.push(`${prefix}: routeOrigins exige ao menos 2 pontos de saída`);
    } else {
      const originIds = new Set();
      for (const origin of city.routeOrigins) {
        if (!origin?.id || !origin?.label || !origin?.query) {
          errors.push(`${prefix}: ponto de saída incompleto em routeOrigins`);
        }
        if (originIds.has(origin?.id)) {
          errors.push(`${prefix}: id duplicado em routeOrigins (${origin.id})`);
        }
        originIds.add(origin?.id);
      }
    }
  }
  if (!city.title || !city.description || !city.h1 || !city.intro) {
    errors.push(`${prefix}: metadados/copy de compra incompletos`);
  }
  if (!Array.isArray(city.paragraphs) || city.paragraphs.length < 2) {
    errors.push(`${prefix}: mínimo de 2 parágrafos de compra`);
  }
  if (!Array.isArray(city.faq) || city.faq.length < 2) {
    errors.push(`${prefix}: mínimo de 2 FAQs de compra`);
  }
  if (tractionRecoverySlugs.has(city.slug)) {
    if (
      !city.contentHeading ||
      !normalize(city.contentHeading).includes(normalize(city.name))
    ) {
      errors.push(
        `${prefix}: recuperação regional exige H2 editorial com a cidade`,
      );
    }
    if (city.paragraphs.length < 4 || city.faq.length < 4) {
      errors.push(
        `${prefix}: recuperação regional exige 4 parágrafos e 4 FAQs`,
      );
    }
    if (
      String(city.description).length < 135 ||
      String(city.description).length > 165
    ) {
      errors.push(
        `${prefix}: description de recuperação deve ter 135–165 caracteres`,
      );
    }
    if (
      !normalize(city.title).startsWith(`seminovos ${normalize(city.name)}`)
    ) {
      errors.push(
        `${prefix}: title de recuperação deve começar por Seminovos + cidade`,
      );
    }
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

  for (const [field, value] of [
    ["title compra", city.title],
    ["description compra", city.description],
    ["H1 compra", city.h1],
    ["title venda", city.sell?.title],
    ["description venda", city.sell?.description],
    ["H1 venda", city.sell?.h1],
  ]) {
    registerUnique(value, `${prefix}: ${field}`);
  }

  const cityName = normalize(city.name);
  for (const [field, value] of [
    ["title compra", city.title],
    ["description compra", city.description],
    ["H1 compra", city.h1],
    ["intro compra", city.intro],
    ["title venda", city.sell?.title],
    ["description venda", city.sell?.description],
    ["H1 venda", city.sell?.h1],
    ["intro venda", city.sell?.intro],
  ]) {
    if (!normalize(value).includes(cityName)) {
      errors.push(
        `${prefix}: ${field} precisa citar o nome completo da cidade`,
      );
    }
  }

  if (!/seminov/i.test(city.title) || !/seminov/i.test(city.h1)) {
    errors.push(
      `${prefix}: title/H1 de compra precisam declarar intenção de seminovos`,
    );
  }
  if (
    !/vender carro/i.test(city.sell?.title) ||
    !/vender carro/i.test(city.sell?.h1)
  ) {
    errors.push(
      `${prefix}: title/H1 de venda precisam declarar intenção de vender carro`,
    );
  }
  for (const [field, value] of [
    ["title compra", city.title],
    ["title venda", city.sell?.title],
  ]) {
    if (!String(value).endsWith("| Netcar")) {
      errors.push(`${prefix}: ${field} deve terminar em | Netcar`);
    }
    if (String(value).length < 35 || String(value).length > 65) {
      errors.push(`${prefix}: ${field} fora da faixa de 35–65 caracteres`);
    }
  }
  for (const [field, value] of [
    ["H1 compra", city.h1],
    ["H1 venda", city.sell?.h1],
  ]) {
    if (/netcar|esteio/i.test(String(value))) {
      errors.push(`${prefix}: ${field} não deve disputar marca/Esteio`);
    }
  }
  if (/netcar(?: multimarcas)? esteio|netcar em esteio/i.test(city.title)) {
    errors.push(
      `${prefix}: title de compra mistura intenção regional com Netcar Esteio`,
    );
  }
  if (
    /netcar(?: multimarcas)? esteio|netcar em esteio/i.test(
      city.sell?.title || "",
    )
  ) {
    errors.push(
      `${prefix}: title de venda mistura intenção regional com Netcar Esteio`,
    );
  }

  if (
    !Array.isArray(city.relatedSlugs) ||
    city.relatedSlugs.length < 2 ||
    city.relatedSlugs.length > 4
  ) {
    errors.push(`${prefix}: relatedSlugs precisa ter de 2 a 4 cidades`);
  } else {
    const related = new Set(city.relatedSlugs);
    if (related.size !== city.relatedSlugs.length) {
      errors.push(`${prefix}: relatedSlugs contém duplicata`);
    }
    if (related.has(city.slug))
      errors.push(`${prefix}: relatedSlugs contém a própria cidade`);
  }

  const serialized = JSON.stringify(city);
  if (/Get[uú]lio Vargas/i.test(serialized)) {
    errors.push(`${prefix}: endereço incorreto; usar Av. Presidente Vargas`);
  }
  if (
    /em minutos|at[eé] 72h|melhor custo-benef[ií]cio|preços da capital|poucas lojas|20%\s*e\s*30%/i.test(
      serialized,
    )
  ) {
    errors.push(`${prefix}: afirmação comercial/local sem comprovação`);
  }
}

const priorityMarkets = cities.filter((city) => city.priorityMarket);
if (priorityMarkets.length < 4 || priorityMarkets.length > 8) {
  errors.push("priorityMarket deve selecionar entre 4 e 8 cidades próximas");
}

for (const city of cities) {
  for (const relatedSlug of city.relatedSlugs || []) {
    if (!slugs.has(relatedSlug)) {
      errors.push(`${city.slug}: relatedSlug inexistente: ${relatedSlug}`);
    }
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
