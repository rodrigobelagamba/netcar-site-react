import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { modelLanding, priceLanding } from "../generate-landings.js";
import { MODEL_BUYER_GUIDES } from "../lib/model-buyer-guides.mjs";

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
  assert.equal(landing.indexable, false);
  const content = JSON.stringify(editorialContent(landing));
  assert.doesNotMatch(content, /nenhum[a]? unidade|não há uma unidade/i);
  assert.match(content, /Jeep Compass/);
});

test("model index thresholds stay intact while copy survives stock rotation", () => {
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
  const configs = [
    compass,
    { slug: "hyundai-creta", marca: "HYUNDAI", modelo: "CRETA", name: "Hyundai Creta" },
    { slug: "nissan-kicks", marca: "NISSAN", modelo: "KICKS", name: "Nissan Kicks" },
  ];
  const comparisons = JSON.parse(readFileSync(new URL("../../src/data/seo/comparisons.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(MODEL_BUYER_GUIDES).sort(), configs.map(({ slug }) => slug).sort());
  for (const config of configs) {
    const empty = modelLanding(config, []);
    const stocked = modelLanding(config, [
      vehicle({ marca: config.marca, modelo: config.modelo, valor: 123456, ano: 2023 }),
      vehicle({ marca: config.marca, modelo: config.modelo, valor: 167890, ano: 2026 }),
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
