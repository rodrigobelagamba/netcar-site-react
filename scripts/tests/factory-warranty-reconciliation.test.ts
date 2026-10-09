import assert from "node:assert/strict";
import test from "node:test";
import {
  factoryWarrantyReviewFingerprint,
  factoryWarrantyToday,
  resolveFactoryWarranty,
  resolveFactoryPowertrainWarranty,
  resolveFactoryTractionBatteryWarranty,
  type FactoryWarrantyMatrix,
  type FactoryWarrantyRecord,
  type WarrantyCatalogVehicle,
} from "../../src/lib/factoryWarranty";
import {
  factoryWarrantyRuleFingerprint,
  reconcileFactoryWarrantyVehicle,
} from "../../src/lib/factoryWarrantyReconciliation";

const TODAY = "2026-10-09";
const key = (value: string) => `vin-sha256:${value.repeat(64)}`;
const candidate = (
  patch: Partial<WarrantyCatalogVehicle> = {},
): WarrantyCatalogVehicle => ({
  id: "new-unit",
  unitKey: key("b"),
  marca: "NISSAN",
  modelo: "KICKS ADVANCE",
  motor: "1.0",
  cambio: "Automático",
  anoFabricacao: 2025,
  year: 2026,
  km: 5100,
  price: 150000,
  diferenciais: [{ tag: "garantia_fabrica", descricao: "" }],
  ...patch,
});

function fixture(): FactoryWarrantyMatrix {
  const record: FactoryWarrantyRecord = {
    recordId: "reviewed-template",
    status: "approved",
    reviewedAt: TODAY,
    approvedFingerprint: "",
    vehicle: {
      vehicleId: "reviewed-unit",
      brand: "NISSAN",
      modelVersion: "KICKS ADVANCE",
      manufactureYear: 2025,
      modelYear: 2026,
    },
    unitBinding: {
      unitKey: key("a"),
      engine: "1.0",
      transmission: "Automático",
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
      reviewId: "review-2026",
      basis:
        "Approved exact model-year manual, common original term and conservative cap.",
      branches: [
        {
          category: "non-commercial",
          condition: "Documented non-commercial coverage",
          scope: "basic-vehicle",
          termYears: 3,
          mileage: { kind: "unlimited" },
          sourceIds: ["manual"],
        },
        {
          category: "commercial",
          condition: "Documented commercial coverage",
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
        url: "https://manufacturer.example/manual.pdf",
        locator: "Warranty pages 10-5 and 10-6",
        revision: "MPPT-P13C00; MY2026; v3",
        verification: {
          status: "verified",
          documentCode: "MPPT-P13C00",
          modelYear: 2026,
          reviewId: "review-2026",
          reviewedAt: TODAY,
        },
      },
    ],
  };
  record.approvedFingerprint = factoryWarrantyReviewFingerprint(record);
  const matrix: FactoryWarrantyMatrix = {
    schemaVersion: 2,
    enabled: true,
    requireUnitBinding: true,
    records: [record],
    automation: {
      schemaVersion: 1,
      rules: [
        {
          ruleId: "nissan-kicks-advance-my2026",
          version: "1",
          status: "approved",
          templateRecordId: record.recordId,
          match: {
            brand: "NISSAN",
            modelVersion: "KICKS ADVANCE",
            engine: "1.0",
            transmission: "Automático",
            manufactureYear: 2025,
            modelYear: 2026,
          },
          allowNewUnits: true,
          approvedFingerprint: "",
        },
      ],
    },
  };
  approveRule(matrix);
  return matrix;
}
function approveRule(matrix: FactoryWarrantyMatrix) {
  const rule = matrix.automation!.rules[0];
  rule.approvedFingerprint = factoryWarrantyRuleFingerprint(rule, matrix);
}
function approveTemplate(matrix: FactoryWarrantyMatrix) {
  const record = matrix.records[0];
  record.approvedFingerprint = factoryWarrantyReviewFingerprint(record);
  approveRule(matrix);
}
const run = (vehicle = candidate(), matrix = fixture(), today = TODAY) =>
  reconcileFactoryWarrantyVehicle(vehicle, matrix, today);

test("new exact unit derives a stamp from the approved common rule without mutating the registry", () => {
  const matrix = fixture();
  const before = JSON.stringify(matrix);
  const result = run(candidate(), matrix);
  assert.equal(result.status, "eligible");
  assert.equal(result.reason, "approved-exact-rule-applied");
  assert.equal(result.ruleVersion, "1");
  assert.equal(JSON.stringify(matrix), before);
  assert.equal(matrix.records.length, 1);
  assert.equal(result.matrix.records.length, 2);
  assert.equal(
    resolveFactoryWarranty(candidate(), result.matrix, TODAY)?.estimatedEndYear,
    2028,
  );
  assert.equal(result.matrix.records[1].usage, "unknown");
  assert.equal(result.matrix.records[1].unitBinding?.unitKey, key("b"));
});

for (const [label, patch] of [
  ["engine", { motor: "1.6" }],
  ["transmission", { cambio: "Manual" }],
  ["model", { modelo: "KICKS SENSE TURBO" }],
  ["brand", { marca: "OTHER" }],
  ["model-year", { year: 2025 }],
  ["manufacturing-year", { anoFabricacao: 2024 }],
] as Array<[string, Partial<WarrantyCatalogVehicle>]>) {
  test(`a changed ${label} never inherits the exact rule`, () => {
    const result = run(candidate(patch));
    assert.equal(result.status, "pending");
    assert.equal(result.reason, "no-approved-compatible-rule");
    assert.equal(
      resolveFactoryWarranty(candidate(patch), result.matrix, TODAY),
      undefined,
    );
  });
}

test("a missing or unverified document blocks even after metadata fingerprints are refreshed", () => {
  for (const missing of [true, false]) {
    const matrix = fixture();
    if (missing) matrix.records[0].sources = [];
    else matrix.records[0].sources[0].verification.status = "pending";
    approveTemplate(matrix);
    const result = run(candidate(), matrix);
    assert.equal(result.status, "blocked");
    assert.equal(result.matrix, matrix);
  }
});

test("the actual km cap, expired term and final-year uncertainty block a new unit", () => {
  assert.equal(run(candidate({ km: 100000 })).reason, "mileage-limit-reached");
  assert.equal(
    run(candidate(), fixture(), "2029-01-01").reason,
    "coverage-expired",
  );
  assert.equal(
    run(candidate(), fixture(), "2028-01-01").reason,
    "confirmed-expiry-required",
  );
});

test("removed flag, unknown flag and unavailable cars cannot acquire an approval", () => {
  assert.equal(
    run(candidate({ diferenciais: [] })).reason,
    "warranty-flag-removed",
  );
  assert.equal(
    run(candidate({ diferenciais: undefined })).reason,
    "warranty-flag-unknown",
  );
  assert.equal(run(candidate({ price: 0 })).reason, "vehicle-unavailable");
});

test("a changed rule version or template requires an explicit new rule fingerprint", () => {
  for (const mutate of [
    (matrix: FactoryWarrantyMatrix) => {
      matrix.automation!.rules[0].version = "2";
    },
    (matrix: FactoryWarrantyMatrix) => {
      matrix.records[0].termYears = 10;
    },
    (matrix: FactoryWarrantyMatrix) => {
      matrix.records[0].status = "revoked";
    },
  ]) {
    const matrix = fixture();
    mutate(matrix);
    assert.equal(run(candidate(), matrix).reason, "rule-approval-required");
  }
});

test("a rule cannot point a valid manual at a different engine even with a refreshed fingerprint", () => {
  const matrix = fixture();
  matrix.automation!.rules[0].match.engine = "1.6";
  approveRule(matrix);
  assert.equal(
    run(candidate({ motor: "1.6" }), matrix).reason,
    "rule-template-identity-conflict",
  );
});

test("existing approved records never transfer to a recycled ID or changed engine", () => {
  const original = candidate({ id: "reviewed-unit", unitKey: key("a") });
  const matrix = fixture();
  assert.equal(run(original, matrix).status, "eligible");
  assert.equal(run(original, matrix).ruleId, "unit:reviewed-template");
  assert.equal(run(original, matrix).ruleVersion, TODAY);
  for (const patch of [
    { unitKey: key("c") },
    { motor: "1.6" },
    { cambio: "Manual" },
  ]) {
    const result = run({ ...original, ...patch }, matrix);
    assert.equal(result.status, "blocked");
    assert.equal(result.matrix, matrix);
    assert.equal(
      resolveFactoryWarranty({ ...original, ...patch }, matrix, TODAY),
      undefined,
    );
  }
});

test("manual pending, rejection and revocation always take precedence over an automatic rule", () => {
  for (const status of ["pending", "revoked", "ineligible"] as const) {
    const matrix = fixture();
    const record = structuredClone(matrix.records[0]);
    record.recordId = "manual-current-unit";
    record.vehicle.vehicleId = "new-unit";
    record.unitBinding!.unitKey = key("b");
    record.status = status;
    record.approvedFingerprint = factoryWarrantyReviewFingerprint(record);
    matrix.records.push(record);
    const result = run(candidate(), matrix);
    assert.equal(result.status, status === "pending" ? "pending" : "blocked");
    assert.equal(result.reason, `manual-${status}`);
    assert.equal(result.matrix.records.length, 2);
  }
});

test("private use, powertrain, battery and individual expiry are never reusable templates", () => {
  for (const patch of [
    { usage: "private" as const, commonPolicy: undefined },
    { scope: "powertrain" as const },
    { supplementalCoverages: [] },
    { confirmedExpiryDate: "2028-10-09" },
    { confirmedExpiryMonth: "2028-10" },
  ]) {
    const matrix = fixture();
    Object.assign(matrix.records[0], patch);
    approveTemplate(matrix);
    assert.equal(run(candidate(), matrix).reason, "rule-template-not-reusable");
  }
});

test("missing stable identity or raw mechanical evidence remains pending", () => {
  for (const patch of [
    { unitKey: undefined },
    { unitKey: "new-unit" },
    { motor: undefined },
    { cambio: undefined },
    { km: NaN },
    { anoFabricacao: undefined },
  ])
    assert.equal(run(candidate(patch)).reason, "unit-data-incomplete");
});

test("duplicate compatible rules or duplicate principal records never select an arbitrary approval", () => {
  const matrix = fixture();
  matrix.automation!.rules.push(structuredClone(matrix.automation!.rules[0]));
  assert.equal(run(candidate(), matrix).reason, "conflicting-compatible-rules");
  const second = fixture();
  second.records.push(structuredClone(second.records[0]));
  assert.equal(
    run(candidate({ id: "reviewed-unit", unitKey: key("a") }), second).reason,
    "conflicting-unit-records",
  );
});

test("repeat processing is deterministic, while km/flag/identity/rules alter validation evidence", () => {
  const matrix = fixture();
  const result = run(candidate(), matrix);
  assert.deepEqual(run(candidate({ observedAt: Date.now() }), matrix), result);
  for (const patch of [
    { km: 5200 },
    { motor: "1.6" },
    { unitKey: key("c") },
    { diferenciais: [] },
  ])
    assert.notEqual(
      run(candidate(patch), matrix).inputFingerprint,
      result.inputFingerprint,
    );
  matrix.automation!.rules[0].version = "2";
  approveRule(matrix);
  assert.notEqual(
    run(candidate(), matrix).ruleFingerprint,
    result.ruleFingerprint,
  );
});

test("binding is fingerprinted, required only on migrated registries, and inherited by original gates", () => {
  const matrix = fixture();
  const original = candidate({ id: "reviewed-unit", unitKey: key("a") });
  delete matrix.records[0].unitBinding;
  matrix.records[0].approvedFingerprint = factoryWarrantyReviewFingerprint(
    matrix.records[0],
  );
  assert.equal(resolveFactoryWarranty(original, matrix, TODAY), undefined);
  matrix.requireUnitBinding = false;
  assert.ok(resolveFactoryWarranty(original, matrix, TODAY));
});

test("disabled registry remains disabled and a missing rule remains an explicit pending", () => {
  const matrix = fixture();
  matrix.enabled = false;
  assert.equal(run(candidate(), matrix).reason, "registry-unavailable");
  matrix.enabled = true;
  delete matrix.automation;
  assert.equal(run(candidate(), matrix).reason, "no-approved-compatible-rule");
});

test("a known unit cannot bypass approved, revoked or pending decisions by changing its catalog ID", () => {
  for (const status of [
    "approved",
    "pending",
    "revoked",
    "ineligible",
  ] as const) {
    const matrix = fixture();
    matrix.records[0].status = status;
    const renamed = candidate({ id: "renamed-unit", unitKey: key("a") });
    const result = run(renamed, matrix);
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "unit-id-changed");
    assert.equal(result.matrix.records.length, 1);
    assert.equal(
      resolveFactoryWarranty(renamed, result.matrix, TODAY),
      undefined,
    );
  }
});

test("malformed registry fields never throw from reconciliation or a public coverage resolver", () => {
  const original = candidate({ id: "reviewed-unit", unitKey: key("a") });
  const mutations: Array<(matrix: FactoryWarrantyMatrix) => void> = [
    (matrix) => {
      Reflect.deleteProperty(matrix.records[0], "mileage");
    },
    (matrix) => {
      Reflect.deleteProperty(matrix.records[0], "vehicle");
    },
    (matrix) => {
      Reflect.set(matrix.records[0], "sources", null);
    },
    (matrix) => {
      Reflect.set(matrix.records[0], "commonPolicy", { branches: [null] });
    },
    (matrix) => {
      Reflect.set(matrix.records[0].vehicle, "brand", null);
    },
    (matrix) => {
      Reflect.set(matrix, "records", {});
    },
  ];
  for (const mutate of mutations) {
    const matrix = fixture();
    mutate(matrix);
    const result = run(original, matrix);
    assert.notEqual(result.status, "eligible");
    for (const resolver of [
      resolveFactoryWarranty,
      resolveFactoryPowertrainWarranty,
      resolveFactoryTractionBatteryWarranty,
    ]) {
      assert.equal(resolver(original, matrix, TODAY), undefined);
      assert.equal(resolver(original, result.matrix, TODAY), undefined);
    }
  }
  const badMileage = fixture();
  Reflect.deleteProperty(badMileage.records[0], "mileage");
  const safe = run(original, badMileage);
  assert.equal(safe.reason, "registry-invalid");
  assert.equal(safe.matrix.enabled, false);
  assert.deepEqual(safe.matrix.records, []);
  const malformedSupplement = fixture();
  Reflect.set(malformedSupplement.records[0], "supplementalCoverages", [null]);
  assert.equal(
    resolveFactoryTractionBatteryWarranty(original, malformedSupplement, TODAY),
    undefined,
  );
  assert.ok(resolveFactoryWarranty(original, malformedSupplement, TODAY));
});

test("warranty dates follow Sao Paulo at UTC midnight and the actual local year rollover", () => {
  assert.equal(
    factoryWarrantyToday(new Date("2028-01-01T00:00:00.000Z")),
    "2027-12-31",
  );
  assert.equal(
    factoryWarrantyToday(new Date("2028-01-01T02:59:59.999Z")),
    "2027-12-31",
  );
  assert.equal(
    factoryWarrantyToday(new Date("2028-01-01T03:00:00.000Z")),
    "2028-01-01",
  );
  const matrix = fixture();
  const vehicle = candidate({ id: "reviewed-unit", unitKey: key("a") });
  assert.equal(
    run(vehicle, matrix, factoryWarrantyToday(new Date("2028-01-01T02:59:59Z")))
      .status,
    "eligible",
  );
  assert.equal(
    run(vehicle, matrix, factoryWarrantyToday(new Date("2028-01-01T03:00:00Z")))
      .reason,
    "confirmed-expiry-required",
  );
});

test("a confirmed expiry remains valid through its Sao Paulo civil day", () => {
  const matrix = fixture();
  matrix.records[0].confirmedExpiryDate = "2027-12-31";
  approveTemplate(matrix);
  const vehicle = candidate({ id: "reviewed-unit", unitKey: key("a") });
  assert.equal(
    run(vehicle, matrix, factoryWarrantyToday(new Date("2028-01-01T02:59:59Z")))
      .status,
    "eligible",
  );
  assert.equal(
    run(vehicle, matrix, factoryWarrantyToday(new Date("2028-01-01T03:00:00Z")))
      .reason,
    "coverage-expired",
  );
});

test("month-only expiry changes status at the start of the confirmed Sao Paulo month", () => {
  const matrix = fixture();
  matrix.records[0].confirmedExpiryMonth = "2026-12";
  approveTemplate(matrix);
  const vehicle = candidate({ id: "reviewed-unit", unitKey: key("a") });
  const beforeMonth = factoryWarrantyToday(new Date("2026-12-01T02:59:59.999Z"));
  const startMonth = factoryWarrantyToday(new Date("2026-12-01T03:00:00.000Z"));
  assert.equal(beforeMonth, "2026-11-30");
  assert.equal(startMonth, "2026-12-01");
  assert.equal(run(vehicle, matrix, beforeMonth).status, "eligible");
  assert.equal(run(vehicle, matrix, startMonth).reason, "confirmed-expiry-day-required");
  assert.equal(run(vehicle, matrix, "2026-12-31").reason, "confirmed-expiry-day-required");
  assert.equal(run(vehicle, matrix, "2027-01-01").reason, "coverage-expired");
  assert.equal(matrix.records[0].confirmedExpiryDate, undefined);
});

test("missing, invalid and conflicting expiry evidence are separate review reasons", () => {
  const vehicle = candidate({ id: "reviewed-unit", unitKey: key("a") });
  const missing = fixture();
  assert.equal(run(vehicle, missing, "2028-10-09").reason, "confirmed-expiry-required");
  for (const patch of [
    { confirmedExpiryMonth: "2028-13" },
    { confirmedExpiryMonth: "2028-12", confirmedExpiryDate: "2028-12-20" },
  ]) {
    const matrix = fixture();
    Object.assign(matrix.records[0], patch);
    approveTemplate(matrix);
    assert.equal(run(vehicle, matrix, "2028-10-09").reason, "confirmed-expiry-invalid");
    assert.equal(resolveFactoryWarranty(vehicle, matrix, "2028-10-09"), undefined);
  }
});

test("reply notes and month facts do not override the pending manual decision", () => {
  const matrix = fixture();
  const record = matrix.records[0];
  record.status = "pending";
  record.confirmedExpiryMonth = "2026-12";
  Reflect.set(record, "notes", "Owner replied: warranty expires December 2026. Reviewed.");
  approveTemplate(matrix);
  const vehicle = candidate({ id: "reviewed-unit", unitKey: key("a") });
  assert.equal(run(vehicle, matrix).reason, "manual-pending");
  assert.equal(resolveFactoryWarranty(vehicle, matrix, TODAY), undefined);
});
