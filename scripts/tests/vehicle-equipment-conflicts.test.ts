import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assessVehicleEquipmentVerification,
  resolveVehicleEquipment,
  unitEquipmentConfirmations,
  type EquipmentVehicle,
  type UnitEquipmentConfirmation,
} from "../../src/lib/vehicleEquipment";
import {
  equipmentConflictRegistry,
  isApprovedEquipmentConflict,
  matchingEquipmentConflicts,
} from "../../src/lib/vehicleEquipmentVerification";
import { vehiclePhysicalIdentityKey } from "../../src/lib/vehiclePhysicalIdentity";
import { buildVehicleHighlights } from "../../src/modules/detalhes/lib/vehicleHighlights";

const hrv: EquipmentVehicle = {
  id: "99001",
  marca: "HONDA",
  modelo: "HRV EX",
  year: 2018,
  anoFabricacao: 2018,
  motor: "1.8",
  cambio: "AUTOMATICO",
  placa: "ABC1D23",
  opcionais: [
    "chave_inteligente",
    "android",
    "apple",
    "camera_de_re",
    "piloto_automatico",
  ],
};
const nivus: EquipmentVehicle = {
  id: "19788",
  marca: "VOLKSWAGEN",
  modelo: "NIVUS HIGHLINE TURBO",
  year: 2024,
  motor: "1.0",
  cambio: "AUTOMATICO",
  opcionais: ["assistencia_faixa", "piloto_adaptativo", "camera_de_re"],
};
const compass: EquipmentVehicle = {
  id: "19379",
  marca: "JEEP",
  modelo: "COMPASS LONGITUDE T270 TURBO",
  year: 2022,
  motor: "1.3",
  cambio: "AUTOMATICO",
  opcionais: ["tracao_awd", "tracao_4x4", "camera_de_re"],
};
const ids = (vehicle: EquipmentVehicle) =>
  resolveVehicleEquipment(vehicle).items.map((item) => item.id);

test("the three reviewed factory conflicts hold only disputed claims, without inventing absence or new equipment", () => {
  for (const [vehicle, held] of [
    [hrv, ["keyless", "android-auto", "apple-carplay"]],
    [nivus, ["lane-assist"]],
    [compass, ["traction-awd", "traction-4x4"]],
  ] as const) {
    const original = structuredClone(vehicle);
    const result = resolveVehicleEquipment(vehicle);
    assert.deepEqual(
      vehicle,
      original,
      "raw supplier input must stay untouched",
    );
    for (const id of held) {
      assert.ok(!result.items.some((item) => item.id === id));
      assert.ok(
        result.suppressed.some(
          (item) =>
            item.id === id && item.reason === "factory-configuration-conflict",
        ),
      );
    }
    assert.ok(result.items.some((item) => item.id === "rear-camera"));
    assert.ok(
      !result.items.some((item) => item.source === "manufacturer-standard"),
    );
    const presentation = buildVehicleHighlights(vehicle);
    assert.ok(
      !presentation.highlights.some((item) =>
        (held as readonly string[]).includes(item.id),
      ),
    );
    const assessment = assessVehicleEquipmentVerification(vehicle, result);
    assert.equal(assessment.conflicts.length, held.length);
    assert.ok(
      assessment.conflicts.every(
        (item) =>
          item.status === "held" && item.sourceUrl.startsWith("https://"),
      ),
    );
  }
  assert.ok(ids(nivus).includes("adaptive-cruise-control"));
});

test("repeat imports, reordered options and another unit of the exact reviewed trim cannot resurrect claims", () => {
  for (const vehicle of [hrv, nivus, compass]) {
    const expected = ids(vehicle);
    assert.deepEqual(ids(structuredClone(vehicle)), expected);
    assert.deepEqual(
      ids({
        ...vehicle,
        id: "99999",
        opcionais: [...vehicle.opcionais!].reverse(),
      }),
      expected,
    );
  }
  const wireless = {
    ...hrv,
    opcionais: ["sem-_fio", "Android Auto sem fio", "CarPlay sem fio"],
  };
  assert.equal(resolveVehicleEquipment(wireless).items.length, 0);
});

test("year, trim, engine, transmission and explicit market bound the factory rules", () => {
  for (const patch of [
    { year: 2020 },
    { year: undefined },
    { modelo: "HRV EXL" },
    { motor: "1.5" },
    { cambio: "MANUAL" },
    { market: "US" },
    { marca: "HONDA USA" },
  ]) {
    const vehicle = { ...hrv, ...patch };
    assert.equal(matchingEquipmentConflicts(vehicle).length, 0);
    assert.ok(ids(vehicle).includes("android-auto"));
  }
  assert.equal(matchingEquipmentConflicts({ ...hrv, market: "BR" }).length, 1);
  assert.equal(
    matchingEquipmentConflicts({ ...hrv, market: undefined }).length,
    1,
    "unknown market can hold a claim, never provide positive equipment evidence",
  );
});

const installedMultimedia: UnitEquipmentConfirmation = {
  schemaVersion: 2,
  id: "test-hrv-installed-multimedia",
  approved: true,
  source: "responsible-confirmation",
  confirmedAt: "2026-10-26",
  claim:
    "Synthetic test only: responsible confirms installed Android Auto and authorizes display on this physical unit.",
  marketSource: "responsible-confirmation",
  match: {
    vehicleId: "99001",
    brand: "HONDA",
    model: "HRV EX",
    modelYear: 2018,
    manufactureYear: 2018,
    engine: "1.8",
    transmission: "AUTOMATICO",
    market: "BR",
    physicalIdentityKey: vehiclePhysicalIdentityKey("99001", "ABC1D23")!,
  },
  presentTags: ["android"],
  absentTags: [],
};

test("approved accessory exception is limited to the exact physical unit and item", () => {
  const result = resolveVehicleEquipment(hrv, [], [installedMultimedia]);
  assert.ok(
    result.items.some(
      (item) =>
        item.id === "android-auto" && item.source === "unit-confirmation",
    ),
  );
  assert.ok(
    !result.items.some((item) =>
      ["apple-carplay", "keyless"].includes(item.id),
    ),
  );
  const assessment = assessVehicleEquipmentVerification(hrv, result);
  assert.equal(
    assessment.conflicts.find((item) => item.itemId === "android-auto")?.status,
    "unit-confirmed",
  );
  const wireless = resolveVehicleEquipment(
    {
      ...hrv,
      opcionais: [
        ...hrv.opcionais!,
        "sem-_fio",
        "Android Auto sem fio",
        "CarPlay sem fio",
      ],
    },
    [],
    [installedMultimedia],
  );
  assert.deepEqual(
    wireless.items
      .filter((item) => /android|carplay/.test(item.id))
      .map((item) => item.id),
    ["android-auto"],
    "a confirmed wired protocol never authorizes wireless or the other protocol",
  );
  for (const patch of [
    { id: "99002" },
    { placa: "ABC1D24" },
    { placa: "" },
    { anoFabricacao: 2017 },
  ]) {
    assert.ok(
      !resolveVehicleEquipment(
        { ...hrv, ...patch },
        [],
        [installedMultimedia],
      ).items.some((item) => item.id === "android-auto"),
    );
  }
  const legacy = {
    ...installedMultimedia,
    schemaVersion: undefined,
    marketSource: undefined,
    match: {
      vehicleId: "99001",
      brand: "HONDA",
      model: "HRV EX",
      modelYear: 2018,
      engine: "1.8",
      transmission: "AUTOMATICO",
    },
  };
  assert.ok(
    !resolveVehicleEquipment(hrv, [], [legacy]).items.some(
      (item) => item.id === "android-auto",
    ),
    "a legacy approval without physical binding is not a retrofit exception",
  );
});

test("existing responsible decisions and unrelated compatible models stay intact", () => {
  for (const id of ["20050", "20051", "20075"]) {
    const confirmation = unitEquipmentConfirmations.find(
      (record) => record.match.vehicleId === id,
    )!;
    assert.ok(confirmation);
    const vehicle: EquipmentVehicle = {
      id,
      marca: confirmation.match.brand,
      modelo: confirmation.match.model,
      year: confirmation.match.modelYear,
      anoFabricacao: confirmation.match.manufactureYear,
      motor: confirmation.match.engine,
      cambio: confirmation.match.transmission,
      physicalIdentityKey: confirmation.match.physicalIdentityKey,
      opcionais: [...confirmation.presentTags, ...confirmation.absentTags],
    };
    assert.deepEqual(
      resolveVehicleEquipment(vehicle),
      resolveVehicleEquipment(vehicle, undefined, undefined, []),
      id,
    );
  }
  assert.ok(
    ids({ ...hrv, id: "20051", modelo: "CIVIC EXL", motor: "2.0" }).includes(
      "android-auto",
    ),
  );
  assert.ok(
    ids({
      ...nivus,
      id: "19903",
      modelo: "T CROSS HIGHLINE TURBO",
      motor: "1.4",
      opcionais: ["park_assist", "teto_solar"],
    }).includes("park-assist"),
  );
});

test("sensitive unreviewed claims are pending research, not confirmed false", () => {
  const result = assessVehicleEquipmentVerification({
    marca: "JEEP",
    modelo: "RENEGADE T270 TURBO",
    year: 2025,
    motor: "1.3",
    cambio: "AUTOMATICO",
    opcionais: ["piloto_adaptativo", "camera_de_re"],
  });
  assert.equal(result.conflicts.length, 0);
  assert.deepEqual(
    result.unverifiedSensitiveItems.map((item) => item.id),
    ["adaptive-cruise-control"],
  );
});

test("conflict records require reviewed exact sources, approval and bounded identities", () => {
  assert.ok(equipmentConflictRegistry.every(isApprovedEquipmentConflict));
  const rule = equipmentConflictRegistry[0];
  for (const patch of [
    { approved: false },
    { sourceUrl: "https://example.com/honda" },
    { sourceUrl: `${rule.sourceUrl}?new=1` },
    { reviewedAt: "2026-02-30" },
    { match: { ...rule.match, modelYear: "2018" } },
    { match: { ...rule.match, model: "HRV.*" } },
    { equipmentIds: [] },
  ])
    assert.equal(isApprovedEquipmentConflict({ ...rule, ...patch }), false);
});
