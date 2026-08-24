import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const projectUrl = new URL(
  "../docs/local-seo-project/project.json",
  import.meta.url,
);
const baselineUrl = new URL(
  "../docs/local-seo-project/evidencias/ranking-maps-centros-8-cidades-2026-08-23.json",
  import.meta.url,
);

const project = JSON.parse(await readFile(projectUrl, "utf8"));
const baseline = JSON.parse(await readFile(baselineUrl, "utf8"));

const CITY_NAMES = new Map([
  ["esteio", "Esteio"],
  ["sapucaia-do-sul", "Sapucaia do Sul"],
  ["canoas", "Canoas"],
  ["sao-leopoldo", "São Leopoldo"],
  ["nova-santa-rita", "Nova Santa Rita"],
  ["cachoeirinha", "Cachoeirinha"],
  ["gravatai", "Gravataí"],
  ["porto-alegre", "Porto Alegre"],
]);

const TERM_LABELS = new Map([
  ["loja-de-carros", "loja de carros"],
  ["revenda-de-veiculos", "revenda de veículos"],
  ["carros-seminovos", "carros seminovos"],
  ["carros-usados", "carros usados"],
  ["comprar-carro", "comprar carro"],
  ["veiculos-seminovos", "veículos seminovos"],
  ["loja-de-veiculos", "loja de veículos"],
  ["carros-a-venda", "carros à venda"],
]);

function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function argumentValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function mapsUrl(keyword, center) {
  const query = encodeURIComponent(keyword).replace(/%20/g, "+");
  return `https://www.google.com/maps/search/${query}/@${center.latitude},${center.longitude},13z?hl=pt-BR`;
}

function searchUrl(keyword) {
  const query = encodeURIComponent(keyword).replace(/%20/g, "+");
  return `https://www.google.com/search?q=${query}&hl=pt-BR&gl=br&pws=0`;
}

function emptyNetcarPositions() {
  return {
    loja1: null,
    loja2: null,
    notObserved: null,
  };
}

const requestedDate = argumentValue("--date") ?? new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
  throw new Error("Use --date no formato YYYY-MM-DD");
}

const requestedCity = argumentValue("--city");
const requestedCitySlug = requestedCity ? slugify(requestedCity) : null;
const outputPath = argumentValue("--output");

const terms = baseline.metadata.terms.map((term) => {
  const id = slugify(term);
  return { id, label: TERM_LABELS.get(id) ?? term };
});

const cities = baseline.cities
  .map((city) => {
    const slug = slugify(city.city);
    return {
      slug,
      name: CITY_NAMES.get(slug) ?? city.city,
      center: city.center,
    };
  })
  .filter((city) => !requestedCitySlug || city.slug === requestedCitySlug);

if (requestedCitySlug && cities.length === 0) {
  throw new Error(`Cidade não configurada: ${requestedCity}`);
}

if (new Set(terms.map((term) => term.id)).size !== terms.length) {
  throw new Error("Há termos duplicados na configuração da linha de base");
}

if (new Set(cities.map((city) => city.slug)).size !== cities.length) {
  throw new Error("Há cidades duplicadas na configuração da linha de base");
}

const queries = cities.flatMap((city) =>
  terms.map((term) => {
    const keyword = `${term.label} em ${city.name}`;
    return {
      id: `${city.slug}__${term.id}`,
      city: city.name,
      citySlug: city.slug,
      center: city.center,
      term: term.label,
      keyword,
      urls: {
        googleMaps: mapsUrl(keyword, city.center),
        googleSearch: searchUrl(keyword),
      },
      locationMethod: {
        googleMaps: `mapa aberto em ${city.center.latitude}, ${city.center.longitude}, zoom 13z`,
        googleSearch:
          "cidade explícita na consulta; confirmar a região exibida pelo Google antes de registrar o Map Pack",
      },
      mapPack: {
        top3: [],
        otherLocalResults: [],
        netcar: emptyNetcarPositions(),
        locationConfirmed: null,
      },
      googleMaps: {
        sponsoredResults: [],
        organicResults: [],
        netcar: emptyNetcarPositions(),
      },
      organic: {
        results: [],
        netcarPosition: null,
        netcarUrl: null,
      },
      competitorsToWatch: project.monitoredCompetitors?.[city.name] ?? [],
      collectedAt: null,
      notes: null,
    };
  }),
);

const expectedQueries = cities.length * terms.length;
if (queries.length !== expectedQueries) {
  throw new Error(`Esperadas ${expectedQueries} consultas; geradas ${queries.length}`);
}

const document = {
  metadata: {
    schemaVersion: 1,
    collectionDate: requestedDate,
    createdAt: new Date().toISOString(),
    timezone: "America/Sao_Paulo",
    status: "pending_collection",
    surfaces: ["Google Maps", "Map Pack", "organic"],
    device: "desktop",
    language: "pt-BR",
    zoom: "13z",
    termsPerCity: terms.length,
    cityCount: cities.length,
    queryCount: queries.length,
    rules: [
      "Registrar anúncios separadamente dos resultados orgânicos.",
      "Não preencher uma posição que não tenha sido observada.",
      "Confirmar data, horário e região exibida antes de concluir a coleta.",
      "Usar os mesmos termos, coordenadas, idioma, dispositivo e zoom da linha de base.",
    ],
  },
  queries,
};

const serialized = `${JSON.stringify(document, null, 2)}\n`;

if (outputPath) {
  const absoluteOutput = resolve(outputPath);
  await mkdir(dirname(absoluteOutput), { recursive: true });
  await writeFile(absoluteOutput, serialized, "utf8");
  console.log(
    `Template criado: ${absoluteOutput} (${queries.length} consultas, ${cities.length} cidades)`,
  );
} else {
  process.stdout.write(serialized);
}
