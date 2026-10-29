import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  factoryWarrantyReviewFingerprint,
  resolveFactoryWarranty,
  resolveFactoryPowertrainWarranty,
  resolveFactoryTractionBatteryWarranty,
  type FactoryWarrantyAutomationRule,
  type FactoryWarrantyMatrix,
  type FactoryWarrantyRecord,
  type WarrantyCatalogVehicle,
} from "../../src/lib/factoryWarranty";
import {
  factoryWarrantyRuleFingerprint,
  reconcileFactoryWarrantyVehicle,
} from "../../src/lib/factoryWarrantyReconciliation";
import { parsePublishedWarrantyRegistry } from "../../src/lib/factoryWarrantyRegistryShape";

const TODAY = "2026-10-29";
const UNIT_KEY = `vin-sha256:${"a".repeat(64)}`;
const vehicle: WarrantyCatalogVehicle = {
  id: "current-unit", unitKey: UNIT_KEY, marca: "Example", modelo: "Exact Version",
  motor: "1.6", cambio: "AUTOMATICO", anoFabricacao: 2023, year: 2024,
  km: 26178, price: 100000,
  diferenciais: [{ tag: "garantia_fabrica", descricao: "Garantia de fábrica" }],
};

function review(patch: Partial<FactoryWarrantyRecord> = {}): FactoryWarrantyRecord {
  const record: FactoryWarrantyRecord = {
    recordId: "current-unit-powertrain", status: "approved", reviewedAt: TODAY,
    approvedFingerprint: "", vehicle: {
      vehicleId: vehicle.id, brand: "EXAMPLE", modelVersion: "Exact Version",
      manufactureYear: 2023, modelYear: 2024,
    },
    unitBinding: { unitKey: UNIT_KEY, engine: "1.6", transmission: "AUTOMATICO" },
    optionalId: 108, optionalConfirmed: true, conditionsConfirmed: true,
    scope: "powertrain", termYears: 5, usage: "private", reviewedMileageKm: 26178,
    mileage: { kind: "unknown" },
    currentCoverageConfirmation: {
      source: "netcar-owner", attestationId: "current-unit-coverage-20261029",
      confirmedAt: TODAY, basis: "explicit-current-unit-coverage", mileageKm: 26178,
    },
    powertrainReview: {
      coverageSubtype: "engine-and-transmission", usageAttestationId: "private-use-attestation",
      displayLabel: "Motor e câmbio",
    },
    sources: [{
      sourceId: "manufacturer-term", label: "Manufacturer statement",
      url: "https://manufacturer.example/coverage", locator: "Five-year engine and transmission term",
      revision: "TERM-MY2024; manufacturer statement", verification: {
        status: "verified", documentCode: "TERM-MY2024", modelYear: 2024,
        reviewId: "exact-term-review", reviewedAt: TODAY,
      },
    }],
    ...patch,
  };
  record.approvedFingerprint = factoryWarrantyReviewFingerprint(record);
  return record;
}

const matrix = (...records: FactoryWarrantyRecord[]): FactoryWarrantyMatrix => ({
  schemaVersion: 2, enabled: true, requireUnitBinding: true, records,
});
const resolve = (record = review(), current = vehicle, today = TODAY) =>
  resolveFactoryPowertrainWarranty(current, matrix(record), today);

test("current unit confirmation permits only its documented powertrain term at the confirmed mileage", () => {
  const record = review();
  assert.equal(resolve(record)?.estimatedEndYear, 2028);
  assert.equal(resolve(record)?.scope, "powertrain");
  assert.equal(resolve(record)?.sourceLabel, "Manufacturer statement");
  assert.equal(resolveFactoryWarranty(vehicle, matrix(record), TODAY), undefined);
  assert.equal(resolveFactoryTractionBatteryWarranty(vehicle, matrix(record), TODAY), undefined);
  assert.deepEqual(record.mileage, { kind: "unknown" });
  assert.equal(reconcileFactoryWarrantyVehicle(vehicle, matrix(record), TODAY).status, "eligible");
  assert.deepEqual(parsePublishedWarrantyRegistry(matrix(record)), matrix(record));
});

for (const km of [26179, 26177, undefined, NaN, Infinity, -1]) {
  test(`changed or missing odometer ${String(km)} cannot extend a current-mileage confirmation`, () => {
    const current = { ...vehicle, km } as WarrantyCatalogVehicle;
    assert.equal(resolve(review(), current), undefined);
    assert.equal(reconcileFactoryWarrantyVehicle(current, matrix(review()), TODAY).status, "blocked");
  });
}

test("mileage increase has an actionable reconciliation reason", () => {
  assert.equal(
    reconcileFactoryWarrantyVehicle({ ...vehicle, km: 26179 }, matrix(review()), TODAY).reason,
    "current-coverage-mileage-changed",
  );
});

test("unknown mileage without current coverage confirmation stays blocked", () => {
  assert.equal(resolve(review({ currentCoverageConfirmation: undefined })), undefined);
});

for (const [name, patch] of Object.entries({
  otherSource: { source: "manufacturer" },
  otherBasis: { basis: "private-use" },
  emptyAttestation: { attestationId: " " },
  unresolvedAttestation: { attestationId: "pending" },
  missingDate: { confirmedAt: undefined },
  invalidDate: { confirmedAt: "2026-02-30" },
  futureDate: { confirmedAt: "2026-10-30" },
  missingMileage: { mileageKm: undefined },
  changedMileage: { mileageKm: 26179 },
  negativeMileage: { mileageKm: -1 },
  unknownField: { unlimitedMileage: true },
})) {
  test(`invalid current confirmation ${name} cannot enable coverage even with a renewed fingerprint`, () => {
    const record = review();
    Object.assign(record.currentCoverageConfirmation!, patch);
    record.approvedFingerprint = factoryWarrantyReviewFingerprint(record);
    assert.equal(resolve(record), undefined);
  });
}

test("confirmation cannot postdate review or be changed without renewed approval", () => {
  assert.equal(resolve(review({ reviewedAt: "2026-10-28" })), undefined);
  const record = review();
  record.currentCoverageConfirmation!.attestationId = "changed-attestation";
  assert.equal(resolve(record), undefined);
});

for (const [name, patch] of Object.entries({
  noBinding: { unitBinding: undefined },
  general: { scope: "basic-vehicle" },
  battery: { scope: "traction-battery" },
  commercial: { usage: "commercial" },
  knownUnlimited: { mileage: { kind: "unlimited" } },
  knownLimited: { mileage: { kind: "limited", limitKm: 100000 } },
  supplemental: { supplementalCoverages: [] },
  reviewedMileageChanged: { reviewedMileageKm: 26177 },
  revoked: { status: "revoked" },
  pending: { status: "pending" },
  unconfirmedConditions: { conditionsConfirmed: false },
  missingSources: { sources: [] },
})) {
  test(`current coverage confirmation does not waive ${name}`, () => {
    assert.equal(resolve(review(patch as Partial<FactoryWarrantyRecord>)), undefined);
  });
}

for (const [name, patch] of Object.entries({
  missingFlag: { diferenciais: undefined },
  removedFlag: { diferenciais: [] },
  physicalIdentity: { unitKey: `vin-sha256:${"b".repeat(64)}` },
  model: { modelo: "Other Version" },
  fabrication: { anoFabricacao: 2024 },
  modelYear: { year: 2025 },
  engine: { motor: "1.5" },
  transmission: { cambio: "MANUAL" },
  unadvertised: { price: 0 },
})) {
  test(`current confirmation preserves the ${name} catalog gate`, () => {
    assert.equal(resolve(review(), { ...vehicle, ...patch }), undefined);
  });
}

test("a duplicate physical unit or revocation cannot leave the confirmation eligible", () => {
  const record = review();
  const duplicate = review({ vehicle: { ...record.vehicle, vehicleId: "other-id" } });
  assert.equal(resolveFactoryPowertrainWarranty(vehicle, matrix(record, duplicate), TODAY), undefined);
  assert.equal(reconcileFactoryWarrantyVehicle(vehicle, matrix(record, duplicate), TODAY).reason, "unit-id-changed");
  assert.equal(resolveFactoryPowertrainWarranty(vehicle, matrix(record, review({ status: "revoked" })), TODAY), undefined);
});

test("an exact automation rule cannot transfer a current-unit confirmation to another vehicle", () => {
  const record = review();
  const registry = matrix(record);
  const rule: FactoryWarrantyAutomationRule = {
    ruleId: "attempted-current-confirmation-template", version: "1", status: "approved",
    templateRecordId: record.recordId, allowNewUnits: true, approvedFingerprint: "",
    match: { ...record.vehicle, engine: "1.6", transmission: "AUTOMATICO" },
    privateUsePolicy: {
      scope: "netcar-stock", attestationId: "private-use-policy", confirmedAt: TODAY,
      coverageBasis: "documented-model-policy",
    },
  };
  registry.automation = { schemaVersion: 1, rules: [rule] };
  rule.approvedFingerprint = factoryWarrantyRuleFingerprint(rule, registry);
  const another = { ...vehicle, id: "another-unit", unitKey: `vin-sha256:${"b".repeat(64)}` };
  const result = reconcileFactoryWarrantyVehicle(another, registry, TODAY);
  assert.equal(result.status, "pending");
  assert.equal(result.reason, "rule-template-not-reusable");
  assert.equal(result.matrix.records.length, 1);
});

test("current confirmation never invents an expiry in the final estimated year", () => {
  assert.ok(resolve(review(), vehicle, "2027-12-31"));
  assert.equal(resolve(review(), vehicle, "2028-01-01"), undefined);
  assert.equal(reconcileFactoryWarrantyVehicle(vehicle, matrix(review()), "2028-01-01").reason, "confirmed-expiry-required");
  assert.equal(resolve(review(), vehicle, "2029-01-01"), undefined);
  const dated = review({ confirmedExpiryMonth: "2028-06" });
  assert.ok(resolve(dated, vehicle, "2028-05-31"));
  assert.equal(resolve(dated, vehicle, "2028-06-01"), undefined);
});

test("transport accepts only the explicit current-confirmation shape", () => {
  for (const patch of [{ source: "manufacturer" }, { basis: "other" }, { confirmedAt: "2026-02-30" }, { mileageKm: -1 }, { mileageKm: "26178" }, { limitKm: 100000 }]) {
    const record = review();
    Object.assign(record.currentCoverageConfirmation!, patch);
    assert.throws(() => parsePublishedWarrantyRegistry(matrix(record)));
  }
});

test("adding optional current confirmation does not change earlier published fingerprints", () => {
  const authority = JSON.parse(readFileSync(new URL("../../src/data/factoryWarrantyMatrix.json", import.meta.url), "utf8")) as FactoryWarrantyMatrix;
  const previousRecords = authority.records.filter((record) => record.currentCoverageConfirmation === undefined);
  assert.ok(previousRecords.length >= 22);
  for (const record of previousRecords)
    assert.equal(factoryWarrantyReviewFingerprint(record), record.approvedFingerprint, record.recordId);
});
