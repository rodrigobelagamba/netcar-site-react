import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { EquipmentVehicle } from "../../src/lib/vehicleEquipment";
import {
  buildVehicleHighlights,
  getVehicleHeroEquipmentLabels,
} from "../../src/modules/detalhes/lib/vehicleHighlights";

const fixture: { vehicles: EquipmentVehicle[] } = JSON.parse(
  readFileSync(
    new URL("../fixtures/vehicle-equipment-stock.json", import.meta.url),
    "utf8",
  ),
);

const tiggo: EquipmentVehicle = {
  id: "20041",
  marca: "CHERY",
  modelo: "TIGGO 8 MAX DRIVE TURBO",
  year: 2024,
  anoFabricacao: 2023,
  cambio: "AUTOMATICO",
  motor: "1.6",
  lugares: 0,
  opcionais: [{ tag: "sete_lugares", descricao: "7 Lugares" }],
};

test("hero highlights seven seats explicitly registered even when lugares is zero", () => {
  const original = structuredClone(tiggo);
  assert.deepEqual(getVehicleHeroEquipmentLabels(tiggo), ["7 lugares"]);
  assert.deepEqual(tiggo, original);
});

test("hero equipment labels follow the canonical resolver and deduplicate aliases", () => {
  assert.deepEqual(
    getVehicleHeroEquipmentLabels({
      opcionais: [
        "sete_lugares",
        "Sete lugares",
        { tag: "sete_lugares", descricao: "7 Lugares" },
        { nome: "Sete lugares" },
      ],
    }),
    ["7 lugares"],
  );
});

test("explicit absence prevents a seven-seat hero label regardless of source order", () => {
  for (const absence of ["Sem 7 lugares", "Não possui sete lugares"]) {
    const opcionais = [
      { tag: "sete_lugares", descricao: "7 Lugares" },
      { tag: "sete_lugares", descricao: absence },
    ];
    assert.deepEqual(getVehicleHeroEquipmentLabels({ opcionais }), []);
    assert.deepEqual(
      getVehicleHeroEquipmentLabels({ opcionais: [...opcionais].reverse() }),
      [],
    );
  }
});

test("hero does not infer seating from vehicle identity, marketing text or lugares alone", () => {
  for (const opcionais of [undefined, null, []]) {
    assert.deepEqual(
      getVehicleHeroEquipmentLabels({
        ...tiggo,
        name: "Tiggo 8 Max Drive com sete lugares",
        lugares: 7,
        opcionais,
      }),
      [],
    );
  }
  assert.deepEqual(getVehicleHeroEquipmentLabels({ lugares: "7" }), []);
  assert.deepEqual(getVehicleHeroEquipmentLabels({}), []);
});

test("explicit supplier description takes precedence over a legacy seven-seat tag", () => {
  assert.deepEqual(
    getVehicleHeroEquipmentLabels({
      opcionais: [{ tag: "sete_lugares", descricao: "5 Lugares" }],
    }),
    [],
  );
});

test("other notable equipment is not promoted to seven-seat hero labels", () => {
  assert.deepEqual(
    getVehicleHeroEquipmentLabels({
      opcionais: [
        "6 airbags",
        "piloto_adaptativo",
        "franagem_emergencia",
        "park_assist",
        "teto_solar",
      ],
    }),
    [],
  );
});

test("the audited Tiggo retains its lower seven-seat highlight without duplicating optionals", () => {
  const vehicle = fixture.vehicles.find((item) => String(item.id) === "20029");
  assert.ok(vehicle, "audited Tiggo 20029 must exist");
  const original = structuredClone(vehicle);
  const before = buildVehicleHighlights(vehicle);
  assert.deepEqual(getVehicleHeroEquipmentLabels(vehicle), ["7 lugares"]);
  const after = buildVehicleHighlights(vehicle);
  assert.deepEqual(after, before);
  assert.equal(
    after.highlights.filter((item) => item.id === "seven-seats").length,
    1,
  );
  assert.ok(!after.remainingOptionals.includes("7 lugares"));
  assert.deepEqual(vehicle, original);
});

test("hero seven-seat label remains eligible alongside higher-ranked safety equipment", () => {
  const vehicle: EquipmentVehicle = {
    ...tiggo,
    opcionais: [
      "6 airbags",
      "piloto_adaptativo",
      "franagem_emergencia",
      "sete_lugares",
      "park_assist",
    ],
  };
  assert.deepEqual(getVehicleHeroEquipmentLabels(vehicle), ["7 lugares"]);
  assert.deepEqual(
    buildVehicleHighlights(vehicle).highlights.map((item) => item.id),
    [
      "airbags-6",
      "adaptive-cruise-control",
      "automatic-emergency-braking",
      "seven-seats",
    ],
  );
});
