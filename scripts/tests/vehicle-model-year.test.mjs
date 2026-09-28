import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync(
  new URL("../../src/modules/detalhes/pages/DetalhesPage.tsx", import.meta.url),
  "utf8",
);

test("the vehicle summary displays only the model year", () => {
  assert.match(page, /const yearDisplay = vehicle\.year \? String\(vehicle\.year\) : "";/);
  assert.match(page, /year: yearDisplay/);
});

test("the technical detail list follows the same model-year-only presentation", () => {
  assert.match(page, /const year = vehicle\.year \|\| 0;/);
  assert.match(page, /const anoDisplay = year \? String\(year\) : "";/);
  assert.match(page, /anoDisplay && \{ label: "Modelo:", value: anoDisplay \}/);
});

test("manufacturing year is neither displayed nor used as model-year fallback on the main page", () => {
  assert.doesNotMatch(page, /\banoFabricacao\b/);
});

test("the model year is labeled Modelo rather than Ano", () => {
  assert.match(page, />\s*Modelo\s*<\/span>/);
  assert.doesNotMatch(page, />\s*Ano\s*<\/span>/);
});
