import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
let server;
let getVehicleSearchAssist;
let parseVehicleSearch;
let matchesVehicleSearch;
const vehicles = [
  {
    marca: "CHEVROLET",
    modelo: "ONIX LT",
    name: "CHEVROLET ONIX LT",
    categoria: "HATCH",
    price: 50_000,
    km: 40_000,
    year: 2020,
    cambio: "MANUAL",
  },
  {
    marca: "CHEVROLET",
    modelo: "ONIX PLUS LT",
    name: "CHEVROLET ONIX PLUS LT",
    categoria: "SEDAN",
    price: 70_000,
    km: 45_000,
    year: 2022,
    cambio: "AUTOMATICO",
  },
  {
    marca: "VOLKSWAGEN",
    modelo: "T-CROSS HIGHLINE",
    name: "VOLKSWAGEN T-CROSS HIGHLINE",
    categoria: "SUV",
    price: 140_000,
    km: 30_000,
    year: 2024,
    cambio: "AUTOMATICO",
  },
  {
    marca: "CHERY",
    modelo: "TIGGO 5X",
    name: "CHERY TIGGO 5X",
    categoria: "SUV",
    price: 90_000,
    km: 50_000,
    year: 2021,
    cambio: "AUTOMATICO",
  },
];

before(async () => {
  server = await createServer({
    root,
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
    logLevel: "error",
    resolve: { alias: { "@": resolve(root, "src") } },
  });
  ({ getVehicleSearchAssist } = await server.ssrLoadModule(
    "/src/lib/vehicleSearchAssist.ts",
  ));
  ({ parseVehicleSearch, matchesVehicleSearch } = await server.ssrLoadModule(
    "/src/lib/vehicleSearch.ts",
  ));
});

after(async () => server?.close());

test("an explicit mileage phrase reports the shared interpretation", () => {
  const result = getVehicleSearchAssist("50000 quilometragem", vehicles);
  assert.deepEqual(result.labels, ["Até 50.000 km"]);
  assert.equal(result.uncertain, false);
  assert.equal(result.invalid, false);
});

test("a mileage fragment completes the unit without advertising a provisional price", () => {
  const result = getVehicleSearchAssist("50000 qui", vehicles);
  const suggestion = result.suggestions.find(
    (item) => item.query === "50000 quilometragem",
  );
  assert.ok(suggestion);
  assert.equal(suggestion.label, "Até 50.000 km");
  assert.deepEqual(result.labels, []);
  assert.equal(result.uncertain, true);
  const selected = parseVehicleSearch(suggestion.query);
  assert.equal(selected.filters.kmMax, 50_000);
  assert.equal(selected.filters.priceMax, undefined);
  assert.equal(matchesVehicleSearch(vehicles[0], selected), true);
  assert.equal(
    result.suggestions.length,
    1,
    "Equivalent unit spellings share one suggestion",
  );
  const firstLetter = getVehicleSearchAssist("50000 q", vehicles);
  assert.deepEqual(firstLetter.labels, []);
  assert.equal(firstLetter.uncertain, true);
  assert.equal(firstLetter.suggestions[0].query, "50000 quilometragem");
});

test("unit completions keep brand, budget and every preceding character", () => {
  const prefix = "GM até 100 mil ";
  const result = getVehicleSearchAssist(`${prefix}50000 qui`, vehicles);
  assert.ok(result.suggestions.length);
  for (const suggestion of result.suggestions) {
    assert.ok(suggestion.query.startsWith(`${prefix}50000 `));
    const selected = parseVehicleSearch(suggestion.query);
    assert.deepEqual(selected.terms, ["chevrolet"]);
    assert.equal(selected.filters.priceMax, 100_000);
    assert.equal(selected.filters.kmMax, 50_000);
  }
});

test("isolated ambiguous amounts offer explicit price and mileage alternatives", () => {
  for (const query of ["50 mil", "até 50 mil", "50000"]) {
    const result = getVehicleSearchAssist(query, vehicles);
    assert.equal(result.uncertain, true, query);
    assert.deepEqual(result.labels, [], query);
    assert.match(
      result.guidance,
      /Por enquanto, filtro preços até R\$ 50\.000/,
    );
    assert.equal(result.suggestions.length, 2, query);
    const interpretations = result.suggestions.map((item) =>
      parseVehicleSearch(item.query),
    );
    assert.deepEqual(
      interpretations.map((item) => item.filters),
      [{ priceMax: 50_000 }, { kmMax: 50_000 }],
      query,
    );
    assert.ok(
      result.suggestions.some((item) => item.label === "Até R$ 50.000"),
    );
    assert.ok(
      result.suggestions.some((item) => item.label === "Até 50.000 km"),
    );
  }
});

test("explicit dimensions and numeric model/year names are not reinterpreted", () => {
  for (const query of [
    "até R$ 50.000",
    "50 mil reais",
    "50 mil km",
    "2020",
    "Peugeot 208",
  ]) {
    const result = getVehicleSearchAssist(query, vehicles);
    assert.ok(
      !result.suggestions.some((item) =>
        /Confirmar|máxim/.test(item.detail || ""),
      ),
      query,
    );
    assert.ok(!result.guidance?.includes("preço ou quilometragem"), query);
  }
  assert.deepEqual(
    getVehicleSearchAssist("R$ 50000 qui", vehicles).suggestions,
    [],
  );
});

test("brand and multiword model suggestions come from stock and keep constraints", () => {
  const brand = getVehicleSearchAssist("GM", vehicles).suggestions.find(
    (item) => item.query === "CHEVROLET",
  );
  assert.ok(brand);
  const models = getVehicleSearchAssist(
    "até 100 mil onix p",
    vehicles,
  ).suggestions;
  assert.ok(models.some((item) => item.query === "até 100 mil ONIX PLUS LT"));
  for (const item of models) {
    assert.equal(parseVehicleSearch(item.query).filters.priceMax, 100_000);
    assert.ok(
      vehicles.some((vehicle) => matchesVehicleSearch(vehicle, item.query)),
    );
  }
  assert.deepEqual(
    getVehicleSearchAssist("até 50 mil t-cro", vehicles).suggestions,
    [],
  );
});

test("vocabulary completions work before stock loads and preserve the prefix", () => {
  for (const [query, completion] of [
    ["até 100 mil hat", "até 100 mil Hatch"],
    ["suv aut", "suv Automático"],
    ["até 100 mil chi", "até 100 mil Chineses"],
  ]) {
    assert.ok(
      getVehicleSearchAssist(query).suggestions.some(
        (item) => item.query === completion,
      ),
      query,
    );
  }
  assert.ok(
    !getVehicleSearchAssist("suv sed").suggestions.some((item) =>
      item.query.endsWith("Sedã"),
    ),
  );
});

test("unsupported exclusions, OR and vague requests have honest guidance", () => {
  for (const query of [
    "gm ou vw",
    "sem suv",
    "não automático",
    "sem gm",
    "exceto chevrolet",
    "baixa km",
    "baixakm",
  ]) {
    const result = getVehicleSearchAssist(query, vehicles);
    assert.deepEqual(result.labels, [], query);
    assert.deepEqual(result.suggestions, [], query);
    assert.equal(result.uncertain, true, query);
    assert.ok(result.guidance, query);
  }
  const supported = getVehicleSearchAssist("sem marcas chinesas", vehicles);
  assert.equal(supported.uncertain, false);
  assert.deepEqual(supported.labels, ["Exceto marcas chinesas"]);
  assert.equal(
    getVehicleSearchAssist("menor ou igual a 50000 km").uncertain,
    false,
  );
});

test("unknown text is not presented as understood catalog data", () => {
  const result = getVehicleSearchAssist("suv batmovel até 100mil", vehicles);
  assert.equal(result.uncertain, true);
  assert.ok(result.guidance);
  assert.ok(result.labels.includes("SUV"));
  assert.ok(!result.labels.some((label) => label.startsWith("Busca:")));
  assert.deepEqual(result.suggestions, []);
  const longQuery = getVehicleSearchAssist("suv ".repeat(31), vehicles);
  assert.deepEqual(longQuery.labels, []);
  assert.deepEqual(longQuery.suggestions, []);
  assert.equal(longQuery.uncertain, true);
  assert.match(longQuery.guidance, /120 caracteres/);
});

test("store vocabulary is explained and completed without changing its limits", () => {
  for (const [query, labels] of [
    ["alemão", ["Marcas alemãs"]],
    ["carro italiano", ["Marcas italianas"]],
    ["mecânico", ["Manual"]],
    ["barato", ["Até R$ 80.000"]],
    ["mais barato", ["Até R$ 80.000"]],
    [
      "italiano mecânico barato",
      ["Marcas italianas", "Manual", "Até R$ 80.000"],
    ],
  ]) {
    const result = getVehicleSearchAssist(query, vehicles);
    assert.equal(result.uncertain, false, query);
    assert.equal(result.invalid, false, query);
    assert.deepEqual(result.labels, labels, query);
  }
  for (const [query, completion] of [
    ["alem", "Alemão"],
    ["ital", "Italiano"],
    ["mec", "Mecânico"],
    ["bar", "Barato"],
    ["sem chineses até 100 mil mec", "sem chineses até 100 mil Mecânico"],
  ]) {
    assert.ok(
      getVehicleSearchAssist(query, vehicles).suggestions.some(
        (item) => item.query === completion,
      ),
      query,
    );
  }
  const completion = getVehicleSearchAssist("sem alemães 50000 qui", vehicles)
    .suggestions[0];
  assert.ok(completion);
  assert.deepEqual(
    parseVehicleSearch(completion.query).filters.excludedBrandOrigins,
    ["german"],
  );
  assert.equal(parseVehicleSearch(completion.query).filters.kmMax, 50_000);
});

test("contradictory limits expose invalid state and no confirming suggestions", () => {
  for (const query of ["de 100 a 50 mil", "de 2025 a 2020"]) {
    const result = getVehicleSearchAssist(query, vehicles);
    assert.equal(result.invalid, true);
    assert.equal(result.uncertain, true);
    assert.deepEqual(result.labels, []);
    assert.deepEqual(result.suggestions, []);
    assert.match(result.guidance, /contradizem/);
  }
});

test("examples and catalog suggestions stay small and deduplicated", () => {
  assert.deepEqual(
    getVehicleSearchAssist("").suggestions.map((item) => item.query),
    ["Hatch", "SUV", "Automático"],
  );
  const result = getVehicleSearchAssist("on", [
    ...vehicles,
    ...vehicles,
    ...vehicles,
  ]);
  assert.ok(result.suggestions.length > 0);
  assert.ok(result.suggestions.length <= 4);
  assert.equal(
    new Set(result.suggestions.map((item) => item.query)).size,
    result.suggestions.length,
  );
});

test("prototype-like text cannot crash assistance or confirm unknown searches", () => {
  for (const term of [
    "constructor",
    "__proto__",
    "prototype",
    "hasOwnProperty",
  ]) {
    for (const suffix of ["", " 50000", " 50000 quilometragem"]) {
      const query = `${term}${suffix}`;
      let result;
      assert.doesNotThrow(() => {
        result = getVehicleSearchAssist(query, vehicles);
      }, query);
      assert.equal(result.invalid, false, query);
      assert.equal(result.uncertain, true, query);
      assert.ok(result.guidance, query);
      assert.ok(
        result.labels.every((label) => typeof label === "string"),
        query,
      );
      assert.ok(
        !result.labels.some((label) => label.startsWith("Busca:")),
        query,
      );
      assert.deepEqual(result.suggestions, [], query);
      assert.equal(
        vehicles.some((vehicle) => matchesVehicleSearch(vehicle, query)),
        false,
        query,
      );
    }
  }
});
