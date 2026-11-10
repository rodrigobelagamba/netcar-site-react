import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { modelLanding, priceLanding, marcaLanding } from "../generate-landings.js";
import { MODEL_BUYER_GUIDES } from "../lib/model-buyer-guides.mjs";
import { MODEL_HUBS } from "../lib/stock-model-hubs.mjs";

const compass = {
  slug: "jeep-compass",
  marca: "JEEP",
  modelo: "COMPASS",
  name: "Jeep Compass",
};

const budget = {
  slug: "automaticos-ate-100-mil",
  name: "Automáticos até R$ 100 mil",
  title: "Carros automáticos até R$ 100 mil em Esteio/RS | Netcar",
  h1: "Carros automáticos até R$ 100 mil",
  filters: { cambio: "AUTOMATICO", precoMax: 100000 },
};

function vehicle(overrides = {}) {
  return {
    marca: "JEEP",
    modelo: "COMPASS LONGITUDE",
    valor: 99000,
    ano: 2021,
    km: 42000,
    cambio: "AUTOMATICO",
    ...overrides,
  };
}

function editorialContent(landing) {
  return {
    description: landing.description,
    intro: landing.intro,
    paragraphs: landing.paragraphs,
    faq: landing.faq,
  };
}

test("one model in stock remains visible without a false sold-out message", () => {
  const landing = modelLanding(compass, [vehicle()]);
  assert.equal(landing.count, 1);
  assert.equal(landing.indexable, true);
  const content = JSON.stringify(editorialContent(landing));
  assert.doesNotMatch(content, /nenhum[a]? unidade|não há uma unidade/i);
  assert.match(content, /Jeep Compass/);
});

test("empty models are noindex and editorial copy survives stock rotation", () => {
  const empty = modelLanding(compass, []);
  const two = modelLanding(compass, [
    vehicle(),
    vehicle({ valor: 140000, ano: 2024, km: 12000 }),
    vehicle({ valor: 0 }),
    vehicle({ marca: "HONDA", modelo: "HRV" }),
  ]);
  assert.equal(empty.count, 0);
  assert.equal(empty.indexable, false);
  assert.equal(two.count, 2);
  assert.equal(two.indexable, true);
  assert.deepEqual(editorialContent(empty), editorialContent(two));
});

test("budget count requires both the price and transmission filters", () => {
  const landing = priceLanding(budget, [
    vehicle({ valor: 100000 }),
    vehicle({ valor: 100001 }),
    vehicle({ valor: 80000, cambio: "MANUAL" }),
    vehicle({ valor: 0 }),
  ]);
  assert.equal(landing.count, 1);
  assert.equal(landing.indexable, false);
  assert.deepEqual(landing.filters, budget.filters);
  assert.match(landing.paragraphs[0], /preço total anunciado/);
  assert.match(landing.paragraphs[0], /sujeita à análise de crédito/);
});

test("budget copy does not retain the count or price range from a build", () => {
  const empty = priceLanding(budget, []);
  const full = priceLanding(budget, [
    vehicle({ valor: 79900 }),
    vehicle({ valor: 89900 }),
    vehicle({ valor: 95900 }),
    vehicle({ valor: 99900 }),
  ]);
  assert.equal(full.count, 4);
  assert.equal(full.indexable, true);
  assert.equal(empty.indexable, false);
  assert.deepEqual(editorialContent(empty), editorialContent(full));
  assert.doesNotMatch(
    JSON.stringify(editorialContent(full)),
    /79\.900|99\.900|4 opções/,
  );
});

test("model guides use existing relevant comparison routes and survive stock rotation", () => {
  const configs = MODEL_HUBS;
  const comparisons = JSON.parse(readFileSync(new URL("../../src/data/seo/comparisons.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(MODEL_BUYER_GUIDES).sort(), configs.map(({ slug }) => slug).sort());
  for (const config of configs) {
    const empty = modelLanding(config, []);
    const stocked = modelLanding(config, [
      vehicle({ marca: config.marca, modelo: config.modelo, categoria: config.categoria, valor: 123456, ano: 2023 }),
      vehicle({ marca: config.marca, modelo: config.modelo, categoria: config.categoria, valor: 167890, ano: 2026 }),
    ]);
    assert.deepEqual(editorialContent(stocked), editorialContent(empty), `${config.slug}: editorial copy must not freeze a build's offers`);
    const editorial = JSON.stringify(MODEL_BUYER_GUIDES[config.slug]);
    assert.doesNotMatch(editorial, /R\$|123[.,]456|167[.,]890|\b\d+\s+(?:unidades|anúncios|carros disponíveis)\b/i);
    assert.ok(stocked.paragraphTemplates.some((paragraph) => paragraph.includes("{{years}}")), "year range must remain a live token");
    for (const link of stocked.guideLinks) {
      assert.match(link.href, /^\/comparar\/[a-z0-9-]+$/);
      const comparison = comparisons.find(({ slug }) => link.href === `/comparar/${slug}`);
      assert.ok(comparison, `Guide target must be a published comparison: ${link.href}`);
      assert.ok([comparison.left, comparison.right].some(({ brand, model }) => brand === config.marca && model === config.modelo), "linked comparison must include this model");
    }
  }
});

test("a brand with one real offer is indexable; an empty brand is not", () => {
  assert.equal(marcaLanding("BYD", 1, {}, 0).indexable, true);
  assert.equal(marcaLanding("BYD", 0, {}, 0).indexable, false);
});

test("a brand without its own guide stays out of the index even with stock", () => {
  for (const name of ["MARCA SEM GUIA", "constructor", "toString"]) {
    for (const count of [0, 1, 5]) {
      const landing = marcaLanding(name, count, {}, 0);
      assert.equal(landing.count, count);
      assert.equal(landing.indexable, false);
      assert.equal(landing.footerPriority, false);
      assert.equal(landing.filters.marca, name);
    }
  }
});

test("Onix hatch and Onix Plus remain separate even when Plus follows the version name", () => {
  const rows = [
    vehicle({ marca: "CHEVROLET", modelo: "ONIX LTZ", categoria: "HATCH" }),
    vehicle({ marca: "CHEVROLET", modelo: "ONIX PREMIER PLUS TURBO", categoria: "SEDAN" }),
  ];
  const onix = modelLanding(MODEL_HUBS.find((model) => model.slug === "chevrolet-onix"), rows);
  const plus = modelLanding(MODEL_HUBS.find((model) => model.slug === "chevrolet-onix-plus"), rows);
  assert.equal(onix.count, 1);
  assert.equal(plus.count, 1);
  assert.equal(onix.filters.categoria, "HATCH");
  assert.equal(plus.filters.categoria, "SEDAN");
});


test("Kwid selection contains only its Renault hatch family and survives no stock", () => {
  const config = MODEL_HUBS.find((model) => model.slug === "renault-kwid");
  const rows = [
    vehicle({ marca: "RENAULT", modelo: "KWID OUTSIDER", categoria: "HATCH" }),
    vehicle({ marca: "RENAULT", modelo: "KWID INTENSE", categoria: "HATCH" }),
    vehicle({ marca: "RENAULT", modelo: "KWID E-TECH", categoria: "HATCH" }),
    vehicle({ marca: "RENAULT", modelo: "SANDERO STEPWAY", categoria: "HATCH" }),
    vehicle({ marca: "OTHER", modelo: "KWID", categoria: "HATCH" }),
    vehicle({ marca: "RENAULT", modelo: "KWID", categoria: "SEDAN" }),
  ];
  const stocked = modelLanding(config, rows);
  assert.equal(stocked.count, 2);
  assert.equal(stocked.indexable, true);
  assert.deepEqual(stocked.filters, { marca: "RENAULT", modelo: "KWID", categoria: "HATCH" });
  const empty = modelLanding(config, []);
  assert.equal(empty.slug, stocked.slug);
  assert.equal(empty.indexable, false);
  assert.deepEqual(editorialContent(stocked), editorialContent(empty));
});

test("Aircross keeps its own Citroën selection without guessing C3 or C4 aliases", () => {
  const config = MODEL_HUBS.find((model) => model.slug === "citroen-aircross");
  const rows = [
    vehicle({ marca: "CITROEN", modelo: "AIRCROSS SHINE", categoria: "MINIVAN" }),
    vehicle({ marca: "CITROEN", modelo: "AIRCROSS LIVE", categoria: "SUV" }),
    vehicle({ marca: "CITROEN", modelo: "C3 AIRCROSS SHINE", categoria: "SUV" }),
    vehicle({ marca: "CITROEN", modelo: "C4 AIRCROSS", categoria: "SUV" }),
    vehicle({ marca: "CITROEN", modelo: "C4 CACTUS SHINE", categoria: "SUV" }),
    vehicle({ marca: "CITROEN", modelo: "C3 TENDANCE", categoria: "HATCH" }),
    vehicle({ marca: "OTHER", modelo: "AIRCROSS SHINE", categoria: "SUV" }),
  ];
  const stocked = modelLanding(config, rows);
  assert.equal(stocked.count, 2);
  assert.equal(stocked.indexable, true);
  assert.deepEqual(stocked.filters, { marca: "CITROEN", modelo: "AIRCROSS" });
  // The source still labels the active unit MINIVAN; a SUV link would exclude it.
  assert.equal(stocked.category, undefined);
  const empty = modelLanding(config, []);
  assert.equal(empty.slug, stocked.slug);
  assert.equal(empty.indexable, false);
  assert.deepEqual(editorialContent(stocked), editorialContent(empty));
});


test("208 and ix35 hubs preserve the exact family, brand and body style", () => {
  const cases = [
    { slug: "peugeot-208", marca: "PEUGEOT", modelo: "208", categoria: "HATCH", accepted: ["208 STYLE", "PEUGEOT 208 ALLURE"], rejected: ["2008 ALLURE", "2080"] },
    { slug: "hyundai-ix35", marca: "HYUNDAI", modelo: "IX35", categoria: "SUV", accepted: ["IX35 GL", "HYUNDAI IX35 GLS"], rejected: ["TUCSON GLS", "CRETA PLATINUM", "IX350"] },
  ];
  for (const { slug, marca, modelo, categoria, accepted, rejected } of cases) {
    const config = MODEL_HUBS.find((model) => model.slug === slug);
    const rows = [
      ...accepted.map((name) => vehicle({ marca, modelo: name, categoria })),
      ...rejected.map((name) => vehicle({ marca, modelo: name, categoria })),
      vehicle({ marca: "OTHER", modelo, categoria }),
      vehicle({ marca, modelo, categoria: "SEDAN" }),
    ];
    const stocked = modelLanding(config, rows);
    assert.equal(stocked.count, accepted.length, slug);
    assert.equal(stocked.indexable, true, slug);
    assert.deepEqual(stocked.filters, { marca, modelo, categoria });
    const empty = modelLanding(config, []);
    assert.equal(empty.slug, stocked.slug);
    assert.equal(empty.indexable, false);
    assert.deepEqual(editorialContent(stocked), editorialContent(empty));
  }
});
