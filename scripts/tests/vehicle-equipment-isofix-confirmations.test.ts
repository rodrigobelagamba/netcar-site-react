import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isApprovedUnitEquipmentConfirmation,
  resolveVehicleEquipment,
  unitEquipmentConfirmations,
  type EquipmentVehicle,
} from "../../src/lib/vehicleEquipment";
import { buildVehicleHighlights } from "../../src/modules/detalhes/lib/vehicleHighlights";

const units = [
  {
    id: "19840",
    brand: "VOLKSWAGEN",
    model: "FOX COMFORTLINE",
    year: 2017,
    manufactureYear: 2016,
  },
  {
    id: "19985",
    brand: "HYUNDAI",
    model: "HB20 COMFORT",
    year: 2016,
    manufactureYear: 2015,
  },
] as const;

function confirmation(id: string) {
  const records = unitEquipmentConfirmations.filter(
    (record) => record.match.vehicleId === id,
  );
  assert.equal(records.length, 1, `${id}: one active confirmation`);
  return records[0];
}

function unitVehicle(unit: (typeof units)[number]): EquipmentVehicle {
  return {
    id: unit.id,
    marca: unit.brand,
    modelo: unit.model,
    year: unit.year,
    anoFabricacao: unit.manufactureYear,
    motor: "1.0",
    cambio: "MANUAL",
    market: "BR",
    physicalIdentityKey: confirmation(unit.id).match.physicalIdentityKey,
    // Controlled inputs exercise stale and differently named supplier claims.
    opcionais: [
      "isofix",
      { tag: "fixacao_infantil", descricao: "ISOFIX" },
      "ar_condicionado",
    ],
  };
}

test("Fox and HB20 ISOFIX absences retain the responsible person's exact-unit provenance", () => {
  for (const unit of units) {
    const record = confirmation(unit.id);
    assert.equal(isApprovedUnitEquipmentConfirmation(record), true);
    assert.equal(record.schemaVersion, 2);
    assert.equal(
      record.id,
      `equipment-review-unit-${unit.id}-no-isofix-2026-10-26`,
    );
    assert.equal(record.source, "responsible-confirmation");
    assert.equal(record.marketSource, "responsible-confirmation");
    assert.equal(record.confirmedAt, "2026-10-26");
    assert.match(record.claim, /nao tem isofix/);
    assert.match(record.claim, /Não é documento da montadora/);
    assert.deepEqual(record.presentTags, []);
    assert.deepEqual(record.absentTags, ["isofix"]);
    assert.deepEqual(record.match, {
      vehicleId: unit.id,
      physicalIdentityKey: record.match.physicalIdentityKey,
      brand: unit.brand,
      model: unit.model,
      modelYear: unit.year,
      manufactureYear: unit.manufactureYear,
      engine: "1.0",
      transmission: "MANUAL",
      market: "BR",
    });
    assert.match(record.match.physicalIdentityKey!, /^[a-f0-9]{64}$/);
  }
});

test("confirmed ISOFIX absence overrides stale tags and aliases while preserving other equipment", () => {
  for (const unit of units) {
    const vehicle = unitVehicle(unit);
    const original = structuredClone(vehicle);
    const baseline = resolveVehicleEquipment(vehicle, [], [], []);
    assert.ok(baseline.items.some((item) => item.id === "isofix"));
    const result = resolveVehicleEquipment(vehicle);
    assert.deepEqual(
      result.items,
      baseline.items.filter((item) => item.id !== "isofix"),
    );
    assert.ok(
      result.suppressed.some(
        (item) =>
          item.id === "isofix" &&
          item.reason === "unit-confirmed-absence" &&
          item.evidenceIds?.includes(confirmation(unit.id).id),
      ),
    );
    assert.deepEqual(vehicle, original, "source data must remain unchanged");
  }
});

test("ISOFIX absence reaches highlights and remaining equipment", () => {
  for (const unit of units) {
    const presentation = buildVehicleHighlights(unitVehicle(unit));
    assert.ok(
      !presentation.highlights.some((highlight) =>
        highlight.equipmentIds.includes("isofix"),
      ),
    );
    assert.ok(
      !presentation.remainingOptionals.some((label) => /isofix/i.test(label)),
    );
    assert.equal(presentation.editorialReview.status, "profile-applied");
    assert.deepEqual(presentation.highlights, []);
  }
});

test("a newly supported topic reopens the previously empty editorial review", () => {
  for (const unit of units) {
    const vehicle = unitVehicle(unit);
    vehicle.opcionais = ["isofix", "teto_solar"];
    const presentation = buildVehicleHighlights(vehicle);
    assert.equal(presentation.editorialReview.status, "needs-editorial-review");
    assert.equal(presentation.editorialReview.reason, "no-supported-topics");
    assert.ok(presentation.remainingOptionals.some((label) => /teto solar/i.test(label)));
  }
});

test("another ID, physical identity, year or mechanical configuration never inherits the absence", () => {
  for (const unit of units) {
    const vehicle = unitVehicle(unit);
    const mismatches: Partial<EquipmentVehicle>[] = [
      { id: `${unit.id}0` },
      { physicalIdentityKey: "0".repeat(64) },
      { physicalIdentityKey: undefined },
      { physicalIdentityKey: null },
      { marca: "OTHER" },
      { modelo: `${unit.model} PLUS` },
      { year: unit.year + 1 },
      { anoFabricacao: unit.manufactureYear + 1 },
      { anoFabricacao: undefined },
      { motor: "1.6" },
      { cambio: "AUTOMATICO" },
      { market: "US" },
    ];
    for (const mismatch of mismatches) {
      const other = { ...vehicle, ...mismatch };
      const baseline = resolveVehicleEquipment(other, [], [], []);
      const actual = resolveVehicleEquipment(
        other,
        [],
        unitEquipmentConfirmations,
        [],
      );
      assert.deepEqual(
        actual,
        baseline,
        `${unit.id}: ${JSON.stringify(mismatch)}`,
      );
      assert.ok(actual.items.some((item) => item.id === "isofix"));
    }
  }
});

test("unapproved or physically incomplete ISOFIX confirmations cannot remove supplier equipment", () => {
  for (const unit of units) {
    const vehicle = unitVehicle(unit);
    const record = confirmation(unit.id);
    for (const invalid of [
      { ...record, approved: false },
      { ...record, source: "manufacturer-standard" },
      { ...record, match: { ...record.match, physicalIdentityKey: undefined } },
      { ...record, match: { ...record.match, manufactureYear: undefined } },
    ]) {
      assert.equal(isApprovedUnitEquipmentConfirmation(invalid), false);
      assert.deepEqual(
        resolveVehicleEquipment(vehicle, [], [invalid], []),
        resolveVehicleEquipment(vehicle, [], [], []),
      );
    }
  }
});
