import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
let server;
let parseVehicleSearch;
let matchesVehicleSearch;

const vehicle = {
  id: "context-fixture",
  name: "HYUNDAI CRETA COMFORT",
  marca: "HYUNDAI",
  modelo: "CRETA COMFORT",
  categoria: "SUV",
  year: 2022,
  price: 90_000,
  km: 45_000,
  cambio: "AUTOMÁTICO",
  combustivel: "FLEX",
  cor: "PRATA",
  motor: "1.0",
  lugares: 5,
};

before(async () => {
  server = await createServer({
    root,
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
    logLevel: "error",
    resolve: { alias: { "@": resolve(root, "src") } },
  });
  ({ parseVehicleSearch, matchesVehicleSearch } = await server.ssrLoadModule(
    "/src/lib/vehicleSearch.ts",
  ));
});

after(async () => {
  await server?.close();
});

function expectMatch(candidate, query, expected = true) {
  assert.equal(matchesVehicleSearch(candidate, query), expected, query);
  assert.equal(
    matchesVehicleSearch(candidate, parseVehicleSearch(query)),
    expected,
    `${query} (parsed)`,
  );
}

// A parser assertion alone can pass while leftover words reject all inventory.
// Check a real match and each numeric boundary as part of every valid phrase.
function expectFilters(query, expected) {
  const parsed = parseVehicleSearch(query);
  assert.deepEqual(parsed.filters, expected, query);
  assert.deepEqual(parsed.terms, [], `${query}: consumed words`);
  assert.ok(parsed.labels.length > 0, `${query}: visible interpretation`);
  const candidate = { ...vehicle };
  for (const field of ["price", "year", "km"]) {
    const min = expected[`${field}Min`];
    const max = expected[`${field}Max`];
    if (min != null) candidate[field] = min;
    else if (max != null) candidate[field] = max;
  }
  expectMatch(candidate, query);
  for (const field of ["price", "year", "km"]) {
    const min = expected[`${field}Min`];
    const max = expected[`${field}Max`];
    const step = field === "price" ? 0.01 : 1;
    if (min != null) {
      expectMatch({ ...candidate, [field]: min }, query);
      expectMatch({ ...candidate, [field]: min - step }, query, false);
    }
    if (max != null) {
      expectMatch({ ...candidate, [field]: max }, query);
      expectMatch({ ...candidate, [field]: max + step }, query, false);
    }
  }
}

test("short model-year notation remains a year, not price or mileage", () => {
  expectFilters("ano21", { yearMin: 2021, yearMax: 2021 });
  expectFilters("modelo de18 a22", { yearMin: 2018, yearMax: 2022 });
  expectFilters("ano20 pra cima", { yearMin: 2020 });
});

test("implicit budgets explain the default without claiming km was requested", () => {
  for (const query of ["70 mil", "70k", "até70"]) {
    assert.ok(
      parseVehicleSearch(query).hints.some(
        (hint) => hint.includes("preço") && hint.includes("km"),
      ),
      query,
    );
  }
  assert.deepEqual(parseVehicleSearch("70 mil km").hints, []);
  assert.deepEqual(parseVehicleSearch("R$70mil").hints, []);
});

test("invalid input explains the issue and never emits a NaN price label", () => {
  for (const query of [
    "até70.0.00",
    "entre70milkm e100milreais",
    "de80 a50mil",
  ]) {
    const parsed = parseVehicleSearch(query);
    assert.ok(parsed.invalid, query);
    assert.ok(parsed.hints.length, query);
    assert.ok(
      parsed.labels.every((label) => !label.includes("NaN")),
      query,
    );
  }
});

test("common category and transmission typos keep the same hard budget", () => {
  for (const query of [
    "hacth automtico até100mil",
    "hatche automatic até100mil",
  ]) {
    const parsed = parseVehicleSearch(query);
    assert.deepEqual(
      parsed.filters,
      { category: "HATCH", transmission: "automatico", priceMax: 100_000 },
      query,
    );
    assert.deepEqual(parsed.terms, [], query);
    expectMatch(
      { ...vehicle, categoria: "HATCH", cambio: "AUTOMÁTICO", price: 100_001 },
      query,
      false,
    );
  }
});

const priceMaxCases = [
  "70 mil",
  "70mil",
  "70k",
  "70K",
  "70.000",
  "70.000,00",
  "70000",
  "R$ 70.000",
  "R$70mil",
  "70 mil reais",
  "preço 70 mil",
  "preco: 70k",
  "valor 70 mil",
  "orçamento 70 mil",
  "orcamento:70000",
  "ate70mil",
  "até70k",
  "até70",
  "até 70",
];

for (const query of priceMaxCases) {
  test(`price context: ${query}`, () => {
    expectFilters(query, { priceMax: 70_000 });
    assert.ok(
      parseVehicleSearch(query).labels.some((label) =>
        /R\$\s*70\.000/.test(label),
      ),
      `${query}: show the inferred budget`,
    );
  });
}

const mileageMaxCases = [
  "70 mil km",
  "70milkm",
  "70kkm",
  "70k km",
  "70.000km",
  "70000 km",
  "70 mil kms",
  "70 mil quilômetros",
  "70 mil quilometros",
  "70 mil rodados",
  "km 70 mil",
  "km:70000",
  "kms 70 mil",
  "quilômetros 70 mil",
  "quilometragem 70 mil",
  "rodagem 70 mil",
  "até70milkm",
  "até 70kkm",
  "quilometragem até 70 mil",
  "até quilometragem 70 mil",
  "rodagem até 70 mil",
  "até 70 mil rodados",
];

for (const query of mileageMaxCases) {
  test(`mileage context: ${query}`, () => {
    expectFilters(query, { kmMax: 70_000 });
  });
}

const phraseCases = [
  [
    "suv até 100 mil com até 70 mil km",
    { category: "SUV", priceMax: 100_000, kmMax: 70_000 },
  ],
  [
    "suv até 70 mil km por até 100 mil",
    { category: "SUV", priceMax: 100_000, kmMax: 70_000 },
  ],
  ["até 70 mil km por até 100 mil", { priceMax: 100_000, kmMax: 70_000 }],
  ["valor até 100 mil km até 70 mil", { priceMax: 100_000, kmMax: 70_000 }],
  ["km até 70 mil valor até 100 mil", { priceMax: 100_000, kmMax: 70_000 }],
  ["km 70mil preço 100mil", { priceMax: 100_000, kmMax: 70_000 }],
  ["preço 100mil km 70mil", { priceMax: 100_000, kmMax: 70_000 }],
  [
    "quilometragem 70 mil por 100 mil reais",
    { priceMax: 100_000, kmMax: 70_000 },
  ],
  [
    "100 mil reais com quilometragem 70 mil",
    { priceMax: 100_000, kmMax: 70_000 },
  ],
  [
    "ano 2020 km até 70 mil orçamento até 100 mil",
    { yearMin: 2020, yearMax: 2020, kmMax: 70_000, priceMax: 100_000 },
  ],
  [
    "orçamento até 100 mil ano 2020 km até 70 mil",
    { yearMin: 2020, yearMax: 2020, kmMax: 70_000, priceMax: 100_000 },
  ],
  [
    "até 70 mil km 2020 pra cima até 100 mil",
    { yearMin: 2020, kmMax: 70_000, priceMax: 100_000 },
  ],
  [
    "2020 pra cima até 100 mil até 70 mil km",
    { yearMin: 2020, kmMax: 70_000, priceMax: 100_000 },
  ],
];

for (const [query, filters] of phraseCases) {
  test(`independent constraints: ${query}`, () =>
    expectFilters(query, filters));
}

const rangeCases = [
  ["de 20 a 50mil", { priceMin: 20_000, priceMax: 50_000 }],
  ["de20a50mil", { priceMin: 20_000, priceMax: 50_000 }],
  ["de 20 a 50", { priceMin: 20_000, priceMax: 50_000 }],
  ["km de 20 a 50 mil", { kmMin: 20_000, kmMax: 50_000 }],
  ["de 20 a 50 mil km", { kmMin: 20_000, kmMax: 50_000 }],
  [
    "km de 20 a 50 mil e valor de 80 a 100 mil",
    { kmMin: 20_000, kmMax: 50_000, priceMin: 80_000, priceMax: 100_000 },
  ],
  [
    "valor de 80 a 100 mil e km de 20 a 50 mil",
    { kmMin: 20_000, kmMax: 50_000, priceMin: 80_000, priceMax: 100_000 },
  ],
  [
    "de 80 a 100 mil reais com de 20 a 50 mil km",
    { kmMin: 20_000, kmMax: 50_000, priceMin: 80_000, priceMax: 100_000 },
  ],
  [
    "de 20 a 50 mil km por de 80 a 100 mil reais",
    { kmMin: 20_000, kmMax: 50_000, priceMin: 80_000, priceMax: 100_000 },
  ],
  [
    "ano de 2018 a 2022 e km de 20 a 50 mil",
    { yearMin: 2018, yearMax: 2022, kmMin: 20_000, kmMax: 50_000 },
  ],
  [
    "km de 20 a 50 mil ano de 2018 a 2022",
    { yearMin: 2018, yearMax: 2022, kmMin: 20_000, kmMax: 50_000 },
  ],
];

for (const [query, filters] of rangeCases) {
  test(`range context: ${query}`, () => expectFilters(query, filters));
}

const operatorCases = [
  ["no máximo 70 mil", { priceMax: 70_000 }],
  ["máximo de 70 mil", { priceMax: 70_000 }],
  ["quilometragem máxima de 70 mil", { kmMax: 70_000 }],
  ["quilometragem no máximo 70 mil", { kmMax: 70_000 }],
  ["não mais de 70 mil", { priceMax: 70_000 }],
  ["não mais de 70 mil km", { kmMax: 70_000 }],
  ["preço <= 70 mil", { priceMax: 70_000 }],
  ["<=70mil", { priceMax: 70_000 }],
  ["km <=70000", { kmMax: 70_000 }],
  ["a partir de 70 mil", { priceMin: 70_000 }],
  ["no mínimo 70 mil", { priceMin: 70_000 }],
  ["mínimo de 70 mil", { priceMin: 70_000 }],
  ["quilometragem mínima de 20 mil", { kmMin: 20_000 }],
  ["quilometragem no mínimo 20 mil", { kmMin: 20_000 }],
  ["não menos de 20 mil km", { kmMin: 20_000 }],
  ["preço >= 70 mil", { priceMin: 70_000 }],
  [">=70mil", { priceMin: 70_000 }],
  ["km >=20000", { kmMin: 20_000 }],
  ["ano >=2020", { yearMin: 2020 }],
  ["ano <=2020", { yearMax: 2020 }],
  ["2020 pra cima", { yearMin: 2020 }],
  ["2020 para baixo", { yearMax: 2020 }],
  ["70 mil para baixo", { priceMax: 70_000 }],
  ["20 mil km pra cima", { kmMin: 20_000 }],
];

for (const [query, filters] of operatorCases) {
  test(`comparison context: ${query}`, () => expectFilters(query, filters));
}

const literalCases = [
  ["20km", { kmMax: 20 }],
  ["até20km", { kmMax: 20 }],
  ["km até 20", { kmMax: 20 }],
  ["quilometragem 20", { kmMax: 20 }],
  ["R$70", { priceMax: 70 }],
  ["70 reais", { priceMax: 70 }],
  ["até R$70", { priceMax: 70 }],
  ["até 70 reais", { priceMax: 70 }],
  ["de 20 a 50 km", { kmMin: 20, kmMax: 50 }],
  ["de 20 a 50 reais", { priceMin: 20, priceMax: 50 }],
  ["de R$20 a R$50", { priceMin: 20, priceMax: 50 }],
  ["2018", { yearMin: 2018, yearMax: 2018 }],
];

for (const [query, filters] of literalCases) {
  test(`literal unit or year: ${query}`, () => expectFilters(query, filters));
}

const auditedCases = [
  ["70 mil km até 100 mil reais", { kmMax: 70_000, priceMax: 100_000 }],
  ["entre 50 mil km e 70 mil km", { kmMin: 50_000, kmMax: 70_000 }],
  ["até70mil de km", { kmMax: 70_000 }],
  [
    "preço de70mil reais a100mil reais",
    { priceMin: 70_000, priceMax: 100_000 },
  ],
  ["km70mil e100mil reais", { kmMax: 70_000, priceMax: 100_000 }],
  ["2018/2019 até70mil", { yearMin: 2019, yearMax: 2019, priceMax: 70_000 }],
  ["setenta mil km até cem mil reais", { kmMax: 70_000, priceMax: 100_000 }],
  ["2020/21", { yearMin: 2021, yearMax: 2021 }],
  ["ano2020/21", { yearMin: 2021, yearMax: 2021 }],
  ["70milrodados", { kmMax: 70_000 }],
  ["70.000km rodados", { kmMax: 70_000 }],
  ["setenta mil e quinhentos km", { kmMax: 70_500 }],
  ["cinquenta mil e quinhentos reais", { priceMax: 50_500 }],
];

for (const [query, filters] of auditedCases) {
  test(`audited numeric context: ${query}`, () =>
    expectFilters(query, filters));
}

// Each field alternates independently between a prefix and a suffix, across
// all six field orders and three ordinary separators: 6 * 8 * 3 = 144 phrases.
const fieldPhrases = {
  price: ["preço até 100 mil", "até 100 mil reais"],
  km: ["km até 70 mil", "até 70 mil km"],
  year: ["ano a partir de 2020", "2020 pra cima"],
};
const fieldOrders = [
  ["price", "km", "year"],
  ["price", "year", "km"],
  ["km", "price", "year"],
  ["km", "year", "price"],
  ["year", "price", "km"],
  ["year", "km", "price"],
];
const orderIndependentFilters = {
  priceMax: 100_000,
  kmMax: 70_000,
  yearMin: 2020,
};
const canonicalContext =
  "preço até 100 mil com km até 70 mil com ano a partir de 2020";

for (const order of fieldOrders) {
  for (const connector of [" com ", " e ", ", "]) {
    for (const priceStyle of [0, 1]) {
      for (const kmStyle of [0, 1]) {
        for (const yearStyle of [0, 1]) {
          const styles = { price: priceStyle, km: kmStyle, year: yearStyle };
          const query = order
            .map((field) => fieldPhrases[field][styles[field]])
            .join(connector);
          test(`order and unit position invariant: ${query}`, () => {
            expectFilters(query, orderIndependentFilters);
            assert.deepEqual(
              parseVehicleSearch(query).labels,
              parseVehicleSearch(canonicalContext).labels,
              `${query}: same visible interpretation`,
            );
          });
        }
      }
    }
  }
}

for (const [query, matching, different] of [
  [
    "208",
    { marca: "PEUGEOT", modelo: "208 GRIFFE", name: "PEUGEOT 208 GRIFFE" },
    { marca: "PEUGEOT", modelo: "2008 ALLURE", name: "PEUGEOT 2008 ALLURE" },
  ],
  [
    "2008",
    { marca: "PEUGEOT", modelo: "2008 ALLURE", name: "PEUGEOT 2008 ALLURE" },
    { marca: "PEUGEOT", modelo: "208 GRIFFE", name: "PEUGEOT 208 GRIFFE" },
  ],
  [
    "Peugeot 2008",
    { marca: "PEUGEOT", modelo: "2008 ALLURE", name: "PEUGEOT 2008 ALLURE" },
    { marca: "PEUGEOT", modelo: "208 GRIFFE", name: "PEUGEOT 208 GRIFFE" },
  ],
  [
    "C3",
    { marca: "CITROEN", modelo: "C3 AIRCROSS", name: "CITROEN C3 AIRCROSS" },
    { marca: "CITROEN", modelo: "C4 CACTUS", name: "CITROEN C4 CACTUS" },
  ],
  ["1.0", { motor: "1.0" }, { motor: "1.4" }],
]) {
  test(`model and engine numbers stay text: ${query}`, () => {
    const parsed = parseVehicleSearch(query);
    assert.deepEqual(parsed.filters, {}, query);
    assert.ok(parsed.terms.length > 0, query);
    expectMatch({ ...vehicle, ...matching }, query);
    expectMatch({ ...vehicle, ...different }, query, false);
  });
}

test("an ambiguous standalone short number is not silently converted to a budget", () => {
  const parsed = parseVehicleSearch("70");
  assert.deepEqual(parsed.filters, {});
  assert.deepEqual(parsed.terms, ["70"]);
  expectMatch(vehicle, "70", false);
  expectMatch({ ...vehicle, name: "VOLVO XC 70", modelo: "XC 70" }, "70");
});

for (const query of ["Nissan Maxima", "Nissan Maxima 3.5"]) {
  test(`a model named Maxima is not a maximum-price operator: ${query}`, () => {
    const parsed = parseVehicleSearch(query);
    assert.deepEqual(parsed.filters, {}, query);
    assert.ok(parsed.terms.includes("maxima"), query);
    const maxima = {
      ...vehicle,
      marca: "NISSAN",
      modelo: "MAXIMA",
      name: "NISSAN MAXIMA",
      motor: "3.5",
    };
    expectMatch(maxima, query);
    expectMatch(
      { ...maxima, modelo: "SENTRA", name: "NISSAN SENTRA" },
      query,
      false,
    );
    if (query.includes("3.5")) {
      expectMatch({ ...maxima, motor: "3.0" }, query, false);
    }
  });
}

for (const [query, brand, model, otherModel] of [
  ["Peugeot 208 a70mil", "PEUGEOT", "208", "2008"],
  ["Fiat 500 -70mil", "FIAT", "500", "UNO"],
]) {
  test(`a separator before a budget preserves a numeric model: ${query}`, () => {
    const parsed = parseVehicleSearch(query);
    assert.deepEqual(parsed.filters, { priceMax: 70_000 }, query);
    assert.deepEqual(parsed.terms, [brand.toLowerCase(), model], query);
    const matching = {
      ...vehicle,
      marca: brand,
      modelo: model,
      name: `${brand} ${model}`,
      price: 70_000,
    };
    expectMatch(matching, query);
    expectMatch({ ...matching, price: 70_000.01 }, query, false);
    expectMatch(
      { ...matching, modelo: otherModel, name: `${brand} ${otherModel}` },
      query,
      false,
    );
  });
}

for (const query of [
  "até 70,000,00",
  "até70.0.00",
  "entre70milkm e100milreais",
]) {
  test(`malformed numbers and mixed-unit ranges are visibly invalid: ${query}`, () => {
    assert.equal(parseVehicleSearch(query).invalid, true, query);
    for (const price of [1_000, 70_000, 200_000]) {
      expectMatch({ ...vehicle, price }, query, false);
    }
  });
}

for (const query of [
  "até 50 mil a partir de 80 mil",
  "a partir de 80 mil até 50 mil",
  "km no mínimo 80 mil e no máximo 50 mil km",
  "ano de 2022 a 2018",
  "de 80 a 50 mil",
  "entre 80 mil km e 50 mil km",
  "preço de100mil reais a70mil reais",
  "km acima de 80 mil e até 70 mil km por até 100 mil reais",
]) {
  test(`contradictory bounds never loosen into a match: ${query}`, () => {
    for (const candidate of [
      vehicle,
      { ...vehicle, price: 40_000, km: 40_000, year: 2018 },
      { ...vehicle, price: 60_000, km: 60_000, year: 2020 },
      { ...vehicle, price: 90_000, km: 90_000, year: 2022 },
    ]) {
      expectMatch(candidate, query, false);
    }
  });
}

for (const query of [
  "até -70 mil",
  "km até -20",
  "de -20 a 50 mil",
  "70 mil km até -100 mil reais",
  "-70 mil km até 100 mil reais",
  "entre -20 mil km e 70 mil km",
]) {
  test(`invalid negative amounts are not reinterpreted as positive: ${query}`, () => {
    for (const candidate of [
      vehicle,
      { ...vehicle, price: 40_000, km: 0 },
      { ...vehicle, price: 70_000, km: 20 },
    ]) {
      expectMatch(candidate, query, false);
    }
  });
}
