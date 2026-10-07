import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const audit = JSON.parse(
  readFileSync(
    resolve(root, "docs/audits/factory-warranty-2026-10-03.json"),
    "utf8",
  ),
);
const october5Audit = JSON.parse(
  readFileSync(
    resolve(root, "docs/audits/factory-warranty-2026-10-05.json"),
    "utf8",
  ),
);
const tiggoPowertrainAudit = JSON.parse(
  readFileSync(
    resolve(root, "docs/audits/factory-warranty-tiggo-powertrain-2026-10-05.json"),
    "utf8",
  ),
);
const tiggo7PowertrainAudit = JSON.parse(
  readFileSync(
    resolve(root, "docs/audits/factory-warranty-tiggo7-powertrain-2026-10-05.json"),
    "utf8",
  ),
);
const renegadeAudit = JSON.parse(
  readFileSync(
    resolve(root, "docs/audits/factory-warranty-renegade-20075-2026-10-07.json"),
    "utf8",
  ),
);
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalFetch = globalThis.fetch;
const OriginalDate = globalThis.Date;
const fixedNow = OriginalDate.parse("2026-10-05T12:00:00.000Z");
let currentNow = fixedNow;
const windowTimers = new Set();
const routerModule = "\0factory-warranty-card-test-router";
let server;
let VehicleCardStatic;
let CardsHero;
let fetchVehicles;
let factoryWarrantyMatrix;
let factoryWarrantyReviewFingerprint;
let factoryWarrantyStampFor;
let factoryTractionBatteryStampFor;
let factoryPowertrainStampFor;
let FactoryWarrantyBadge;
let FactoryWarrantyNote;
let renderer;

class FixedDate extends OriginalDate {
  constructor(...args) {
    if (args.length) super(...args);
    else super(currentNow);
  }

  static now() {
    return currentNow;
  }
}

function approvedVehicle(id = "19587") {
  const snapshot = renegadeAudit.publicVehicles.find((vehicle) => vehicle.id === id)
    ?? tiggo7PowertrainAudit.publicVehicles.find((vehicle) => vehicle.id === id)
    ?? tiggoPowertrainAudit.publicVehicles.find((vehicle) => vehicle.id === id)
    ?? october5Audit.publicVehicles.find((vehicle) => vehicle.id === id)
    ?? audit.currentCatalogSnapshot.find((vehicle) => vehicle.id === id);
  assert.ok(snapshot, `Missing reviewed catalog fixture ${id}`);
  return structuredClone(snapshot);
}

// Real card, badge, registry and resolver. Only navigation is stubbed: clicking
// or fetching outside an explicit API fixture is an error in this harness.
before(async () => {
  globalThis.fetch = async () => {
    throw new Error("Unexpected network request in factory warranty card test");
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener() {},
      removeEventListener() {},
      setTimeout(callback, delay, ...args) {
        const timer = setTimeout(() => {
          windowTimers.delete(timer);
          callback(...args);
        }, delay);
        windowTimers.add(timer);
        return timer;
      },
      clearTimeout(timer) {
        windowTimers.delete(timer);
        clearTimeout(timer);
      },
    },
  });
  server = await createServer({
    root,
    configFile: false,
    envFile: false,
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    logLevel: "error",
    resolve: {
      alias: {
        "@": resolve(root, "src"),
        "@tanstack/react-router": routerModule,
      },
    },
    plugins: [
      {
        name: "factory-warranty-card-test-navigation",
        resolveId(id) {
          if (id === routerModule) return id;
        },
        load(id) {
          if (id === routerModule) {
            return 'export function useNavigate() { return () => { throw new Error("Unexpected navigation"); }; }';
          }
        },
      },
    ],
    define: {
      "import.meta.env.DEV": "false",
      "import.meta.env.VITE_WARRANTY_PREVIEW": JSON.stringify("0"),
      "import.meta.env.VITE_SHOW_CAMPAIGN_STAMP": JSON.stringify("false"),
      "import.meta.env.VITE_API_BASE_URL": JSON.stringify("https://catalog.test/api/v1"),
    },
  });
  ({ VehicleCardStatic } = await server.ssrLoadModule(
    "/src/design-system/components/patterns/VehicleCard.tsx",
  ));
  ({ CardsHero } = await server.ssrLoadModule(
    "/src/design-system/components/patterns/CardsHero.tsx",
  ));
  ({ fetchVehicles } = await server.ssrLoadModule(
    "/src/catalog/endpoints/vehicles.ts",
  ));
  ({
    factoryWarrantyMatrix,
    factoryWarrantyStampFor,
    factoryTractionBatteryStampFor,
    factoryPowertrainStampFor,
  } = await server.ssrLoadModule(
    "/src/lib/factoryWarrantyStamp.ts",
  ));
  ({ FactoryWarrantyBadge, FactoryWarrantyNote } = await server.ssrLoadModule(
    "/src/design-system/components/patterns/FactoryWarrantyBadge.tsx",
  ));
  ({ factoryWarrantyReviewFingerprint } = await server.ssrLoadModule(
    "/src/lib/factoryWarranty.ts",
  ));
});

beforeEach(() => {
  currentNow = fixedNow;
  globalThis.Date = FixedDate;
  globalThis.fetch = async () => {
    throw new Error("Unexpected network request in factory warranty card test");
  };
});

afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  globalThis.Date = OriginalDate;
  for (const timer of windowTimers) clearTimeout(timer);
  windowTimers.clear();
});

after(async () => {
  await server?.close();
  globalThis.Date = OriginalDate;
  globalThis.fetch = originalFetch;
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

async function renderCard(raw, { base = approvedVehicle(), ...overrides } = {}) {
  // Intentionally keep valid presentation fallbacks even when raw data is
  // missing/changed. Passing these values to the gate would recreate the bug.
  const props = {
    id: raw?.id ?? base.id,
    name: `${base.marca} ${base.modelo}`,
    marca: base.marca,
    modelo: base.modelo,
    price: base.price,
    year: 2026,
    anoFabricacao: base.anoFabricacao,
    km: base.km,
    diferenciais: base.diferenciais,
    images: [],
    warrantyVehicle: raw,
    ...overrides,
  };
  await act(async () => {
    const element = React.createElement(VehicleCardStatic, props);
    if (renderer) renderer.update(element);
    else renderer = TestRenderer.create(element);
  });
  assert.equal(renderer.root.findByType(CardsHero).props.year, "2026");
}

function assertStamp(expected) {
  const badges = renderer.root.findAll(
    (node) => node.type === "div" && node.props["data-factory-warranty-badge"] === "card",
  );
  assert.equal(badges.length, expected ? 1 : 0);
  if (expected) {
    assert.equal(
      badges[0].findByType("svg").props["aria-label"],
      "Garantia de fábrica até 2028*. Ano estimado pela fabricação.",
    );
  } else {
    assert.equal(renderer.root.findByType(CardsHero).props.warrantyStamp, undefined);
  }
}

for (const compact of [false, true]) {
  for (const source of ["raw", "API"]) {
    test(`Renegade 20075: ${source} -> ${compact ? "compact" : "normal"} card shows one general 2028 stamp`, async () => {
      currentNow = OriginalDate.parse(`${renegadeAudit.reviewedAt}T12:00:00Z`);
      const base = approvedVehicle("20075");
      const raw = source === "API" ? await mappedApiVehicle("20075") : base;
      await renderCard(raw, { base, compact });
      assertStamp(true);
      const hero = renderer.root.findByType(CardsHero).props;
      assert.equal(hero.warrantyStamp.estimatedEndYear, 2028);
      assert.equal(hero.powertrainStamp, undefined);
      assert.equal(hero.tractionBatteryStamp, undefined);
    });
  }
}

for (const [label, patch] of [
  ["recycled Citroen identity", { marca: "CITROEN", modelo: "C3" }],
  ["XML-only model shorthand", { modelo: "RENEGADE LONGITUDE T270" }],
  ["another unit", { id: "another-renegade" }],
  ["changed fabrication year", { anoFabricacao: 2024 }],
  ["missing model year", { year: undefined }],
  ["regressed mileage", { km: 62044 }],
  ["missing mileage", { km: undefined }],
  ["removed warranty flag", { diferenciais: [] }],
  ["sold raw vehicle", { price: 0 }],
]) {
  test(`Renegade 20075: ${label} cannot borrow a valid presentation to display its stamp`, async () => {
    currentNow = OriginalDate.parse(`${renegadeAudit.reviewedAt}T12:00:00Z`);
    const base = approvedVehicle("20075");
    await renderCard({ ...base, ...patch }, { base });
    assertStamp(false);
  });
}

test("Renegade 20075: a recycled Citroen API row is rejected after the real mapper", async () => {
  currentNow = OriginalDate.parse(`${renegadeAudit.reviewedAt}T12:00:00Z`);
  const raw = await mappedApiVehicle("20075", { marca: "CITROEN", modelo: "C3" });
  await renderCard(raw, { base: approvedVehicle("20075") });
  assertStamp(false);
});

test("Renegade 20075: sold presentation suppresses a still-available raw unit", async () => {
  currentNow = OriginalDate.parse(`${renegadeAudit.reviewedAt}T12:00:00Z`);
  const raw = approvedVehicle("20075");
  await renderCard(raw, { base: raw, price: 0 });
  assertStamp(false);
});

test("Renegade 20075: the card hides the final-year estimate without a confirmed expiry", async () => {
  currentNow = OriginalDate.parse("2028-01-01T12:00:00Z");
  const raw = approvedVehicle("20075");
  await renderCard(raw, { base: raw });
  assertStamp(false);
});

for (const id of ["19587", "19857"]) {
  test(`real card displays the production stamp for approved unit ${id}`, async () => {
    const raw = approvedVehicle(id);
    await renderCard(raw, { base: raw });
    assertStamp(true);
  });

  for (const [label, year] of [
    ["missing", undefined],
    ["null", null],
    ["zero", 0],
    ["NaN", Number.NaN],
    ["changed", 2025],
  ]) {
    test(`${id}: ${label} raw MY cannot borrow visual year 2026`, async () => {
      const base = approvedVehicle(id);
      await renderCard({ ...base, year }, { base });
      assertStamp(false);
    });
  }
}

for (const [label, changes] of [
  ["missing FAB", { anoFabricacao: undefined }],
  ["null FAB", { anoFabricacao: null }],
  ["changed FAB", { anoFabricacao: 2024 }],
  ["missing mileage", { km: undefined }],
  ["null mileage", { km: null }],
  ["NaN mileage", { km: Number.NaN }],
  ["regressed mileage", { km: 6699 }],
  ["changed model", { modelo: "TERA OUTRA VERSAO" }],
  ["new catalog ID", { id: "new-xml-unit" }],
  ["removed warranty tag", { diferenciais: [] }],
]) {
  test(`valid presentation cannot repair ${label} in the raw unit`, async () => {
    await renderCard({ ...approvedVehicle(), ...changes });
    assertStamp(false);
  });
}

for (const [km, expected] of [[99_999, true], [100_000, false], [100_001, false]]) {
  test(`Kicks raw mileage ${km} respects the verified 100000 km cap`, async () => {
    const base = approvedVehicle("19857");
    await renderCard({ ...base, km }, { base });
    assertStamp(expected);
  });
}

test("missing warrantyVehicle never enables a stamp from visual props", async () => {
  await renderCard(undefined);
  assertStamp(false);
});

test("an approved raw unit cannot lend its stamp to another card ID", async () => {
  await renderCard(approvedVehicle(), { id: "another-card" });
  assertStamp(false);
});

test("a sold card does not display a stamp from an available raw unit", async () => {
  await renderCard(approvedVehicle(), { price: 0 });
  assertStamp(false);
});

test("an available presentation cannot repair a sold raw unit", async () => {
  await renderCard({ ...approvedVehicle(), price: 0 });
  assertStamp(false);
});

function apiVehicle(id, changes) {
  const raw = approvedVehicle(id);
  return {
    id: raw.id,
    marca: raw.marca,
    modelo: raw.modelo,
    ano: raw.year,
    ano_fabricacao: raw.anoFabricacao,
    km: raw.km,
    valor: raw.price,
    diferenciais: raw.diferenciais,
    opcionais: [],
    imagens: { thumb: [], full: [] },
    link: raw.id,
    ...changes,
  };
}

async function mappedApiVehicle(id, changes, expectedResults = 1) {
  let requests = 0;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://catalog.test");
    assert.equal(url.pathname, "/api/v1/veiculos.php");
    requests += 1;
    return new Response(
      JSON.stringify({
        success: true,
        data: [apiVehicle(id, changes)],
        total_results: 1,
        limit: 500,
        offset: 0,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  const vehicles = await fetchVehicles({ fetchAll: true });
  assert.equal(requests, 1);
  assert.equal(vehicles.length, expectedResults);
  return vehicles[0];
}

test("reviewed zero mileage still requires a known raw value despite visual km=0", async () => {
  const index = factoryWarrantyMatrix.records.findIndex(
    (record) => record.vehicle.vehicleId === "19587",
  );
  assert.notEqual(index, -1);
  const originalRecord = factoryWarrantyMatrix.records[index];
  const zeroMileageRecord = structuredClone(originalRecord);
  zeroMileageRecord.reviewedMileageKm = 0;
  zeroMileageRecord.approvedFingerprint = factoryWarrantyReviewFingerprint(zeroMileageRecord);
  // Change only the test process's imported JSON object, never the registry file.
  factoryWarrantyMatrix.records[index] = zeroMileageRecord;
  try {
    await renderCard({ ...approvedVehicle(), km: 0 }, { km: 0 });
    assertStamp(true);
    for (const km of [undefined, null, Number.NaN]) {
      await renderCard({ ...approvedVehicle(), km }, { km: 0 });
      assertStamp(false);
    }
    const mappedZero = await mappedApiVehicle("19587", { km: 0 });
    await renderCard(mappedZero, { km: 0 });
    assertStamp(true);
    for (const km of [undefined, null]) {
      const mappedMissing = await mappedApiVehicle("19587", { km });
      assert.equal(mappedMissing.km, km);
      await renderCard(mappedMissing, { km: 0 });
      assertStamp(false);
    }
  } finally {
    factoryWarrantyMatrix.records[index] = originalRecord;
  }
});

for (const [label, id, changes, expected] of [
  ["approved Tera", "19587", {}, true],
  ["approved Kicks", "19857", {}, true],
  ["omitted MY", "19587", { ano: undefined }, false],
  ["null MY", "19857", { ano: null }, false],
  ["zero MY", "19587", { ano: 0 }, false],
  ["changed MY", "19857", { ano: 2025 }, false],
  ["omitted FAB", "19587", { ano_fabricacao: undefined }, false],
  ["changed FAB", "19587", { ano_fabricacao: 2024 }, false],
  ["omitted mileage", "19587", { km: undefined }, false],
  ["null mileage", "19587", { km: null }, false],
  ["regressed mileage", "19857", { km: 8499 }, false],
  ["mileage at cap", "19857", { km: 100_000 }, false],
  ["new ID", "19587", { id: "new-xml-unit" }, false],
  ["removed warranty tag", "19587", { diferenciais: [] }, false],
]) {
  test(`API response -> real mapper -> real card: ${label}`, async () => {
    const vehicle = await mappedApiVehicle(id, changes);
    // Render exactly the mapped object as the raw prop; presentation keeps the
    // same valid fallbacks that previously concealed absent API fields.
    await renderCard(vehicle, { base: approvedVehicle(id) });
    assertStamp(expected);
  });
}

function assertBydCoverages({ general = false, battery = false } = {}) {
  const badges = renderer.root.findAll(
    (node) => node.type === "div" && node.props["data-factory-warranty-badge"] === "card",
  );
  const expected = [
    ...(general ? [{ scope: "basic-vehicle", year: 2030, label: "Garantia de fábrica até 2030*. Ano estimado pela fabricação.", visible: /GARANTIA DE FÁBRICA ATÉ 2030/ }] : []),
    ...(battery ? [{ scope: "traction-battery", year: 2032, label: "Garantia de fábrica da bateria de tração até 2032*. Ano estimado pela fabricação.", visible: /GARANTIA BATERIA DE TRAÇÃO ATÉ 2032/ }] : []),
  ];
  assert.deepEqual(
    badges.map((node) => node.props["data-warranty-scope"]).sort(),
    expected.map((item) => item.scope).sort(),
  );
  for (const item of expected) {
    const badge = badges.find((node) => node.props["data-warranty-scope"] === item.scope);
    assert.equal(badge.findByType("svg").props["aria-label"], item.label);
    const visibleText = badge.findAllByType("text").map((node) => node.children.join("")).join(" ");
    assert.match(visibleText, item.visible);
    if (item.scope === "traction-battery") assert.doesNotMatch(visibleText, /DE FÁBRICA/);
  }
  const hero = renderer.root.findByType(CardsHero).props;
  assert.equal(hero.warrantyStamp?.estimatedEndYear, general ? 2030 : undefined);
  assert.equal(hero.tractionBatteryStamp?.estimatedEndYear, battery ? 2032 : undefined);
  const notes = renderer.root.findAll(
    (node) => node.type === "p" && Object.hasOwn(node.props, "data-factory-warranty-note"),
  );
  assert.equal(notes.length, general || battery ? 1 : 0);
}

test("reviewed BYD API -> mapper -> card renders distinct general 2030 and traction battery 2032 labels", async () => {
  const raw = await mappedApiVehicle("19924");
  await renderCard(raw, { base: approvedVehicle("19924") });
  assertBydCoverages({ general: true, battery: true });
});

for (const [label, changes] of [
  ["missing MY", { year: undefined }],
  ["zero MY", { year: 0 }],
  ["NaN MY", { year: Number.NaN }],
  ["missing mileage", { km: undefined }],
  ["null mileage", { km: null }],
  ["NaN mileage", { km: Number.NaN }],
  ["missing live flag", { diferenciais: undefined }],
  ["removed live flag", { diferenciais: [] }],
  ["different raw ID", { id: "another-byd-unit" }],
  ["unverified legacy bootstrap", { factoryWarrantyVehicle: null }],
]) {
  test(`BYD ${label} suppresses both coverages despite valid presentation`, async () => {
    const base = approvedVehicle("19924");
    await renderCard({ ...base, ...changes }, { base, id: base.id });
    assertBydCoverages();
  });
}

test("reviewed BYD cannot lend either coverage to a different displayed card ID", async () => {
  const raw = approvedVehicle("19924");
  await renderCard(raw, { base: raw, id: "another-card" });
  assertBydCoverages();
});

for (const status of ["revoked", "pending"]) {
  test(`BYD ${status} supplement hides only the battery and preserves general coverage`, async () => {
    const index = factoryWarrantyMatrix.records.findIndex(
      (record) => record.vehicle.vehicleId === "19924",
    );
    assert.notEqual(index, -1);
    const originalRecord = factoryWarrantyMatrix.records[index];
    const changedRecord = structuredClone(originalRecord);
    assert.equal(changedRecord.supplementalCoverages.length, 1);
    changedRecord.supplementalCoverages[0].status = status;
    factoryWarrantyMatrix.records[index] = changedRecord;
    try {
      const raw = approvedVehicle("19924");
      await renderCard(raw, { base: raw });
      assertBydCoverages({ general: true });
    } finally {
      factoryWarrantyMatrix.records[index] = originalRecord;
    }
  });
}

test("BYD in 2031 shows only traction battery 2032, without a general warranty badge", async () => {
  currentNow = OriginalDate.parse("2031-06-01T12:00:00.000Z");
  const raw = approvedVehicle("19924");
  await renderCard(raw, { base: raw });
  assertBydCoverages({ battery: true });
});

function renderedText(node) {
  return typeof node === "string" || typeof node === "number"
    ? String(node)
    : node.children.map(renderedText).join("");
}

const tiggo8PowertrainExpectation = {
  estimatedEndYear: 2028,
  manualUrl: "https://cloudfront.alpes.one/public/6a4/69f/810/6a469f8101d3d793499526.pdf#page=298",
  manualCode: "B09999T8006",
};
const tiggo7PowertrainExpectation = {
  estimatedEndYear: 2029,
  manualUrl: "https://cloudfront.alpes.one/public/6a4/693/d01/6a4693d011f5e785772375.pdf#page=298",
  manualCode: "B09999T7303",
};

function assertTiggoPowertrain(expected, expectation = tiggo8PowertrainExpectation) {
  const badges = renderer.root.findAll(
    (node) => node.type === "div" && node.props["data-factory-warranty-badge"] === "card",
  );
  assert.deepEqual(
    badges.map((node) => node.props["data-warranty-scope"]),
    expected ? ["powertrain"] : [],
    "A Tiggo must never borrow a general or traction-battery badge",
  );
  const hero = renderer.root.findByType(CardsHero).props;
  assert.equal(hero.warrantyStamp, undefined);
  assert.equal(hero.tractionBatteryStamp, undefined);
  const captions = renderer.root.findAll(
    (node) => node.type === "p" && Object.hasOwn(node.props, "data-powertrain-label"),
  );
  const notes = renderer.root.findAll(
    (node) => node.type === "p" && Object.hasOwn(node.props, "data-factory-warranty-note"),
  );
  assert.equal(captions.length, 0);
  assert.equal(notes.length, expected ? 1 : 0);
  if (!expected) {
    assert.equal(hero.powertrainStamp, undefined);
    return;
  }

  assertPowertrainPresentation(badges[0], notes[0], hero.powertrainStamp, expectation);
}

function assertPowertrainPresentation(badge, note, stamp, { estimatedEndYear, manualUrl, manualCode }) {
  assert.equal(stamp.scope, "powertrain");
  assert.equal(stamp.estimatedEndYear, estimatedEndYear);
  assert.equal(stamp.termYears, 5);
  assert.equal(stamp.sourceUrl, manualUrl);
  assert.equal(
    badge.findByType("svg").props["aria-label"],
    `Garantia de fábrica de motor e câmbio até ${estimatedEndYear}*. Ano estimado pela fabricação.`,
  );
  const stampText = badge.findAllByType("text").map(renderedText).join(" ");
  assert.ok(stampText.includes(`GARANTIA MOTOR E CÂMBIO ATÉ ${estimatedEndYear} *`));
  assert.doesNotMatch(stampText, /BATERIA|GARANTIA DE FÁBRICA/);
  const noteText = renderedText(note);
  assert.equal(noteText, "*Ano estimado pela fabricação. Prazo original e condições conforme manual da montadora. Consultar manual.");
  assert.doesNotMatch(noteText, /bateria de tração|garantia geral/i);
  const links = note.findAllByType("a");
  assert.equal(links.length, 1);
  assert.equal(renderedText(links[0]), "Consultar manual");
  assert.equal(links[0].props.href, manualUrl);
  assert.equal(links[0].props.title, `Manual ${manualCode}`);
  assert.equal(links[0].props.target, "_blank");
  assert.deepEqual(links[0].props.rel.split(/\s+/).sort(), ["noopener", "noreferrer"]);
  let stopped = 0;
  links[0].props.onClick({ stopPropagation() { stopped += 1; } });
  assert.equal(stopped, 1, "Opening the manual must not trigger card navigation");
}

for (const [id, expectation] of [
  ["20029", tiggo8PowertrainExpectation],
  ["20041", tiggo8PowertrainExpectation],
  ["20066", tiggo7PowertrainExpectation],
]) {
  for (const compact of [false, true]) {
    for (const source of ["raw", "API"]) {
      test(`Tiggo ${id}: reviewed ${source} -> ${compact ? "compact" : "normal"} card shows only motor/câmbio ${expectation.estimatedEndYear} with the original five-year term`, async () => {
        const base = approvedVehicle(id);
        const raw = source === "API" ? await mappedApiVehicle(id) : base;
        await renderCard(raw, { base, compact });
        assertTiggoPowertrain(true, expectation);
      });
    }
  }

  for (const [label, changes] of [
    ["sold raw vehicle", { price: 0 }],
    ["new ID", { id: "unreviewed-tiggo-unit" }],
    ["another reviewed Tiggo ID with incompatible identity", { id: id === "20066" ? "20029" : "20066" }],
    ["changed model", { modelo: "TIGGO 7 SPORT" }],
    ["missing FAB", { anoFabricacao: undefined }],
    ["null FAB", { anoFabricacao: null }],
    ["NaN FAB", { anoFabricacao: Number.NaN }],
    ["changed FAB", { anoFabricacao: approvedVehicle(id).anoFabricacao + 1 }],
    ["missing MY", { year: undefined }],
    ["null MY", { year: null }],
    ["zero MY", { year: 0 }],
    ["NaN MY", { year: Number.NaN }],
    ["changed MY", { year: approvedVehicle(id).year + 1 }],
    ["missing mileage", { km: undefined }],
    ["null mileage", { km: null }],
    ["NaN mileage", { km: Number.NaN }],
    ["negative mileage", { km: -1 }],
    ["regressed mileage", { km: approvedVehicle(id).km - 1 }],
    ["missing live flag", { diferenciais: undefined }],
    ["removed live flag", { diferenciais: [] }],
    ["unrelated live flag", { diferenciais: [{ tag: "unico_dono", descricao: "Único Dono" }] }],
    ["unverified legacy bootstrap", { factoryWarrantyVehicle: null }],
  ]) {
    test(`Tiggo ${id}: ${label} hides all warranty claims despite valid presentation`, async () => {
      const base = approvedVehicle(id);
      await renderCard({ ...base, ...changes }, { base });
      assertTiggoPowertrain(false);
    });
  }

  test(`Tiggo ${id}: sold presentation hides the powertrain badge and note`, async () => {
    const raw = approvedVehicle(id);
    await renderCard(raw, { base: raw, price: 0 });
    assertTiggoPowertrain(false);
  });

  test(`Tiggo ${id}: reviewed raw data cannot lend coverage to another root card ID`, async () => {
    const raw = approvedVehicle(id);
    await renderCard(raw, { base: raw, id: "another-card" });
    assertTiggoPowertrain(false);
  });

  test(`Tiggo ${id}: API sold price removes the vehicle before card rendering`, async () => {
    const raw = await mappedApiVehicle(id, { valor: 0 }, 0);
    assert.equal(raw, undefined);
  });

  for (const [label, changes] of [
    ["new ID", { id: "another-api-tiggo-unit" }],
    ["missing FAB", { ano_fabricacao: undefined }],
    ["null FAB", { ano_fabricacao: null }],
    ["changed FAB", { ano_fabricacao: approvedVehicle(id).anoFabricacao + 1 }],
    ["missing MY", { ano: undefined }],
    ["null MY", { ano: null }],
    ["zero MY", { ano: 0 }],
    ["changed MY", { ano: approvedVehicle(id).year + 1 }],
    ["missing mileage", { km: undefined }],
    ["null mileage", { km: null }],
    ["regressed mileage", { km: approvedVehicle(id).km - 1 }],
    ["missing live flag", { diferenciais: undefined }],
    ["removed live flag", { diferenciais: [] }],
  ]) {
    test(`Tiggo ${id}: API ${label} cannot be replaced by presentation fallbacks`, async () => {
      const raw = await mappedApiVehicle(id, changes);
      await renderCard(raw, { base: approvedVehicle(id) });
      assertTiggoPowertrain(false);
    });
  }
}

test("Tiggo 7 20066: shared helper -> real hero badge and short note show only motor/câmbio 2029", async () => {
  const raw = approvedVehicle("20066");
  const stamp = factoryPowertrainStampFor(raw);
  assert.ok(stamp);
  assert.equal(factoryWarrantyStampFor(raw), undefined);
  assert.equal(factoryTractionBatteryStampFor(raw), undefined);

  // Exercise the same shared helper and presentation components used by the
  // detail hero. Full DetalhesPage mounting/layout is covered by browser review.
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(
      React.Fragment,
      null,
      React.createElement(FactoryWarrantyBadge, { ...stamp, variant: "hero" }),
      React.createElement(FactoryWarrantyNote, { compact: true, powertrain: stamp }),
    ));
  });
  const badges = renderer.root.findAll(
    (node) => node.type === "div" && node.props["data-factory-warranty-badge"] === "hero",
  );
  assert.equal(badges.length, 1);
  assert.equal(badges[0].props["data-warranty-scope"], "powertrain");
  const notes = renderer.root.findAllByType("p");
  assert.equal(notes.length, 1, "The hero components must not add an external powertrain caption");
  assert.ok(Object.hasOwn(notes[0].props, "data-factory-warranty-note"));
  assert.equal(renderer.root.findAll(
    (node) => node.type === "p" && Object.hasOwn(node.props, "data-powertrain-label"),
  ).length, 0);
  assertPowertrainPresentation(badges[0], notes[0], stamp, tiggo7PowertrainExpectation);
});

test("Tiggo 7 20066: the final estimated year hides the stamp without a confirmed expiry date", async () => {
  currentNow = OriginalDate.parse("2029-01-01T12:00:00.000Z");
  const raw = approvedVehicle("20066");
  await renderCard(raw, { base: raw });
  assertTiggoPowertrain(false);
});
