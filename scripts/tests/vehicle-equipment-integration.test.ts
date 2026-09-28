import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  equipmentEvidenceRegistry,
  equipmentByTag,
  isApprovedEquipmentEvidence,
  normalizeEquipmentTag,
  resolveVehicleEquipment,
  unitEquipmentConfirmations,
  type EquipmentVehicle,
} from "../../src/lib/vehicleEquipment";
import { buildVehicleHighlights } from "../../src/modules/detalhes/lib/vehicleHighlights";

interface StockFixture {
  checkedAt: string;
  source: string;
  vehicles: EquipmentVehicle[];
}

const fixture: StockFixture = JSON.parse(
  readFileSync(
    new URL("../fixtures/vehicle-equipment-stock.json", import.meta.url),
    "utf8",
  ),
);

const context = (vehicle: EquipmentVehicle) =>
  `${vehicle.id}: ${vehicle.modelo} ${vehicle.year}`;
const sorted = (values: string[]) => [...values].sort();

test("the audited integration fixture has 60 unique active vehicles and no private fields", () => {
  assert.equal(fixture.vehicles.length, 60);
  assert.equal(new Set(fixture.vehicles.map((vehicle) => vehicle.id)).size, 60);
  assert.ok(Number.isFinite(Date.parse(fixture.checkedAt)));
  assert.equal(
    fixture.source,
    "https://www.netcarmultimarcas.com.br/api/v1/veiculos.php?limit=500",
  );
  const permitted = new Set([
    "id",
    "marca",
    "modelo",
    "year",
    "anoFabricacao",
    "cambio",
    "motor",
    "lugares",
    "opcionais",
  ]);
  for (const vehicle of fixture.vehicles) {
    for (const key of Object.keys(vehicle)) {
      assert.ok(permitted.has(key), `${context(vehicle)}: unexpected ${key}`);
    }
    assert.ok(vehicle.opcionais?.length, context(vehicle));
    for (const optional of vehicle.opcionais || []) {
      assert.notEqual(typeof optional, "string", context(vehicle));
      assert.deepEqual(Object.keys(optional).sort(), ["descricao", "tag"]);
    }
  }
});

test("all real inventory tags have an audited weight and every result is sorted and unique", () => {
  for (const vehicle of fixture.vehicles) {
    const label = context(vehicle);
    for (const optional of vehicle.opcionais || []) {
      const tag = typeof optional === "string" ? optional : optional.tag || "";
      assert.ok(
        equipmentByTag.has(normalizeEquipmentTag(tag)),
        `${label}: ${tag}`,
      );
    }
    const { items } = resolveVehicleEquipment(vehicle);
    assert.equal(
      new Set(items.map((item) => item.id)).size,
      items.length,
      label,
    );
    assert.equal(
      new Set(items.map((item) => item.description)).size,
      items.length,
      label,
    );
    assert.ok(items.length > 0, label);
    for (let index = 1; index < items.length; index += 1) {
      assert.ok(items[index - 1].priority >= items[index].priority, label);
    }
    for (const item of items) {
      assert.ok(
        item.priority > 20,
        `${label}: unrecognized ${item.description}`,
      );
    }
  }
});

test("cards and list partition the same resolved inventory, without repeated equipment", () => {
  for (const vehicle of fixture.vehicles) {
    const label = context(vehicle);
    const equipment = resolveVehicleEquipment(vehicle);
    const presentation = buildVehicleHighlights(vehicle);
    const expectedCards = equipment.items
      .filter((item) => item.benefit)
      .slice(0, 4);
    assert.deepEqual(
      presentation.highlights.map((item) => item.id),
      expectedCards.map((item) => item.id),
      label,
    );
    assert.deepEqual(
      presentation.highlights.map((item) => item.title),
      expectedCards.map((item) => item.description),
      label,
    );
    const shownInCards = new Set(
      presentation.highlights.map((item) => item.title),
    );
    assert.ok(
      presentation.remainingOptionals.every((item) => !shownInCards.has(item)),
      label,
    );
    assert.deepEqual(
      sorted([
        ...presentation.highlights.map((item) => item.title),
        ...presentation.remainingOptionals,
      ]),
      sorted(equipment.items.map((item) => item.description)),
      label,
    );
    const selectedIds = new Set(expectedCards.map((item) => item.id));
    assert.deepEqual(
      presentation.remainingOptionals,
      equipment.items
        .filter((item) => !selectedIds.has(item.id))
        .map((item) => item.description),
      label,
    );
    assert.deepEqual(
      presentation.explainedTags,
      new Set(expectedCards.flatMap((item) => item.sourceTags)),
      label,
    );
  }
});

test("every real item retains inventory, exact manufacturer or exact unit-confirmation provenance", () => {
  for (const vehicle of fixture.vehicles) {
    const label = context(vehicle);
    const sourceTags = new Set(
      (vehicle.opcionais || []).map((optional) =>
        normalizeEquipmentTag(
          typeof optional === "string" ? optional : optional.tag || "",
        ),
      ),
    );
    for (const item of resolveVehicleEquipment(vehicle).items) {
      if (item.source === "unit-confirmation") {
        assert.equal(String(vehicle.id), "20050", label);
        assert.equal(item.id, "lane-assist", label);
        const record = unitEquipmentConfirmations.find(
          (record) => String(record.match.vehicleId) === String(vehicle.id),
        );
        assert.ok(record, `${label}: unit confirmation missing`);
        assert.equal(record.source, "responsible-confirmation", label);
        assert.equal(record.approved, true, label);
        assert.equal(record.match.brand, vehicle.marca, label);
        assert.equal(record.match.model, vehicle.modelo, label);
        assert.equal(record.match.modelYear, vehicle.year, label);
        assert.equal(record.match.engine, vehicle.motor, label);
        assert.equal(record.match.transmission, vehicle.cambio, label);
        assert.deepEqual(item.evidenceIds, [record.id], label);
        assert.ok(
          item.sourceTags.every((tag) => sourceTags.has(tag)),
          label,
        );
        assert.deepEqual(item.sourceTags, ["assistencia_faixa"], label);
        continue;
      }
      if (item.source === "manufacturer-standard") {
        assert.equal(String(vehicle.id), "19788", label);
        assert.equal(vehicle.marca, "VOLKSWAGEN", label);
        assert.equal(vehicle.modelo, "NIVUS HIGHLINE TURBO", label);
        assert.equal(vehicle.year, 2024, label);
        assert.equal(vehicle.motor, "1.0", label);
        assert.equal(item.id, "automatic-6", label);
        assert.ok(
          item.evidenceIds?.length,
          `${label}: manufacturer evidence missing`,
        );
        continue;
      }
      assert.equal(item.source, "inventory", label);
      assert.ok(item.sourceTags.length > 0, label);
      assert.ok(
        item.sourceTags.every((tag) => sourceTags.has(tag)),
        label,
      );
      assert.ok(!/^airbags-(?:[3-9]|1[0-2])$/.test(item.id), label);
      assert.ok(!/\b[3-9]\s+airbags\b/i.test(item.description), label);
    }
  }
});

test("reversing source order does not change displayed order or mutate any of the 60 records", () => {
  for (const vehicle of fixture.vehicles) {
    const label = context(vehicle);
    const original = structuredClone(vehicle);
    const reversed = {
      ...vehicle,
      opcionais: [...(vehicle.opcionais || [])].reverse(),
    };
    const presentation = buildVehicleHighlights(vehicle);
    const alternate = buildVehicleHighlights(reversed);
    assert.deepEqual(
      alternate.highlights.map((item) => [item.id, item.title]),
      presentation.highlights.map((item) => [item.id, item.title]),
      label,
    );
    assert.deepEqual(
      alternate.remainingOptionals,
      presentation.remainingOptionals,
      label,
    );
    assert.deepEqual(vehicle, original, label);
  }
});

test("all audited vehicles omit generic automatic transmission and turbo already displayed in their specs", () => {
  let checkedAutomatic = 0;
  let checkedTurbo = 0;
  for (const vehicle of fixture.vehicles) {
    const label = context(vehicle);
    const equipment = resolveVehicleEquipment(vehicle);
    const ids = new Set(equipment.items.map((item) => item.id));
    const presentation = buildVehicleHighlights(vehicle);
    const descriptions = [
      ...presentation.highlights.map((item) => item.title),
      ...presentation.remainingOptionals,
    ];
    if (/automatic[oa]|cvt|dsg/i.test(String(vehicle.cambio))) {
      checkedAutomatic += 1;
      assert.ok(!ids.has("automatic-transmission"), label);
      assert.ok(
        !descriptions.some((text) => /^câmbio automático$/i.test(text)),
        label,
      );
    }
    if (/\bturbo\b/i.test(`${vehicle.motor} ${vehicle.modelo}`)) {
      checkedTurbo += 1;
      assert.ok(!ids.has("turbo"), label);
      assert.ok(
        !descriptions.some((text) => /^motor turbo$/i.test(text)),
        label,
      );
    }
  }
  assert.ok(checkedAutomatic > 0);
  assert.ok(checkedTurbo > 0);
});

test("T-Cross 19903 keeps its supplier-confirmed Park Assist and sunroof exactly once", () => {
  const vehicle = fixture.vehicles.find((item) => String(item.id) === "19903");
  assert.ok(vehicle);
  const equipment = resolveVehicleEquipment(vehicle);
  const presentation = buildVehicleHighlights(vehicle);
  for (const id of ["park-assist", "sunroof"]) {
    const item = equipment.items.find((item) => item.id === id);
    assert.ok(item, id);
    assert.equal(
      [
        ...presentation.highlights.map((card) => card.title),
        ...presentation.remainingOptionals,
      ].filter((description) => description === item.description).length,
      1,
      id,
    );
  }
  assert.ok(!equipment.items.some((item) => item.id === "panoramic-roof"));
  assert.ok(
    !equipment.suppressed.some((item) =>
      ["park-assist", "sunroof"].includes(item.id),
    ),
  );
});

test("ranking and specific-over-generic suppression are shared by highlights and list", () => {
  const vehicle: EquipmentVehicle = {
    opcionais: [
      "manual",
      "vidros_eletricos",
      "air_bag",
      "air_bag_duplo",
      "air_bag_lateral",
      "air_bag_cortina",
      "piloto_automatico",
      "controle_velocidade",
      "piloto_adaptativo",
      "sete_lugares",
      "park_assist",
      "6 airbags",
      "ar_condicionado",
      "ar_condicionado_digital",
      "ar_condicionado_dual_zone",
    ],
  };
  const presentation = buildVehicleHighlights(vehicle);
  assert.deepEqual(
    presentation.highlights.map((item) => item.id),
    ["airbags-6", "adaptive-cruise-control", "seven-seats", "park-assist"],
  );
  const finalIds = resolveVehicleEquipment(vehicle).items.map(
    (item) => item.id,
  );
  for (const redundant of [
    "airbags",
    "airbags-2",
    "side-airbags",
    "curtain-airbags",
    "cruise-control",
    "air-conditioning",
    "digital-climate",
  ]) {
    assert.ok(!finalIds.includes(redundant), redundant);
  }
  assert.equal(presentation.remainingOptionals[0], "Ar-condicionado dual zone");
});

test("model, year, old metric IDs and marketing text cannot add equipment or a trunk metric", () => {
  const marketing =
    "6 airbags, Park Assist, teto panorâmico, ACC, 7 lugares e porta-malas de 600 litros";
  for (const id of ["19903", "19884"]) {
    const vehicle = {
      id,
      marca: "VOLKSWAGEN",
      modelo: "T CROSS HIGHLINE TURBO",
      name: marketing,
      year: 2024,
      lugares: 7,
      anuncio: marketing,
      opcionais: [],
    };
    assert.deepEqual(resolveVehicleEquipment(vehicle).items, []);
    const presentation = buildVehicleHighlights(vehicle);
    assert.deepEqual(presentation, {
      highlights: [],
      explainedTags: new Set(),
      remainingOptionals: [],
    });
    // Guard runtime callers left over from the old (vehicle, anuncio) API.
    assert.deepEqual(
      Reflect.apply(buildVehicleHighlights, undefined, [vehicle, marketing]),
      presentation,
    );
  }
  assert.equal(buildVehicleHighlights.length, 1);
});

test("unknown items remain in the list and metadata does not upgrade ordinary parking or cruise aids", () => {
  const vehicle: EquipmentVehicle = {
    modelo: "T CROSS HIGHLINE TURBO",
    year: 2024,
    opcionais: [
      "piloto_automatico",
      "camera_de_re",
      "sensor_de_estacionamento",
      {
        tag: "novo_item_xml",
        descricao: "Novo acessório informado no cadastro",
      },
    ],
  };
  const equipment = resolveVehicleEquipment(vehicle);
  const presentation = buildVehicleHighlights(vehicle);
  assert.ok(
    !equipment.items.some((item) => item.id === "adaptive-cruise-control"),
  );
  assert.ok(!equipment.items.some((item) => item.id === "park-assist"));
  assert.ok(!equipment.items.some((item) => item.id === "camera-360"));
  assert.ok(
    presentation.remainingOptionals.includes(
      "Novo acessório informado no cadastro",
    ),
  );
});

test("generic transmission and turbo information are preserved when absent from displayed specs", () => {
  const vehicle: EquipmentVehicle = {
    opcionais: ["cambio_automatico", "motor_turbo"],
  };
  const equipment = resolveVehicleEquipment(vehicle);
  assert.deepEqual(sorted(equipment.items.map((item) => item.id)), [
    "automatic-transmission",
    "turbo",
  ]);
  const presentation = buildVehicleHighlights(vehicle);
  assert.equal(
    presentation.highlights.length + presentation.remainingOptionals.length,
    2,
  );
});

test("research metadata alone does not add a transmission to a Nivus with no supplied optionals", () => {
  const vehicle: EquipmentVehicle = {
    id: "19788",
    marca: "VOLKSWAGEN",
    modelo: "NIVUS HIGHLINE TURBO",
    year: 2024,
    motor: "1.0",
    cambio: "AUTOMATICO",
    opcionais: [],
  };
  assert.deepEqual(resolveVehicleEquipment(vehicle).items, []);
  assert.deepEqual(buildVehicleHighlights(vehicle).highlights, []);
  assert.deepEqual(buildVehicleHighlights(vehicle).remainingOptionals, []);
});

test("airbag positions are consolidated into one display item throughout the real stock without summing bags", () => {
  for (const vehicle of fixture.vehicles) {
    const label = context(vehicle);
    const items = resolveVehicleEquipment(vehicle).items;
    const airbags = items.filter((item) => /airbag/i.test(item.id));
    assert.equal(airbags.length, 1, label);
    const presentation = buildVehicleHighlights(vehicle);
    const displayed = [
      ...presentation.highlights.map((item) => item.title),
      ...presentation.remainingOptionals,
    ].filter((description) => /airbag/i.test(description));
    assert.equal(displayed.length, 1, label);
    assert.ok(!/\b[3-9]\s*airbags?\b/i.test(displayed[0]), label);
  }
  const vehicle = fixture.vehicles.find((item) => String(item.id) === "19903");
  assert.ok(vehicle);
  const combined = resolveVehicleEquipment(vehicle).items.find(
    (item) => item.id === "airbag-protection",
  );
  assert.ok(combined);
  assert.match(combined.description, /frontais/i);
  assert.match(combined.description, /laterais/i);
  assert.match(combined.description, /cortina/i);
  for (const tag of [
    "air_bag",
    "air_bag_duplo",
    "air_bag_lateral",
    "air_bag_cortina",
  ]) {
    assert.ok(combined.sourceTags.includes(tag), tag);
  }
});

test("only the exact documented Nivus replaces the supplier's seven-speed claim, retaining auditable evidence", () => {
  const vehicle = fixture.vehicles.find((item) => String(item.id) === "19788");
  assert.ok(vehicle);
  const original = structuredClone(vehicle);
  const result = resolveVehicleEquipment(vehicle);
  const corrected = result.items.find((item) => item.id === "automatic-6");
  assert.ok(corrected);
  assert.equal(corrected.source, "manufacturer-standard");
  assert.equal(corrected.tag, "cambio_automatico_6_marchas");
  assert.ok(corrected.sourceTags.includes("cambio_sete"));
  assert.deepEqual(corrected.evidenceIds, [
    "vw-nivus-highline-turbo-my2024-automatic-6",
  ]);
  assert.ok(!result.items.some((item) => item.id === "transmission-7"));
  const evidence = equipmentEvidenceRegistry.find(
    (record) => record.id === corrected.evidenceIds?.[0],
  );
  assert.ok(evidence);
  assert.ok(isApprovedEquipmentEvidence(evidence));
  assert.equal(evidence.sourcePage, 293);
  const suppressed = result.suppressed.find(
    (item) => item.id === "transmission-7",
  );
  assert.ok(suppressed);
  assert.equal(suppressed.reason, "manufacturer-correction");
  assert.equal(suppressed.replacedBy, "automatic-6");
  const presentation = buildVehicleHighlights(vehicle);
  const displayed = [
    ...presentation.highlights.map((item) => item.title),
    ...presentation.remainingOptionals,
  ];
  assert.ok(displayed.includes(corrected.description));
  assert.ok(!displayed.some((text) => /7 (?:marchas|velocidades)/i.test(text)));
  assert.deepEqual(vehicle, original);

  for (const mismatch of [
    { year: 2023 },
    { year: 2025 },
    { modelo: "NIVUS COMFORTLINE TURBO" },
    { motor: "1.4" },
    { cambio: "MANUAL" },
    { marca: "FIAT" },
  ]) {
    const altered = resolveVehicleEquipment({ ...vehicle, ...mismatch });
    assert.ok(
      !altered.items.some((item) => item.source === "manufacturer-standard"),
      JSON.stringify(mismatch),
    );
    assert.ok(altered.items.some((item) => item.id === "transmission-7"));
  }
});
