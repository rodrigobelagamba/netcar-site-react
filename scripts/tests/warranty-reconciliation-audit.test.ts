import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildEquipmentAudit,
  parseStockResponse,
  runEquipmentAudit,
} from "../audit-vehicle-equipment";
import { factoryWarrantyCatalogFromApi } from "../lib/factory-warranty-catalog.js";
import {
  factoryWarrantyReviewFingerprint,
  resolveFactoryWarranty,
  type FactoryWarrantyMatrix,
  type FactoryWarrantyRecord,
  type WarrantyCatalogVehicle,
} from "../../src/lib/factoryWarranty";
import {
  factoryWarrantyRuleFingerprint,
  reconcileFactoryWarrantyVehicle,
} from "../../src/lib/factoryWarrantyReconciliation";

const NOW = "2026-10-09T16:00:00.000Z";
const LATER = "2026-10-10T16:00:00.000Z";
const raw = (patch: Record<string, unknown> = {}) => ({
  id: "90002",
  chassi: "9BWZZZ377VT004251",
  placa: "ABC1D23",
  marca: "NISSAN",
  modelo: "KICKS ADVANCE",
  motor: "1.0",
  cambio: "AUTOMATICO",
  ano_fabricacao: 2025,
  ano: 2026,
  km: 5100,
  valor: 150000,
  opcionais: [],
  diferenciais: [{ tag: "garantia_fabrica", descricao: "Garantia de fábrica" }],
  ...patch,
});
const payload = (data: Record<string, unknown>[]) => ({
  success: true,
  total_results: data.length,
  limit: 500,
  offset: 0,
  data,
});
const parse = (rows = [raw()]) => parseStockResponse(payload(rows));
function fixture(): FactoryWarrantyMatrix {
  const record: FactoryWarrantyRecord = {
    recordId: "approved-exact-template",
    status: "approved",
    reviewedAt: "2026-10-09",
    approvedFingerprint: "",
    vehicle: {
      vehicleId: "90001",
      brand: "NISSAN",
      modelVersion: "KICKS ADVANCE",
      manufactureYear: 2025,
      modelYear: 2026,
    },
    unitBinding: {
      unitKey: `vin-sha256:${"a".repeat(64)}`,
      engine: "1.0",
      transmission: "AUTOMATICO",
    },
    optionalId: 108,
    optionalConfirmed: true,
    conditionsConfirmed: true,
    scope: "basic-vehicle",
    termYears: 3,
    usage: "unknown",
    reviewedMileageKm: 5100,
    mileage: { kind: "limited", limitKm: 100000 },
    commonPolicy: {
      kind: "documented-regime-intersection",
      reviewId: "fixture-review",
      basis:
        "Explicitly reviewed common CPF/CNPJ policy for exact model and year.",
      branches: [
        {
          category: "cpf",
          condition: "CPF",
          scope: "basic-vehicle",
          termYears: 3,
          mileage: { kind: "unlimited" },
          sourceIds: ["manual"],
        },
        {
          category: "cnpj",
          condition: "CNPJ",
          scope: "basic-vehicle",
          termYears: 3,
          mileage: { kind: "limited", limitKm: 100000 },
          sourceIds: ["manual"],
        },
      ],
    },
    sources: [
      {
        sourceId: "manual",
        url: "https://www.nissan.com.br/manual-fixture.pdf",
        locator: "10-5 and 10-6",
        revision: "MPPT-P13C00 v3 MY2026",
        verification: {
          status: "verified",
          documentCode: "MPPT-P13C00",
          modelYear: 2026,
          reviewId: "fixture-review",
          reviewedAt: "2026-10-09",
        },
      },
    ],
  };
  const matrix: FactoryWarrantyMatrix = {
    schemaVersion: 2,
    enabled: true,
    requireUnitBinding: true,
    records: [record],
    automation: {
      schemaVersion: 1,
      rules: [
        {
          ruleId: "fixture-exact-kicks",
          version: "1",
          status: "approved",
          templateRecordId: record.recordId,
          match: {
            brand: "NISSAN",
            modelVersion: "KICKS ADVANCE",
            engine: "1.0",
            transmission: "AUTOMATICO",
            manufactureYear: 2025,
            modelYear: 2026,
          },
          allowNewUnits: true,
          approvedFingerprint: "",
        },
      ],
    },
  };
  approve(matrix);
  return matrix;
}
function approve(matrix: FactoryWarrantyMatrix) {
  matrix.records[0].approvedFingerprint = factoryWarrantyReviewFingerprint(
    matrix.records[0],
  );
  const rule = matrix.automation!.rules[0];
  rule.approvedFingerprint = factoryWarrantyRuleFingerprint(rule, matrix);
}

test("audit concretely resolves a new exact eligible unit using the same runtime reconciliation", () => {
  const matrix = fixture();
  const before = JSON.stringify(matrix);
  const source = factoryWarrantyCatalogFromApi(raw())!;
  const effective = reconcileFactoryWarrantyVehicle(
    source,
    matrix,
    NOW.slice(0, 10),
  );
  assert.equal(
    resolveFactoryWarranty(source, effective.matrix, NOW.slice(0, 10))
      ?.estimatedEndYear,
    2028,
  );
  const report = buildEquipmentAudit(parse(), null, NOW, matrix);
  const warranty = report.vehicles[0].warranty!;
  assert.equal(warranty.status, "eligible");
  assert.equal(warranty.reason, "approved-exact-rule-applied");
  assert.equal(warranty.ruleId, "fixture-exact-kicks");
  assert.equal(warranty.ruleVersion, "1");
  assert.equal(warranty.recordIds.length, 1);
  assert.match(warranty.inputFingerprint!, /^[a-f0-9]{64}$/);
  assert.match(warranty.ruleFingerprint!, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(matrix), before);
  assert.equal(report.newWarrantyAlerts?.length, 0);
  const repeated = buildEquipmentAudit(parse(), report, LATER, matrix);
  assert.equal(repeated.counts.unchanged, 1);
  assert.equal(repeated.warrantyHistory?.[0].states.length, 1);
  assert.equal(repeated.newWarrantyAlerts?.length, 0);
  for (const sensitive of [
    "9BWZZZ377VT004251",
    "ABC1D23",
    '"chassi"',
    '"placa"',
  ])
    assert.ok(!JSON.stringify(report).includes(sensitive));
});

test("the existing audit persists month-boundary review and alerts once without inventing an expiry day", () => {
  const matrix = fixture();
  const source = raw({ id: "90001" });
  const record = matrix.records[0];
  record.unitBinding!.unitKey = factoryWarrantyCatalogFromApi(source)!.unitKey!;
  record.confirmedExpiryMonth = "2026-12";
  approve(matrix);
  const input = parse([source]);
  const before = JSON.stringify(matrix);
  const october = buildEquipmentAudit(input, null, NOW, matrix);
  assert.equal(october.vehicles[0].warranty?.status, "eligible");
  assert.equal(october.newWarrantyAlerts?.length, 0);
  const december = buildEquipmentAudit(input, october, "2026-12-01T03:00:00.000Z", matrix);
  assert.equal(december.vehicles[0].warranty?.reason, "confirmed-expiry-day-required");
  assert.equal(december.newWarrantyAlerts?.length, 1);
  assert.equal(december.newWarrantyAlerts?.[0].reason, "confirmed-expiry-day-required");
  const restored = JSON.parse(JSON.stringify(december));
  const repeated = buildEquipmentAudit(input, restored, "2026-12-15T15:00:00.000Z", matrix);
  assert.equal(repeated.vehicles[0].warranty?.reason, "confirmed-expiry-day-required");
  assert.equal(repeated.newWarrantyAlerts?.length, 0);
  assert.equal(repeated.warrantyHistory?.[0].states.length, 2);
  const january = buildEquipmentAudit(input, repeated, "2027-01-01T03:00:00.000Z", matrix);
  assert.equal(january.vehicles[0].warranty?.reason, "coverage-expired");
  assert.equal(JSON.stringify(matrix), before);
  assert.equal(record.confirmedExpiryDate, undefined);
});

test("specific incompatible-engine pendency is emitted once and kept after unknown absence", () => {
  const matrix = fixture();
  const changed = parse([raw({ motor: "1.6" })]);
  const first = buildEquipmentAudit(changed, null, NOW, matrix);
  assert.equal(
    first.vehicles[0].warranty?.reason,
    "no-approved-compatible-rule",
  );
  assert.equal(first.newWarrantyAlerts?.length, 1);
  const before = JSON.stringify(first);
  const repeated = buildEquipmentAudit(changed, first, LATER, matrix);
  assert.equal(repeated.newWarrantyAlerts?.length, 0);
  assert.equal(JSON.stringify(first), before);
  const absent = buildEquipmentAudit(
    parse([raw({ id: "90003", diferenciais: [] })]),
    repeated,
    LATER,
    matrix,
  );
  const entry = absent.warrantyHistory?.find(
    (item) => item.vehicleId === "90002",
  );
  assert.equal(entry?.inventoryPresence, "unknown-absence");
  assert.deepEqual(entry?.lastWarranty, first.vehicles[0].warranty);
  assert.equal(absent.newWarrantyAlerts?.length, 0);
  const returned = buildEquipmentAudit(changed, absent, LATER, matrix);
  assert.equal(returned.newWarrantyAlerts?.length, 0);
  assert.equal(
    returned.warrantyHistory?.find((item) => item.vehicleId === "90002")
      ?.inventoryPresence,
    "present",
  );
});

test("a reused numeric ID produces a distinct opaque history and cannot inherit manual approval", () => {
  const matrix = fixture();
  const original = raw({ id: "90001" });
  matrix.records[0].unitBinding!.unitKey =
    factoryWarrantyCatalogFromApi(original)!.unitKey!;
  approve(matrix);
  const first = buildEquipmentAudit(parse([original]), null, NOW, matrix);
  assert.equal(first.vehicles[0].warranty?.status, "eligible");
  const reused = buildEquipmentAudit(
    parse([raw({ id: "90001", chassi: "9BWZZZ377VT004252" })]),
    first,
    LATER,
    matrix,
  );
  assert.equal(reused.vehicles[0].warranty?.status, "blocked");
  assert.equal(reused.vehicles[0].warranty?.reason, "unit-identity-changed");
  assert.equal(reused.warrantyHistory?.length, 2);
  assert.equal(
    reused.warrantyHistory?.filter(
      (entry) => entry.inventoryPresence === "unknown-absence",
    ).length,
    1,
  );
  assert.equal(reused.newWarrantyAlerts?.length, 1);
});

test("rule changes, missing source, expiry, mileage limit and withdrawn flag yield distinct decisions", () => {
  const matrix = fixture();
  const first = buildEquipmentAudit(parse(), null, NOW, matrix);
  const ruleChange = structuredClone(matrix);
  ruleChange.automation!.rules[0].version = "2";
  const changed = buildEquipmentAudit(parse(), first, LATER, ruleChange);
  assert.equal(changed.vehicles[0].warranty?.reason, "rule-approval-required");
  assert.notEqual(
    changed.vehicles[0].warranty?.ruleFingerprint,
    first.vehicles[0].warranty?.ruleFingerprint,
  );
  assert.equal(changed.newWarrantyAlerts?.length, 1);
  const missing = structuredClone(matrix);
  missing.records[0].sources = [];
  approve(missing);
  assert.equal(
    buildEquipmentAudit(parse(), first, LATER, missing).vehicles[0].warranty
      ?.status,
    "blocked",
  );
  assert.equal(
    buildEquipmentAudit(parse(), first, "2028-01-01T12:00:00Z", matrix)
      .vehicles[0].warranty?.reason,
    "confirmed-expiry-required",
  );
  assert.equal(
    buildEquipmentAudit(parse(), first, "2029-01-01T12:00:00Z", matrix)
      .vehicles[0].warranty?.reason,
    "coverage-expired",
  );
  assert.equal(
    buildEquipmentAudit(parse([raw({ km: 100000 })]), first, LATER, matrix)
      .vehicles[0].warranty?.reason,
    "mileage-limit-reached",
  );
  const existing = raw({ id: "90001" });
  matrix.records[0].unitBinding!.unitKey =
    factoryWarrantyCatalogFromApi(existing)!.unitKey!;
  approve(matrix);
  assert.equal(
    buildEquipmentAudit(
      parse([raw({ id: "90001", diferenciais: [] })]),
      first,
      LATER,
      matrix,
    ).vehicles[0].warranty?.reason,
    "warranty-flag-removed",
  );
});

test("state history is bounded while unchanged pending conditions do not generate mileage noise", () => {
  const matrix = fixture();
  let report = buildEquipmentAudit(
    parse([raw({ motor: "1.6" })]),
    null,
    NOW,
    matrix,
  );
  for (let index = 1; index <= 30; index++) {
    report = buildEquipmentAudit(
      parse([raw({ motor: "1.6", km: 5100 + index })]),
      report,
      LATER,
      matrix,
    );
    assert.equal(report.newWarrantyAlerts?.length, 0);
  }
  assert.equal(report.warrantyHistory?.[0].states.length, 20);
});

test("an exactly full 500-row page is rejected as potentially truncated", () => {
  const fiveHundred = Array.from({ length: 500 }, (_, index) =>
    raw({ id: String(91000 + index) }),
  );
  assert.throws(
    () => parseStockResponse(payload(fiveHundred)),
    /incompleto|limite/,
  );
  assert.equal(
    parseStockResponse(payload(fiveHundred.slice(0, 499))).length,
    499,
  );
});

test("failed and partial inputs preserve the previous private report and history byte-for-byte", async () => {
  const stateDir = mkdtempSync(join(tmpdir(), "netcar-warranty-audit-"));
  try {
    await runEquipmentAudit({ stateDir, loadStock: async () => parse() });
    const previous = readFileSync(join(stateDir, "report.json"), "utf8");
    for (const loadStock of [
      async () => {
        throw new Error("simulated temporary network failure");
      },
      async () => parseStockResponse({ ...payload([raw()]), total_results: 2 }),
    ]) {
      await assert.rejects(runEquipmentAudit({ stateDir, loadStock }));
      assert.equal(
        readFileSync(join(stateDir, "report.json"), "utf8"),
        previous,
      );
    }
  } finally {
    rmSync(stateDir, { recursive: true, force: true });
  }
});

test("flag removal on an automatic unit remains an explicit present history observation", () => {
  const matrix = fixture();
  const first = buildEquipmentAudit(parse(), null, NOW, matrix);
  const noFlag = parse([raw({ diferenciais: [] })]);
  const removed = buildEquipmentAudit(noFlag, first, LATER, matrix);
  assert.equal(removed.vehicles[0].warranty, undefined);
  assert.equal(removed.warrantyHistory?.[0].inventoryPresence, "present");
  assert.equal(
    removed.warrantyHistory?.[0].lastWarranty.reason,
    "warranty-flag-removed",
  );
  assert.equal(removed.warrantyHistory?.[0].lastWarranty.flagPresent, false);
  const repeated = buildEquipmentAudit(noFlag, removed, LATER, matrix);
  assert.equal(repeated.warrantyHistory?.[0].states.length, 2);
  assert.equal(repeated.newWarrantyAlerts?.length, 0);
});

test("a mileage reduction on the same automatic unit produces one specific audit alert", () => {
  const matrix = fixture();
  const first = buildEquipmentAudit(parse(), null, NOW, matrix);
  const reduced = parse([raw({ km: 5000 })]);
  const report = buildEquipmentAudit(reduced, first, LATER, matrix);
  assert.equal(report.newWarrantyAlerts?.length, 1);
  assert.equal(
    report.newWarrantyAlerts?.[0].code,
    "factory-warranty-mileage-regression",
  );
  assert.equal(
    report.newWarrantyAlerts?.[0].reason,
    "mileage-regressed-since-last-observation",
  );
  const repeat = buildEquipmentAudit(reduced, report, LATER, matrix);
  assert.equal(repeat.newWarrantyAlerts?.length, 0);
});

test("audit honors the reconciliation unit-ID block for general, powertrain and traction battery coverage", () => {
  const published = JSON.parse(readFileSync(new URL("../../src/data/factoryWarrantyMatrix.json", import.meta.url), "utf8")) as FactoryWarrantyMatrix;
  const inventory = JSON.parse(readFileSync(new URL("../../docs/audits/factory-warranty-reconciliation-2026-10-09.json", import.meta.url), "utf8")) as { publicVehicles: WarrantyCatalogVehicle[] };
  for (const id of ["19587", "19924", "20066"]) {
    const source = inventory.publicVehicles.find((entry) => entry.id === id)!;
    const input = parse([{ id: source.id, marca: source.marca, modelo: source.modelo,
      motor: source.motor, cambio: source.cambio, ano: source.year, ano_fabricacao: source.anoFabricacao,
      km: source.km, valor: source.price, opcionais: [], diferenciais: source.diferenciais,
      factoryWarrantyVehicle: source }]);
    const intact = buildEquipmentAudit(input, null, NOW, published).vehicles[0].warranty!;
    if (id === "20066") {
      assert.equal(intact.status, "blocked");
      assert.equal(intact.reason, "canonical-general-gate-rejected");
      assert.equal(intact.powertrain?.status, "eligible");
    } else assert.equal(intact.status, "eligible");
    if (id === "19924") assert.equal(intact.supplemental?.status, "eligible");
    const conflicted = structuredClone(published);
    const formerId = structuredClone(conflicted.records.find((entry) => entry.vehicle.vehicleId === id)!);
    formerId.recordId = `prior-decision-${id}`;
    formerId.vehicle.vehicleId = `prior-${id}`;
    formerId.status = "revoked";
    conflicted.records.push(formerId);
    const report = buildEquipmentAudit(input, null, NOW, conflicted);
    const blocked = report.vehicles[0].warranty!;
    assert.equal(blocked.status, "blocked");
    assert.equal(blocked.reason, "unit-id-changed");
    if (id === "20066") assert.equal(blocked.powertrain?.status, "blocked");
    if (id === "19924") assert.equal(blocked.supplemental?.status, "blocked");
    assert.ok(report.newWarrantyAlerts?.some((alert) => alert.reason === "unit-id-changed"));
  }
});
