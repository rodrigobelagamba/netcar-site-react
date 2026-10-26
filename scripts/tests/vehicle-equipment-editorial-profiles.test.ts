import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  resolveVehicleEquipment,
  type EquipmentVehicle,
} from "../../src/lib/vehicleEquipment";
import { buildVehicleHighlights } from "../../src/modules/detalhes/lib/vehicleHighlights";
import {
  selectVehicleEditorialTopics,
  vehicleEditorialProfiles,
} from "../../src/modules/detalhes/lib/vehicleEditorialProfiles";

const fixture: { vehicles: EquipmentVehicle[] } = JSON.parse(
  readFileSync(
    new URL("../fixtures/vehicle-equipment-stock.json", import.meta.url),
    "utf8",
  ),
);
const stockVehicle = (id: string): EquipmentVehicle => {
  const vehicle = fixture.vehicles.find((entry) => String(entry.id) === id);
  assert.ok(vehicle);
  return vehicle;
};

test("reviewed profiles cover only four exact combinations and contain no equipment enrichment", () => {
  assert.equal(vehicleEditorialProfiles.length, 4);
  const identities = new Set<string>();
  for (const profile of vehicleEditorialProfiles) {
    const identity = JSON.stringify(profile.match);
    assert.ok(!identities.has(identity));
    identities.add(identity);
    assert.equal(typeof profile.match.modelYear, "number");
    assert.ok(profile.topics.length > 0 && profile.topics.length <= 4);
    assert.equal(new Set(profile.topics).size, profile.topics.length);
    assert.deepEqual(Object.keys(profile).sort(), [
      "id",
      "match",
      "reviewedAt",
      "topics",
    ]);
  }
});

test("Advance and Touring have different editorial selections without changing equipment ranking", () => {
  const expected: Record<string, string[]> = {
    "19854": [
      "driving-assistance",
      "parking-aids",
      "cabin-comfort",
      "phone-connectivity",
    ],
    "19898": [
      "driving-assistance",
      "parking-aids",
      "cabin-comfort",
      "everyday-convenience",
    ],
    "19587": [
      "parking-aids",
      "cabin-comfort",
      "phone-connectivity",
      "everyday-convenience",
    ],
  };
  for (const [id, topics] of Object.entries(expected)) {
    const vehicle = stockVehicle(id);
    const result = buildVehicleHighlights(vehicle);
    assert.deepEqual(
      result.highlights.map((card) => card.id),
      topics,
    );
    assert.equal(result.editorialReview.status, "profile-applied");
    assert.equal(
      result.editorialReview.provenance,
      "Curadoria editorial dos equipamentos cadastrados",
    );
    const equipment = resolveVehicleEquipment(vehicle).items;
    const indexes = result.highlights.map((card) =>
      Math.min(
        ...card.equipmentIds.map((equipmentId) =>
          equipment.findIndex((item) => item.id === equipmentId),
        ),
      ),
    );
    assert.deepEqual(
      indexes,
      [...indexes].sort((a, b) => a - b),
    );
    const visible = [
      ...result.highlights.flatMap((card) => card.equipmentLabels),
      ...result.remainingOptionals,
    ];
    assert.equal(new Set(visible).size, visible.length);
    assert.deepEqual(
      [...visible].sort(),
      equipment.map((item) => item.description).sort(),
    );
    assert.ok(
      result.remainingOptionals.includes(
        "Airbags frontais, laterais e de cortina",
      ),
    );
  }
});

test("another model year, trim, brand or missing identity uses the factual fallback", () => {
  const touring = stockVehicle("19898");
  for (const change of [
    { year: 2025 },
    { modelo: "HRV TOURING" },
    { modelo: "HRV EXL TURBO" },
    { marca: "OUTRA" },
    { year: undefined, anoFabricacao: 2024 },
    { modelo: undefined, name: "HRV TOURING TURBO" },
  ]) {
    const result = buildVehicleHighlights({ ...touring, ...change });
    assert.equal(result.editorialReview.status, "needs-editorial-review");
    assert.equal(result.editorialReview.reason, "no-exact-profile");
    assert.equal(result.editorialReview.profileId, undefined);
    assert.deepEqual(
      result.highlights.map((card) => card.id),
      [
        "driving-assistance",
        "airbag-protection",
        "parking-aids",
        "cabin-comfort",
      ],
    );
  }
});

test("missing profile topics are omitted without inventing substitute equipment", () => {
  const touring = stockVehicle("19898");
  const original = structuredClone(touring);
  const missing = buildVehicleHighlights({
    ...touring,
    opcionais: ["bancos_de_couro", "ar_condicionado_digital", "camera_de_re"],
  });
  assert.deepEqual(
    missing.highlights.map((card) => card.id),
    ["cabin-comfort"],
  );
  assert.deepEqual(missing.remainingOptionals, ["Câmera de ré"]);
  assert.equal(missing.editorialReview.reason, "unavailable-topics");
  assert.deepEqual(missing.editorialReview.unavailableTopics, [
    "driving-assistance",
    "everyday-convenience",
    "parking-aids",
  ]);
  assert.doesNotMatch(
    JSON.stringify(missing.highlights),
    /ACC|adaptativo|sensor|keyless|botão|indução/i,
  );
  const empty = buildVehicleHighlights({ ...touring, opcionais: [] });
  assert.deepEqual(empty.highlights, []);
  assert.deepEqual(empty.remainingOptionals, []);
  assert.equal(empty.editorialReview.status, "needs-editorial-review");
  assert.deepEqual(touring, original);
});

test("a changed unit shares only editorial themes, never another unit's equipment", () => {
  const touring = stockVehicle("19898");
  const changed = buildVehicleHighlights({
    ...touring,
    id: "99999",
    opcionais: ["chave_inteligente", "botao"],
  });
  assert.deepEqual(changed.highlights[0].equipmentIds, [
    "keyless",
    "push-start",
  ]);
  assert.doesNotMatch(
    JSON.stringify(changed.highlights),
    /indução|recarga|ACC|adaptativo/,
  );
  assert.equal(changed.editorialReview.status, "needs-editorial-review");
});

test("Tracker 2018 topics use its registered MyLink and navigation without inheriting later equipment", () => {
  const tracker: EquipmentVehicle = {
    id: "20088",
    marca: "CHEVROLET",
    modelo: "TRACKER LT TURBO",
    year: 2018,
    anoFabricacao: 2017,
    motor: "1.4",
    cambio: "AUTOMATICO",
    opcionais: [
      "camera_de_re",
      "piloto_automatico",
      "mylink",
      "gps",
      "freios_abs",
      "air_bag_duplo",
    ],
  };
  const result = buildVehicleHighlights(tracker);
  assert.deepEqual(
    result.highlights.map((card) => card.id),
    ["rear-camera", "cruise-control", "mylink", "navigation"],
  );
  assert.equal(
    result.editorialReview.profileId,
    "chevrolet-tracker-lt-turbo-2018",
  );
  assert.equal(result.editorialReview.status, "profile-applied");
  assert.doesNotMatch(
    JSON.stringify(result.highlights),
    /CarPlay|Android|sensor|keyless|couro|digital|adaptativo/i,
  );
  assert.equal(
    selectVehicleEditorialTopics({ ...tracker, year: 2022 }, ["rear-camera"])
      .topics,
    null,
  );
});
