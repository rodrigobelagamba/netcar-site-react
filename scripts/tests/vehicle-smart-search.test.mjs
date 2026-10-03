import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
let server;
let parseVehicleSearch;
let matchesVehicleSearch;

const hatch = {
  id: "hatch",
  name: "HYUNDAI HB20 COMFORT",
  marca: "HYUNDAI",
  modelo: "HB20 COMFORT",
  categoria: "HATCH",
  year: 2022,
  price: 90_000,
  valor_formatado: "R$ 90.000,00",
  km: 45_000,
  cambio: "AUTOMÁTICO",
  combustivel: "FLEX",
  cor: "BRANCA",
  motor: "1.0",
  lugares: 5,
};

const suv = {
  ...hatch,
  id: "suv",
  name: "VOLKSWAGEN T-CROSS HIGHLINE TURBO",
  marca: "VOLKSWAGEN",
  modelo: "T-CROSS HIGHLINE TURBO",
  categoria: "SUV",
  year: 2024,
  price: 134_900,
  valor_formatado: "R$ 134.900,00",
  km: 55_000,
  cor: "PRATA",
  motor: "1.4",
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

function expectMatch(vehicle, query, expected = true) {
  assert.equal(matchesVehicleSearch(vehicle, query), expected, query);
  assert.equal(
    matchesVehicleSearch(vehicle, parseVehicleSearch(query)),
    expected,
    `${query} (pre-parsed query)`,
  );
}

test("brand aliases work in both query and catalog, including spaced initials", () => {
  for (const aliases of [
    ["Chevrolet", "GM", "G.M.", "G M", "Chevy", "General Motors"],
    ["Volkswagen", "VW", "V.W.", "V W", "Volks"],
    ["CHERY", "CAOA CHERY"],
  ]) {
    for (const marca of aliases) {
      const car = { ...suv, marca, modelo: "EXEMPLO", name: "EXEMPLO" };
      for (const query of aliases) {
        expectMatch(car, query);
        expectMatch(car, `${query} até 150 mil`);
        expectMatch(car, `${query} até 100 mil`, false);
      }
    }
  }
});

test("Chinese-brand phrases match Chery and BYD, not Asian brands in general", () => {
  for (const query of [
    "chinês",
    "chines",
    "chinesa",
    "chineses",
    "chinesas",
    "china",
    "carros chineses",
    "marcas chinesas",
    "carro da china",
  ]) {
    assert.deepEqual(parseVehicleSearch(query).labels, ["Marcas chinesas"]);
    for (const marca of ["BYD", "CHERY", "CAOA CHERY"]) {
      expectMatch({ ...suv, marca }, query);
    }
    for (const marca of [
      "HYUNDAI",
      "HONDA",
      "TOYOTA",
      "FORD",
      "VOLKSWAGEN",
      "",
      "DESCONHECIDA",
    ]) {
      expectMatch({ ...suv, marca }, query, false);
    }
  }
});

test("negated Chinese origin excludes instead of reversing the user's intent", () => {
  for (const query of [
    "não chinês",
    "nao-chines",
    "sem chineses",
    "sem carros chineses",
    "exceto marcas chinesas",
    "não quero carro chinês",
    "que nao sejam chineses",
    "chineses não",
    "não quero um carro que seja chinês",
    "não quero carros que sejam chineses",
  ]) {
    assert.deepEqual(
      parseVehicleSearch(query).labels,
      ["Exceto marcas chinesas"],
      query,
    );
    expectMatch(suv, query);
    expectMatch({ ...suv, marca: "GM" }, query);
    for (const marca of ["BYD", "CHERY", "CAOA CHERY", "", "DESCONHECIDA"]) {
      expectMatch({ ...suv, marca }, query, false);
    }
  }
  assert.equal(parseVehicleSearch("chineses sem chineses").invalid, true);
  expectMatch({ ...suv, marca: "CHERY" }, "chineses sem chineses", false);
  // A following negation belongs to its own attribute, not the brand origin.
  for (const query of [
    "chinês não automático",
    "chineses não suv",
    "chinês não branco",
  ]) {
    assert.equal(parseVehicleSearch(query).filters.brandOrigin, "chinese");
    expectMatch(suv, query, false);
    expectMatch({ ...suv, marca: "CHERY" }, query, false);
  }
});

test("brand origin never drops model, budget, year or mileage constraints", () => {
  const car = {
    ...suv,
    marca: "CHERY",
    modelo: "TIGGO 8",
    name: "CHERY TIGGO 8",
  };
  const query = "suv chines tiggo 8 até 150mil de 2021 a 2024 até 70mil km";
  expectMatch(car, query);
  for (const change of [
    { price: 150_001 },
    { km: 70_001 },
    { year: 2020 },
    { marca: "HONDA" },
    { modelo: "TIGGO 7", name: "TIGGO 7" },
  ]) {
    expectMatch({ ...car, ...change }, query, false);
  }
  expectMatch(suv, "sem chineses suv ate 150mil ate 70mil km");
  expectMatch(
    { ...suv, km: 70_001 },
    "sem chineses suv ate 150mil ate 70mil km",
    false,
  );
});

test("German and Italian origins combine with price and manual transmission", () => {
  const italian = {
    ...hatch,
    marca: "FIAT",
    modelo: "ARGO",
    name: "FIAT ARGO",
    cambio: "MANUAL",
    price: 80_000,
  };
  const german = {
    ...italian,
    marca: "VW",
    modelo: "POLO",
    name: "VOLKSWAGEN POLO",
  };
  for (const query of [
    "alemão",
    "carro alemao",
    "carros alemães",
    "alemã",
    "marcas alemas",
    "carro da Alemanha",
  ]) {
    assert.deepEqual(
      parseVehicleSearch(query).labels,
      ["Marcas alemãs"],
      query,
    );
    expectMatch(german, query);
    expectMatch(italian, query, false);
  }
  for (const query of [
    "italiano",
    "carro italiano",
    "carros italianos",
    "marcas italianas",
    "carro da Itália",
  ]) {
    assert.deepEqual(
      parseVehicleSearch(query).labels,
      ["Marcas italianas"],
      query,
    );
    expectMatch(italian, query);
    expectMatch(german, query, false);
  }
  expectMatch(italian, "italiano mecânico barato até 50mil km");
  expectMatch({ ...italian, price: 80_001 }, "italiano mecânico barato", false);
  expectMatch(
    { ...italian, cambio: "AUTOMATICO" },
    "italiano mecânico barato",
    false,
  );
  expectMatch(german, "alemão sem chineses barato");
  expectMatch(italian, "sem alemães barato");
  expectMatch(german, "sem alemães barato", false);
  expectMatch({ ...italian, marca: "DESCONHECIDA" }, "sem alemães", false);
});

test("mechanical transmission spellings mean manual, not automated manual", () => {
  for (const query of [
    "mecânico",
    "mecanico",
    "mecânica",
    "mecanicos",
    "carros mecânicos",
    "câmbio mecânico",
    "transmissão mecânica",
    "marcha manual",
    "marchas manuais",
  ]) {
    assert.deepEqual(parseVehicleSearch(query).labels, ["Manual"], query);
    for (const cambio of ["MANUAL", "MECÂNICO", "MECANICA"]) {
      expectMatch({ ...hatch, cambio }, query);
    }
    for (const cambio of [
      "AUTOMÁTICO",
      "CVT",
      "AUTOMATIZADO",
      "MANUAL AUTOMATIZADO",
      "MECÂNICO DUALOGIC",
      "",
      undefined,
    ]) {
      expectMatch({ ...hatch, cambio }, query, false);
    }
  }
});

test("cheap uses the store's inclusive 80k cap without widening other budgets", () => {
  for (const query of [
    "barato",
    "baratos",
    "carro barato",
    "carros baratos",
    "mais barato",
  ]) {
    assert.equal(parseVehicleSearch(query).filters.priceMax, 80_000, query);
    assert.deepEqual(
      parseVehicleSearch(query).labels,
      ["até R$ 80.000"],
      query,
    );
    expectMatch({ ...hatch, price: 80_000 }, query);
    for (const price of [80_001, 0, undefined])
      expectMatch({ ...hatch, price }, query, false);
  }
  for (const query of ["barato até 50 mil", "até 50 mil barato"]) {
    assert.equal(parseVehicleSearch(query).filters.priceMax, 50_000);
    expectMatch({ ...hatch, price: 50_001 }, query, false);
  }
  assert.equal(parseVehicleSearch("barato acima de 90 mil").invalid, true);
  expectMatch(
    { ...hatch, price: 75_000 },
    "hatch barato de 2020 a 2024 até 50 mil km",
  );
  expectMatch(
    { ...hatch, price: 75_000, km: 50_001 },
    "hatch barato de 2020 a 2024 até 50 mil km",
    false,
  );
});

test("body category is searchable even when absent from the model name", () => {
  for (const query of ["hatch", "HATCH", "hatches", "hatch até 100 mil"]) {
    expectMatch(hatch, query);
    expectMatch(suv, query, false);
  }
  expectMatch({ ...hatch, categoria: "SEDAN" }, "sedã");
  expectMatch(hatch, "sedã", false);
  // Respect the shared catalog correction instead of the incorrect raw field.
  expectMatch(
    { ...hatch, marca: "JEEP", modelo: "RENEGADE SPORT", categoria: "HATCH" },
    "suv",
  );
});

test("Brazilian maximum-price spellings are equivalent and inclusive", () => {
  for (const query of [
    "ate100mil",
    "até 100mil",
    "até 100 mil",
    "ate 100k",
    "até R$ 100.000,00",
    "até 100000",
  ]) {
    const parsed = parseVehicleSearch(query);
    assert.equal(parsed.filters.priceMax, 100_000, query);
    expectMatch(hatch, query);
    expectMatch({ ...hatch, price: 100_000 }, query);
    expectMatch({ ...hatch, price: 100_001 }, query, false);
  }
});

test("category, transmission, model-year, budget and mileage combine with AND", () => {
  const query = "suv automático 2021 pra cima até 150 mil até 70 mil km";
  const parsed = parseVehicleSearch(query);
  assert.equal(parsed.filters.priceMax, 150_000);
  assert.equal(parsed.filters.yearMin, 2021);
  assert.equal(parsed.filters.kmMax, 70_000);
  expectMatch(suv, query);
  for (const changed of [
    { categoria: "HATCH" },
    { cambio: "MANUAL" },
    { year: 2020 },
    { price: 150_001 },
    { km: 70_001 },
  ]) {
    expectMatch({ ...suv, ...changed }, query, false);
  }
  expectMatch({ ...suv, year: 2021, price: 150_000, km: 70_000 }, query);
});

test("price ranges propagate a shared mil suffix to both endpoints", () => {
  const query = "entre 80 e 100 mil";
  const parsed = parseVehicleSearch(query);
  assert.equal(parsed.filters.priceMin, 80_000);
  assert.equal(parsed.filters.priceMax, 100_000);
  for (const price of [80_000, 90_000, 100_000]) {
    expectMatch({ ...hatch, price }, query);
  }
  for (const price of [79_999, 100_001]) {
    expectMatch({ ...hatch, price }, query, false);
  }
});

test("20-to-50-thousand budget accepts compact spacing and omitted repeated units", () => {
  for (const query of [
    "de 20 a 50mil",
    "de 20 a 50 mil",
    "de20a50mil",
    "entre20e50mil",
    "de 20 a 50",
    "entre 20 e 50",
    "valor 20 a 50",
    "de 20 mil a 50",
    "de20k a50",
    "de 20.000 a 50.000",
  ]) {
    const parsed = parseVehicleSearch(query);
    assert.deepEqual(parsed.terms, [], query);
    assert.deepEqual(
      parsed.filters,
      { priceMin: 20_000, priceMax: 50_000 },
      query,
    );
    assert.deepEqual(parsed.labels, ["R$ 20.000 a R$ 50.000"], query);
    for (const price of [20_000, 37_900, 50_000]) {
      expectMatch({ ...hatch, price }, query);
    }
    for (const price of [19_999, 50_001]) {
      expectMatch({ ...hatch, price }, query, false);
    }
  }
});

test("range shorthand never expands literal currency, km or years into thousands", () => {
  for (const [query, filters] of [
    ["de 20 a 50 reais", { priceMin: 20, priceMax: 50 }],
    ["de R$ 20 a R$ 50", { priceMin: 20, priceMax: 50 }],
    ["de 0 a 1 real", { priceMin: 0, priceMax: 1 }],
    ["de0.02mil a0.05mil", { priceMin: 20, priceMax: 50 }],
    ["de 20 a 50 km", { kmMin: 20, kmMax: 50 }],
    ["km de20a50", { kmMin: 20, kmMax: 50 }],
    ["de 20 mil a 50 km", { kmMin: 20_000, kmMax: 50_000 }],
    ["de2018a2022", { yearMin: 2018, yearMax: 2022 }],
  ]) {
    const parsed = parseVehicleSearch(query);
    assert.deepEqual(parsed.terms, [], query);
    assert.deepEqual(parsed.filters, filters, query);
  }
  expectMatch({ ...hatch, price: 40_000 }, "de 20 a 50 reais", false);
  expectMatch({ ...hatch, km: 40_000 }, "de 20 a 50 km", false);
});

test("compact ranges preserve numeric model and other search constraints", () => {
  const query = "peugeot 208 hatch de20a50mil";
  const parsed = parseVehicleSearch(query);
  assert.deepEqual(parsed.terms, ["peugeot", "208"]);
  assert.deepEqual(parsed.filters, {
    priceMin: 20_000,
    priceMax: 50_000,
    category: "HATCH",
  });
  const peugeot = {
    ...hatch,
    marca: "PEUGEOT",
    modelo: "208 GRIFFE",
    name: "PEUGEOT 208 GRIFFE",
    price: 47_900,
  };
  expectMatch(peugeot, query);
  expectMatch({ ...peugeot, price: 50_001 }, query, false);
  expectMatch(
    { ...peugeot, modelo: "2008 ALLURE", name: "PEUGEOT 2008 ALLURE" },
    query,
    false,
  );
});

test("model-year ranges stay distinct from prices and fabrication years", () => {
  const query = "2018 a 2022";
  const parsed = parseVehicleSearch(query);
  assert.equal(parsed.filters.yearMin, 2018);
  assert.equal(parsed.filters.yearMax, 2022);
  assert.equal(parsed.filters.priceMin, undefined);
  assert.equal(parsed.filters.priceMax, undefined);
  for (const year of [2018, 2020, 2022]) {
    expectMatch({ ...hatch, year }, query);
  }
  expectMatch({ ...hatch, year: 2023, anoFabricacao: 2022 }, query, false);
  expectMatch({ ...hatch, year: 2017 }, query, false);
  expectMatch({ ...hatch, year: 2022, anoFabricacao: 2021 }, "2022");
});

test("an exact model year followed by a budget is not consumed as a price range", () => {
  for (const query of ["hatch 2020 até 100mil", "hatch ano 2020 até 100mil"]) {
    const parsed = parseVehicleSearch(query);
    assert.equal(parsed.filters.yearMin, 2020, query);
    assert.equal(parsed.filters.yearMax, 2020, query);
    assert.equal(parsed.filters.priceMax, 100_000, query);
    assert.equal(parsed.filters.priceMin, undefined, query);
    expectMatch({ ...hatch, year: 2020 }, query);
    expectMatch({ ...hatch, year: 2021 }, query, false);
    expectMatch({ ...hatch, year: 2020, price: 100_001 }, query, false);
  }
});

test("numeric Peugeot models survive a following budget expression", () => {
  for (const [model, query] of [
    ["2008", "peugeot 2008 até 100mil"],
    ["208", "peugeot 208 até100mil"],
  ]) {
    const parsed = parseVehicleSearch(query);
    assert.ok(parsed.terms.includes(model), query);
    assert.equal(parsed.filters.yearMin, undefined, query);
    assert.equal(parsed.filters.yearMax, undefined, query);
    assert.equal(parsed.filters.priceMax, 100_000, query);
    assert.equal(parsed.filters.priceMin, undefined, query);
    const peugeot = {
      ...hatch,
      marca: "PEUGEOT",
      modelo: `${model} ALLURE`,
      name: `PEUGEOT ${model} ALLURE`,
    };
    expectMatch(peugeot, query);
    expectMatch({ ...peugeot, price: 100_001 }, query, false);
    expectMatch(
      { ...hatch, marca: "PEUGEOT", modelo: "308", name: "PEUGEOT 308" },
      query,
      false,
    );
  }
});

test("an explicit old year is exact even when that number is also a model name", () => {
  const parsed = parseVehicleSearch("ano 2008");
  assert.equal(parsed.filters.yearMin, 2008);
  assert.equal(parsed.filters.yearMax, 2008);
  assert.equal(parsed.filters.priceMax, undefined);
  expectMatch({ ...hatch, year: 2008 }, "ano 2008");
  expectMatch(
    { ...hatch, modelo: "2008 ALLURE", year: 2022 },
    "ano 2008",
    false,
  );
});

test("bare mileage field values mean maximum km, never a price", () => {
  for (const query of ["km 50.000", "quilometragem 50000"]) {
    const parsed = parseVehicleSearch(query);
    assert.equal(parsed.filters.kmMax, 50_000, query);
    assert.equal(parsed.filters.priceMax, undefined, query);
    assert.equal(parsed.filters.priceMin, undefined, query);
    expectMatch({ ...suv, km: 50_000 }, query);
    expectMatch({ ...suv, km: 50_001 }, query, false);
  }
});

test("year, price and mileage constraints keep their meanings across phrase order", () => {
  for (const query of [
    "hatch 2020 até 100mil até 50mil km",
    "até 100mil hatch ano 2020 km 50.000",
    "quilometragem 50000 hatch até 100mil ano 2020",
  ]) {
    const parsed = parseVehicleSearch(query);
    assert.equal(parsed.filters.yearMin, 2020, query);
    assert.equal(parsed.filters.yearMax, 2020, query);
    assert.equal(parsed.filters.priceMax, 100_000, query);
    assert.equal(parsed.filters.kmMax, 50_000, query);
    expectMatch({ ...hatch, year: 2020, price: 100_000, km: 50_000 }, query);
    for (const changed of [
      { year: 2021 },
      { price: 100_001 },
      { km: 50_001 },
    ]) {
      expectMatch({ ...hatch, year: 2020, ...changed }, query, false);
    }
  }
});

test("a year followed by mileage does not turn the year into minimum mileage", () => {
  const query = "suv ano 2020 até 70 mil km";
  const parsed = parseVehicleSearch(query);
  assert.equal(parsed.filters.yearMin, 2020);
  assert.equal(parsed.filters.yearMax, 2020);
  assert.equal(parsed.filters.kmMax, 70_000);
  assert.equal(parsed.filters.kmMin, undefined);
  expectMatch({ ...suv, year: 2020, km: 1_000 }, query);
  expectMatch({ ...suv, year: 2020, km: 70_001 }, query, false);
  expectMatch({ ...suv, year: 2021, km: 60_000 }, query, false);
});

test("field-prefixed amounts consume repeated currency or mileage units", () => {
  for (const [query, field, max] of [
    ["valor 100mil reais", "price", 100_000],
    ["km 50mil km", "km", 50_000],
    ["quilometragem 50mil quilômetros", "km", 50_000],
  ]) {
    const parsed = parseVehicleSearch(query);
    assert.deepEqual(parsed.terms, [], query);
    assert.equal(parsed.filters[`${field}Max`], max, query);
    assert.equal(
      parsed.filters[field === "price" ? "kmMax" : "priceMax"],
      undefined,
      query,
    );
    expectMatch(hatch, query);
  }
});

test("mileage thresholds are not interpreted as vehicle prices", () => {
  for (const query of ["até 70 mil km", "até 70000 km", "até 70k km"]) {
    const parsed = parseVehicleSearch(query);
    assert.equal(parsed.filters.kmMax, 70_000, query);
    assert.equal(parsed.filters.priceMax, undefined, query);
    expectMatch({ ...suv, price: 200_000, km: 70_000 }, query);
    expectMatch({ ...suv, price: 60_000, km: 70_001 }, query, false);
  }
});

test("numbers in model names and engine sizes never become budget filters", () => {
  for (const [query, modelo] of [
    ["208", "208 GRIFFE"],
    ["2008", "2008 ALLURE"],
    ["C3", "C3 AIRCROSS"],
    ["320", "320 SPORT"],
    ["1.0", "HB20 COMFORT"],
  ]) {
    const parsed = parseVehicleSearch(query);
    assert.equal(parsed.filters.priceMin, undefined, query);
    assert.equal(parsed.filters.priceMax, undefined, query);
    expectMatch({ ...hatch, modelo, name: modelo }, query);
  }
  expectMatch(
    { ...hatch, modelo: "2008 ALLURE", name: "2008 ALLURE" },
    "208",
    false,
  );
  expectMatch({ ...hatch, motor: "1.4" }, "1.0", false);
});

test("T-Cross model search does not accidentally include Corolla Cross", () => {
  for (const query of ["T-Cross", "t cross", "VW t-cross até 150 mil"]) {
    expectMatch(suv, query);
    expectMatch(
      {
        ...suv,
        marca: "TOYOTA",
        modelo: "COROLLA CROSS",
        name: "TOYOTA COROLLA CROSS",
      },
      query,
      false,
    );
  }
});

test("brand aliases and grammatical color forms match canonical catalog values", () => {
  expectMatch(suv, "VW prata");
  expectMatch(hatch, "branco");
  expectMatch({ ...hatch, cor: "PRETA" }, "preto");
  expectMatch({ ...hatch, cor: "VERMELHA" }, "vermelho");
  expectMatch(hatch, "preto", false);
  expectMatch(hatch, "vw branco", false);
});

test("small model typos may match, but never relax budget limits", () => {
  const renegade = {
    ...suv,
    marca: "JEEP",
    modelo: "RENEGADE LONGITUDE",
    name: "JEEP RENEGADE LONGITUDE",
    price: 99_900,
  };
  expectMatch(renegade, "renegadde até 100 mil");
  expectMatch({ ...renegade, price: 100_001 }, "renegadde até 100 mil", false);
  expectMatch(suv, "renegadde até 150 mil", false);
});

test("missing, invalid or sold prices never appear as affordable vehicles", () => {
  for (const price of [undefined, null, 0, -1, NaN, Infinity]) {
    expectMatch({ ...hatch, price }, "até 100 mil", false);
  }
});

test("unknown mileage is not zero, but an explicitly recorded zero is valid", () => {
  for (const km of [undefined, null, -1, NaN, Infinity]) {
    expectMatch({ ...hatch, km }, "até 70 mil km", false);
  }
  expectMatch({ ...hatch, km: 0 }, "até 70 mil km");
});

test("empty input clears every constraint and unknown terms do not match everything", () => {
  for (const query of ["", "   ", "\n\t"]) {
    const parsed = parseVehicleSearch(query);
    assert.deepEqual(parsed.terms, []);
    assert.deepEqual(parsed.filters, {});
    assert.deepEqual(parsed.labels, []);
    expectMatch(hatch, query);
    expectMatch({ price: 0, km: null }, query);
  }
  expectMatch(hatch, "bananaxyz", false);
  expectMatch(suv, "bananaxyz até 150 mil", false);
  const parsed = parseVehicleSearch("hatch até 100 mil");
  assert.ok(Array.isArray(parsed.labels));
  assert.ok(
    parsed.labels.length > 0,
    "Recognized filters need visible explanations",
  );
});

test("prototype-like text remains an unknown term instead of creating filters", () => {
  const affordable = { ...hatch, price: 40_000, km: 10_000 };
  for (const term of [
    "constructor",
    "__proto__",
    "prototype",
    "hasOwnProperty",
  ]) {
    for (const [suffix, filters] of [
      ["", {}],
      [" 50000", { priceMax: 50_000 }],
      [" 50000 quilometragem", { kmMax: 50_000 }],
    ]) {
      const query = `${term}${suffix}`;
      const parsed = parseVehicleSearch(query);
      assert.equal(parsed.invalid, false, query);
      assert.deepEqual(parsed.filters, filters, query);
      assert.ok(parsed.terms.length > 0, `${query} retains its unknown text`);
      assert.ok(
        parsed.labels.every((label) => typeof label === "string"),
        query,
      );
      expectMatch(affordable, query, false);
    }
  }
});
