import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, afterEach, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import {
  factoryWarrantyCatalogFromApi,
  factoryWarrantyUnitKey,
} from "../../src/lib/factoryWarrantyCatalog.js";
import { factoryWarrantyCatalogFromApi as buildProjection } from "../lib/factory-warranty-catalog.js";

// Synthetic identifiers only: no real inventory identifiers in these fixtures.
const VIN = "9BWZZZ377VT004251";
const cacheDir = mkdtempSync(resolve(tmpdir(), "warranty-catalog-vite-"));
const OTHER_VIN = "9BWZZZ377VT004252";
const OBSERVED_AT = 1_800_000_000_000;
const fixture = (changes = {}) => ({
  id: "42",
  marca: "TEST",
  modelo: "VERSION A",
  motor: "1.0 TURBO",
  cambio: "AUTOMÁTICO",
  ano: 2025,
  ano_fabricacao: 2024,
  km: 12_345,
  valor: 100_000,
  chassi: VIN,
  placa: "ABC1D23",
  renavam: "ADMINISTRATIVE-TEST",
  observacoes: "PRIVATE-TEST",
  diferenciais: [
    { tag: "garantia_fabrica", descricao: "Untrusted description" },
  ],
  opcionais: [],
  imagens: { thumb: [], full: [] },
  ...changes,
});
const roundTrip = (value) => JSON.parse(JSON.stringify(value));

test("VIN is normalized, SHA-256 hashed and preferred to plate", () => {
  const expected = `vin-sha256:${createHash("sha256").update(VIN).digest("hex")}`;
  assert.equal(factoryWarrantyUnitKey(fixture()), expected);
  assert.equal(
    factoryWarrantyUnitKey(
      fixture({ chassi: ` ${VIN.toLowerCase()} `, placa: "XYZ9A99" }),
    ),
    expected,
  );
  assert.notEqual(
    factoryWarrantyUnitKey(fixture({ chassi: OTHER_VIN })),
    expected,
  );
});

test("full plate is accepted only when VIN is absent, never when present but invalid", () => {
  const plateKey = factoryWarrantyUnitKey(fixture({ chassi: null }));
  assert.match(plateKey, /^plate-sha256:[a-f0-9]{64}$/);
  assert.equal(
    factoryWarrantyUnitKey(fixture({ chassi: "", placa: " abc1d23 " })),
    plateKey,
  );
  assert.equal(
    factoryWarrantyUnitKey(fixture({ chassi: null, placa: "ABC-1234" })),
    factoryWarrantyUnitKey(fixture({ chassi: null, placa: "ABC1234" })),
  );
  for (const chassi of [
    "SHORT",
    "9BWZZZ377VT00425I",
    "9BWZZZ377VT00425O",
    "9BWZZZ377VT00425Q",
    123,
  ])
    assert.equal(factoryWarrantyUnitKey(fixture({ chassi })), undefined);
  for (const placa of ["ABC****", "ABC1D**", "ABC 1234", "AB12345", "", null])
    assert.equal(
      factoryWarrantyUnitKey(fixture({ chassi: null, placa })),
      undefined,
    );
});

test("the shared projection retains engine/transmission and excludes administrative fields", () => {
  const source = fixture();
  const projection = factoryWarrantyCatalogFromApi(source, {
    observedAt: OBSERVED_AT,
  });
  assert.equal(buildProjection, factoryWarrantyCatalogFromApi);
  assert.equal(projection.motor, source.motor);
  assert.equal(projection.cambio, source.cambio);
  assert.equal(projection.observedAt, OBSERVED_AT);
  assert.deepEqual(projection.diferenciais, [
    { tag: "garantia_fabrica", descricao: "" },
  ]);
  assert.deepEqual(Object.keys(projection).sort(), [
    "anoFabricacao",
    "cambio",
    "diferenciais",
    "id",
    "km",
    "marca",
    "modelo",
    "motor",
    "observedAt",
    "price",
    "unitKey",
    "year",
  ]);
  assert.doesNotMatch(
    JSON.stringify(projection),
    /chassi|placa|renavam|observacoes|PRIVATE|ADMINISTRATIVE|Untrusted/,
  );
  assert.ok(!JSON.stringify(projection).includes(VIN));
  assert.ok(!JSON.stringify(projection).includes(source.placa));
});

test("missing and malformed source numbers never acquire presentation defaults", () => {
  for (const unknown of [undefined, null, "2025", NaN, Infinity]) {
    const projection = factoryWarrantyCatalogFromApi(
      fixture({
        ano: unknown,
        ano_fabricacao: unknown,
        km: unknown,
        valor: unknown,
        motor: null,
        cambio: null,
      }),
    );
    for (const field of [
      "year",
      "anoFabricacao",
      "km",
      "price",
      "motor",
      "cambio",
      "observedAt",
    ])
      assert.equal(projection[field], undefined, field);
  }
  assert.equal(factoryWarrantyCatalogFromApi(fixture({ km: 0 })).km, 0);
  for (const observedAt of ["1800000000000", -1, 0, NaN, Infinity, 1.5])
    assert.equal(
      factoryWarrantyCatalogFromApi(fixture(), { observedAt }).observedAt,
      undefined,
    );
});

test("cache/build round trips preserve observation time instead of refreshing old evidence", () => {
  const original = factoryWarrantyCatalogFromApi(fixture(), {
    observedAt: OBSERVED_AT,
  });
  const cached = fixture({
    chassi: undefined,
    factoryWarrantyVehicle: roundTrip(original),
  });
  assert.deepEqual(
    factoryWarrantyCatalogFromApi(cached, { observedAt: OBSERVED_AT + 60_000 }),
    original,
  );
  const legacy = { ...original };
  delete legacy.observedAt;
  assert.equal(
    factoryWarrantyCatalogFromApi(
      { ...cached, factoryWarrantyVehicle: legacy },
      {
        observedAt: OBSERVED_AT,
      },
    ).observedAt,
    undefined,
  );
  assert.equal(factoryWarrantyCatalogFromApi(fixture()).observedAt, undefined);
});

test("reused IDs and changed originals cannot inherit a preserved warranty snapshot", () => {
  const original = factoryWarrantyCatalogFromApi(fixture(), {
    observedAt: OBSERVED_AT,
  });
  for (const changes of [
    { id: "43" },
    { chassi: OTHER_VIN },
    { chassi: "INVALID" },
    { modelo: "VERSION B" },
    { marca: "OTHER" },
    { motor: "2.0" },
    { cambio: "MANUAL" },
    { ano: 2026 },
    { ano_fabricacao: 2025 },
    { km: 13_000 },
    { valor: 0 },
    { diferenciais: [] },
  ]) {
    assert.equal(
      factoryWarrantyCatalogFromApi(
        fixture({ ...changes, factoryWarrantyVehicle: original }),
      ),
      null,
    );
  }
  for (const factoryWarrantyVehicle of [null, undefined, [], false])
    assert.equal(
      factoryWarrantyCatalogFromApi(fixture({ factoryWarrantyVehicle })),
      null,
    );
});

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const originalFetch = globalThis.fetch;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
let server;
let endpoints;
let responsePayload;
let requests = [];
before(async () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { setTimeout, clearTimeout },
  });
  globalThis.fetch = async (url, options) => {
    requests.push({ url: new URL(url), options });
    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  server = await createServer({
    root,
    cacheDir,
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
    logLevel: "silent",
    resolve: { alias: { "@": resolve(root, "src") } },
  });
  endpoints = await server.ssrLoadModule("/src/catalog/endpoints/vehicles.ts");
});
afterEach(() => {
  requests = [];
});
after(async () => {
  await server?.close();
  rmSync(cacheDir, { recursive: true, force: true });
  globalThis.fetch = originalFetch;
  if (originalWindow)
    Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

test("live list and detail responses use the original projection and bypass HTTP cache", async () => {
  responsePayload = { success: true, data: [fixture()], total_results: 1 };
  const before = Date.now();
  const [listed] = await endpoints.fetchVehicles();
  const detailed = await endpoints.fetchVehicleById("42");
  const after = Date.now();
  for (const vehicle of [listed, detailed]) {
    assert.equal(
      vehicle.factoryWarrantyVehicle.unitKey,
      factoryWarrantyUnitKey(fixture()),
    );
    assert.equal(vehicle.factoryWarrantyVehicle.km, 12_345);
    assert.ok(vehicle.factoryWarrantyVehicle.observedAt >= before);
    assert.ok(vehicle.factoryWarrantyVehicle.observedAt <= after);
    assert.doesNotMatch(
      JSON.stringify(vehicle),
      /chassi|renavam|observacoes|PRIVATE|ADMINISTRATIVE/,
    );
    assert.ok(!JSON.stringify(vehicle).includes(VIN));
  }
  assert.equal(requests.length, 2);
  assert.ok(requests.every(({ options }) => options.cache === "no-store"));
});

test("fresh API reads cannot upgrade embedded stale projections or mismatched IDs", async () => {
  const projection = factoryWarrantyCatalogFromApi(fixture(), {
    observedAt: OBSERVED_AT,
  });
  responsePayload = {
    success: true,
    data: [fixture({ factoryWarrantyVehicle: projection })],
  };
  assert.equal(
    (await endpoints.fetchVehicleById("42")).factoryWarrantyVehicle.observedAt,
    OBSERVED_AT,
  );
  responsePayload = { success: true, data: [fixture({ id: "43" })] };
  await assert.rejects(endpoints.fetchVehicleById("42"), /identidade inválida/);
  responsePayload = { success: false, data: [] };
  await assert.rejects(endpoints.fetchVehicles(), /resposta inválida/);
});
