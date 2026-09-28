import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  resolveVehicleEquipment,
  unitEquipmentConfirmations,
  type EquipmentVehicle,
} from "../../src/lib/vehicleEquipment";
import { buildVehicleHighlights } from "../../src/modules/detalhes/lib/vehicleHighlights";

const fixture: { vehicles: EquipmentVehicle[] } = JSON.parse(
  readFileSync(
    new URL("../fixtures/vehicle-equipment-stock.json", import.meta.url),
    "utf8",
  ),
);

function stockVehicle(id: string): EquipmentVehicle {
  const vehicle = fixture.vehicles.find((item) => String(item.id) === id);
  assert.ok(vehicle, `fixture vehicle ${id} missing`);
  return structuredClone(vehicle);
}

function confirmationFor(id: string) {
  const record = unitEquipmentConfirmations.find(
    (item) => String(item.match.vehicleId) === id,
  );
  assert.ok(record, `unit confirmation ${id} missing`);
  return record;
}

const itemIds = (vehicle: EquipmentVehicle) =>
  resolveVehicleEquipment(vehicle).items.map((item) => item.id);

test("responsible confirmations are explicitly scoped to the two reviewed units", () => {
  for (const id of ["20050", "20051"]) {
    const vehicle = stockVehicle(id);
    const record = confirmationFor(id);
    assert.equal(record.approved, true);
    assert.equal(record.source, "responsible-confirmation");
    assert.equal(record.confirmedAt, "2026-09-28");
    assert.ok(record.claim.trim());
    assert.equal(record.match.brand, vehicle.marca);
    assert.equal(record.match.model, vehicle.modelo);
    assert.equal(record.match.modelYear, vehicle.year);
    assert.equal(record.match.engine, vehicle.motor);
    assert.equal(record.match.transmission, vehicle.cambio);
    assert.deepEqual(
      record.presentTags,
      id === "20050" ? ["assistencia_faixa"] : [],
    );
    assert.deepEqual(
      [...record.absentTags].sort(),
      id === "20050"
        ? ["park_assist", "piloto_adaptativo"]
        : ["teto_panoramico", "teto_solar"],
    );
  }
});

test("only Fastback has confirmed lane assistance and removal of Park Assist and adaptive cruise", () => {
  const vehicle = stockVehicle("20050");
  const record = confirmationFor("20050");
  const { items } = resolveVehicleEquipment(vehicle);
  assert.equal(items.filter((item) => item.id === "lane-assist").length, 1);
  assert.ok(!items.some((item) => item.id === "park-assist"));
  assert.ok(!items.some((item) => item.id === "adaptive-cruise-control"));
  const laneAssist = items.find((item) => item.id === "lane-assist")!;
  assert.equal(laneAssist.source, "unit-confirmation");
  assert.deepEqual(laneAssist.evidenceIds, [record.id]);
  assert.equal(laneAssist.description, "Assistência de permanência em faixa");
  assert.deepEqual(laneAssist.sourceTags, ["assistencia_faixa"]);
  assert.ok(!itemIds(stockVehicle("20051")).includes("lane-assist"));
});

test("the correction reaches both highlight cards and the list without repeating lane assist", () => {
  for (const id of ["20050", "20051"]) {
    const presentation = buildVehicleHighlights(stockVehicle(id));
    const descriptions = [
      ...presentation.highlights.map((item) => item.title),
      ...presentation.remainingOptionals,
    ];
    assert.equal(
      descriptions.filter(
        (text) => text === "Assistência de permanência em faixa",
      ).length,
      id === "20050" ? 1 : 0,
      id,
    );
    assert.ok(
      !descriptions.some((text) => /park assist|adaptativo/i.test(text)),
      id,
    );
    assert.equal(
      presentation.highlights.some((item) => item.id === "lane-assist"),
      id === "20050",
      id,
    );
    assert.ok(descriptions.includes("Piloto automático"), id);
    if (id === "20051")
      assert.ok(!descriptions.some((text) => /teto/i.test(text)));
  }
});

test("Civic correction removes only the roof, preserving all other supplied equipment", () => {
  for (const id of ["20050", "20051"]) {
    const ids = itemIds(stockVehicle(id));
    assert.ok(ids.includes("cruise-control"), id);
    assert.ok(ids.includes("parking-sensors"), id);
  }
  const civic = stockVehicle("20051");
  const result = resolveVehicleEquipment(civic);
  assert.deepEqual(
    result.items,
    resolveVehicleEquipment(civic, [], []).items.filter(
      (item) => item.id !== "sunroof",
    ),
  );
  const roof = result.suppressed.find((item) => item.id === "sunroof");
  assert.ok(roof);
  assert.equal(roof.reason, "unit-confirmed-absence");
  assert.deepEqual(roof.evidenceIds, [confirmationFor("20051").id]);
  assert.deepEqual(confirmationFor("20051").presentTags, []);
  assert.deepEqual([...confirmationFor("20051").absentTags].sort(), [
    "teto_panoramico",
    "teto_solar",
  ]);
  assert.ok(!result.items.some((item) => item.source === "unit-confirmation"));
  // The clarification denied only the Civic roof, not its driver-assistance
  // inventory. A future supplier claim must not be silently blocked by this record.
  const futureCivic = {
    ...civic,
    opcionais: [
      ...(civic.opcionais || []),
      "park_assist",
      "piloto_adaptativo",
      "assistencia_faixa",
    ],
  };
  for (const id of ["park-assist", "adaptive-cruise-control", "lane-assist"]) {
    assert.ok(itemIds(futureCivic).includes(id), id);
  }
});

test("Fastback absences reject future supplier claims and equivalent named equipment", () => {
  const vehicle = stockVehicle("20050");
  vehicle.opcionais = [
    ...(vehicle.opcionais || []),
    "park_assist",
    "piloto_adaptativo",
    { tag: "assistente_estacionamento", descricao: "Park Assist" },
    { tag: "acc", descricao: "Piloto Automático Adaptativo" },
  ];
  const result = resolveVehicleEquipment(vehicle);
  assert.ok(!result.items.some((item) => item.id === "park-assist"));
  assert.ok(
    !result.items.some((item) => item.id === "adaptive-cruise-control"),
  );
  for (const itemId of ["park-assist", "adaptive-cruise-control"]) {
    const suppressed = result.suppressed.filter((item) => item.id === itemId);
    assert.ok(
      suppressed.some((item) =>
        item.evidenceIds?.includes(confirmationFor("20050").id),
      ),
      `20050: ${itemId}`,
    );
  }
});

test("Civic roof absence cannot be bypassed with a panoramic roof or sunroof alias", () => {
  const vehicle = stockVehicle("20051");
  vehicle.opcionais = [
    ...(vehicle.opcionais || []),
    "teto_panoramico",
    { tag: "sunroof", descricao: "Teto Solar" },
    { tag: "roof_panoramic", descricao: "Teto Panorâmico" },
  ];
  const result = resolveVehicleEquipment(vehicle);
  assert.ok(!result.items.some((item) => /roof/.test(item.id)));
  for (const id of ["sunroof", "panoramic-roof"]) {
    assert.ok(
      result.suppressed.some(
        (item) =>
          item.id === id &&
          item.reason === "unit-confirmed-absence" &&
          item.evidenceIds?.includes(confirmationFor("20051").id),
      ),
      id,
    );
  }
});

test("confirmation identity cannot fall back to family, fabrication year, name or another unit", () => {
  for (const id of ["20050", "20051"]) {
    const vehicle = stockVehicle(id);
    const mismatches: Partial<EquipmentVehicle>[] = [
      { id: `${id}-other` },
      { id: undefined },
      { marca: "OTHER" },
      { marca: undefined },
      { modelo: `${vehicle.modelo} PLUS` },
      { modelo: undefined, name: vehicle.modelo },
      { year: Number(vehicle.year) + 1 },
      { year: undefined, anoFabricacao: vehicle.year },
      { motor: "1.5" },
      { motor: undefined },
      { cambio: "MANUAL" },
      { cambio: undefined },
    ];
    for (const mismatch of mismatches) {
      const other = { ...vehicle, ...mismatch };
      const baseline = resolveVehicleEquipment(other, [], []);
      const actual = resolveVehicleEquipment(
        other,
        [],
        unitEquipmentConfirmations,
      );
      assert.deepEqual(actual, baseline, `${id}: ${JSON.stringify(mismatch)}`);
    }
  }
});

test("unapproved or incomplete unit confirmations do not change the inventory", () => {
  const vehicle = stockVehicle("20051");
  const approved = confirmationFor("20051");
  const baseline = resolveVehicleEquipment(vehicle, [], []);
  for (const invalid of [
    { ...approved, approved: false },
    { ...approved, source: "manufacturer-standard" },
    { ...approved, claim: "" },
    { ...approved, confirmedAt: "2026-02-30" },
    { ...approved, match: { ...approved.match, vehicleId: "" } },
    { ...approved, match: { ...approved.match, model: "" } },
    { ...approved, presentTags: ["unknown_optional"] },
    { ...approved, absentTags: ["unknown_optional"] },
    { ...approved, presentTags: ["teto_solar"] },
  ]) {
    assert.deepEqual(
      resolveVehicleEquipment(vehicle, [], [invalid]),
      baseline,
      JSON.stringify(invalid),
    );
  }
});

test("confirmation never mutates raw XML/API fixtures or the evidence registry", () => {
  for (const id of ["20050", "20051"]) {
    const vehicle = stockVehicle(id);
    const originalVehicle = structuredClone(vehicle);
    const records = structuredClone(unitEquipmentConfirmations);
    const originalRecords = structuredClone(records);
    resolveVehicleEquipment(vehicle, [], records);
    buildVehicleHighlights(vehicle);
    assert.deepEqual(vehicle, originalVehicle, id);
    assert.deepEqual(records, originalRecords, id);
  }
  const civicTags = (stockVehicle("20051").opcionais || []).map((item) =>
    typeof item === "string" ? item : item.tag,
  );
  assert.ok(!civicTags.includes("assistencia_faixa"));
  assert.ok(civicTags.includes("teto_solar"));
  const fastbackTags = (stockVehicle("20050").opcionais || []).map((item) =>
    typeof item === "string" ? item : item.tag,
  );
  assert.ok(fastbackTags.includes("park_assist"));
  assert.ok(fastbackTags.includes("piloto_adaptativo"));
});

test("T-Cross equipment and other units of the same model are untouched", () => {
  const tCross = stockVehicle("19903");
  assert.deepEqual(
    resolveVehicleEquipment(tCross),
    resolveVehicleEquipment(tCross, [], []),
  );
  assert.ok(itemIds(tCross).includes("park-assist"));
  assert.ok(itemIds(tCross).includes("sunroof"));
  const otherFastback = { ...stockVehicle("20050"), id: "20052" };
  assert.deepEqual(
    resolveVehicleEquipment(otherFastback),
    resolveVehicleEquipment(otherFastback, [], []),
  );
  assert.ok(itemIds(otherFastback).includes("park-assist"));
  assert.ok(itemIds(otherFastback).includes("adaptive-cruise-control"));
  const otherCivic = { ...stockVehicle("20051"), id: "20053" };
  assert.ok(!itemIds(otherCivic).includes("lane-assist"));
  assert.ok(itemIds(otherCivic).includes("sunroof"));
});
