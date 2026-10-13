import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { EquipmentVehicle } from "../../src/lib/vehicleEquipment";
import { VehicleDescription } from "../../src/modules/detalhes/components/VehicleDescription";
import { buildVehicleDescription } from "../../src/modules/detalhes/lib/vehicleDescription";

type DescriptionVehicle = EquipmentVehicle & { combustivel?: string };

const fixture: { vehicles: DescriptionVehicle[] } = JSON.parse(
  readFileSync(
    new URL(
      "../fixtures/vehicle-equipment-description-stock.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

function vehicle(id: string): DescriptionVehicle {
  const found = fixture.vehicles.find((entry) => String(entry.id) === id);
  assert.ok(found, `missing description fixture ${id}`);
  return structuredClone(found);
}

function render(vehicle: DescriptionVehicle): string {
  const content = buildVehicleDescription(vehicle);
  assert.ok(content, "a named inventory vehicle has a description");
  return renderToStaticMarkup(createElement(VehicleDescription, { content }));
}

test("Argo description uses the supplied automatic/CVT transmission, not the old manual announcement", () => {
  const html = render(vehicle("19687"));
  assert.match(html, /ARGO DRIVE/);
  assert.match(html, /2023\/2024/);
  assert.match(html, /1\.3/);
  assert.match(html, /AUTOMATICO/);
  assert.match(html, /Câmbio CVT/);
  assert.doesNotMatch(html, /manual de cinco|5 marchas|cinco marchas/i);
});

test("ix35 description agrees with hydraulic steering and leather seats in the feed", () => {
  const html = render(vehicle("19653"));
  assert.match(html, /Direção hidráulica/);
  assert.match(html, /Bancos em couro/);
  assert.doesNotMatch(
    html,
    /Direção elétrica|bancos em tecido|revestidos em tecido/i,
  );
  // A generic automatic transmission does not establish its number of gears.
  assert.doesNotMatch(html, /6 velocidades|seis velocidades/i);
});

test("HR-V Advance does not inherit heating, stability control or hill assistance from prose", () => {
  const html = render(vehicle("19854"));
  assert.match(html, /Bancos em couro/);
  assert.match(html, /Ar-condicionado digital/);
  assert.doesNotMatch(
    html,
    /aquecimento|aquecidos|estabilidade|partida em rampa/i,
  );
});

test("digital climate is not expanded to dual zone on either audited vehicle", () => {
  for (const id of ["19750", "19898"]) {
    const html = render(vehicle(id));
    assert.match(html, /Ar-condicionado digital/, id);
    assert.doesNotMatch(html, /dual zone|duas zonas|Climatronic/i, id);
  }
});

test("Renegade description preserves the five authorized additions and the Park Assist exclusion", () => {
  const html = render(vehicle("20075"));
  for (const label of [
    "Frenagem automática de emergência",
    "Indicador de fadiga",
    "Android Auto e Apple CarPlay sem fio",
    "Câmbio automático de 6 velocidades",
    "Assistente de partida em rampa",
  ]) {
    assert.ok(html.includes(label), label);
    assert.equal(html.split(label).length - 1, 1, `${label} is not duplicated`);
  }
  assert.doesNotMatch(html, /Park Assist/i);

  const otherUnit = render({
    ...vehicle("20075"),
    physicalIdentityKey: "0".repeat(64),
  });
  assert.match(otherUnit, /Park Assist/);
  assert.doesNotMatch(
    otherUnit,
    /partida em rampa|Indicador de fadiga|CarPlay sem fio/i,
  );
});

test("Nivus description retains the reviewed six-speed correction rather than restoring XML seven-speed", () => {
  const html = render(vehicle("19788"));
  assert.match(html, /Câmbio automático de 6 velocidades/);
  assert.doesNotMatch(html, /7 marchas|sete marchas|som premium/i);
});

test("free-form marketing and draft instructions cannot contaminate a vehicle description", () => {
  const source = vehicle("19854");
  const claim =
    "Bancos dianteiros aquecidos, ar de duas zonas, 12 airbags, som premium. " +
    "(Remover item caso não confirmado)";
  const contaminated = {
    ...source,
    name: claim,
    anuncio: claim,
    gptContent: claim,
    description: claim,
    observacoes: claim,
  };
  assert.deepEqual(
    buildVehicleDescription(contaminated),
    buildVehicleDescription(source),
  );
  assert.doesNotMatch(
    render(contaminated),
    /aquecidos|duas zonas|12 airbags|som premium|Remover item/i,
  );
});

test("a later inventory edit changes the description without retaining old equipment claims", () => {
  const original = vehicle("19653");
  const updated = {
    ...original,
    cambio: "MANUAL",
    combustivel: "FLEX",
    opcionais: [
      { tag: "direcao_eletrica", descricao: "Direção Elétrica" },
      { tag: "ar_condicionado", descricao: "Ar Condicionado" },
    ],
  };
  assert.match(render(original), /Direção hidráulica/);
  const html = render(updated);
  assert.match(html, /MANUAL/);
  assert.match(html, /FLEX/);
  assert.match(html, /Direção elétrica/);
  assert.doesNotMatch(
    html,
    /AUTOMATICO|Direção hidráulica|Bancos em couro|Ar-condicionado digital/i,
  );
});

test("explicit negative equipment remains excluded from the generated description", () => {
  const source = {
    ...vehicle("19687"),
    opcionais: [
      { tag: "park_assist", descricao: "Park Assist" },
      { tag: "no_park_assist", descricao: "Sem Park Assist" },
      {
        tag: "sensor_de_estacionamento",
        descricao: "Sensor de Estacionamento",
      },
    ],
  };
  const html = render(source);
  assert.match(html, /Sensor de estacionamento/);
  assert.doesNotMatch(html, /Park Assist/i);
});

test("missing inventory data does not create a description or default specifications", () => {
  for (const missing of [undefined, null, {}, { opcionais: [] }]) {
    assert.equal(buildVehicleDescription(missing), null);
  }
  const namedOnly = render({ modelo: "MODELO INFORMADO", opcionais: [] });
  assert.match(namedOnly, /MODELO INFORMADO/);
  assert.doesNotMatch(
    namedOnly,
    /Motor:|Câmbio:|Combustível:|airbag|automático|litros/i,
  );
});
