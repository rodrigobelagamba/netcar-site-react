import assert from "node:assert/strict";
import { test } from "node:test";
import { vehiclePhysicalIdentityKey } from "../../src/lib/vehiclePhysicalIdentity";
import {
  definitionForEquipmentTag,
  isApprovedUnitEquipmentConfirmation,
  isReviewedUnitEquipmentDefinition,
  resolveVehicleEquipment,
  type EquipmentVehicle,
  type ReviewedUnitEquipmentDefinition,
  type UnitEquipmentConfirmation,
} from "../../src/lib/vehicleEquipment";

const hud: ReviewedUnitEquipmentDefinition = {
  id: "head-up-display",
  tag: "head_up_display",
  sourceDescription: "Head-up display",
  description: "Head-up display",
  category: "Conforto",
  priority: 500,
  reviewedAt: "2026-10-09",
  reviewNote:
    "Exemplo sintético: nome, prioridade e sinônimos revisados especificamente.",
  aliases: ["HUD", "Projeção de informações no para-brisa"],
};
const vehicle: EquipmentVehicle = {
  id: "99901",
  placa: "ABC1D23",
  marca: "TESTE",
  modelo: "MODELO EXATO",
  year: 2024,
  anoFabricacao: 2023,
  motor: "1.0",
  cambio: "AUTOMATICO",
  opcionais: ["piloto_automatico", "sensor_estacionamento"],
};
const confirmation: UnitEquipmentConfirmation = {
  schemaVersion: 2,
  id: "synthetic-unit-99901",
  approved: true,
  source: "responsible-confirmation",
  confirmedAt: "2026-10-09",
  claim: "Confirmação sintética apenas para teste de presença e autorização.",
  match: {
    vehicleId: "99901",
    brand: "TESTE",
    model: "MODELO EXATO",
    modelYear: 2024,
    manufactureYear: 2023,
    market: "BR",
    physicalIdentityKey: vehiclePhysicalIdentityKey("99901", "ABC1D23")!,
    engine: "1.0",
    transmission: "AUTOMATICO",
  },
  marketSource: "responsible-confirmation",
  reviewedDefinitions: [hud],
  presentTags: ["head_up_display"],
  absentTags: [],
};
const resolve = (
  v: EquipmentVehicle,
  records: readonly unknown[] = [confirmation],
) => resolveVehicleEquipment(v, [], records);

test("a reviewed new capability applies only to its exact unit and fabrication year", () => {
  assert.equal(isReviewedUnitEquipmentDefinition(hud), true);
  assert.equal(isApprovedUnitEquipmentConfirmation(confirmation), true);
  const result = resolve(vehicle);
  const item = result.items.find((entry) => entry.id === hud.id);
  assert.ok(item);
  assert.equal(item.source, "unit-confirmation");
  assert.equal(item.benefit, undefined);
  assert.deepEqual(item.evidenceIds, [confirmation.id]);
  for (const mismatch of [
    { id: "99902" },
    { anoFabricacao: 2024 },
    { anoFabricacao: undefined },
    { modelo: "MODELO EXATO PLUS" },
    { year: 2023 },
    { motor: "1.5" },
    { cambio: "MANUAL" },
    { market: "US" },
    { placa: "DEF4G56" },
    { placa: undefined },
  ]) {
    const other = { ...vehicle, ...mismatch };
    assert.deepEqual(
      resolve(other),
      resolve(other, []),
      JSON.stringify(mismatch),
    );
  }
});

test("market comes from the explicit unit attestation and never fabricates a feed field", () => {
  const before = structuredClone(vehicle);
  assert.equal(vehicle.market, undefined);
  assert.deepEqual(resolve(vehicle), resolve({ ...vehicle, market: "BR" }));
  assert.deepEqual(vehicle, before);
  for (const invalid of [
    { ...confirmation, marketSource: undefined },
    { ...confirmation, match: { ...confirmation.match, market: undefined } },
    {
      ...confirmation,
      match: { ...confirmation.match, physicalIdentityKey: undefined },
    },
    {
      ...confirmation,
      match: { ...confirmation.match, manufactureYear: undefined },
    },
    { ...confirmation, schemaVersion: undefined },
    { ...confirmation, schemaVersion: 3 },
  ]) {
    assert.equal(isApprovedUnitEquipmentConfirmation(invalid), false);
    assert.deepEqual(resolve(vehicle, [invalid]), resolve(vehicle, []));
  }
});

test("a recycled stock ID cannot inherit the exact same trim's physical-unit confirmation", () => {
  const first = resolve(vehicle);
  const reimported = resolve({
    ...structuredClone(vehicle),
    placa: "abc-1d23",
    opcionais: [],
  });
  assert.ok(first.items.some((item) => item.id === hud.id));
  assert.ok(reimported.items.some((item) => item.id === hud.id));
  const token = vehiclePhysicalIdentityKey(vehicle.id, vehicle.placa)!;
  assert.ok(
    resolve({
      ...vehicle,
      placa: undefined,
      physicalIdentityKey: token,
    }).items.some((item) => item.id === hud.id),
  );
  for (const changed of [
    { placa: "DEF4G56" },
    { placa: "DEF4G56", physicalIdentityKey: token },
    { placa: "", physicalIdentityKey: token },
    { placa: "ABC****", physicalIdentityKey: token },
    { physicalIdentityKey: "0".repeat(64) },
    { placa: undefined, physicalIdentityKey: null },
  ]) {
    const current = { ...vehicle, ...changed };
    assert.deepEqual(resolve(current), resolve(current, []));
  }
  assert.ok(!JSON.stringify(first).includes(vehicle.placa!));
  assert.ok(!JSON.stringify(confirmation).includes(vehicle.placa!));
});

test("new XML data reapplies the confirmation and deduplicates only exact reviewed synonyms", () => {
  const imported = {
    ...vehicle,
    opcionais: [
      "HUD",
      "head_up_display",
      {
        tag: "novo_fornecedor",
        descricao: "Projeção de informações no para-brisa",
      },
      { tag: "camera_outra", descricao: "Câmera traseira com linhas" },
      "piloto_automatico",
      "sensor_estacionamento",
    ],
  };
  const result = resolve(imported);
  assert.equal(result.items.filter((item) => item.id === hud.id).length, 1);
  assert.equal(
    result.items.find((item) => item.id === hud.id)?.source,
    "unit-confirmation",
  );
  assert.ok(
    result.items.some(
      (item) => item.description === "Câmera traseira com linhas",
    ),
  );
  assert.ok(result.items.some((item) => item.id === "cruise-control"));
  assert.ok(
    !result.items.some((item) => item.id === "adaptive-cruise-control"),
  );
  assert.ok(!result.items.some((item) => item.id === "park-assist"));
  assert.equal(resolve({ ...vehicle, opcionais: [] }).items[0].id, hud.id);
  // The same string in a different unit remains a raw, unreviewed optional.
  const other = resolve({ ...imported, id: "99902" });
  assert.ok(!other.items.some((item) => item.id === hud.id));
  assert.ok(other.items.some((item) => item.id === "other-hud"));
  assert.equal(definitionForEquipmentTag("HUD"), undefined);
});

test("reviewed definitions cannot redefine stronger equipment or smuggle global aliases", () => {
  for (const change of [
    { id: "adaptive-cruise-control" },
    { tag: "piloto_automatico" },
    { description: "ACC" },
    { sourceDescription: "Park Assist" },
    { aliases: ["CarPlay sem fio"] },
    { aliases: ["Sem teto"] },
    { priority: 1001 },
    { priority: 1.5 },
    { category: "Categoria inventada" },
    { reviewedAt: "2026-02-30" },
    { reviewNote: "" },
    { unsupportedInference: "all models" },
  ]) {
    const invalid = { ...hud, ...change };
    assert.equal(
      isReviewedUnitEquipmentDefinition(invalid),
      false,
      JSON.stringify(change),
    );
    assert.deepEqual(
      resolve(vehicle, [{ ...confirmation, reviewedDefinitions: [invalid] }]),
      resolve(vehicle, []),
    );
  }
});

test("colliding or unused local definitions fail closed before touching inventory", () => {
  const collisions = [
    { ...hud },
    { ...hud, id: "second-display", tag: "second_display" },
    {
      ...hud,
      id: "second-display",
      tag: "second_display",
      description: "Outra tela",
      sourceDescription: "Outra tela",
      aliases: ["HUD"],
    },
  ];
  for (const second of collisions) {
    assert.equal(
      isApprovedUnitEquipmentConfirmation({
        ...confirmation,
        reviewedDefinitions: [hud, second],
      }),
      false,
    );
  }
  assert.equal(
    isApprovedUnitEquipmentConfirmation({
      ...confirmation,
      presentTags: ["piloto_automatico"],
    }),
    false,
  );
  assert.equal(
    isApprovedUnitEquipmentConfirmation({
      ...confirmation,
      absentTags: ["HUD"],
    }),
    false,
  );
});

test("confirmed absence of a reviewed item survives equivalent future feed labels", () => {
  const absent = { ...confirmation, presentTags: [], absentTags: [hud.tag] };
  const result = resolve({ ...vehicle, opcionais: ["HUD", hud.tag] }, [absent]);
  assert.ok(!result.items.some((item) => item.id === hud.id));
  assert.ok(
    result.suppressed.some(
      (item) => item.id === hud.id && item.reason === "unit-confirmed-absence",
    ),
  );
});

test("duplicate concurrent v2 records cannot combine confirmations by input order", () => {
  const second = {
    ...confirmation,
    id: "synthetic-second",
    reviewedDefinitions: [],
    presentTags: ["piloto_adaptativo"],
  };
  for (const records of [
    [confirmation, second],
    [second, confirmation],
  ]) {
    assert.deepEqual(resolve(vehicle, records), resolve(vehicle, []));
  }
});

test("duplicate records cannot restore absences from legacy or reviewed custom corrections", () => {
  const legacy = {
    id: "synthetic-legacy",
    approved: true,
    source: "responsible-confirmation",
    confirmedAt: "2026-09-28",
    claim: "Ausência sintética já confirmada.",
    match: {
      vehicleId: "99901",
      brand: "TESTE",
      model: "MODELO EXATO",
      modelYear: 2024,
      engine: "1.0",
      transmission: "AUTOMATICO",
    },
    presentTags: [],
    absentTags: ["piloto_automatico"],
  };
  const customAbsent = {
    ...confirmation,
    id: "synthetic-absence",
    presentTags: [],
    absentTags: [hud.tag],
  };
  for (const records of [
    [confirmation, legacy],
    [legacy, confirmation],
  ]) {
    assert.deepEqual(resolve(vehicle, records), resolve(vehicle, [legacy]));
  }
  for (const records of [
    [confirmation, customAbsent],
    [customAbsent, confirmation],
  ]) {
    const result = resolve(
      { ...vehicle, opcionais: ["HUD", hud.tag] },
      records,
    );
    assert.equal(result.items.length, 0);
  }
});

test("parallel unit resolutions share no mutable taxonomy and preserve inputs", async () => {
  const records = structuredClone([confirmation]);
  const before = structuredClone(records);
  const vehicles = Array.from({ length: 20 }, (_, index) => ({
    ...vehicle,
    id: index % 2 ? "99902" : "99901",
    opcionais: ["HUD"],
  }));
  const originalVehicles = structuredClone(vehicles);
  const results = await Promise.all(
    vehicles.map(async (input) => resolve(input, records)),
  );
  results.forEach((result, index) =>
    assert.equal(
      result.items.some((item) => item.id === hud.id),
      index % 2 === 0,
    ),
  );
  assert.deepEqual(records, before);
  assert.deepEqual(vehicles, originalVehicles);
  assert.equal(definitionForEquipmentTag("HUD"), undefined);
});
