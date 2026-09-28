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

test("the technical detail list labels manufacturing/model year separately", () => {
  assert.match(page, /const year = vehicle\.year \|\| 0;/);
  assert.match(page, /anoDisplay && \{ label: "Ano\/modelo:", value: anoDisplay \}/);
});

// Exercise the actual display expression without mounting this data-heavy page.
const technicalExpression = page.match(/const anoDisplay =\s*([\s\S]*?);/);
assert.ok(technicalExpression, "technical year display must exist");
const technicalYear = new Function("vehicle", "year", `return (${technicalExpression[1]});`);

for (const [name, vehicle, expected] of [
  ["different years", { anoFabricacao: 2023, year: 2024 }, "2023 / 2024"],
  ["same years", { anoFabricacao: 2024, year: 2024 }, "2024 / 2024"],
  ["model year without manufacturing year", { year: 2024 }, "2024"],
  ["missing model year", { anoFabricacao: 2023 }, ""],
  ["missing both years", {}, ""],
]) {
  test(`technical summary handles ${name} without inventing a year`, () => {
    assert.equal(technicalYear(vehicle, vehicle.year || 0), expected);
  });
}

test("the model year is labeled Modelo rather than Ano", () => {
  assert.match(page, />\s*Modelo\s*<\/span>/);
  assert.doesNotMatch(page, />\s*Ano\s*<\/span>/);
});
