import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
let server;
let parseVehicleBrandOrigin;
let hasVehicleBrandOrigin;
let hasChineseBrandOrigin;

before(async () => {
  server = await createServer({
    root,
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
    logLevel: "error",
    resolve: { alias: { "@": resolve(root, "src") } },
  });
  ({ parseVehicleBrandOrigin, hasVehicleBrandOrigin, hasChineseBrandOrigin } =
    await server.ssrLoadModule("/src/lib/vehicleBrandOrigin.ts"));
});

after(async () => server?.close());

test("German, Italian and Chinese genders, plurals and country names share origins", () => {
  const phrases = {
    german: [
      "carro alemão?",
      "alemao",
      "marca alemã",
      "carros alemães",
      "marcas alemãs",
      "carro da Alemanha",
      "origem Alemanha",
    ],
    italian: [
      "carro italiano?",
      "marca italiana",
      "carros italianos",
      "marcas italianas",
      "carro da Itália",
      "da Italia",
      "origem Itália",
    ],
    chinese: [
      "chinês",
      "chines",
      "chinesa",
      "chineses",
      "chinesas",
      "carro da China",
      "marcas chinesas",
    ],
  };
  for (const [origin, queries] of Object.entries(phrases)) {
    for (const query of queries) {
      const parsed = parseVehicleBrandOrigin(query);
      assert.equal(parsed.brandOrigin, origin, query);
      assert.deepEqual(parsed.excludedBrandOrigins, [], query);
      assert.equal(parsed.invalid, false, query);
      assert.equal(parsed.remaining.replace(/[\s?]+/g, ""), "", query);
    }
  }
});

test("all supported origin exclusions use explicit lists without a generic other sentinel", () => {
  for (const [origin, adjective, country] of [
    ["german", "alemão", "Alemanha"],
    ["italian", "italiano", "Itália"],
    ["chinese", "chinês", "China"],
  ]) {
    for (const query of [
      `não ${adjective}`,
      `nao-${adjective}`,
      `sem carro ${adjective}`,
      `exceto carro da ${country}`,
      `não quero um carro que seja ${adjective}`,
      `que não seja ${adjective}`,
      `${adjective} não?`,
    ]) {
      const parsed = parseVehicleBrandOrigin(query);
      assert.equal(parsed.brandOrigin, undefined, query);
      assert.deepEqual(parsed.excludedBrandOrigins, [origin], query);
      assert.equal(parsed.invalid, false, query);
    }
  }
});

test("shared or repeated negation excludes every listed origin without reversing later targets", () => {
  for (const query of [
    "sem alemães e italianos",
    "exceto marcas alemãs, marcas italianas",
    "não quero carros alemães nem italianos",
    "sem alemães ou italianos",
    "sem alemães sem italianos",
  ]) {
    const parsed = parseVehicleBrandOrigin(query);
    assert.equal(parsed.brandOrigin, undefined, query);
    assert.deepEqual(parsed.excludedBrandOrigins, ["german", "italian"], query);
    assert.equal(parsed.invalid, false, query);
  }
  const duplicate = parseVehicleBrandOrigin("sem alemão sem alemã");
  assert.deepEqual(duplicate.excludedBrandOrigins, ["german"]);
});

test("multiple positive origins and positive-negative contradictions fail closed", () => {
  for (const query of [
    "alemão italiano",
    "alemão ou italiano",
    "chinês e alemão",
    "alemão sem alemães",
    "italiano exceto italianas",
    "chineses sem chineses",
  ]) {
    assert.equal(parseVehicleBrandOrigin(query).invalid, true, query);
  }
  const compatible = parseVehicleBrandOrigin("alemão exceto italianos");
  assert.equal(compatible.brandOrigin, "german");
  assert.deepEqual(compatible.excludedBrandOrigins, ["italian"]);
  assert.equal(compatible.invalid, false);
  assert.equal(parseVehicleBrandOrigin("alemão da Alemanha").invalid, false);
});

test("postfixed negation cannot consume a following attribute or numeric limit", () => {
  for (const [adjective, origin] of [
    ["alemão", "german"],
    ["italiano", "italian"],
    ["chinês", "chinese"],
  ]) {
    for (const attribute of [
      "automático",
      "branco",
      "suv",
      "mais de 100 mil",
    ]) {
      const parsed = parseVehicleBrandOrigin(`${adjective} não ${attribute}`);
      assert.equal(parsed.brandOrigin, origin);
      assert.deepEqual(parsed.excludedBrandOrigins, []);
      assert.match(parsed.remaining, /\bnao\b/);
    }
  }
});

test("other search requirements survive origin extraction", () => {
  const parsed = parseVehicleBrandOrigin(
    "suv alemão automático até 100 mil de 2021 a 2024 até 70 mil km",
  );
  assert.equal(parsed.brandOrigin, "german");
  for (const requirement of [
    "suv",
    "automatico",
    "ate 100 mil",
    "de 2021 a 2024",
    "ate 70 mil km",
  ]) {
    assert.ok(parsed.remaining.includes(requirement), requirement);
  }
  const unknown = parseVehicleBrandOrigin("carro francês");
  assert.equal(unknown.brandOrigin, undefined);
  assert.deepEqual(unknown.excludedBrandOrigins, []);
  assert.match(unknown.remaining, /frances/);
});

test("brand-origin matching uses the explicit registry and canonical aliases", () => {
  for (const alias of ["VOLKSWAGEN", "VW", "V.W.", "V W", "Volks"]) {
    assert.equal(hasVehicleBrandOrigin(alias, "german"), true, alias);
    assert.equal(hasVehicleBrandOrigin(alias, "italian"), false, alias);
    assert.equal(hasChineseBrandOrigin(alias), false, alias);
  }
  assert.equal(hasVehicleBrandOrigin("FIAT", "italian"), true);
  assert.equal(hasVehicleBrandOrigin("FIAT", "german"), false);
  for (const brand of ["BYD", "CHERY", "CAOA CHERY"]) {
    assert.equal(hasChineseBrandOrigin(brand), true, brand);
    assert.equal(hasVehicleBrandOrigin(brand, "german"), false, brand);
    assert.equal(hasVehicleBrandOrigin(brand, "italian"), false, brand);
  }
  for (const brand of [
    "GM",
    "Chevrolet",
    "Renault",
    "Peugeot",
    "Hyundai",
    "Nissan",
    "Ford",
    "Honda",
    "Jeep",
    "Toyota",
    "Citroën",
  ]) {
    for (const origin of ["chinese", "german", "italian"]) {
      assert.equal(
        hasVehicleBrandOrigin(brand, origin),
        false,
        `${brand}: ${origin}`,
      );
    }
  }
});

test("unregistered brands are unknown even when evaluating exclusions", () => {
  for (const brand of [
    undefined,
    null,
    "",
    "DESCONHECIDA",
    "BMW",
    "constructor",
  ]) {
    for (const origin of ["chinese", "german", "italian"]) {
      assert.equal(
        hasVehicleBrandOrigin(brand, origin),
        undefined,
        `${brand}: ${origin}`,
      );
    }
    assert.equal(hasChineseBrandOrigin(brand), undefined);
  }
});
