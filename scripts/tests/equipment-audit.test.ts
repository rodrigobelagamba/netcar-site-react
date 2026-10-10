import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import {
  getDefaultAutoSelectFamily,
  getDefaultAutoSelectFamilyAttemptTimeout,
  setDefaultAutoSelectFamilyAttemptTimeout,
} from "node:net";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { mock, test } from "node:test";
import {
  buildEquipmentAudit as buildAuditWithMatrix,
  configureEquipmentAuditNetwork,
  EQUIPMENT_STOCK_URL,
  fetchEquipmentStock,
  parseStockResponse,
  runEquipmentAudit,
} from "../audit-vehicle-equipment";
import {
  resolveVehicleEquipment,
  unitEquipmentConfirmations,
  type EquipmentVehicle,
} from "../../src/lib/vehicleEquipment";
import warrantyRegistrySeed from "../../src/data/factoryWarrantyMatrix.json";
import { factoryWarrantyUnitKey } from "../lib/factory-warranty-catalog.js";
import {
  factoryWarrantyReviewFingerprint,
  factoryTractionBatteryReviewFingerprint,
  resolveFactoryWarranty,
  resolveFactoryPowertrainWarranty,
  type FactoryWarrantyMatrix,
} from "../../src/lib/factoryWarranty";

// Isolated identities keep these historic equipment tests independent of live
// VIN/plate data while exercising the production binding requirement unchanged.
const fixtureVin = (id: string) => `9BW${id.padStart(14, "0")}`;
const warrantyRegistry = structuredClone(
  warrantyRegistrySeed,
) as FactoryWarrantyMatrix;
for (const record of warrantyRegistry.records) {
  if (record.unitBinding)
    record.unitBinding.unitKey = factoryWarrantyUnitKey({
      chassi: fixtureVin(record.vehicle.vehicleId),
    })!;
  record.approvedFingerprint = factoryWarrantyReviewFingerprint(record);
  for (const coverage of record.supplementalCoverages || [])
    coverage.approvedFingerprint = factoryTractionBatteryReviewFingerprint(
      record,
      coverage,
    );
}
const buildEquipmentAudit: typeof buildAuditWithMatrix = (
  vehicles,
  previous = null,
  now,
  matrix = warrantyRegistry,
) => buildAuditWithMatrix(vehicles, previous, now, matrix);

const fixture: { vehicles: EquipmentVehicle[] } = JSON.parse(
  readFileSync(
    new URL("../fixtures/vehicle-equipment-stock.json", import.meta.url),
    "utf8",
  ),
);
const firstRunAt = "2026-09-28T18:00:00.000Z";
const secondRunAt = "2026-09-29T18:00:00.000Z";
const warrantyRunAt = "2026-10-09T12:00:00.000Z";
const basicWarrantyId = "20049";
const powertrainWarrantyIds = ["20029", "20041", "20066"];

function warrantyApiVehicle(id = basicWarrantyId): Record<string, unknown> {
  const record = warrantyRegistry.records.find(
    (item) => item.vehicle.vehicleId === id,
  );
  assert.ok(record);
  return {
    id: record.vehicle.vehicleId,
    marca: record.vehicle.brand,
    modelo: record.vehicle.modelVersion,
    ano_fabricacao: record.vehicle.manufactureYear,
    ano: record.vehicle.modelYear,
    km: record.reviewedMileageKm,
    valor: 100000,
    chassi: fixtureVin(record.vehicle.vehicleId),
    motor: record.unitBinding?.engine || "1.6",
    cambio: record.unitBinding?.transmission || "AUTOMÁTICO",
    opcionais: [],
    diferenciais: [
      { tag: "garantia_fabrica", descricao: "Garantia de fábrica" },
    ],
  };
}

function stockVehicle(id: string): EquipmentVehicle {
  const vehicle = fixture.vehicles.find((item) => String(item.id) === id);
  assert.ok(vehicle, `fixture vehicle ${id} missing`);
  return structuredClone(vehicle);
}

function apiVehicle(vehicle = fixture.vehicles[0]): Record<string, unknown> {
  const { year, anoFabricacao, ...rest } = structuredClone(vehicle);
  return { ...rest, ano: year, ano_fabricacao: anoFabricacao, valor: 100000 };
}

function apiResponse(data: Record<string, unknown>[]) {
  return {
    success: true,
    total_results: data.length,
    limit: 500,
    offset: 0,
    data,
  };
}

async function withStateDirectory(
  callback: (directory: string) => Promise<void>,
) {
  const directory = mkdtempSync(join(tmpdir(), "netcar-equipment-audit-test-"));
  try {
    await callback(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function existingOwner(stateDir: string) {
  const lockPath = join(stateDir, "audit.lock");
  const ownerName = readdirSync(lockPath).find((name) =>
    name.endsWith(".json"),
  );
  assert.ok(ownerName);
  const ownerPath = join(lockPath, ownerName);
  return {
    lockPath,
    ownerPath,
    owner: JSON.parse(readFileSync(ownerPath, "utf8")),
  };
}

function makeExpiredLock(stateDir: string, temporary = false) {
  const lockPath = join(stateDir, "audit.lock");
  mkdirSync(lockPath, { mode: 0o700 });
  const token = randomUUID();
  writeFileSync(
    join(lockPath, `${token}.json`),
    JSON.stringify({
      token,
      pid: process.pid,
      hostname: hostname(),
      startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    }),
    { mode: 0o600 },
  );
  if (temporary)
    writeFileSync(join(lockPath, `${token}.report.tmp`), "interrupted report");
  return lockPath;
}

test("the auditor gives dual-stack connection attempts 2s without reducing an existing higher timeout", () => {
  const previous = getDefaultAutoSelectFamilyAttemptTimeout();
  const familySelection = getDefaultAutoSelectFamily();
  try {
    setDefaultAutoSelectFamilyAttemptTimeout(250);
    configureEquipmentAuditNetwork();
    assert.equal(getDefaultAutoSelectFamilyAttemptTimeout(), 2_000);
    assert.equal(getDefaultAutoSelectFamily(), familySelection);
    setDefaultAutoSelectFamilyAttemptTimeout(5_000);
    configureEquipmentAuditNetwork();
    assert.equal(getDefaultAutoSelectFamilyAttemptTimeout(), 5_000);
    assert.equal(getDefaultAutoSelectFamily(), familySelection);
  } finally {
    setDefaultAutoSelectFamilyAttemptTimeout(previous);
  }
});

test("importing the auditor leaves the hosting process network policy unchanged", () => {
  const script = new URL("../audit-vehicle-equipment.ts", import.meta.url).href;
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      `import assert from 'node:assert/strict';
     import net from 'node:net';
     net.setDefaultAutoSelectFamilyAttemptTimeout(250);
     const family = net.getDefaultAutoSelectFamily();
     await import(${JSON.stringify(script)});
     assert.equal(net.getDefaultAutoSelectFamilyAttemptTimeout(), 250);
     assert.equal(net.getDefaultAutoSelectFamily(), family);`,
    ],
    { encoding: "utf8", timeout: 10_000 },
  );
  assert.equal(result.status, 0, result.stderr);
});

test("the CLI applies the connection policy before fetching while preserving request safeguards", async () => {
  await withStateDirectory(async (stateDir) => {
    const preload = `import assert from 'node:assert/strict';
      import net from 'node:net';
      net.setDefaultAutoSelectFamilyAttemptTimeout(250);
      const family = net.getDefaultAutoSelectFamily();
      const tlsVerification = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      globalThis.fetch = async (url, options) => {
        assert.equal(net.getDefaultAutoSelectFamilyAttemptTimeout(), 2000);
        assert.equal(net.getDefaultAutoSelectFamily(), family);
        assert.equal(url, ${JSON.stringify(EQUIPMENT_STOCK_URL)});
        assert.equal(options.redirect, 'error');
        assert.ok(options.signal instanceof AbortSignal);
        assert.equal(options.signal.aborted, false);
        assert.equal(process.env.NODE_TLS_REJECT_UNAUTHORIZED, tlsVerification);
        return Response.json(${JSON.stringify(apiResponse([apiVehicle()]))});
      };`;
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--import",
        `data:text/javascript,${encodeURIComponent(preload)}`,
        fileURLToPath(
          new URL("../audit-vehicle-equipment.ts", import.meta.url),
        ),
        "--state-dir",
        stateDir,
      ],
      { encoding: "utf8", timeout: 10_000 },
    );
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(
      readFileSync(join(stateDir, "report.json"), "utf8"),
    );
    assert.equal(report.counts.vehicles, 1);
  });
});

test("first audit covers every active fixture vehicle using the shared presentation", () => {
  const input = structuredClone(fixture.vehicles);
  const before = structuredClone(input);
  const report = buildEquipmentAudit(input, null, firstRunAt);
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.generatedAt, firstRunAt);
  assert.match(report.catalogFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(report.counts.vehicles, 60);
  assert.equal(report.counts.new, 60);
  assert.equal(report.counts.changed, 0);
  assert.equal(report.counts.unchanged, 0);
  assert.equal(report.vehicles.length, 60);
  assert.equal(new Set(report.vehicles.map((item) => item.id)).size, 60);
  assert.equal(
    report.counts.withAlerts,
    report.vehicles.filter((item) =>
      item.findings.some((finding) => finding.severity !== "info"),
    ).length,
  );
  for (const vehicle of input) {
    const row = report.vehicles.find((item) => item.id === String(vehicle.id));
    assert.ok(row, String(vehicle.id));
    assert.equal(row.change, "new", row.id);
    assert.match(row.reviewKey, /^[a-f0-9]{64}$/, row.id);
    assert.deepEqual(
      row.displayedDescriptions,
      resolveVehicleEquipment(vehicle).items.map((item) => item.description),
      row.id,
    );
    assert.ok(row.researchQuery.includes(String(vehicle.year)), row.id);
    assert.ok(row.researchQuery.includes(vehicle.modelo!), row.id);
  }
  assert.deepEqual(input, before, "auditing must preserve the source fixture");
});

test("repeat audits preserve review keys and mark all vehicles unchanged", () => {
  const previous = buildEquipmentAudit(fixture.vehicles, null, firstRunAt);
  const before = structuredClone(previous);
  const current = buildEquipmentAudit(fixture.vehicles, previous, secondRunAt);
  assert.equal(current.generatedAt, secondRunAt);
  assert.equal(current.counts.new, 0);
  assert.equal(current.counts.changed, 0);
  assert.equal(current.counts.unchanged, 60);
  for (const row of current.vehicles) {
    assert.equal(row.change, "unchanged", row.id);
    assert.equal(
      row.reviewKey,
      previous.vehicles.find((item) => item.id === row.id)?.reviewKey,
      row.id,
    );
  }
  assert.deepEqual(
    previous,
    before,
    "previous report is not a writable ledger",
  );
});

test("reordered stock, reordered optionals and price changes do not reopen review", () => {
  const previous = buildEquipmentAudit(fixture.vehicles, null, firstRunAt);
  const reordered = structuredClone(fixture.vehicles)
    .reverse()
    .map((vehicle) => ({
      ...vehicle,
      valor: 98765,
      price: 12345,
      opcionais: [...(vehicle.opcionais || [])].reverse(),
    }));
  const current = buildEquipmentAudit(reordered, previous, secondRunAt);
  assert.equal(current.counts.unchanged, 60);
  assert.equal(current.counts.changed, 0);
  for (const row of current.vehicles) {
    assert.equal(
      row.reviewKey,
      previous.vehicles.find((item) => item.id === row.id)?.reviewKey,
      row.id,
    );
  }
});

test("changed equipment reopens only the affected unit and keeps unknown equipment visible", () => {
  const input = structuredClone(fixture.vehicles);
  const previous = buildEquipmentAudit(input, null, firstRunAt);
  const changed = input[0];
  changed.opcionais = [
    ...(changed.opcionais || []),
    { tag: "novo_recurso_a_conferir", descricao: "Novo recurso a conferir" },
  ];
  const report = buildEquipmentAudit(input, previous, secondRunAt);
  assert.equal(report.counts.changed, 1);
  assert.equal(report.counts.unchanged, 59);
  assert.equal(report.counts.new, 0);
  const row = report.vehicles.find((item) => item.id === String(changed.id));
  assert.ok(row);
  assert.equal(row.change, "changed");
  assert.notEqual(
    row.reviewKey,
    previous.vehicles.find((item) => item.id === row.id)?.reviewKey,
  );
  assert.ok(row.displayedDescriptions.includes("Novo recurso a conferir"));
  assert.ok(
    row.findings.some(
      (finding) =>
        finding.code === "unknown-equipment" && finding.severity === "medium",
    ),
  );
});

test("a changed model year, version, engine or transmission reopens the unit", () => {
  const vehicle = stockVehicle("20051");
  const previous = buildEquipmentAudit([vehicle], null, firstRunAt);
  const changes: Partial<EquipmentVehicle>[] = [
    { year: Number(vehicle.year) + 1 },
    { modelo: `${vehicle.modelo} PLUS` },
    { marca: "OTHER" },
    { motor: "1.5" },
    { cambio: "MANUAL" },
  ];
  for (const change of changes) {
    const report = buildEquipmentAudit([{ ...vehicle, ...change }], previous);
    assert.equal(report.counts.changed, 1, JSON.stringify(change));
    assert.equal(report.vehicles[0].change, "changed");
    assert.notEqual(
      report.vehicles[0].reviewKey,
      previous.vehicles[0].reviewKey,
    );
    assert.deepEqual(report.vehicles[0].confirmationIds, []);
  }
});

test("a new stock ID requires its own review and never inherits unit confirmations", () => {
  const vehicle = stockVehicle("20051");
  const previous = buildEquipmentAudit([vehicle], null, firstRunAt);
  const report = buildEquipmentAudit([{ ...vehicle, id: "99999" }], previous);
  assert.equal(report.counts.new, 1);
  assert.equal(report.vehicles[0].change, "new");
  assert.notEqual(report.vehicles[0].reviewKey, previous.vehicles[0].reviewKey);
  assert.deepEqual(report.vehicles[0].confirmationIds, []);
  assert.ok(
    report.vehicles[0].displayedDescriptions.some((text) => /teto/i.test(text)),
  );
});

test("incomplete identity warns and cannot inherit a unit confirmation", () => {
  const vehicle = stockVehicle("20051");
  for (const key of ["marca", "modelo", "year", "motor", "cambio"] as const) {
    const report = buildEquipmentAudit([{ ...vehicle, [key]: undefined }]);
    const row = report.vehicles[0];
    assert.ok(
      row.findings.some(
        (finding) =>
          finding.code === "incomplete-identity" && finding.severity === "high",
      ),
      key,
    );
    assert.ok(
      row.findings.some(
        (finding) => finding.code === "confirmation-identity-mismatch",
      ),
      key,
    );
    assert.deepEqual(row.confirmationIds, [], key);
    assert.ok(
      row.displayedDescriptions.some((text) => /teto/i.test(text)),
      key,
    );
  }
});

test("unit source conflicts retain the raw claim and expose the confirmed presentation", () => {
  const report = buildEquipmentAudit([
    stockVehicle("20050"),
    stockVehicle("20051"),
  ]);
  for (const row of report.vehicles) {
    assert.deepEqual(
      row.confirmationIds,
      unitEquipmentConfirmations
        .filter((record) => record.match.vehicleId === row.id)
        .map((record) => record.id),
    );
    assert.ok(
      row.findings.some(
        (finding) =>
          finding.code === "unit-source-conflict" &&
          finding.severity === "high",
      ),
      row.id,
    );
    if (row.id === "20050") {
      assert.ok(
        row.inventoryDescriptions.some((text) => /park assist/i.test(text)),
      );
      assert.ok(
        row.inventoryDescriptions.some((text) => /adaptativo/i.test(text)),
      );
      assert.ok(
        !row.displayedDescriptions.some((text) =>
          /park assist|adaptativo/i.test(text),
        ),
      );
      assert.ok(
        row.displayedDescriptions.includes(
          "Assistência de permanência em faixa",
        ),
      );
    } else {
      assert.ok(row.inventoryDescriptions.some((text) => /teto/i.test(text)));
      assert.ok(!row.displayedDescriptions.some((text) => /teto/i.test(text)));
      assert.ok(
        !row.displayedDescriptions.some((text) =>
          /permanência em faixa/i.test(text),
        ),
      );
    }
    assert.ok(row.displayedDescriptions.includes("Piloto automático"));
    assert.ok(
      row.displayedDescriptions.some((text) =>
        /sensor.*estacionamento/i.test(text),
      ),
    );
  }
});

test("the API parser maps the complete 60-vehicle fixture without changing equipment", () => {
  const raw = fixture.vehicles.map((vehicle) => apiVehicle(vehicle));
  const parsed = parseStockResponse(apiResponse(raw));
  assert.equal(parsed.length, 60);
  for (const expected of fixture.vehicles) {
    const actual = parsed.find(
      (item) => String(item.id) === String(expected.id),
    );
    assert.ok(actual, String(expected.id));
    assert.equal(Number(actual.year), Number(expected.year));
    assert.deepEqual(actual.opcionais, expected.opcionais);
  }
});

test("the API parser filters sold vehicles after validating a complete response", () => {
  const active = apiVehicle();
  const sold = { ...apiVehicle(), id: "99998", valor: 0 };
  assert.equal(parseStockResponse(apiResponse([active, sold])).length, 1);
  assert.throws(() => parseStockResponse(apiResponse([sold])));
});

test("warranty source fields use a separate allowlisted snapshot without inventing missing data", () => {
  const raw = {
    ...warrantyApiVehicle(),
    placa: "PRIVATE_PLATE_SENTINEL",
    vin: "PRIVATE_VIN_SENTINEL",
    diferenciais: [
      {
        tag: "garantia_fabrica",
        descricao: "Garantia de fábrica",
        placa: "PRIVATE_NESTED_SENTINEL",
        payload: { token: "PRIVATE_TOKEN_SENTINEL" },
      },
    ],
  };
  const original = JSON.stringify(raw);
  const [vehicle] = parseStockResponse(apiResponse([raw]));
  assert.deepEqual(vehicle.warrantySnapshot, {
    manufactureYear: 2024,
    modelYear: 2025,
    mileageKm: 24500,
    price: 100000,
    diferenciais: [
      { tag: "garantia_fabrica", descricao: "Garantia de fábrica" },
    ],
  });
  assert.equal(JSON.stringify(raw), original);
  const report = buildEquipmentAudit([vehicle], null, warrantyRunAt);
  for (const result of [vehicle, report])
    assert.ok(!JSON.stringify(result).includes("PRIVATE_"));
  assert.ok(!JSON.stringify(report).includes("warrantySnapshot"));

  for (const missing of [undefined, null, "", " ", false, "invalid"]) {
    const [parsed] = parseStockResponse(
      apiResponse([
        {
          ...warrantyApiVehicle(),
          ano_fabricacao: missing,
          ano: missing,
          km: missing,
        },
      ]),
    );
    assert.equal(parsed.warrantySnapshot?.manufactureYear, null);
    assert.equal(parsed.warrantySnapshot?.modelYear, null);
    assert.equal(parsed.warrantySnapshot?.mileageKm, null);
    assert.equal(
      buildEquipmentAudit([parsed], null, warrantyRunAt).vehicles[0].warranty
        ?.status,
      "blocked",
    );
  }
});

test("warranty audit preserves the public gate's rejection of coerced numbers and normalized tags", () => {
  for (const change of [
    { ano_fabricacao: "2024" },
    { ano: "2025" },
    { km: "24500" },
    { valor: "100000" },
    {
      diferenciais: [
        { tag: " garantia_fabrica ", descricao: "Garantia de fábrica" },
      ],
    },
  ]) {
    const raw: Record<string, unknown> = { ...warrantyApiVehicle(), ...change };
    // Match the public adapter's pass-through values, without Number()/trim().
    const publicVehicle = {
      id: String(raw.id),
      unitKey: factoryWarrantyUnitKey(raw),
      motor: raw.motor,
      cambio: raw.cambio,
      marca: raw.marca,
      modelo: raw.modelo,
      anoFabricacao: raw.ano_fabricacao,
      year: raw.ano,
      km: raw.km,
      price: raw.valor,
      diferenciais: raw.diferenciais,
    } as unknown as Parameters<typeof resolveFactoryWarranty>[0];
    assert.equal(
      resolveFactoryWarranty(
        publicVehicle,
        warrantyRegistry as FactoryWarrantyMatrix,
        warrantyRunAt.slice(0, 10),
      ),
      undefined,
    );
    const row = buildEquipmentAudit(
      parseStockResponse(apiResponse([raw])),
      null,
      warrantyRunAt,
    ).vehicles[0];
    assert.equal(row.warranty?.status, "blocked", JSON.stringify(change));
  }
});

test("a newly flagged ID without its own warranty record stays pending and never inherits approval", () => {
  const before = JSON.stringify(warrantyRegistry);
  const parsed = parseStockResponse(
    apiResponse([
      {
        ...warrantyApiVehicle(),
        id: "99999",
        chassi: fixtureVin("99999"),
      },
    ]),
  );
  const report = buildEquipmentAudit(parsed, null, warrantyRunAt);
  const row = report.vehicles[0];
  assert.equal(row.warranty?.status, "pending");
  assert.deepEqual(row.warranty?.recordIds, []);
  const finding = row.findings.find(
    (item) => item.code === "factory-warranty-pending",
  );
  assert.ok(finding);
  assert.equal(finding.severity, "medium");
  assert.match(finding.message, /sem carimbo.*Não há registro específico/);
  assert.match(
    finding.message,
    /Revisar equipamentos não aprova garantia nem altera a matriz/,
  );
  assert.match(finding.message, /opcional 108.*revisão documental/);
  assert.equal(JSON.stringify(warrantyRegistry), before);
});

test("an omitted warranty flag keeps a previous new-unit pending finding until the source is explicit", () => {
  const raw = { ...warrantyApiVehicle(), id: "99999", chassi: fixtureVin("99999") };
  const first = buildEquipmentAudit(
    parseStockResponse(apiResponse([raw])),
    null,
    warrantyRunAt,
  );
  for (const diferenciais of [undefined, null]) {
    const parsed = parseStockResponse(apiResponse([{ ...raw, diferenciais }]));
    const unknown = buildEquipmentAudit(parsed, first, warrantyRunAt);
    assert.equal(unknown.vehicles[0].warranty?.status, "pending");
    assert.equal(unknown.vehicles[0].warranty?.flagPresent, null);
    assert.ok(
      unknown.vehicles[0].findings.some(
        (item) => item.code === "factory-warranty-pending",
      ),
    );
    assert.equal(unknown.counts.changed, 1);
    assert.equal(
      buildEquipmentAudit(parsed, unknown, warrantyRunAt).counts.unchanged,
      1,
    );
  }
  const absent = buildEquipmentAudit(
    parseStockResponse(apiResponse([{ ...raw, diferenciais: [] }])),
    first,
    warrantyRunAt,
  );
  assert.equal(absent.vehicles[0].warranty, undefined);
});

test("eligible warranty findings agree with the real resolver and stable runs keep their key", () => {
  const raw = warrantyApiVehicle();
  const parsed = parseStockResponse(apiResponse([raw]));
  assert.ok(
    resolveFactoryWarranty(
      {
        id: String(raw.id),
        unitKey: factoryWarrantyUnitKey(raw),
        motor: String(raw.motor),
        cambio: String(raw.cambio),
        marca: String(raw.marca),
        modelo: String(raw.modelo),
        anoFabricacao: Number(raw.ano_fabricacao),
        year: Number(raw.ano),
        km: Number(raw.km),
        price: Number(raw.valor),
        diferenciais: [
          { tag: "garantia_fabrica", descricao: "Garantia de fábrica" },
        ],
      },
      warrantyRegistry as FactoryWarrantyMatrix,
      warrantyRunAt.slice(0, 10),
    ),
  );
  const before = JSON.stringify(parsed);
  const first = buildEquipmentAudit(parsed, null, warrantyRunAt);
  const row = first.vehicles[0];
  assert.equal(row.warranty?.status, "eligible");
  assert.ok(
    row.findings.some(
      (item) =>
        item.code === "factory-warranty-eligible" && item.severity === "info",
    ),
  );
  const second = buildEquipmentAudit(parsed, first, "2026-10-10T12:00:00.000Z");
  assert.equal(second.vehicles[0].reviewKey, row.reviewKey);
  assert.equal(second.counts.unchanged, 1);
  assert.equal(JSON.stringify(parsed), before);
});

test("the three Tiggo records are eligible only for motor and transmission without false general alerts", () => {
  const raw = powertrainWarrantyIds.map(warrantyApiVehicle);
  const parsed = parseStockResponse(apiResponse(raw));
  const before = JSON.stringify(warrantyRegistry);
  const report = buildEquipmentAudit(parsed, null, warrantyRunAt);
  for (const item of raw) {
    const catalogVehicle = {
      id: String(item.id),
      unitKey: factoryWarrantyUnitKey(item),
      motor: item.motor,
      cambio: item.cambio,
      marca: item.marca,
      modelo: item.modelo,
      anoFabricacao: item.ano_fabricacao,
      year: item.ano,
      km: item.km,
      price: item.valor,
      diferenciais: item.diferenciais,
    } as Parameters<typeof resolveFactoryWarranty>[0];
    assert.equal(
      resolveFactoryWarranty(
        catalogVehicle,
        warrantyRegistry as FactoryWarrantyMatrix,
        warrantyRunAt.slice(0, 10),
      ),
      undefined,
    );
    assert.equal(
      resolveFactoryPowertrainWarranty(
        catalogVehicle,
        warrantyRegistry as FactoryWarrantyMatrix,
        warrantyRunAt.slice(0, 10),
      )?.scope,
      "powertrain",
    );
    const row = report.vehicles.find((vehicle) => vehicle.id === item.id)!;
    assert.equal(
      row.warranty?.status,
      "blocked",
      "general coverage must stay ineligible",
    );
    assert.equal(row.warranty?.powertrain?.status, "eligible");
    assert.equal(row.warranty?.powertrain?.scope, "powertrain");
    const expectedEndYear = item.id === "20066" ? 2029 : 2028;
    assert.equal(row.warranty?.powertrain?.estimatedEndYear, expectedEndYear);
    if (item.id === "20066") {
      const record = warrantyRegistry.records.find(
        (entry) => entry.vehicle.vehicleId === "20066",
      )!;
      assert.equal(record.vehicle.manufactureYear, 2024);
      assert.equal(record.vehicle.modelYear, 2025);
      assert.equal(record.termYears, 5);
      assert.equal(record.usage, "private");
      assert.equal(record.mileage.kind, "unlimited");
    }
    assert.ok(
      row.findings.some(
        (finding) =>
          finding.code === "factory-warranty-general-out-of-scope" &&
          finding.severity === "info",
      ),
    );
    const scoped = row.findings.find(
      (finding) => finding.code === "factory-warranty-powertrain-eligible",
    );
    assert.equal(scoped?.severity, "info");
    assert.match(
      scoped?.message || "",
      new RegExp(`motor e câmbio.*${expectedEndYear}.*não é garantia geral`),
    );
    assert.ok(
      !row.findings.some((finding) =>
        ["factory-warranty-eligible", "factory-warranty-blocked"].includes(
          finding.code,
        ),
      ),
    );
  }
  assert.equal(report.counts.withAlerts, 0);
  assert.equal(
    buildEquipmentAudit(parsed, report, "2026-10-10T12:00:00.000Z").counts
      .unchanged,
    3,
  );
  assert.equal(JSON.stringify(warrantyRegistry), before);
});

test("Tiggo scope gates block removed flags, stale identity and mileage without reopening unrelated units", () => {
  const ids = powertrainWarrantyIds;
  const raw = ids.map(warrantyApiVehicle);
  const first = buildEquipmentAudit(
    parseStockResponse(apiResponse(raw)),
    null,
    warrantyRunAt,
  );
  for (const id of ids) {
    const original = raw.find((item) => item.id === id)!;
    for (const changes of [
      { diferenciais: [] },
      { diferenciais: undefined },
      { marca: "OTHER" },
      { modelo: `${original.modelo} PLUS` },
      { ano_fabricacao: 2022 },
      { ano: Number(original.ano) + 1 },
      { km: Number(original.km) - 1 },
      { km: undefined },
    ]) {
      const changed = raw.map((item) =>
        item.id === id ? { ...item, ...changes } : item,
      );
      const parsed = parseStockResponse(apiResponse(changed));
      const report = buildEquipmentAudit(parsed, first, warrantyRunAt);
      const row = report.vehicles.find((item) => item.id === id)!;
      assert.equal(
        row.warranty?.powertrain?.status,
        "blocked",
        `${id} ${JSON.stringify(changes)}`,
      );
      assert.equal(row.warranty?.status, "blocked");
      assert.ok(
        row.findings.some(
          (finding) =>
            finding.code === "factory-warranty-powertrain-blocked" &&
            finding.severity === "high",
        ),
      );
      assert.equal(report.counts.changed, 1);
      assert.equal(report.counts.unchanged, 2);
      assert.equal(report.counts.withAlerts, 1);
      assert.equal(
        buildEquipmentAudit(parsed, report, warrantyRunAt).counts.unchanged,
        3,
      );
    }
    const moreKm = raw.map((item) =>
      item.id === id ? { ...item, km: 500000 } : item,
    );
    const increased = buildEquipmentAudit(
      parseStockResponse(apiResponse(moreKm)),
      first,
      warrantyRunAt,
    );
    assert.equal(
      increased.vehicles.find((item) => item.id === id)?.warranty?.powertrain
        ?.status,
      "eligible",
      "confirmed unlimited mileage has no invented ceiling",
    );
    assert.equal(increased.counts.changed, 1);
  }
  const priorEndYear = buildEquipmentAudit(
    parseStockResponse(apiResponse(raw)),
    first,
    "2028-01-01T12:00:00.000Z",
  );
  assert.equal(priorEndYear.counts.changed, 2);
  assert.equal(priorEndYear.counts.withAlerts, 2);
  assert.equal(
    priorEndYear.vehicles.find((row) => row.id === "20066")?.warranty
      ?.powertrain?.status,
    "eligible",
  );
  const expired = buildEquipmentAudit(
    parseStockResponse(apiResponse(raw)),
    first,
    "2029-01-01T12:00:00.000Z",
  );
  assert.equal(expired.counts.changed, 3);
  assert.equal(expired.counts.withAlerts, 3);
  assert.ok(
    expired.vehicles.every(
      (row) => row.warranty?.powertrain?.status === "blocked",
    ),
  );
});

test("powertrain source changes and conflicting records remain blocked and reopen only their unit", () => {
  const parsed = parseStockResponse(
    apiResponse([
      ...powertrainWarrantyIds.map(warrantyApiVehicle),
      warrantyApiVehicle(),
    ]),
  );
  const first = buildEquipmentAudit(parsed, null, warrantyRunAt);
  for (const id of powertrainWarrantyIds) {
    for (const change of [
      "source",
      "revoked",
      "duplicate",
      "conflicting-scope",
    ]) {
      const matrix = structuredClone(warrantyRegistry) as FactoryWarrantyMatrix;
      const record = matrix.records.find(
        (entry) => entry.vehicle.vehicleId === id,
      )!;
      if (change === "source")
        record.sources[0].verification.status = "pending";
      if (change === "revoked") record.status = "revoked";
      if (change === "duplicate") matrix.records.push(structuredClone(record));
      if (change === "conflicting-scope")
        matrix.records.push({
          ...structuredClone(record),
          scope: "basic-vehicle",
        });
      const report = buildEquipmentAudit(parsed, first, warrantyRunAt, matrix);
      const row = report.vehicles.find((entry) => entry.id === id)!;
      assert.equal(
        row.warranty?.powertrain?.status,
        "blocked",
        `${id} ${change}`,
      );
      assert.equal(row.warranty?.status, "blocked");
      assert.ok(
        row.findings.some(
          (finding) =>
            finding.code === "factory-warranty-powertrain-blocked" &&
            finding.severity === "high",
        ),
      );
      assert.equal(report.counts.changed, 1);
      assert.equal(report.counts.unchanged, 3);
      assert.equal(report.counts.withAlerts, 1);
    }
  }
});

test("the registry audit keeps twelve general coverages, three powertrain coverages and the BYD battery separate", () => {
  const report = buildEquipmentAudit(
    parseStockResponse(
      apiResponse(
        warrantyRegistry.records.map((record) =>
          warrantyApiVehicle(record.vehicle.vehicleId),
        ),
      ),
    ),
    null,
    "2026-10-10T12:00:00.000Z",
  );
  const general = report.vehicles.filter(
    (row) => row.warranty?.status === "eligible",
  );
  const powertrain = report.vehicles.filter(
    (row) => row.warranty?.powertrain?.status === "eligible",
  );
  const battery = report.vehicles.filter(
    (row) => row.warranty?.supplemental?.status === "eligible",
  );
  assert.deepEqual(general.map((row) => row.id).sort(), [
    "19587", "19779", "19854", "19857", "19866", "19898", "19924", "19994",
    "20019", "20038", "20049", "20075",
  ]);
  assert.deepEqual(powertrain.map((row) => row.id).sort(), powertrainWarrantyIds);
  assert.deepEqual(battery.map((row) => row.id), ["19924"]);
  assert.equal(general.length + powertrain.length + battery.length, 16);
  assert.equal(new Set([...general, ...powertrain, ...battery].map((row) => row.id)).size, 15);
  for (const id of ["19779", "19854", "19898", "19866"]) {
    const coverage = report.vehicles.find((row) => row.id === id)!.warranty!;
    assert.equal(coverage.status, "eligible");
    assert.notEqual(coverage.powertrain?.status, "eligible");
    assert.notEqual(coverage.supplemental?.status, "eligible");
  }
  assert.equal(
    report.vehicles.find((row) => row.id === "19924")?.warranty?.supplemental
      ?.scope,
    "traction-battery",
  );
  // This complete registry fixture also includes Nivus20018, which is absent
  // from the current public catalog and remains unapproved.
  assert.deepEqual(
    warrantyRegistry.records.filter((record) => record.status === "pending").map((record) => record.vehicle.vehicleId).sort(),
    ["20018"],
  );
  for (const id of ["20018"]) {
    const coverage = report.vehicles.find((row) => row.id === id)!.warranty!;
    assert.notEqual(coverage.status, "eligible");
    assert.notEqual(coverage.powertrain?.status, "eligible");
    assert.notEqual(coverage.supplemental?.status, "eligible");
  }
  assert.equal(report.counts.withAlerts, 1);
});

test("warranty identity, FAB, MY, mileage and flag changes reopen only the candidate", () => {
  const raw = warrantyApiVehicle();
  const ordinary = { ...apiVehicle(), id: "99998", diferenciais: [] };
  const first = buildEquipmentAudit(
    parseStockResponse(apiResponse([raw, ordinary])),
    null,
    warrantyRunAt,
  );
  for (const change of [
    { marca: "OTHER" },
    { modelo: `${raw.modelo} PLUS` },
    { ano_fabricacao: 2023 },
    { ano: 2026 },
    { km: 24501 },
    { km: 100000 },
    { diferenciais: [] },
  ]) {
    const parsed = parseStockResponse(
      apiResponse([{ ...raw, ...change }, ordinary]),
    );
    const next = buildEquipmentAudit(parsed, first, warrantyRunAt);
    assert.equal(next.counts.changed, 1, JSON.stringify(change));
    assert.equal(next.counts.unchanged, 1);
    assert.notEqual(next.vehicles[0].reviewKey, first.vehicles[0].reviewKey);
    assert.equal(next.vehicles[1].reviewKey, first.vehicles[1].reviewKey);
    assert.equal(
      next.vehicles[0].warranty?.status,
      "km" in change && change.km === 24501 ? "eligible" : "blocked",
    );
    const repeated = buildEquipmentAudit(parsed, next, warrantyRunAt);
    assert.equal(repeated.counts.unchanged, 2);
  }
});

test("missing source fields and expired warranty fail conservatively without withdrawing their review finding", () => {
  const raw = warrantyApiVehicle();
  const previous = buildEquipmentAudit(
    parseStockResponse(apiResponse([raw])),
    null,
    warrantyRunAt,
  );
  for (const key of ["ano_fabricacao", "ano", "km", "diferenciais"] as const) {
    const incomplete = { ...raw };
    delete incomplete[key];
    const report = buildEquipmentAudit(
      parseStockResponse(apiResponse([incomplete])),
      previous,
      warrantyRunAt,
    );
    assert.equal(report.vehicles[0].warranty?.status, "blocked", key);
    assert.equal(report.counts.changed, 1);
    assert.ok(
      report.vehicles[0].findings.some(
        (item) => item.code === "factory-warranty-blocked",
      ),
    );
  }
  for (const value of [undefined, null, "", false])
    assert.throws(() =>
      parseStockResponse(apiResponse([{ ...raw, valor: value }])),
    );
  const expired = buildEquipmentAudit(
    parseStockResponse(apiResponse([raw])),
    previous,
    "2027-01-01T12:00:00.000Z",
  );
  assert.equal(expired.vehicles[0].warranty?.status, "blocked");
  assert.equal(expired.counts.changed, 1);
});

test("relevant warranty rules reopen review while unrelated records and array ordering do not", () => {
  const parsed = parseStockResponse(apiResponse([warrantyApiVehicle()]));
  const first = buildEquipmentAudit(parsed, null, warrantyRunAt);
  for (const mutation of [
    "disabled",
    "source",
    "status",
    "duplicate",
  ] as const) {
    const matrix = structuredClone(warrantyRegistry) as FactoryWarrantyMatrix;
    const record = matrix.records.find(
      (item) => item.vehicle.vehicleId === basicWarrantyId,
    )!;
    if (mutation === "disabled") matrix.enabled = false;
    if (mutation === "source") record.sources[0].revision += " altered";
    if (mutation === "status") record.status = "revoked";
    if (mutation === "duplicate") matrix.records.push(structuredClone(record));
    const next = buildEquipmentAudit(parsed, first, warrantyRunAt, matrix);
    assert.equal(next.counts.changed, 1, mutation);
    assert.equal(next.vehicles[0].warranty?.status, "blocked", mutation);
    assert.equal(
      buildEquipmentAudit(parsed, next, warrantyRunAt, matrix).counts.unchanged,
      1,
    );
  }
  const unrelated = structuredClone(warrantyRegistry) as FactoryWarrantyMatrix;
  unrelated.records.find(
    (item) => item.vehicle.vehicleId !== basicWarrantyId,
  )!.status = "revoked";
  unrelated.records.reverse();
  assert.equal(
    buildEquipmentAudit(parsed, first, warrantyRunAt, unrelated).counts
      .unchanged,
    1,
  );
});

test("supplemental traction battery review is explicit and never expands the general warranty", () => {
  const parsed = parseStockResponse(
    apiResponse([
      warrantyApiVehicle(),
      { ...apiVehicle(), id: "99998", diferenciais: [] },
    ]),
  );
  const first = buildEquipmentAudit(parsed, null, warrantyRunAt);
  const matrix = structuredClone(warrantyRegistry) as FactoryWarrantyMatrix;
  const primary = matrix.records.find(
    (record) => record.vehicle.vehicleId === basicWarrantyId,
  )!;
  // Synthetic pending evidence only: this test never creates an approval.
  primary.supplementalCoverages = [
    {
      recordId: "test-only-traction-battery",
      status: "pending",
      reviewedAt: "2026-10-05",
      approvedFingerprint: "",
      scope: "traction-battery",
      conditionsConfirmed: false,
      termYears: 8,
      usage: "private",
      reviewedMileageKm: primary.reviewedMileageKm,
      mileage: { kind: "unlimited" },
      sources: [],
    },
  ];
  const before = JSON.stringify(matrix);
  const pending = buildEquipmentAudit(parsed, first, warrantyRunAt, matrix);
  const row = pending.vehicles[0];
  assert.equal(pending.counts.changed, 1);
  assert.equal(pending.counts.unchanged, 1);
  assert.equal(row.warranty?.status, "eligible");
  assert.equal(row.warranty?.supplemental?.scope, "traction-battery");
  assert.equal(row.warranty?.supplemental?.status, "pending");
  assert.deepEqual(row.warranty?.supplemental?.recordIds, [
    "test-only-traction-battery",
  ]);
  const finding = row.findings.find(
    (item) => item.code === "factory-warranty-traction-battery-pending",
  );
  assert.ok(finding);
  assert.match(finding.message, /bateria de tração.*sem carimbo específico/);
  assert.match(finding.message, /não amplia a garantia geral/);
  assert.equal(JSON.stringify(matrix), before);
  assert.equal(
    buildEquipmentAudit(parsed, pending, warrantyRunAt, matrix).counts
      .unchanged,
    2,
  );

  primary.supplementalCoverages[0].termYears = 7;
  const altered = buildEquipmentAudit(parsed, pending, warrantyRunAt, matrix);
  assert.equal(altered.counts.changed, 1);
  assert.equal(altered.vehicles[0].warranty?.status, "eligible");
  primary.supplementalCoverages[0].status = "revoked";
  const blocked = buildEquipmentAudit(parsed, altered, warrantyRunAt, matrix);
  assert.equal(blocked.counts.changed, 1);
  assert.equal(blocked.vehicles[0].warranty?.supplemental?.status, "blocked");
  assert.equal(blocked.vehicles[0].warranty?.status, "eligible");
  assert.equal(blocked.vehicles[1].reviewKey, first.vehicles[1].reviewKey);
});

test("positive price, photos and unrelated differential order do not reopen warranty review", () => {
  const raw = warrantyApiVehicle();
  const first = buildEquipmentAudit(
    parseStockResponse(apiResponse([raw])),
    null,
    warrantyRunAt,
  );
  const changed = {
    ...raw,
    valor: 150000,
    fotos: ["photo-two", "photo-one"],
    diferenciais: [
      { tag: "revisado", descricao: "Revisado" },
      { tag: "garantia_fabrica", descricao: "Descrição atualizada" },
    ],
  };
  assert.equal(
    buildEquipmentAudit(
      parseStockResponse(apiResponse([changed])),
      first,
      warrantyRunAt,
    ).counts.unchanged,
    1,
  );
});

test("units without a warranty flag or record preserve the exact legacy review key", () => {
  const raw = { ...warrantyApiVehicle(), id: "99998", diferenciais: [] };
  const parsed = parseStockResponse(apiResponse([raw]));
  const report = buildEquipmentAudit(parsed, null, warrantyRunAt);
  const row = report.vehicles[0];
  const legacyKey = createHash("sha256")
    .update(
      JSON.stringify({
        catalogFingerprint: report.catalogFingerprint,
        identity: {
          id: row.id,
          brand: row.brand,
          model: row.model,
          modelYear: row.modelYear,
          engine: row.engine,
          transmission: row.transmission,
        },
        seats: parsed[0].lugares ?? "",
        options: [],
      }),
    )
    .digest("hex");
  assert.equal(row.reviewKey, legacyKey);
  assert.equal(row.warranty, undefined);
  assert.ok(
    !row.findings.some((item) => item.code.startsWith("factory-warranty-")),
  );
  const matrix = structuredClone(warrantyRegistry) as FactoryWarrantyMatrix;
  matrix.enabled = false;
  const changed = parseStockResponse(
    apiResponse([{ ...raw, ano_fabricacao: 2023, km: 999999, valor: 200000 }]),
  );
  assert.equal(
    buildEquipmentAudit(changed, report, warrantyRunAt, matrix).vehicles[0]
      .reviewKey,
    legacyKey,
  );
});

test("partial or failed API responses cannot become a successful stock snapshot", () => {
  const data = [apiVehicle()];
  for (const response of [
    { ...apiResponse(data), success: false },
    { ...apiResponse(data), total_results: 2 },
    { ...apiResponse(data), total_results: 0 },
    { ...apiResponse(data), total_results: undefined },
    { ...apiResponse(data), offset: 1 },
    { ...apiResponse(data), data: null },
    apiResponse([]),
    null,
  ]) {
    assert.throws(() => parseStockResponse(response));
  }
});

test("duplicate IDs and invalid equipment rows fail instead of silently dropping vehicles", () => {
  const valid = apiVehicle();
  assert.throws(() => parseStockResponse(apiResponse([valid, { ...valid }])));
  for (const invalid of [
    { ...valid, id: "" },
    { ...valid, id: undefined },
    { ...valid, opcionais: undefined },
    { ...valid, opcionais: null },
    { ...valid, opcionais: "air_bag" },
    { ...valid, opcionais: [null] },
    { ...valid, opcionais: [42] },
    { ...valid, opcionais: [{ tag: { nested: true } }] },
    { ...valid, opcionais: [{}] },
    { ...valid, opcionais: [""] },
    { ...valid, opcionais: [{ tag: " ", descricao: " ", nome: " " }] },
    { ...valid, valor: "not-a-price" },
  ]) {
    assert.throws(() => parseStockResponse(apiResponse([invalid])));
  }
  assert.deepEqual(
    parseStockResponse(apiResponse([{ ...valid, opcionais: [] }]))[0].opcionais,
    [],
  );
});

test("private API fields never enter parsed vehicles or the persisted audit", () => {
  const secrets = {
    renavam: "PRIVATE_RENAVAM_SENTINEL",
    placa: "PRIVATE_PLATE_SENTINEL",
    chassi: "PRIVATE_CHASSIS_SENTINEL",
    private: { token: "PRIVATE_TOKEN_SENTINEL" },
    proprietario: "PRIVATE_OWNER_SENTINEL",
  };
  const raw = { ...apiVehicle(stockVehicle("20051")), ...secrets };
  const parsed = parseStockResponse(apiResponse([raw]));
  const report = buildEquipmentAudit(parsed, null, firstRunAt);
  const direct = buildEquipmentAudit([
    { ...stockVehicle("20051"), ...secrets },
  ]);
  for (const result of [parsed, report, direct]) {
    const json = JSON.stringify(result);
    assert.ok(!json.includes("PRIVATE_"));
    for (const key of Object.keys(secrets)) {
      assert.ok(!json.includes(`"${key}":`), key);
    }
  }
});

test("the runner persists a private report and compares the next run with it", async () => {
  await withStateDirectory(async (stateDir) => {
    const loadStock = async () => structuredClone(fixture.vehicles);
    const first = await runEquipmentAudit({ stateDir, loadStock });
    const reportPath = join(stateDir, "report.json");
    assert.deepEqual(JSON.parse(readFileSync(reportPath, "utf8")), first);
    assert.equal(statSync(stateDir).mode & 0o777, 0o700);
    assert.equal(statSync(reportPath).mode & 0o777, 0o600);
    assert.deepEqual(readdirSync(stateDir), ["report.json"]);

    const second = await runEquipmentAudit({ stateDir, loadStock });
    assert.equal(second.counts.new, 0);
    assert.equal(second.counts.changed, 0);
    assert.equal(second.counts.unchanged, 60);
    assert.deepEqual(JSON.parse(readFileSync(reportPath, "utf8")), second);
    assert.deepEqual(readdirSync(stateDir), ["report.json"]);
  });
});

test("failed and partial stock loads preserve the last valid report byte for byte", async () => {
  await withStateDirectory(async (stateDir) => {
    await runEquipmentAudit({
      stateDir,
      loadStock: async () => structuredClone(fixture.vehicles),
    });
    const reportPath = join(stateDir, "report.json");
    const previous = readFileSync(reportPath, "utf8");
    const invalidLoads = [
      async () => {
        throw new Error("Controlled stock loading failure");
      },
      async () =>
        parseStockResponse({
          ...apiResponse([apiVehicle()]),
          total_results: 60,
        }),
      async () => [],
    ];
    for (const loadStock of invalidLoads) {
      await assert.rejects(runEquipmentAudit({ stateDir, loadStock }));
      assert.equal(readFileSync(reportPath, "utf8"), previous);
      assert.deepEqual(readdirSync(stateDir), ["report.json"]);
    }
  });
});

test("failed warranty source loads preserve the last valid pending report byte for byte", async () => {
  await withStateDirectory(async (stateDir) => {
    const pending = { ...warrantyApiVehicle(), id: "99999" };
    const first = await runEquipmentAudit({
      stateDir,
      loadStock: async () => parseStockResponse(apiResponse([pending])),
    });
    assert.equal(first.vehicles[0].warranty?.status, "pending");
    const reportPath = join(stateDir, "report.json");
    const previous = readFileSync(reportPath, "utf8");
    for (const loadStock of [
      async () => {
        throw new Error("Controlled API failure");
      },
      async () =>
        parseStockResponse(apiResponse([{ ...pending, valor: undefined }])),
      async () =>
        parseStockResponse(apiResponse([{ ...pending, diferenciais: [null] }])),
    ]) {
      await assert.rejects(runEquipmentAudit({ stateDir, loadStock }));
      assert.equal(readFileSync(reportPath, "utf8"), previous);
      assert.deepEqual(readdirSync(stateDir), ["report.json"]);
    }
  });
});

test("an invalid previous report is preserved and prevents a new stock request", async () => {
  await withStateDirectory(async (stateDir) => {
    const reportPath = join(stateDir, "report.json");
    const invalid = '{"schemaVersion": 0, "vehicles": []}\n';
    writeFileSync(reportPath, invalid, { mode: 0o600 });
    let requested = false;
    await assert.rejects(
      runEquipmentAudit({
        stateDir,
        loadStock: async () => {
          requested = true;
          return fixture.vehicles;
        },
      }),
      /Relatório anterior inválido/,
    );
    assert.equal(requested, false);
    assert.equal(readFileSync(reportPath, "utf8"), invalid);
    assert.deepEqual(readdirSync(stateDir), ["report.json"]);
  });
});

test("a second concurrent audit cannot replace the first audit lock or start a stock load", async () => {
  await withStateDirectory(async (stateDir) => {
    let releaseStock!: (vehicles: EquipmentVehicle[]) => void;
    const waitingStock = new Promise<EquipmentVehicle[]>((resolve) => {
      releaseStock = resolve;
    });
    const first = runEquipmentAudit({
      stateDir,
      loadStock: () => waitingStock,
    });
    const { lockPath, ownerPath } = existingOwner(stateDir);
    let secondRequested = false;
    try {
      const initialLock = readFileSync(ownerPath, "utf8");
      assert.equal(statSync(lockPath).mode & 0o777, 0o700);
      assert.equal(statSync(ownerPath).mode & 0o777, 0o600);
      await assert.rejects(
        runEquipmentAudit({
          stateDir,
          loadStock: async () => {
            secondRequested = true;
            return fixture.vehicles;
          },
        }),
        /auditoria em execução/,
      );
      assert.equal(secondRequested, false);
      assert.equal(readFileSync(ownerPath, "utf8"), initialLock);
      assert.equal(existsSync(join(stateDir, "report.json")), false);
    } finally {
      releaseStock(structuredClone(fixture.vehicles));
      await first;
    }
    assert.deepEqual(readdirSync(stateDir), ["report.json"]);
  });
});

test("expired locks recover after PID reuse and remove only that owner's interrupted report", async () => {
  for (const temporary of [false, true]) {
    await withStateDirectory(async (stateDir) => {
      makeExpiredLock(stateDir, temporary);
      const report = await runEquipmentAudit({
        stateDir,
        loadStock: async () => fixture.vehicles,
      });
      assert.equal(report.counts.vehicles, 60);
      assert.deepEqual(readdirSync(stateDir), ["report.json"]);
    });
  }
});

test("only an old empty lock directory can be reclaimed; legacy lock files are preserved", async () => {
  await withStateDirectory(async (stateDir) => {
    const lockPath = join(stateDir, "audit.lock");
    mkdirSync(lockPath);
    await assert.rejects(
      runEquipmentAudit({ stateDir, loadStock: async () => fixture.vehicles }),
    );
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    utimesSync(lockPath, yesterday, yesterday);
    await runEquipmentAudit({
      stateDir,
      loadStock: async () => fixture.vehicles,
    });
    writeFileSync(lockPath, "legacy lock metadata");
    await assert.rejects(
      runEquipmentAudit({ stateDir, loadStock: async () => fixture.vehicles }),
      /Trava antiga ou desconhecida/,
    );
    assert.equal(readFileSync(lockPath, "utf8"), "legacy lock metadata");
  });
});

test("a resumed expired producer cannot overwrite its successor's report", async () => {
  await withStateDirectory(async (stateDir) => {
    let releaseStock!: (vehicles: EquipmentVehicle[]) => void;
    const waitingStock = new Promise<EquipmentVehicle[]>((resolve) => {
      releaseStock = resolve;
    });
    const first = runEquipmentAudit({
      stateDir,
      loadStock: () => waitingStock,
    });
    const { ownerPath, owner } = existingOwner(stateDir);
    writeFileSync(
      ownerPath,
      JSON.stringify({ ...owner, startedAt: "2000-01-01T00:00:00.000Z" }),
    );
    await runEquipmentAudit({
      stateDir,
      loadStock: async () => [stockVehicle("20051")],
    });
    const reportPath = join(stateDir, "report.json");
    const completed = readFileSync(reportPath, "utf8");
    releaseStock(fixture.vehicles);
    await assert.rejects(first, /perdeu a trava/);
    assert.equal(readFileSync(reportPath, "utf8"), completed);
    assert.deepEqual(readdirSync(stateDir), ["report.json"]);
  });
});

test("metadata write failure does not leave an empty permanent lock", async () => {
  await withStateDirectory(async (stateDir) => {
    const originalWrite = fs.writeFileSync;
    const replacement = mock.method(
      fs,
      "writeFileSync",
      (...args: Parameters<typeof writeFileSync>) => {
        if (String(args[0]).startsWith(join(stateDir, ".audit-lock.")))
          throw Object.assign(new Error("Simulated disk full"), {
            code: "ENOSPC",
          });
        return originalWrite(...args);
      },
    );
    syncBuiltinESMExports();
    try {
      await assert.rejects(
        runEquipmentAudit({
          stateDir,
          loadStock: async () => fixture.vehicles,
        }),
        /Simulated disk full/,
      );
      assert.deepEqual(readdirSync(stateDir), []);
    } finally {
      replacement.mock.restore();
      syncBuiltinESMExports();
    }
    await runEquipmentAudit({
      stateDir,
      loadStock: async () => fixture.vehicles,
    });
    assert.deepEqual(readdirSync(stateDir), ["report.json"]);
  });
});

test("recovery immediately before commit fences out the expired report writer", async () => {
  await withStateDirectory(async (stateDir) => {
    const originalRename = fs.renameSync;
    let successor: ReturnType<typeof runEquipmentAudit> | undefined;
    let intercepted = false;
    const replacement = mock.method(
      fs,
      "renameSync",
      (...args: Parameters<typeof fs.renameSync>) => {
        if (!intercepted && String(args[0]).endsWith(".report.tmp")) {
          intercepted = true;
          const { ownerPath, owner } = existingOwner(stateDir);
          writeFileSync(
            ownerPath,
            JSON.stringify({ ...owner, startedAt: "2000-01-01T00:00:00.000Z" }),
          );
          // Acquisition/reclamation is synchronous up to the pending stock load.
          // The old producer has already checked ownership immediately above us.
          successor = runEquipmentAudit({
            stateDir,
            loadStock: async () => [stockVehicle("20051")],
          });
        }
        return originalRename(...args);
      },
    );
    syncBuiltinESMExports();
    try {
      await assert.rejects(
        runEquipmentAudit({
          stateDir,
          loadStock: async () => fixture.vehicles,
        }),
        (error: unknown) => {
          assert.equal((error as NodeJS.ErrnoException).code, "ENOENT");
          return true;
        },
      );
      assert.ok(successor);
      const report = await successor;
      assert.equal(report.vehicles.length, 1);
      assert.equal(report.vehicles[0].id, "20051");
      assert.deepEqual(
        JSON.parse(readFileSync(join(stateDir, "report.json"), "utf8")),
        report,
      );
      assert.deepEqual(readdirSync(stateDir), ["report.json"]);
    } finally {
      replacement.mock.restore();
      syncBuiltinESMExports();
    }
  });
});

test("lock publication is atomic and never exposes an empty owner directory", async () => {
  await withStateDirectory(async (stateDir) => {
    const originalRename = fs.renameSync;
    let publications = 0;
    const replacement = mock.method(
      fs,
      "renameSync",
      (...args: Parameters<typeof fs.renameSync>) => {
        if (String(args[0]).startsWith(join(stateDir, ".audit-lock."))) {
          const entries = readdirSync(String(args[0]));
          assert.equal(entries.length, 1);
          assert.match(entries[0], /^[a-f0-9-]+\.json$/);
          assert.equal(
            JSON.parse(readFileSync(join(String(args[0]), entries[0]), "utf8"))
              .pid,
            process.pid,
          );
          assert.equal(existsSync(join(stateDir, "audit.lock")), false);
          publications++;
        }
        return originalRename(...args);
      },
    );
    syncBuiltinESMExports();
    try {
      await runEquipmentAudit({
        stateDir,
        loadStock: async () => fixture.vehicles,
      });
      assert.equal(publications, 1);
      assert.deepEqual(readdirSync(stateDir), ["report.json"]);
    } finally {
      replacement.mock.restore();
      syncBuiltinESMExports();
    }
  });
});

test(
  "simultaneous processes reclaim an orphan without admitting two producers",
  { timeout: 15000 },
  async () => {
    await withStateDirectory(async (stateDir) => {
      makeExpiredLock(stateDir);
      const auditorPath = fileURLToPath(
        new URL("../audit-vehicle-equipment.ts", import.meta.url),
      );
      const source = `
      const { runEquipmentAudit } = await import(process.argv[2]);
      const wait = (kind) => new Promise(resolve => {
        const receive = message => { if (message === kind) { process.off("message", receive); resolve(); } };
        process.on("message", receive);
      });
      const start = wait("start");
      process.send({ kind: "ready" });
      await start;
      try {
        await runEquipmentAudit({ stateDir: process.argv[3], loadStock: async () => {
          const finish = wait("finish");
          process.send({ kind: "loaded" });
          await finish;
          return [{ id: "12345", marca: "TEST", modelo: "VERSION", year: 2025, motor: "1.0", cambio: "AUTOMATICO", opcionais: [] }];
        }});
        process.send({ kind: "completed" });
      } catch (error) { process.send({ kind: "rejected", message: error.message }); }
      process.disconnect();
    `;
      const children = Array.from({ length: 3 }, () => {
        const child = spawn(
          process.execPath,
          [
            "--import",
            "tsx",
            "--input-type=module",
            "-e",
            source,
            "equipment-lock-test",
            auditorPath,
            stateDir,
          ],
          { stdio: ["ignore", "pipe", "pipe", "ipc"] },
        );
        let ready!: () => void;
        let attempted!: (attempt: { kind: string; message?: string }) => void;
        const readyPromise = new Promise<void>((resolve) => {
          ready = resolve;
        });
        const attemptPromise = new Promise<{ kind: string; message?: string }>(
          (resolve) => {
            attempted = resolve;
          },
        );
        const exitPromise = new Promise<number | null>((resolve) => {
          child.on("exit", resolve);
        });
        child.on("message", (message: { kind: string }) => {
          if (message.kind === "ready") ready();
          if (["loaded", "rejected"].includes(message.kind)) attempted(message);
        });
        return { child, readyPromise, attemptPromise, exitPromise };
      });
      try {
        await Promise.all(children.map((item) => item.readyPromise));
        for (const { child } of children) child.send("start");
        const attempts = await Promise.all(
          children.map((item) => item.attemptPromise),
        );
        assert.equal(
          attempts.filter(({ kind }) => kind === "loaded").length,
          1,
          JSON.stringify(attempts),
        );
        for (let index = 0; index < children.length; index++) {
          if (attempts[index].kind === "loaded")
            children[index].child.send("finish");
        }
        assert.deepEqual(
          await Promise.all(children.map((item) => item.exitPromise)),
          [0, 0, 0],
        );
        assert.deepEqual(readdirSync(stateDir), ["report.json"]);
      } finally {
        for (const { child } of children)
          if (child.exitCode === null) child.kill("SIGKILL");
        await Promise.all(children.map((item) => item.exitPromise));
      }
    });
  },
);

test("stock fetch uses the fixed public endpoint and rejects redirects", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (url, init) => {
    calls += 1;
    assert.equal(url, EQUIPMENT_STOCK_URL);
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal instanceof AbortSignal);
    return new Response(JSON.stringify(apiResponse([apiVehicle()])), {
      headers: { "Content-Type": "application/json" },
    });
  };
  assert.equal((await fetchEquipmentStock(fetcher)).length, 1);
  assert.equal(calls, 1);
});

test("stock fetch retries are bounded and never return remote failure details", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    throw new Error("PRIVATE_REMOTE_TOKEN_SENTINEL");
  };
  await assert.rejects(fetchEquipmentStock(fetcher), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /3 tentativas/);
    assert.ok(!error.message.includes("PRIVATE_"));
    return true;
  });
  assert.equal(calls, 3);
});

test("stock fetch reports only safe classified network, HTTP and validation failures", async () => {
  const cases: Array<{ fetcher: typeof fetch; expected: RegExp }> = [
    {
      fetcher: async () => new Response("PRIVATE_BODY", { status: 503 }),
      expected: /HTTP 503/,
    },
    {
      fetcher: async () => new Response("PRIVATE_INVALID_JSON"),
      expected: /não é JSON válido/,
    },
    {
      fetcher: async () =>
        new Response(
          JSON.stringify({ success: true, data: [], total_results: 2 }),
        ),
      expected: /Estoque incompleto/,
    },
    {
      fetcher: async () => {
        throw new Error("PRIVATE_OUTER", {
          cause: Object.assign(new Error("PRIVATE_TLS"), {
            code: "CERT_HAS_EXPIRED",
          }),
        });
      },
      expected: /CERT_HAS_EXPIRED/,
    },
    {
      fetcher: async () => {
        throw Object.assign(new Error("PRIVATE_TIMEOUT"), {
          name: "TimeoutError",
        });
      },
      expected: /Tempo limite/,
    },
    {
      fetcher: async () => {
        throw new Error("PRIVATE_OUTER", {
          cause: new AggregateError([
            Object.assign(new Error("PRIVATE_IP"), { code: "ENETUNREACH" }),
          ]),
        });
      },
      expected: /ENETUNREACH/,
    },
    {
      fetcher: async () => {
        throw new Error("PRIVATE_OUTER", {
          cause: new Error("unexpected redirect"),
        });
      },
      expected: /Redirecionamento/,
    },
  ];
  await Promise.all(
    cases.map(async ({ fetcher, expected }) => {
      await assert.rejects(fetchEquipmentStock(fetcher), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, expected);
        assert.ok(!error.message.includes("PRIVATE_"));
        return true;
      });
    }),
  );
});
