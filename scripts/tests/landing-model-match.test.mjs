import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createServer } from "vite";
import { matchesLandingModel } from "../../src/lib/landingModelMatch.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fixtures = [
  ["FOX CONNECT", "FOX", "VOLKSWAGEN", true],
  ["CROSSFOX", "FOX", "VOLKSWAGEN", false],
  ["HB20 COMFORT", "HB20", "HYUNDAI", true],
  ["HB20S COMFORT", "HB20", "HYUNDAI", false],
  ["HB20X STYLE", "HB20", "HYUNDAI", false],
  ["HONDA HR-V EX", "HRV", "HONDA", true],
  ["HR.V EXL", "HR V", "HONDA", true],
  ["WRV EX", "WR-V", "HONDA", true],
  ["TCROSS HIGHLINE", "T CROSS", "VOLKSWAGEN", true],
  ["T-CROSS SENSE", "TCROSS", "VOLKSWAGEN", true],
  ["TIGGO5X PRO", "TIGGO 5X", "CHERY", true],
  ["TIGGO 5 X PRO", "TIGGO5X", "CHERY", true],
  ["TIGGO 5X PRO", "TIGGO 5", "CHERY", false],
  ["TIGGO 8", "TIGGO 7", "CHERY", false],
  ["C4 CACTUS SHINE PACK", "C4 CACTUS", "CITROEN", true],
  ["C4 LOUNGE", "C4 CACTUS", "CITROEN", false],
  ["SONG PLUS DM I", "SONG PLUS", "BYD", true],
  ["SONG PRO", "SONG PLUS", "BYD", false],
  ["2008 ALLURE", "2008", "PEUGEOT", true],
  ["FOCUS 2008", "2008", "FORD", false],
  ["POLO TRACK FIRST EDITION", "POLO", "VOLKSWAGEN", true],
  ["POLO TRACK FIRST EDITION", "POLO TRACK", "VOLKSWAGEN", true],
  ["POLO HIGHLINE TURBO", "POLO TRACK", "VOLKSWAGEN", false],
  ["Citroën C3 TENDANCE", "C3", "CITROEN", true],
  [undefined, "HB20", "HYUNDAI", false],
  ["HB20", "", "HYUNDAI", false],
];

let server;
let matchesLandingFilters;
let getBootstrapVehicles;

before(async () => {
  server = await createServer({
    root,
    // The matcher is independent of generated navigation metadata. A clean
    // checkout runs these tests before the stock-backed landings generator.
    plugins: [{
      name: "isolated-landing-navigation",
      enforce: "pre",
      resolveId(source, importer) {
        if (source === "./landings.json" && importer?.endsWith("/src/data/seo/index.ts")) return "\0test-landing-navigation";
      },
      load(id) { if (id === "\0test-landing-navigation") return "export default []"; },
    }],
    configFile: false,
    envFile: false,
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    logLevel: "error",
    resolve: { alias: { "@": resolve(root, "src") } },
  });
  ({ matchesLandingFilters } = await server.ssrLoadModule(
    "/src/data/seo/index.ts",
  ));
  ({ getBootstrapVehicles } = await server.ssrLoadModule(
    "/src/lib/stockBootstrap.ts",
  ));
});

after(async () => {
  await server?.close();
});

test("model families require a leading whole name and accept explicit spacing aliases", () => {
  for (const [value, filter, brand, expected] of fixtures) {
    assert.equal(
      matchesLandingModel(value, filter, brand),
      expected,
      `${value} / ${filter}`,
    );
  }
});

test("the brand fallback does not remove unrelated leading words", () => {
  assert.equal(matchesLandingModel("HONDA HRV EX", "HRV", "JEEP"), false);
  assert.equal(
    matchesLandingModel("PROCURANDO FOX", "FOX", "VOLKSWAGEN"),
    false,
  );
});

test("landing selection keeps brand and category boundaries on top of model matching", () => {
  const onixHatch = {
    marca: "CHEVROLET",
    modelo: "ONIX LTZ",
    categoria: "HATCH",
    price: 50000,
  };
  const onixPlus = {
    marca: "CHEVROLET",
    modelo: "ONIX PREMIER PLUS TURBO",
    categoria: "SEDAN",
    price: 100000,
  };
  const hatchFilters = {
    marca: "CHEVROLET",
    modelo: "ONIX",
    categoria: "HATCH",
  };
  const sedanFilters = {
    marca: "CHEVROLET",
    modelo: "ONIX",
    categoria: "SEDAN",
  };
  assert.equal(matchesLandingFilters(onixHatch, hatchFilters), true);
  assert.equal(matchesLandingFilters(onixPlus, hatchFilters), false);
  assert.equal(matchesLandingFilters(onixHatch, sedanFilters), false);
  assert.equal(matchesLandingFilters(onixPlus, sedanFilters), true);
  assert.equal(
    matchesLandingFilters({ ...onixHatch, marca: "FORD" }, hatchFilters),
    false,
  );
  assert.equal(
    matchesLandingFilters(
      { marca: "HONDA", name: "Honda HR-V EX", price: 80000 },
      { marca: "HONDA", modelo: "HRV" },
    ),
    true,
  );
});

test("the initial stock snapshot applies the same family boundary as the landing", () => {
  const bootstrap = {
    scope: "showroom",
    vehicles: [
      {
        id: "hatch",
        marca: "HYUNDAI",
        modelo: "HB20 COMFORT",
        price: 55000,
        year: 2020,
      },
      {
        id: "sedan",
        marca: "HYUNDAI",
        modelo: "HB20S COMFORT",
        price: 60000,
        year: 2020,
      },
      {
        id: "crossover",
        marca: "HYUNDAI",
        modelo: "HB20X STYLE",
        price: 60000,
        year: 2020,
      },
      {
        id: "sold",
        marca: "HYUNDAI",
        modelo: "HB20 COMFORT",
        price: 0,
        year: 2019,
      },
    ],
  };
  assert.deepEqual(
    getBootstrapVehicles({ marca: "HYUNDAI", modelo: "HB20" }, bootstrap).map(
      ({ id }) => id,
    ),
    ["hatch"],
  );
  assert.deepEqual(
    getBootstrapVehicles(
      { marca: "HYUNDAI", modelo: "HB20", includeSold: true },
      bootstrap,
    ).map(({ id }) => id),
    ["hatch", "sold"],
  );
});

const phpAvailable =
  spawnSync("php", ["-v"], { encoding: "utf8" }).status === 0;
test(
  "PHP and JavaScript return the same family matches",
  { skip: !phpAvailable && "PHP CLI is unavailable on this machine" },
  () => {
    const source = readFileSync(
      resolve(root, "public/seo/landing-stock.php"),
      "utf8",
    );
    const normalization = source.slice(
      source.indexOf("function netcar_landing_ascii("),
      source.indexOf("function netcar_landing_vehicle_slug("),
    );
    const matching = source.slice(
      source.indexOf("function netcar_landing_model_canonical("),
      source.indexOf("function netcar_landing_matches("),
    );
    const encoded = Buffer.from(JSON.stringify(fixtures)).toString("base64");
    const input = `<?php\n${normalization}\n${matching}\n$rows = json_decode(base64_decode('${encoded}'), true);\necho json_encode(array_map(function ($r) { return netcar_landing_model_matches($r[0], $r[1], $r[2]); }, $rows));`;
    const result = spawnSync("php", [], { input, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(
      JSON.parse(result.stdout),
      fixtures.map((row) => row[3]),
    );
  },
);
