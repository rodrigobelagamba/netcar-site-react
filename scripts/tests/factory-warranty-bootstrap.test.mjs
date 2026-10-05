import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { createServer } from "vite";
import { factoryWarrantyCatalogFromApi } from "../lib/factory-warranty-catalog.js";
import {
  readSeoBuildStockSnapshot,
  readVersionedSeoStock,
  writeSeoBuildStockSnapshot,
} from "../lib/seo-stock-cache.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const snapshots = JSON.parse(
  readFileSync(join(root, "docs/audits/factory-warranty-2026-10-03.json"), "utf8"),
).currentCatalogSnapshot;
const OriginalDate = globalThis.Date;
const originalFetch = globalThis.fetch;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const fixedNow = OriginalDate.parse("2026-10-05T12:00:00.000Z");
let server;
let toBootstrapVehicle;
let factoryWarrantyStampFor;
let factoryWarrantyMatrix;
let factoryWarrantyReviewFingerprint;
let getBootstrapVehicles;
let temporaryRoots = [];

class FixedDate extends OriginalDate {
  constructor(...args) {
    if (args.length) super(...args);
    else super(fixedNow);
  }

  static now() {
    return fixedNow;
  }
}

before(async () => {
  globalThis.fetch = async () => {
    throw new Error("Unexpected network request in warranty bootstrap test");
  };
  const generator = readFileSync(join(root, "scripts/generate-seo-assets.js"), "utf8");
  const start = generator.indexOf("function normalizeBootstrapImage(raw)");
  const end = generator.indexOf("const stockBootstrap =", start);
  assert.ok(start >= 0 && end > start, "Production bootstrap section was not found");
  // Execute the actual pure producer without running the build or fetching stock.
  // Merchandising only adds display labels; warranty normalization stays real.
  toBootstrapVehicle = runInNewContext(
    `${generator.slice(start, end)}\ntoBootstrapVehicle;`,
    {
      SITE: "https://www.netcarmultimarcas.com.br",
      resolveVehicleMerchandising: () => ({ priority: 0 }),
      factoryWarrantyCatalogFromApi,
    },
  );
  server = await createServer({
    root,
    configFile: false,
    envFile: false,
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    logLevel: "error",
    resolve: { alias: { "@": resolve(root, "src") } },
    define: {
      "import.meta.env.DEV": "false",
      "import.meta.env.VITE_WARRANTY_PREVIEW": JSON.stringify("0"),
    },
  });
  ({ factoryWarrantyStampFor, factoryWarrantyMatrix } = await server.ssrLoadModule(
    "/src/lib/factoryWarrantyStamp.ts",
  ));
  ({ factoryWarrantyReviewFingerprint } = await server.ssrLoadModule(
    "/src/lib/factoryWarranty.ts",
  ));
  ({ getBootstrapVehicles } = await server.ssrLoadModule(
    "/src/lib/stockBootstrap.ts",
  ));
});

beforeEach(() => {
  globalThis.Date = FixedDate;
});

afterEach(() => {
  globalThis.Date = OriginalDate;
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
  for (const directory of temporaryRoots) rmSync(directory, { recursive: true, force: true });
  temporaryRoots = [];
});

after(async () => {
  await server?.close();
  globalThis.Date = OriginalDate;
  globalThis.fetch = originalFetch;
});

function catalogVehicle(id = "19587") {
  const vehicle = snapshots.find((entry) => entry.id === id);
  assert.ok(vehicle, `Missing reviewed catalog fixture ${id}`);
  return structuredClone(vehicle);
}

function apiVehicle(changes = {}, id = "19587") {
  const vehicle = catalogVehicle(id);
  return {
    id: vehicle.id,
    marca: vehicle.marca,
    modelo: vehicle.modelo,
    ano: vehicle.year,
    ano_fabricacao: vehicle.anoFabricacao,
    km: vehicle.km,
    valor: vehicle.price,
    diferenciais: vehicle.diferenciais,
    opcionais: [],
    imagens: { thumb: [], full: [] },
    ...changes,
  };
}

const jsonRoundTrip = (value) => JSON.parse(JSON.stringify(value));
const bootstrap = (vehicle) => jsonRoundTrip(toBootstrapVehicle(vehicle));

function assertVerified(vehicle, expectedYear) {
  const stamp = factoryWarrantyStampFor(vehicle);
  assert.ok(stamp, "Expected the reviewed unit to retain its stamp");
  assert.equal(stamp.estimatedEndYear, expectedYear);
  assert.equal(stamp.mode, "verified");
}

function temporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), "netcar-warranty-bootstrap-"));
  temporaryRoots.push(directory);
  return directory;
}

function browserBootstrapVehicle(vehicle) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { __NETCAR_STOCK__: { scope: "available", vehicles: [vehicle] } },
  });
  const vehicles = getBootstrapVehicles();
  assert.equal(vehicles?.length, 1);
  return vehicles[0];
}

function versionedSnapshotRoundTrip(vehicle) {
  const directory = temporaryDirectory();
  mkdirSync(join(directory, "public", "seo"), { recursive: true });
  writeFileSync(
    join(directory, "public", "seo", "stock-bootstrap.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), vehicles: [vehicle] }),
  );
  const versioned = readVersionedSeoStock(directory);
  assert.ok(versioned);
  assert.equal(versioned.vehicles.length, 1);
  writeSeoBuildStockSnapshot(directory, versioned.vehicles, {
    source: versioned.source,
    sourceAgeMs: versioned.ageMs,
  });
  const snapshot = readSeoBuildStockSnapshot(directory);
  assert.ok(snapshot);
  assert.equal(snapshot.vehicles.length, 1);
  return bootstrap(snapshot.vehicles[0]);
}

for (const [id, year] of [
  ["20066", 2027],
  ["19994", 2027],
  ["20038", 2029],
  ["19857", 2028],
  ["19587", 2028],
]) {
  test(`${id}: producer, JSON and versioned/build caches preserve approved warranty`, () => {
    const source = apiVehicle({}, id);
    const produced = bootstrap(source);
    assert.equal(produced.year, source.ano);
    assert.equal(produced.km, source.km);
    assert.equal(produced.factoryWarrantyVehicle.year, source.ano);
    assert.equal(produced.factoryWarrantyVehicle.km, source.km);
    assertVerified(produced, year);
    const cached = versionedSnapshotRoundTrip(produced);
    assert.deepEqual(cached.factoryWarrantyVehicle, produced.factoryWarrantyVehicle);
    assertVerified(cached, year);
  });
}

for (const [label, changes] of [
  ["missing MY", { ano: undefined }],
  ["null MY", { ano: null }],
  ["zero MY", { ano: 0 }],
  ["NaN MY", { ano: Number.NaN }],
  ["string MY", { ano: "2026" }],
  ["changed MY", { ano: 2025 }],
  ["missing FAB", { ano_fabricacao: undefined }],
  ["changed FAB", { ano_fabricacao: 2024 }],
  ["missing mileage", { km: undefined }],
  ["null mileage", { km: null }],
  ["invalid mileage", { km: Number.NaN }],
  ["new ID", { id: "new-xml-unit" }],
  ["removed warranty flag", { diferenciais: [] }],
]) {
  test(`${label} remains blocked after producer, JSON and cache roundtrip`, () => {
    const produced = bootstrap(apiVehicle(changes));
    // Simulate the valid visual props that must never repair original fields.
    const presentation = { ...produced, year: 2026, anoFabricacao: 2025, km: 6700 };
    assert.equal(factoryWarrantyStampFor(presentation), undefined);
    const cached = versionedSnapshotRoundTrip(presentation);
    assert.equal(factoryWarrantyStampFor(cached), undefined);
  });
}

for (const [label, projection] of [
  ["null", null],
  ["undefined", undefined],
  ["array", []],
  ["scalar", false],
  ["different ID", { ...catalogVehicle(), id: "another-unit" }],
]) {
  test(`existing ${label} projection never falls back to valid presentation`, () => {
    const presented = { ...catalogVehicle(), factoryWarrantyVehicle: projection };
    assert.equal(factoryWarrantyStampFor(presented), undefined);
    const produced = bootstrap(apiVehicle({ factoryWarrantyVehicle: projection }));
    assert.ok(Object.hasOwn(produced, "factoryWarrantyVehicle"));
    assert.equal(factoryWarrantyStampFor(produced), undefined);
    assert.equal(factoryWarrantyStampFor(versionedSnapshotRoundTrip(produced)), undefined);
  });
}

test("producer and snapshot whitelist exclude administrative fields from API and reused projection", () => {
  const administrative = {
    chassi: "SYNTHETIC-NOT-PUBLIC",
    renavam: "SYNTHETIC-NOT-PUBLIC",
    observacoes: "SYNTHETIC-NOT-PUBLIC",
    internalTestField: "SYNTHETIC-NOT-PUBLIC",
  };
  const source = apiVehicle({
    ...administrative,
    factoryWarrantyVehicle: { ...catalogVehicle(), ...administrative },
  });
  const produced = bootstrap(source);
  assert.deepEqual(Object.keys(produced.factoryWarrantyVehicle).sort(), [
    "anoFabricacao", "diferenciais", "id", "km", "marca", "modelo", "price", "year",
  ]);
  assert.doesNotMatch(JSON.stringify(produced), /SYNTHETIC-NOT-PUBLIC|internalTestField|evidence/);
  assertVerified(produced, 2028);
  const directory = temporaryDirectory();
  writeSeoBuildStockSnapshot(directory, [source], { source: "test-api" });
  const snapshot = readSeoBuildStockSnapshot(directory);
  assert.ok(snapshot);
  assert.deepEqual(snapshot.vehicles[0].factoryWarrantyVehicle, produced.factoryWarrantyVehicle);
  assert.doesNotMatch(
    readFileSync(join(directory, ".devops", "seo-build-stock.json"), "utf8"),
    /SYNTHETIC-NOT-PUBLIC|internalTestField|chassi|renavam|observacoes|evidence/,
  );
});

test("real browser bootstrap reader preserves a new original warranty projection", () => {
  const produced = bootstrap(apiVehicle());
  const loaded = browserBootstrapVehicle(produced);
  assert.deepEqual(loaded.factoryWarrantyVehicle, produced.factoryWarrantyVehicle);
  assertVerified(loaded, 2028);
});

test("real browser bootstrap reader marks legacy HTML data as unknown", () => {
  const legacy = bootstrap(apiVehicle());
  delete legacy.factoryWarrantyVehicle;
  const loaded = browserBootstrapVehicle(legacy);
  assert.equal(loaded.factoryWarrantyVehicle, null);
  assert.equal(factoryWarrantyStampFor(loaded), undefined);
});

test("legacy versioned bootstrap without original projection remains explicitly blocked", () => {
  const legacy = bootstrap(apiVehicle());
  delete legacy.factoryWarrantyVehicle;
  const cached = versionedSnapshotRoundTrip(legacy);
  assert.equal(cached.factoryWarrantyVehicle, null);
  assert.equal(factoryWarrantyStampFor(cached), undefined);
});

test("reviewed km=0 requires original zero even when bootstrap presentation defaults to zero", () => {
  const index = factoryWarrantyMatrix.records.findIndex(
    (record) => record.vehicle.vehicleId === "19587",
  );
  assert.notEqual(index, -1);
  const original = factoryWarrantyMatrix.records[index];
  const zeroMileageRecord = structuredClone(original);
  zeroMileageRecord.reviewedMileageKm = 0;
  zeroMileageRecord.approvedFingerprint = factoryWarrantyReviewFingerprint(zeroMileageRecord);
  factoryWarrantyMatrix.records[index] = zeroMileageRecord;
  try {
    const knownZero = bootstrap(apiVehicle({ km: 0 }));
    assert.equal(knownZero.km, 0);
    assertVerified(knownZero, 2028);
    assertVerified(browserBootstrapVehicle(knownZero), 2028);
    assertVerified(versionedSnapshotRoundTrip(knownZero), 2028);
    for (const km of [undefined, null, Number.NaN, "0"]) {
      const produced = bootstrap(apiVehicle({ km }));
      assert.equal(produced.km, 0, "Existing presentation fallback stays unchanged");
      assert.equal(factoryWarrantyStampFor(produced), undefined);
      assert.equal(factoryWarrantyStampFor(browserBootstrapVehicle(produced)), undefined);
      assert.equal(factoryWarrantyStampFor(versionedSnapshotRoundTrip(produced)), undefined);
    }
    const legacyZero = { ...knownZero };
    delete legacyZero.factoryWarrantyVehicle;
    const browserLegacy = browserBootstrapVehicle(legacyZero);
    assert.equal(browserLegacy.factoryWarrantyVehicle, null);
    assert.equal(factoryWarrantyStampFor(browserLegacy), undefined);
    const cachedLegacy = versionedSnapshotRoundTrip(legacyZero);
    assert.equal(cachedLegacy.factoryWarrantyVehicle, null);
    assert.equal(factoryWarrantyStampFor(cachedLegacy), undefined);
  } finally {
    factoryWarrantyMatrix.records[index] = original;
  }
});
