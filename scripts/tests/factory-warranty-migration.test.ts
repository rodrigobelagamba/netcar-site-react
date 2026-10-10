import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  factoryWarrantyReviewFingerprint,
  factoryTractionBatteryReviewFingerprint,
  resolveFactoryWarranty,
  resolveFactoryPowertrainWarranty,
  resolveFactoryTractionBatteryWarranty,
  type FactoryWarrantyMatrix,
  type FactoryWarrantyRecord,
  type FactoryWarrantyAutomationRule,
  type WarrantyCatalogVehicle,
} from "../../src/lib/factoryWarranty";
import {
  factoryWarrantyRuleFingerprint,
  reconcileFactoryWarrantyVehicle,
} from "../../src/lib/factoryWarrantyReconciliation";

const read = (file: string) =>
  JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8"));
const baseline = read(
  "../../docs/audits/factory-warranty-reconciliation-baseline-2026-10-09.json",
) as {
  capturedFromCommit: string;
  matrix: FactoryWarrantyMatrix;
};
const current = read(
  "../../src/data/factoryWarrantyMatrix.json",
) as FactoryWarrantyMatrix;
const compassAudit = read("../../docs/audits/factory-warranty-compass-19866-2026-10-10.json");

test("confirmed Compass displays its five-year general stamp without approving other Jeep units", () => {
  const record = current.records.find((entry) => entry.vehicle.vehicleId === "19866")!;
  const vehicle = compassAudit.publicVehicle as WarrantyCatalogVehicle;
  const date = "2026-10-10";
  assert.deepEqual(record, compassAudit.approvedRecord);
  assert.equal(record.approvedFingerprint, factoryWarrantyReviewFingerprint(record));
  assert.equal(record.status, "approved");
  assert.equal(record.usage, "private");
  assert.deepEqual(record.mileage, { kind: "unlimited" });
  assert.equal(reconcileFactoryWarrantyVehicle(vehicle, current, date).status, "eligible");
  assert.equal(resolveFactoryWarranty(vehicle, current, date)?.estimatedEndYear, 2029);
  assert.equal(resolveFactoryWarranty({ ...vehicle, km: 150000 }, current, date)?.estimatedEndYear, 2029);
  assert.equal(resolveFactoryPowertrainWarranty(vehicle, current, date), undefined);
  assert.equal(resolveFactoryTractionBatteryWarranty(vehicle, current, date), undefined);
  assert.equal(resolveFactoryWarranty(vehicle, current, "2029-01-01"), undefined);
  for (const patch of [
    { price: 0 }, { diferenciais: [] }, { unitKey: undefined },
    { motor: "2.0" }, { year: 2024 }, { km: record.reviewedMileageKm - 1 },
    { id: "different-compass" },
  ]) {
    const changed = { ...vehicle, ...patch };
    const decision = reconcileFactoryWarrantyVehicle(changed, current, date);
    assert.notEqual(decision.status, "eligible");
    assert.equal(resolveFactoryWarranty(changed, decision.matrix, date), undefined);
  }
  assert.equal(current.automation!.rules.some((rule) => rule.templateRecordId === record.recordId), false);
});

test("Compass release preserves all other records and separates owner confirmation from official evidence", () => {
  const others = current.records.filter((entry) => entry.vehicle.vehicleId !== "19866");
  assert.equal(others.length, compassAudit.preservation.otherRecordCount);
  assert.equal(createHash("sha256").update(JSON.stringify(others)).digest("hex"), compassAudit.preservation.otherRecordsSha256);
  assert.equal(compassAudit.ownerAttestations.publicationAuthorized, true);
  assert.equal(compassAudit.ownerAttestations.usageIsEstablishedNetcarPolicy, true);
  assert.equal(compassAudit.previousRecord.status, "pending");
  assert.equal(compassAudit.timing.actualStartDate, null);
  assert.equal(compassAudit.timing.confirmedExpiryDate, null);
  assert.equal(compassAudit.timing.resaleRestartsTerm, false);
  assert.equal(compassAudit.approvedRecord.sources[0].verification.modelYear, 2025);
});
const migration = read(
  "../../docs/audits/factory-warranty-reconciliation-2026-10-09.json",
) as {
  observedAt: string;
  baselineCommit: string;
  count: number;
  migratedApprovedIds: string[];
  reusableTemplateIds: string[];
  preservedIndividualOnly: string[];
  publicVehicles: WarrantyCatalogVehicle[];
};
const kicksAudit = read(
  "../../docs/audits/factory-warranty-kicks-20019-2026-10-09.json",
) as {
  reviewedAt: string;
  approvedRecord: FactoryWarrantyRecord;
  approvedRule: FactoryWarrantyAutomationRule;
  actualStartDate: null;
  actualExpiryDate: null;
  estimatedEndYear: number;
  title: string;
  footnote: string;
  identityCorrespondence: {
    xml: { unitKey: string; fields: { modelVersion: string } };
    api: { unitKey: string; fields: { modelVersion: string } };
    unitComparison: {
      sameOpaquePlateIdentity: boolean;
      sameVehicleId: boolean;
      termsEqual: Record<string, boolean>;
    };
    officialDocumentEvidence: {
      publicationCode: string;
      officialIndexModelYear: number;
      sha256: string;
    };
  };
};
const monthAudit = read("../../docs/audits/factory-warranty-month-precision-2026-10-09.json") as {
  schemaVersion: number;
  reviewedAt: string;
  previousSourceCommit: string;
  approvedVehicleIds: string[];
  records: Array<{
    vehicleId: string;
    recordId: string;
    approvedPublication: boolean;
    termYears: number;
    mileagePolicy: string;
    usage: string;
    confirmedExpiryMonth: string | null;
    sourceVerified: boolean;
    sourceDocumentCode: string;
    ownerAttestations: unknown;
    limitations: unknown;
  }>;
};
const TODAY = migration.observedAt.slice(0, 10);
const OLD_APPROVED = baseline.matrix.records.filter(
  (record) => record.status === "approved",
);
const EXPECTED_BASIC = [
  "19587",
  "19857",
  "19924",
  "19994",
  "20038",
  "20049",
  "20075",
];
const EXPECTED_POWERTRAIN = ["20029", "20041", "20066"];
const MONTH_RELEASE_IDS = ["19779", "19854", "19898"];
const oldRecord = (id: string) =>
  baseline.matrix.records.find((record) => record.vehicle.vehicleId === id)!;
const currentRecord = (id: string) =>
  current.records.find((record) => record.vehicle.vehicleId === id)!;
const observed = (id: string) => {
  const vehicle = migration.publicVehicles.find((entry) => entry.id === id);
  assert.ok(vehicle, `Current public snapshot missing vehicle ${id}`);
  return vehicle;
};
const keyFor = (id: string) =>
  `vin-sha256:${createHash("sha256").update(id).digest("hex")}`;
const anyCoverage = (vehicle: WarrantyCatalogVehicle, matrix = current) =>
  resolveFactoryWarranty(vehicle, matrix, TODAY) ||
  resolveFactoryPowertrainWarranty(vehicle, matrix, TODAY) ||
  resolveFactoryTractionBatteryWarranty(vehicle, matrix, TODAY);

function beforeBinding(record: FactoryWarrantyRecord): FactoryWarrantyRecord {
  const restored = structuredClone(record);
  delete restored.unitBinding;
  // Pending snapshots are intentionally not reapproved during the migration.
  if (restored.status === "approved") {
    restored.approvedFingerprint = factoryWarrantyReviewFingerprint(restored);
    for (const coverage of restored.supplementalCoverages || []) {
      coverage.approvedFingerprint = factoryTractionBatteryReviewFingerprint(
        restored,
        coverage,
      );
    }
  }
  return restored;
}

test("migration baseline is the immutable release captured from c76f883", () => {
  assert.equal(
    baseline.capturedFromCommit,
    "c76f883afcb84e86d704e1c047208b0679178529",
  );
  assert.equal(migration.baselineCommit, baseline.capturedFromCommit);
  assert.equal(
    createHash("sha256").update(JSON.stringify(baseline.matrix)).digest("hex"),
    "154bdd1d66b0bf0af3bbaa4f5a543a295ecd57b40daba4e77b8d0e17231d4fdc",
  );
  assert.equal(baseline.matrix.records.length, 16);
  assert.equal(OLD_APPROVED.length, 10);
});

for (const prior of baseline.matrix.records.filter(
  (record) => !["20019", "19866"].includes(record.vehicle.vehicleId) && !MONTH_RELEASE_IDS.includes(record.vehicle.vehicleId),
)) {
  const id = prior.vehicle.vehicleId;
  test(`migration preserves every prior coverage, source, condition and decision for ${id}`, () => {
    const active = currentRecord(id);
    assert.ok(active);
    assert.deepEqual(beforeBinding(active), prior);
    if (active.status === "approved")
      assert.equal(
        active.approvedFingerprint,
        factoryWarrantyReviewFingerprint(active),
      );
  });
}

test("the current registry requires opaque stable identity on every approved unit", () => {
  assert.equal(current.schemaVersion, 2);
  assert.equal(current.enabled, true);
  assert.equal(current.requireUnitBinding, true);
  assert.equal(
    new Set(current.records.map((record) => record.vehicle.vehicleId)).size,
    current.records.length,
  );
  for (const record of current.records.filter(
    (entry) => entry.status === "approved",
  )) {
    const source = observed(record.vehicle.vehicleId);
    assert.match(
      record.unitBinding?.unitKey || "",
      /^(?:vin|plate)-sha256:[a-f0-9]{64}$/,
    );
    assert.equal(record.unitBinding?.unitKey, source.unitKey);
    assert.equal(record.unitBinding?.engine, source.motor);
    assert.equal(record.unitBinding?.transmission, source.cambio);
    assert.equal(
      record.approvedFingerprint,
      factoryWarrantyReviewFingerprint(record),
    );
  }
  assert.deepEqual(
    [...migration.migratedApprovedIds].sort(),
    OLD_APPROVED.map((record) => record.vehicle.vehicleId).sort(),
  );
});

test("all ten previously approved public units retain their exact scopes and estimates", () => {
  const general: string[] = [];
  const powertrain: string[] = [];
  const battery: string[] = [];
  for (const prior of OLD_APPROVED) {
    const id = prior.vehicle.vehicleId;
    const vehicle = observed(id);
    const expectedYear = prior.vehicle.manufactureYear + prior.termYears;
    const basic = resolveFactoryWarranty(vehicle, current, TODAY);
    const motor = resolveFactoryPowertrainWarranty(vehicle, current, TODAY);
    const traction = resolveFactoryTractionBatteryWarranty(
      vehicle,
      current,
      TODAY,
    );
    assert.equal(
      reconcileFactoryWarrantyVehicle(vehicle, current, TODAY).status,
      "eligible",
      id,
    );
    if (basic) {
      general.push(id);
      assert.equal(basic.estimatedEndYear, expectedYear);
    }
    if (motor) {
      powertrain.push(id);
      assert.equal(motor.estimatedEndYear, expectedYear);
    }
    if (traction) {
      battery.push(id);
      assert.equal(traction.estimatedEndYear, 2032);
    }
    assert.equal(!!basic, prior.scope === "basic-vehicle", id);
    assert.equal(!!motor, prior.scope === "powertrain", id);
  }
  assert.deepEqual(general.sort(), EXPECTED_BASIC);
  assert.deepEqual(powertrain.sort(), EXPECTED_POWERTRAIN);
  assert.deepEqual(battery, ["19924"]);
  const byd = currentRecord("19924");
  assert.equal(
    byd.supplementalCoverages![0].approvedFingerprint,
    factoryTractionBatteryReviewFingerprint(byd, byd.supplementalCoverages![0]),
  );
});

for (const prior of OLD_APPROVED) {
  const id = prior.vehicle.vehicleId;
  test(`the migrated ${id} cannot reuse any stamp after its unit key, engine or ID changes`, () => {
    const source = observed(id);
    for (const patch of [
      { unitKey: keyFor(`different-unit-${id}`) },
      { unitKey: undefined },
      { motor: "different-engine" },
      { cambio: "different-transmission" },
      { id: `different-id-${id}` },
      { anoFabricacao: source.anoFabricacao! - 1 },
      { year: source.year - 1 },
      { diferenciais: [] },
      { km: prior.reviewedMileageKm - 1 },
    ])
      assert.equal(
        anyCoverage({ ...source, ...patch }),
        undefined,
        JSON.stringify(patch),
      );
    const counterfeit = { ...source, unitKey: keyFor(`recycled-id-${id}`) };
    assert.equal(
      reconcileFactoryWarrantyVehicle(counterfeit, current, TODAY).status,
      "blocked",
    );
  });
}

test("the public migration snapshot keeps full inventory without raw administrative identifiers", () => {
  assert.equal(migration.publicVehicles.length, migration.count);
  assert.equal(
    new Set(migration.publicVehicles.map((vehicle) => vehicle.id)).size,
    migration.count,
  );
  assert.ok(migration.publicVehicles.some((vehicle) => vehicle.price === 0));
  const allowed = new Set([
    "id",
    "marca",
    "modelo",
    "motor",
    "cambio",
    "year",
    "anoFabricacao",
    "km",
    "price",
    "unitKey",
    "observedAt",
    "diferenciais",
  ]);
  for (const vehicle of migration.publicVehicles) {
    assert.ok(Object.keys(vehicle).every((name) => allowed.has(name)));
    if (vehicle.unitKey)
      assert.match(vehicle.unitKey, /^(?:vin|plate)-sha256:[a-f0-9]{64}$/);
  }
});

test("only the reviewed exact reusable variants are enabled by the current migration", () => {
  assert.equal(current.automation?.schemaVersion, 1);
  assert.deepEqual(migration.reusableTemplateIds.slice().sort(), [
    "19587",
    "19857",
    "19994",
    "20038",
  ]);
  for (const id of migration.reusableTemplateIds) {
    const template = currentRecord(id);
    const rule = current.automation!.rules.find(
      (entry) => entry.templateRecordId === template.recordId,
    );
    assert.ok(rule, id);
    assert.equal(rule.status, "approved");
    assert.equal(rule.allowNewUnits, true);
    assert.equal(
      rule.approvedFingerprint,
      factoryWarrantyRuleFingerprint(rule, current),
    );
    assert.equal(template.usage, "unknown");
    assert.ok(template.commonPolicy);
    const source = observed(id);
    const newcomer = {
      ...source,
      id: `new-${id}`,
      unitKey: keyFor(`new-${id}`),
      km: 1000,
    };
    const applied = reconcileFactoryWarrantyVehicle(newcomer, current, TODAY);
    assert.equal(applied.status, "eligible", id);
    assert.equal(applied.ruleId, rule.ruleId);
    assert.equal(
      resolveFactoryWarranty(newcomer, applied.matrix, TODAY)?.estimatedEndYear,
      oldRecord(id).vehicle.manufactureYear + oldRecord(id).termYears,
    );
    for (const patch of [
      { motor: "other-engine" },
      { year: source.year + 1 },
      { modelo: "Similar model" },
    ])
      assert.equal(
        reconcileFactoryWarrantyVehicle(
          { ...newcomer, ...patch },
          current,
          TODAY,
        ).status,
        "pending",
      );
  }
});

test("Tracker conditions, private attestations and scoped coverages never apply to another unit", () => {
  assert.deepEqual(migration.preservedIndividualOnly.slice().sort(), [
    "19924",
    "20029",
    "20041",
    "20049",
    "20066",
    "20075",
  ]);
  for (const id of migration.preservedIndividualOnly) {
    const record = currentRecord(id);
    assert.equal(
      current.automation!.rules.some(
        (rule) => rule.templateRecordId === record.recordId,
      ),
      false,
      id,
    );
    const newcomer = {
      ...observed(id),
      id: `new-${id}`,
      unitKey: keyFor(`new-${id}`),
    };
    const result = reconcileFactoryWarrantyVehicle(newcomer, current, TODAY);
    assert.equal(result.status, "pending", id);
    assert.equal(result.reason, "no-approved-compatible-rule", id);
    assert.equal(anyCoverage(newcomer, result.matrix), undefined);
  }
});

test("Kicks 20019 has a separate audited approval while its original pending decision remains immutable", () => {
  const prior = oldRecord("20019");
  assert.equal(prior.status, "pending");
  assert.equal(prior.vehicle.modelVersion, "KICKS ADVANCE");
  assert.equal(prior.reviewedMileageKm, 0);
  assert.equal(prior.sources[0].verification.status, "pending");
  const approved = currentRecord("20019");
  assert.deepEqual(approved, kicksAudit.approvedRecord);
  assert.equal(approved.status, "approved");
  assert.equal(approved.reviewedAt, "2026-10-09");
  assert.equal(approved.vehicle.modelVersion, "KICKS ADVANCE TURBO");
  assert.equal(approved.reviewedMileageKm, 5100);
  assert.equal(approved.usage, "unknown");
  assert.equal(approved.scope, "basic-vehicle");
  assert.deepEqual(approved.mileage, { kind: "limited", limitKm: 100000 });
  assert.equal(
    approved.approvedFingerprint,
    factoryWarrantyReviewFingerprint(approved),
  );
  assert.equal(
    current.records.filter((record) => record.status === "approved").length,
    15,
  );
  assert.equal(OLD_APPROVED.length, 10);
});

test("later approved units leave pending while absent Nivus remains pending", () => {
  assert.deepEqual(
    current.records.filter((record) => record.status === "pending").map((record) => record.vehicle.vehicleId).sort(),
    ["20018"],
  );
  for (const id of MONTH_RELEASE_IDS) {
    assert.equal(oldRecord(id).status, "pending", id);
    const record = currentRecord(id);
    assert.equal(record.status, "approved", id);
    assert.equal(record.scope, "basic-vehicle", id);
    assert.equal(record.termYears, 3, id);
    assert.equal(record.usage, "private", id);
    assert.deepEqual(record.mileage, { kind: "unlimited" }, id);
    assert.ok(record.sources.every((source) => source.verification.status === "verified" && source.verification.modelYear === 2024), id);
    assert.equal(record.approvedFingerprint, factoryWarrantyReviewFingerprint(record), id);
    assert.equal(current.automation!.rules.some((rule) => rule.templateRecordId === record.recordId), false, id);
  }
});

test("the three approvals persist the reviewed source, owner response and explicit publication authority", () => {
  assert.equal(monthAudit.schemaVersion, 1);
  assert.equal(monthAudit.reviewedAt, TODAY);
  assert.equal(monthAudit.previousSourceCommit, "45829134b5a57f8d3ff2d92a2a8bf34b0f748bd9");
  assert.deepEqual(monthAudit.approvedVehicleIds.slice().sort(), MONTH_RELEASE_IDS);
  assert.ok(JSON.stringify(monthAudit).includes("Sentinel_cbf0958dc5a881918c1819f25eee503f"));
  for (const id of MONTH_RELEASE_IDS) {
    const evidence = monthAudit.records.find((entry) => entry.vehicleId === id);
    assert.ok(evidence, id);
    const record = currentRecord(id);
    assert.equal(evidence.recordId, record.recordId);
    assert.equal(evidence.approvedPublication, true);
    assert.equal(evidence.sourceVerified, true);
    assert.equal(evidence.termYears, record.termYears);
    assert.equal(evidence.usage, record.usage);
    assert.equal(evidence.mileagePolicy, record.mileage.kind);
    assert.equal(evidence.confirmedExpiryMonth, record.confirmedExpiryMonth ?? null);
    assert.ok(record.sources.some((source) => source.verification.documentCode === evidence.sourceDocumentCode));
    assert.ok(evidence.ownerAttestations);
    if (id !== "19854") {
      const reply = JSON.stringify(evidence.ownerAttestations);
      assert.ok(reply.includes("Sentinel_c2d59486cd688191989f0b0db96214cf"));
      assert.ok(reply.includes("Sentinel_e284e59840c48191b58769ca4ee169b9"));
    }
  }
});

for (const [id, year] of [["19779", 2026], ["19898", 2026], ["19854", 2027]] as const) {
  test(`approved unit ${id} resolves its authorized year without invented original dates`, () => {
    const record = currentRecord(id);
    const vehicle = observed(id);
    assert.equal(reconcileFactoryWarrantyVehicle(vehicle, current, TODAY).status, "eligible");
    assert.equal(resolveFactoryWarranty(vehicle, current, TODAY)?.estimatedEndYear, year);
    assert.equal(resolveFactoryPowertrainWarranty(vehicle, current, TODAY), undefined);
    assert.equal(resolveFactoryTractionBatteryWarranty(vehicle, current, TODAY), undefined);
    assert.equal(record.confirmedExpiryDate, undefined);
    assert.equal(Object.hasOwn(record, "actualStartDate"), false);
    if (year === 2026) {
      assert.equal(record.confirmedExpiryMonth, "2026-12");
      assert.equal(resolveFactoryWarranty(vehicle, current, "2026-11-30")?.estimatedEndYear, 2026);
      assert.equal(reconcileFactoryWarrantyVehicle(vehicle, current, "2026-12-01").reason, "confirmed-expiry-day-required");
      assert.equal(resolveFactoryWarranty(vehicle, current, "2026-12-01"), undefined);
      assert.equal(resolveFactoryWarranty(vehicle, current, "2027-01-01"), undefined);
    } else {
      assert.equal(record.confirmedExpiryMonth, undefined);
      assert.equal(resolveFactoryWarranty(vehicle, current, "2027-01-01"), undefined);
    }
    for (const patch of [
      { unitKey: keyFor(`other-${id}`) }, { unitKey: undefined },
      { motor: "other-engine" }, { cambio: "MANUAL" },
      { modelo: "Different model" }, { year: 2025 }, { anoFabricacao: undefined },
      { diferenciais: [] }, { km: record.reviewedMileageKm - 1 }, { km: NaN }, { price: 0 },
    ]) assert.equal(anyCoverage({ ...vehicle, ...patch }), undefined, `${id} ${JSON.stringify(patch)}`);
  });
}

test("Kicks 20019 approval binds the verified exact XML/API unit correspondence and Brazilian MY2026 manual", () => {
  const reviewed = kicksAudit.identityCorrespondence;
  const record = currentRecord("20019");
  assert.equal(reviewed.xml.fields.modelVersion, "KICKS ADVANCE");
  assert.equal(reviewed.api.fields.modelVersion, "KICKS ADVANCE TURBO");
  assert.equal(reviewed.xml.unitKey, reviewed.api.unitKey);
  assert.equal(record.unitBinding?.unitKey, reviewed.api.unitKey);
  assert.equal(record.unitBinding?.engine, "1.0");
  assert.equal(record.unitBinding?.transmission, "AUTOMATICO");
  assert.equal(reviewed.unitComparison.sameOpaquePlateIdentity, true);
  assert.equal(reviewed.unitComparison.sameVehicleId, true);
  assert.ok(Object.values(reviewed.unitComparison.termsEqual).every(Boolean));
  assert.equal(
    reviewed.officialDocumentEvidence.publicationCode,
    "MPPT-P13C00",
  );
  assert.equal(reviewed.officialDocumentEvidence.officialIndexModelYear, 2026);
  assert.match(reviewed.officialDocumentEvidence.sha256, /^[a-f0-9]{64}$/);
  assert.equal(record.sources[0].verification.status, "verified");
  assert.equal(record.sources[0].verification.documentCode, "MPPT-P13C00");
  assert.equal(
    record.sources[0].verification.reviewedAt,
    kicksAudit.reviewedAt,
  );
  assert.equal(record.commonPolicy?.kind, "documented-regime-intersection");
  assert.deepEqual(
    record.commonPolicy?.branches.map((branch) => branch.category).sort(),
    ["cnpj", "cpf"],
  );
});

test("real Kicks 20019 displays only general warranty estimated until 2028 without inventing dates", () => {
  const vehicle = observed("20019");
  const record = currentRecord("20019");
  assert.equal(vehicle.km, 5100);
  const decision = reconcileFactoryWarrantyVehicle(vehicle, current, TODAY);
  assert.equal(decision.status, "eligible");
  assert.equal(decision.ruleId, `unit:${record.recordId}`);
  assert.equal(
    resolveFactoryWarranty(vehicle, decision.matrix, TODAY)?.estimatedEndYear,
    2028,
  );
  assert.equal(
    resolveFactoryPowertrainWarranty(vehicle, decision.matrix, TODAY),
    undefined,
  );
  assert.equal(
    resolveFactoryTractionBatteryWarranty(vehicle, decision.matrix, TODAY),
    undefined,
  );
  assert.equal(record.confirmedExpiryDate, undefined);
  assert.equal(Object.hasOwn(record, "actualStartDate"), false);
  assert.equal(kicksAudit.actualStartDate, null);
  assert.equal(kicksAudit.actualExpiryDate, null);
  assert.equal(kicksAudit.estimatedEndYear, 2028);
  assert.equal(kicksAudit.title, "GARANTIA DE FÁBRICA ATÉ 2028*");
  assert.equal(
    kicksAudit.footnote,
    "*Estimativa pela fabricação e documentação oficial da montadora. Validade, cobertura e km conforme manual do modelo/ano.",
  );
  assert.equal(
    resolveFactoryWarranty(vehicle, current, "2028-01-01"),
    undefined,
  );
});

for (const [condition, patch] of [
  ["engine1.6", { motor: "1.6" }],
  ["MY2025", { year: 2025 }],
  ["missing-stable-key", { unitKey: undefined }],
  ["recycled-id", { unitKey: keyFor("another-kicks") }],
  ["removed-flag", { diferenciais: [] }],
  ["km-limit", { km: 100000 }],
  ["km-over-limit", { km: 100001 }],
  ["km-regression", { km: 5099 }],
] as Array<[string, Partial<WarrantyCatalogVehicle>]>) {
  test(`real Kicks 20019 blocks ${condition} before display`, () => {
    const changed = { ...observed("20019"), ...patch };
    assert.equal(anyCoverage(changed), undefined);
    const result = reconcileFactoryWarrantyVehicle(changed, current, TODAY);
    assert.equal(result.status, "blocked");
    assert.equal(anyCoverage(changed, result.matrix), undefined);
  });
}

test("the fifth exact Kicks rule approves a new matching unit but never a Nissan family or XML alias", () => {
  const rule = current.automation!.rules.find(
    (entry) => entry.ruleId === "nissan-kicks-advance-my2026-hr10ddt-basic",
  );
  assert.ok(rule);
  assert.deepEqual(rule, kicksAudit.approvedRule);
  assert.equal(current.automation!.rules.length, 5);
  assert.equal(
    rule.approvedFingerprint,
    factoryWarrantyRuleFingerprint(rule, current),
  );
  assert.deepEqual(rule.match, {
    brand: "NISSAN",
    modelVersion: "KICKS ADVANCE TURBO",
    engine: "1.0",
    transmission: "AUTOMATICO",
    manufactureYear: 2025,
    modelYear: 2026,
  });
  const newcomer = {
    ...observed("20019"),
    id: "new-kicks-advance",
    unitKey: keyFor("new-kicks-advance"),
    km: 1234,
  };
  const result = reconcileFactoryWarrantyVehicle(newcomer, current, TODAY);
  assert.equal(result.status, "eligible");
  assert.equal(result.ruleId, rule.ruleId);
  assert.equal(
    resolveFactoryWarranty(newcomer, result.matrix, TODAY)?.estimatedEndYear,
    2028,
  );
  for (const patch of [
    { modelo: "KICKS ADVANCE" },
    { modelo: "KICKS PLAY" },
    { modelo: "KICKS EXCLUSIVE" },
    { motor: "1.6" },
    { year: 2025 },
    { anoFabricacao: 2024 },
    { cambio: "MANUAL" },
  ])
    assert.equal(
      reconcileFactoryWarrantyVehicle({ ...newcomer, ...patch }, current, TODAY)
        .status,
      "pending",
    );
  const sameKnownKey = { ...newcomer, unitKey: observed("20019").unitKey };
  assert.equal(
    reconcileFactoryWarrantyVehicle(sameKnownKey, current, TODAY).reason,
    "unit-id-changed",
  );
});
