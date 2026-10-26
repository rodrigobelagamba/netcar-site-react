import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  resolveVehicleEquipment,
  type EquipmentVehicle,
} from "../../src/lib/vehicleEquipment";
import { buildVehicleHighlights } from "../../src/modules/detalhes/lib/vehicleHighlights";

const fixture: { vehicles: EquipmentVehicle[] } = JSON.parse(
  readFileSync(
    new URL("../fixtures/vehicle-equipment-stock.json", import.meta.url),
    "utf8",
  ),
);

test("Touring profile selects its topics while keeping all other facts in the canonical list", () => {
  const vehicle = fixture.vehicles.find(
    (entry) => String(entry.id) === "19898",
  );
  assert.ok(vehicle);
  const { highlights, remainingOptionals } = buildVehicleHighlights(vehicle);
  assert.deepEqual(
    highlights.map((item) => item.id),
    [
      "driving-assistance",
      "parking-aids",
      "cabin-comfort",
      "everyday-convenience",
    ],
  );
  assert.deepEqual(highlights[0].equipmentIds, [
    "adaptive-cruise-control",
    "automatic-emergency-braking",
    "lane-assist",
  ]);
  assert.deepEqual(highlights[1].equipmentIds, [
    "rear-camera",
    "parking-sensors",
  ]);
  assert.deepEqual(highlights[2].equipmentLabels, [
    "Bancos em couro",
    "Ar-condicionado digital",
  ]);
  assert.deepEqual(highlights[3].equipmentIds, [
    "wireless-charging",
    "keyless",
    "push-start",
  ]);
  assert.ok(
    remainingOptionals.includes("Airbags frontais, laterais e de cortina"),
  );
  assert.doesNotMatch(
    JSON.stringify(highlights),
    /dual zone|6 airbags|porta-malas/i,
  );
});

test("removing assistance facts changes the card without retaining a stale claim", () => {
  const partial = buildVehicleHighlights({
    opcionais: ["piloto_adaptativo", "franagem_emergencia"],
  });
  assert.equal(partial.highlights[0].id, "driving-assistance");
  assert.doesNotMatch(JSON.stringify(partial), /faixa/i);
  const single = buildVehicleHighlights({ opcionais: ["assistencia_faixa"] });
  assert.equal(single.highlights[0].id, "lane-assist");
  assert.doesNotMatch(JSON.stringify(single), /adaptativo|frenagem/i);
});

test("access convenience requires both facts and mentions charging only when supplied", () => {
  const single = buildVehicleHighlights({ opcionais: ["chave_inteligente"] });
  assert.equal(single.highlights[0].id, "keyless");
  const pair = buildVehicleHighlights({
    opcionais: ["chave_inteligente", "botao"],
  });
  assert.equal(pair.highlights[0].id, "everyday-convenience");
  assert.equal(pair.highlights[0].equipmentIds.length, 2);
  assert.doesNotMatch(JSON.stringify(pair), /indu[çc][ãa]o|recarga/i);
  const triple = buildVehicleHighlights({
    opcionais: [
      "chave_inteligente",
      "botao",
      "Carregador de celular por indução",
    ],
  });
  assert.equal(triple.highlights[0].equipmentIds.length, 3);
  assert.match(triple.highlights[0].description, /celulares compatíveis/);
});

test("connectivity grouping cannot turn ordinary phone integration into a wireless claim", () => {
  const { highlights, remainingOptionals } = buildVehicleHighlights({
    opcionais: ["multimidia", "android", "apple"],
  });
  assert.equal(highlights.length, 1);
  assert.equal(highlights[0].id, "phone-connectivity");
  assert.equal(highlights[0].equipmentIds.length, 3);
  assert.deepEqual(remainingOptionals, []);
  assert.doesNotMatch(JSON.stringify(highlights), /sem fio|sem cabo|wi-?fi/i);
});

test("factory conflicts are resolved before editorial grouping and cannot be resurrected", () => {
  const vehicle: EquipmentVehicle = {
    marca: "HONDA",
    modelo: "HRV EX",
    year: 2018,
    motor: "1.8",
    cambio: "AUTOMATICO",
    opcionais: [
      "chave_inteligente",
      "botao",
      "multimidia",
      "android",
      "apple",
      "camera_de_re",
      "sensor_de_estacionamento",
    ],
  };
  const result = buildVehicleHighlights(vehicle);
  assert.doesNotMatch(
    JSON.stringify(result.highlights),
    /keyless|android|carplay|phone-connectivity|everyday-convenience/i,
  );
  const parking = result.highlights.find((item) => item.id === "parking-aids");
  assert.ok(parking);
  assert.deepEqual(parking.equipmentIds, ["rear-camera", "parking-sensors"]);
});

test("seven seats keeps its resolver priority even with four complete complementary groups", () => {
  const { highlights } = buildVehicleHighlights({
    opcionais: [
      "sete_lugares",
      "piloto_adaptativo",
      "franagem_emergencia",
      "assistencia_faixa",
      "camera_de_re",
      "sensor_de_estacionamento",
      "bancos_de_couro",
      "ar_condicionado_digital",
      "chave_inteligente",
      "botao",
    ],
  });
  assert.deepEqual(
    highlights.map((item) => item.id),
    ["driving-assistance", "seven-seats", "parking-aids", "cabin-comfort"],
  );
  assert.deepEqual(highlights[1].equipmentLabels, ["7 lugares"]);
});

test("Advance and Touring lead with their own registered assistance combination", () => {
  const advance = fixture.vehicles.find(
    (vehicle) => String(vehicle.id) === "19854",
  );
  const touring = fixture.vehicles.find(
    (vehicle) => String(vehicle.id) === "19898",
  );
  assert.ok(advance);
  assert.ok(touring);
  const advanceCards = buildVehicleHighlights(advance);
  const touringCards = buildVehicleHighlights(touring);
  assert.equal(
    advanceCards.highlights[0].title,
    "Piloto automático e assistências de segurança",
  );
  assert.equal(
    touringCards.highlights[0].title,
    "ACC, frenagem automática e assistência de faixa",
  );
  assert.deepEqual(advanceCards.highlights[0].equipmentIds, [
    "automatic-emergency-braking",
    "collision-warning",
    "lane-assist",
    "cruise-control",
  ]);
  assert.doesNotMatch(
    JSON.stringify(advanceCards.highlights),
    /\bACC\b|adaptativo/i,
  );
  assert.doesNotMatch(
    JSON.stringify(touringCards.highlights),
    /alerta de colisão/i,
  );
  assert.equal(advanceCards.highlights[2].id, "cabin-comfort");
  assert.equal(advanceCards.highlights[3].id, "phone-connectivity");
  assert.match(
    advanceCards.highlights[0].description,
    /velocidade definida pelo motorista/,
  );
  assert.doesNotMatch(
    advanceCards.highlights[0].description,
    /acompanhar o veículo|distância/,
  );
  assert.equal(
    buildVehicleHighlights({ opcionais: ["piloto_automatico"] }).highlights[0]
      .id,
    "cruise-control",
  );
  assert.match(
    advanceCards.highlights[0].description,
    /limites de cada sistema/,
  );
  assert.match(touringCards.highlights[0].description, /limites do sistema/);
  for (const vehicle of [advance, touring]) {
    const result = buildVehicleHighlights(vehicle);
    const visibleLabels = [
      ...result.highlights.flatMap((card) => card.equipmentLabels),
      ...result.remainingOptionals,
    ];
    assert.deepEqual(
      [...visibleLabels].sort(),
      resolveVehicleEquipment(vehicle)
        .items.map((item) => item.description)
        .sort(),
    );
    assert.equal(new Set(visibleLabels).size, visibleLabels.length);
  }
});

test("each assistance subset names only its current resolved facts", () => {
  const tags = [
    "piloto_adaptativo",
    "franagem_emergencia",
    "alerta_colisao",
    "assistencia_faixa",
  ];
  const claims = [
    /\bACC\b|adaptativo/i,
    /frenagem|freios/i,
    /alerta de colisão/i,
    /faixa/i,
  ];
  for (let mask = 1; mask < 16; mask += 1) {
    const result = buildVehicleHighlights({
      opcionais: tags.filter((_, index) => mask & (1 << index)),
    });
    const text = JSON.stringify(result.highlights);
    claims.forEach((claim, index) => {
      if (mask & (1 << index)) assert.match(text, claim);
      else assert.doesNotMatch(text, claim);
    });
  }
});

test("airbag calls preserve registered categories or an explicit count", () => {
  const categories = buildVehicleHighlights({
    opcionais: ["air_bag_duplo", "air_bag_lateral", "air_bag_cortina"],
  }).highlights[0];
  assert.equal(categories.title, "Airbags frontais, laterais e de cortina");
  assert.doesNotMatch(categories.description, /frontais|laterais|cortina/);
  assert.doesNotMatch(
    JSON.stringify(categories),
    /\b[3-9] airbags|Proteção a bordo/i,
  );
  const count = buildVehicleHighlights({ opcionais: ["6 airbags"] })
    .highlights[0];
  assert.equal(count.title, "6 airbags");
  assert.match(count.description, /6 bolsas/);
  assert.doesNotMatch(JSON.stringify(count), /frontais|laterais|cortina/i);
});

test("camera and climate calls change with the exact configuration", () => {
  const rear = buildVehicleHighlights({
    opcionais: ["camera_de_re", "sensor_de_estacionamento"],
  }).highlights[0];
  const surround = buildVehicleHighlights({
    opcionais: ["camera_360", "sensor_de_estacionamento"],
  }).highlights[0];
  assert.equal(rear.title, "Câmera de ré e sensor de estacionamento");
  assert.doesNotMatch(JSON.stringify(rear), /360|ao redor/i);
  assert.equal(surround.title, "Câmera 360° e sensor de estacionamento");
  assert.match(surround.description, /ao redor/);
  const digital = buildVehicleHighlights({
    opcionais: ["bancos_de_couro", "ar_condicionado_digital"],
  }).highlights[0];
  const dual = buildVehicleHighlights({
    opcionais: ["bancos_de_couro", "ar_condicionado_dual_zone"],
  }).highlights[0];
  assert.equal(digital.title, "Bancos em couro e ar digital");
  assert.doesNotMatch(JSON.stringify(digital), /dual zone|por zona/i);
  assert.equal(dual.title, "Bancos em couro e ar dual zone");
  assert.match(dual.description, /por zona/);
});

test("connectivity names the supported platforms without upgrading either to wireless", () => {
  const ordinary = buildVehicleHighlights({
    opcionais: ["multimidia", "apple", "android"],
  }).highlights[0];
  const wireless = buildVehicleHighlights({
    opcionais: ["multimidia", "Android Auto e Apple CarPlay sem fio"],
  }).highlights[0];
  assert.match(ordinary.title, /Android Auto/);
  assert.match(ordinary.title, /Apple CarPlay/);
  assert.doesNotMatch(JSON.stringify(ordinary), /sem fio|sem cabo/i);
  assert.match(wireless.title, /Android Auto e Apple CarPlay sem fio/);
  assert.match(wireless.description, /sem cabo/);
});
