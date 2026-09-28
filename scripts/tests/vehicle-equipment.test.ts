import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  cleanEquipmentDescription,
  equipmentByTag,
  equipmentCatalog,
  equipmentEvidenceRegistry,
  isApprovedEquipmentEvidence,
  normalizeEquipmentTag,
  resolveVehicleEquipment,
} from "../../src/lib/vehicleEquipment";

const resolve = (
  ...opcionais: Parameters<
    typeof resolveVehicleEquipment
  >[0]["opcionais"] extends ReadonlyArray<infer T> | null | undefined
    ? T[]
    : never
) => resolveVehicleEquipment({ opcionais });
const ids = (result: ReturnType<typeof resolveVehicleEquipment>) =>
  result.items.map((item) => item.id);

test("every one of the 112 audited supplier tags has an explicit, finite ranking", () => {
  const audit = JSON.parse(
    readFileSync(
      new URL(
        "../../docs/audits/equipment-catalog-2026-09-28.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(equipmentCatalog.length, 112);
  assert.equal(equipmentByTag.size, 112);
  for (const item of audit.taxonomy) {
    const definition = equipmentByTag.get(normalizeEquipmentTag(item.tag));
    assert.ok(definition, item.tag);
    assert.equal(definition.sourceDescription, item.description, item.tag);
    assert.ok(
      Number.isFinite(definition.priority) && definition.priority > 0,
      item.tag,
    );
    assert.ok(definition.description.trim(), item.tag);
    assert.ok(definition.category.trim(), item.tag);
  }
});

test("normalization tolerates legacy punctuation but does not change claims", () => {
  assert.equal(normalizeEquipmentTag("sem-_fio"), "sem_fio");
  assert.equal(
    cleanEquipmentDescription(" .Controle   de Tração "),
    "Controle de Tração",
  );
  assert.equal(cleanEquipmentDescription("*REMAP CARBASE*"), "REMAP CARBASE");
});

test("ranks notable safety and versatility above equipment basics", () => {
  const result = resolve(
    "vidros_eletricos",
    "park_assist",
    "sete_lugares",
    "franagem_emergencia",
    "piloto_adaptativo",
    "6 airbags",
    "chave_reserva",
  );
  assert.deepEqual(ids(result), [
    "airbags-6",
    "adaptive-cruise-control",
    "automatic-emergency-braking",
    "seven-seats",
    "park-assist",
    "power-windows",
    "spare-key",
  ]);
});

test("ranking is stable regardless of incoming XML order", () => {
  const list = ["apple", "android", "camera_de_re", "teto_solar", "air_bag"];
  assert.deepEqual(ids(resolve(...list)), ids(resolve(...list.reverse())));
});

test("retains Park Assist and sunroof explicitly supplied for 19903", () => {
  const result = resolveVehicleEquipment({
    id: 19903,
    modelo: "T CROSS HIGHLINE TURBO",
    year: 2024,
    opcionais: ["park_assist", "teto_solar"],
  });
  assert.deepEqual(ids(result), ["park-assist", "sunroof"]);
});

test("never infers equipment from vehicle identity or year", () => {
  const result = resolveVehicleEquipment({
    id: 19903,
    marca: "VOLKSWAGEN",
    modelo: "T CROSS HIGHLINE TURBO",
    name: "T-Cross Highline com teto",
    year: 2024,
    lugares: 7,
  });
  assert.deepEqual(result.items, []);
});

test("airbag flags are not added together to invent a quantity", () => {
  const result = resolve(
    "air_bag",
    "air_bag_duplo",
    "air_bag_lateral",
    "air_bag_cortina",
  );
  assert.deepEqual(ids(result), ["airbag-protection"]);
  assert.equal(
    result.items[0].description,
    "Airbags frontais, laterais e de cortina",
  );
  assert.equal(result.items[0].sourceTags.length, 4);
  assert.ok(!result.items.some((item) => /6 airbags/i.test(item.description)));
});

test("explicit six airbags subsume generic, dual, side and curtain flags", () => {
  const result = resolve(
    "air_bag",
    "air_bag_duplo",
    "air_bag_lateral",
    "air_bag_cortina",
    "6 Airbags",
  );
  assert.deepEqual(ids(result), ["airbags-6"]);
  assert.equal(result.items[0].sourceTags.length, 5);
  assert.equal(result.suppressed.length, 4);
});

test("spelled out airbag counts are handled, without using a model lookup", () => {
  assert.deepEqual(ids(resolve("Seis airbags", "airbags_6")), ["airbags-6"]);
  assert.deepEqual(ids(resolve("8 air bags")), ["airbags-8"]);
});

test("conflicting explicit counts never choose the larger unsupported count", () => {
  const result = resolve("6 airbags", "8 airbags", "air_bag", "air_bag_duplo");
  assert.deepEqual(ids(result), ["airbags-unconfirmed-count"]);
  assert.equal(result.items[0].description, "Airbags (quantidade a confirmar)");
  assert.equal(result.items[0].benefit, undefined);
  assert.equal(
    result.suppressed.filter(
      (item) => item.reason === "conflicting-airbag-count",
    ).length,
    2,
  );
});

test("four airbags do not prove that separately reported curtain airbags are redundant", () => {
  assert.deepEqual(
    ids(resolve("4 airbags", "air_bag_cortina", "air_bag_duplo")),
    ["airbags-4", "curtain-airbags"],
  );
});

test("front airbag wording alone is not converted to a quantity", () => {
  const result = resolve("Airbags frontais");
  assert.equal(result.items[0].description, "Airbags frontais");
  assert.equal(result.items[0].benefit, undefined);
});

test("hides generic automatic transmission only when it is already shown in specs", () => {
  assert.deepEqual(
    ids(
      resolveVehicleEquipment({
        cambio: "AUTOMATICO",
        opcionais: ["cambio_automatico", "cambio_automatico_6_marchas"],
      }),
    ),
    ["automatic-6"],
  );
  assert.deepEqual(
    ids(
      resolveVehicleEquipment({
        cambio: "CVT",
        opcionais: ["cambio_automatico"],
      }),
    ),
    [],
  );
  assert.deepEqual(
    ids(
      resolveVehicleEquipment({
        cambio: "Manual",
        opcionais: ["cambio_automatico"],
      }),
    ),
    ["automatic-transmission"],
  );
  assert.deepEqual(ids(resolve("cambio_automatico")), [
    "automatic-transmission",
  ]);
});

test("turbo is hidden only if explicit in the displayed engine/model", () => {
  assert.deepEqual(
    ids(
      resolveVehicleEquipment({
        motor: "1.4 Turbo",
        opcionais: ["motor_turbo"],
      }),
    ),
    [],
  );
  assert.deepEqual(
    ids(
      resolveVehicleEquipment({
        modelo: "T CROSS HIGHLINE TURBO",
        opcionais: ["motor_turbo"],
      }),
    ),
    [],
  );
  assert.deepEqual(
    ids(
      resolveVehicleEquipment({
        motor: "1.4",
        modelo: "T-Cross 250 TSI",
        opcionais: ["motor_turbo"],
      }),
    ),
    ["turbo"],
  );
});

test("merges aliases and ranks the most specific climate/cruise/roof claims", () => {
  const result = resolve(
    "ar_condicionado",
    "ar_condicionado_digital",
    "ar_condicionado_dual_zone",
    "controle_velocidade",
    "piloto_automatico",
    "piloto_adaptativo",
    "teto_solar",
    "teto_panoramico",
  );
  assert.deepEqual(ids(result), [
    "adaptive-cruise-control",
    "panoramic-roof",
    "dual-zone-climate",
  ]);
  assert.equal(result.items[0].sourceTags.length, 3);
});

test("supplier ABS tags are read according to their real descriptions, not their names", () => {
  assert.deepEqual(ids(resolve("freios_abs_com_ebd")), ["abs"]);
  assert.deepEqual(ids(resolve("freios_abs")), ["abs-ebd"]);
  assert.deepEqual(
    ids(resolve({ tag: "freios_abs", descricao: "Freios ABS" })),
    ["abs"],
  );
  assert.deepEqual(
    ids(resolve({ tag: "freios_abs_com_ebd", descricao: "Freios ABS EBD" })),
    ["abs-ebd"],
  );
  assert.deepEqual(ids(resolve("Freios ABS", "Freios ABS EBD")), ["abs-ebd"]);
});

test("opaque supplier aliases retain their audited meanings", () => {
  assert.deepEqual(ids(resolve("som_radio", "vidros_verdes")), [
    "bluetooth",
    "mirror-indicators",
  ]);
  const result = resolve(
    { tag: "som_radio", descricao: "Rádio" },
    { tag: "vidros_verdes", descricao: "Vidros verdes" },
  );
  assert.ok(!ids(result).includes("bluetooth"));
  assert.ok(!ids(result).includes("mirror-indicators"));
});

test("explicit weak descriptions override strong tags instead of expanding them", () => {
  const result = resolve(
    { tag: "park_assist", descricao: "Sensor de estacionamento" },
    { tag: "piloto_adaptativo", descricao: "Piloto automático" },
    { tag: "teto_panoramico", descricao: "Teto solar" },
  );
  assert.deepEqual(ids(result), [
    "sunroof",
    "cruise-control",
    "parking-sensors",
  ]);
});

test("ambiguous wireless wording does not claim both phone protocols", () => {
  const result = resolve({ tag: "sem-_fio", descricao: "Sem fio" });
  assert.equal(result.items[0].description, "Sem fio");
  assert.equal(result.items[0].benefit, undefined);
  assert.deepEqual(ids(resolve("sem-_fio")), ["wireless-carplay-android"]);
});

test("wireless capability for one protocol never invents the other", () => {
  const result = resolve("Apple CarPlay sem fio", "apple", "android");
  assert.deepEqual(ids(result), ["wireless-carplay", "android-auto"]);
  assert.ok(!result.items[0].benefit?.includes("Android"));
});

test("both explicit wireless protocols subsume their generic duplicates", () => {
  assert.deepEqual(
    ids(
      resolve(
        "sem-_fio",
        "apple",
        "android",
        "CarPlay sem fio",
        "Android Auto sem fio",
      ),
    ),
    ["wireless-carplay-android"],
  );
});

test("branded media center removes generic duplicate but preserves distinct capabilities", () => {
  assert.deepEqual(
    ids(
      resolve("multimidia", "my_link", "gps", "som_radio_com_usb", "android"),
    ),
    ["mylink", "android-auto", "navigation", "usb"],
  );
});

test("automatic tailgate does not become electric, and opaque Z360 is not camera 360", () => {
  const result = resolve("porta_mala", "porta_automatica", "z360");
  assert.deepEqual(ids(result), ["automatic-tailgate", "z360"]);
  assert.ok(!result.items[0].description.includes("elétrico"));
  assert.equal(result.items[1].benefit, undefined);
  assert.deepEqual(
    ids(resolve({ tag: "porta_malas_eletrico", descricao: "Porta-malas" })),
    ["other-porta_malas"],
  );
});

test("known 360 camera removes rear-camera duplicate only when explicitly named", () => {
  assert.deepEqual(ids(resolve("Câmera 360°", "camera_de_re")), ["camera-360"]);
});

test("unknown optional is preserved verbatim with a low rank and no invented benefit", () => {
  const result = resolve({
    tag: "nova_tag",
    descricao: " .Novo recurso particular ",
  });
  assert.equal(result.items[0].description, "Novo recurso particular");
  assert.equal(result.items[0].priority, 20);
  assert.equal(result.items[0].benefit, undefined);
});

test("negated equipment is not advertised even when its tag claims it", () => {
  const result = resolve(
    { tag: "teto_solar", descricao: "Sem teto solar" },
    { tag: "park_assist", descricao: "Não possui Park Assist" },
  );
  assert.deepEqual(result.items, []);
  assert.ok(
    result.suppressed.every((item) => item.reason === "explicitly-absent"),
  );
});

test("works with description-only objects and ignores empty inputs", () => {
  assert.deepEqual(
    ids(resolve({ nome: "Park Assist" }, { descricao: "" }, "")),
    ["park-assist"],
  );
});

test("does not mutate inventory, definitions or objects across calls", () => {
  const input = Object.freeze({
    cambio: "AUTOMATICO",
    opcionais: Object.freeze([
      Object.freeze({ tag: "air_bag", descricao: "Air Bag" }),
      Object.freeze({ tag: "air_bag_duplo", descricao: "Air Bag Duplo" }),
    ]),
  });
  const before = JSON.stringify(input);
  const catalogBefore = JSON.stringify(equipmentCatalog);
  const first = resolveVehicleEquipment(input);
  first.items[0].sourceTags.push("outside");
  const second = resolveVehicleEquipment(input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(JSON.stringify(equipmentCatalog), catalogBefore);
  assert.ok(!second.items[0].sourceTags.includes("outside"));
});

test("groups only airbag positions actually supplied, never adds curtain or front airbags", () => {
  const frontAndSide = resolve("air_bag_duplo", "air_bag_lateral");
  assert.equal(frontAndSide.items[0].id, "airbag-protection");
  assert.equal(
    frontAndSide.items[0].description,
    "Airbags frontais e laterais",
  );
  const sideAndCurtain = resolve("air_bag_lateral", "air_bag_cortina");
  assert.equal(
    sideAndCurtain.items[0].description,
    "Airbags laterais e de cortina",
  );
  assert.deepEqual(ids(resolve("air_bag_cortina")), ["curtain-airbags"]);
});

const nivus = {
  id: "19788",
  marca: "VOLKSWAGEN",
  modelo: "NIVUS HIGHLINE TURBO",
  year: 2024,
  anoFabricacao: 2024,
  motor: "1.0",
  cambio: "AUTOMATICO",
  opcionais: [{ tag: "cambio_sete", descricao: "Câmbio 7 Marchas" }],
};

test("approved exact Nivus MY24 technical evidence corrects six speeds without mutating XML", () => {
  const before = JSON.stringify(nivus);
  const result = resolveVehicleEquipment(nivus);
  assert.deepEqual(ids(result), ["automatic-6"]);
  assert.equal(result.items[0].source, "manufacturer-standard");
  assert.deepEqual(result.items[0].evidenceIds, [
    "vw-nivus-highline-turbo-my2024-automatic-6",
  ]);
  assert.deepEqual(result.items[0].sourceTags, ["cambio_sete"]);
  assert.deepEqual(result.suppressed, [
    {
      id: "transmission-7",
      tag: "cambio_sete",
      description: "Câmbio de 7 marchas",
      reason: "manufacturer-correction",
      replacedBy: "automatic-6",
      evidenceIds: ["vw-nivus-highline-turbo-my2024-automatic-6"],
    },
  ]);
  assert.equal(JSON.stringify(nivus), before);
});

test("the real stock fixture matches the tightly scoped transmission correction", () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL("../fixtures/vehicle-equipment-stock.json", import.meta.url),
      "utf8",
    ),
  );
  const stock = Array.isArray(fixture) ? fixture : fixture.vehicles;
  const actual = stock.find(
    (vehicle: { id: string }) => String(vehicle.id) === "19788",
  );
  assert.ok(actual);
  const result = resolveVehicleEquipment(actual);
  assert.ok(ids(result).includes("automatic-6"));
  assert.ok(!ids(result).includes("transmission-7"));
});

test("model, model-year, engine, brand and transmission mismatches prohibit correction", () => {
  for (const change of [
    { marca: "FIAT" },
    { modelo: "NIVUS COMFORTLINE TURBO" },
    { modelo: "NIVUS" },
    { year: 2023 },
    { year: 2025 },
    { motor: "1.4" },
    { motor: "1.0 TSI" },
    { cambio: "MANUAL" },
    { marca: undefined },
    { modelo: undefined },
    { year: undefined, anoFabricacao: 2024 },
    { motor: undefined },
    { cambio: undefined },
  ]) {
    assert.deepEqual(
      ids(resolveVehicleEquipment({ ...nivus, ...change })),
      ["transmission-7"],
      JSON.stringify(change),
    );
  }
});

test("transmission correction requires both the conflicting tag and its explicit seven-speed claim", () => {
  for (const opcionais of [
    [],
    ["cambio_automatico"],
    [{ tag: "cambio_sete", descricao: "Câmbio CVT" }],
    [{ tag: "different_tag", descricao: "Câmbio 7 Marchas" }],
  ]) {
    assert.ok(
      !ids(resolveVehicleEquipment({ ...nivus, opcionais })).includes(
        "automatic-6",
      ),
    );
  }
});

test("unapproved, optional-package, foreign-market and undocumented evidence is rejected", () => {
  const approved = equipmentEvidenceRegistry[0];
  assert.ok(isApprovedEquipmentEvidence(approved));
  for (const change of [
    { approved: false },
    { approved: "true" },
    { kind: "optional-package" },
    { equipmentStatus: "optional" },
    { market: "EU" },
    { sourceUrl: undefined },
    { sourceUrl: "https://example.com/vw.com.br/manual.pdf" },
    { sourceUrl: "https://www.vw.com.br.example.com/manual.pdf" },
    { sourceUrl: "http://www.vw.com.br/manual.pdf" },
    { reviewedAt: undefined },
    { reviewedAt: "2026-02-30" },
    { reviewedAt: "recently" },
    { sourceTitle: "" },
    { sourcePage: 0 },
    { claim: "" },
  ]) {
    const record = { ...approved, ...change };
    assert.equal(
      isApprovedEquipmentEvidence(record),
      false,
      JSON.stringify(change),
    );
    assert.deepEqual(ids(resolveVehicleEquipment(nivus, [record])), [
      "transmission-7",
    ]);
  }
});

test("generic family rules, year ranges and incomplete evidence matches are rejected", () => {
  const approved = equipmentEvidenceRegistry[0];
  for (const change of [
    { model: "NIVUS.*" },
    { model: "NIVUS|T CROSS" },
    { modelYear: [2024, 2025] },
    { modelYear: "2024-2026" },
    { engine: "1.*" },
    { engine: "" },
    { transmission: undefined },
  ]) {
    const record = { ...approved, match: { ...approved.match, ...change } };
    assert.equal(
      isApprovedEquipmentEvidence(record),
      false,
      JSON.stringify(change),
    );
    assert.deepEqual(ids(resolveVehicleEquipment(nivus, [record])), [
      "transmission-7",
    ]);
  }
});

test("evidence can be audited without becoming an equipment inference from its document title", () => {
  const approved = equipmentEvidenceRegistry[0];
  assert.equal(approved.sourcePage, 293);
  assert.ok(approved.sourceUrl.startsWith("https://www.vw.com.br/"));
  assert.equal(approved.kind, "manufacturer-standard");
  assert.deepEqual(
    resolveVehicleEquipment({ ...nivus, opcionais: [] }).items,
    [],
  );
});

test("correction records cannot use unknown tags or replace an item with itself", () => {
  const approved = equipmentEvidenceRegistry[0];
  for (const action of [
    { ...approved.action, fromTag: "not-in-catalog" },
    { ...approved.action, fromEquipmentId: "wrong-identity" },
    { ...approved.action, toTag: "cambio_sete" },
    { ...approved.action, toTag: "invented-feature" },
  ])
    assert.equal(isApprovedEquipmentEvidence({ ...approved, action }), false);
});

test("a reviewed evidence fixture can supply an explicit count without adding production claims", () => {
  // Synthetic record to exercise the approval mechanism only. No production
  // evidence says six airbags: the actual registry still contains one gearbox correction.
  const record = {
    ...equipmentEvidenceRegistry[0],
    id: "test-fixture-six-airbags",
    sourceTitle: "Synthetic test fixture: standard equipment",
    claim: "Synthetic six-airbag fixture, never registered for production.",
    action: { type: "add", toTag: "airbags_6" },
  };
  const vehicle = {
    ...nivus,
    opcionais: [
      "air_bag",
      "air_bag_duplo",
      "air_bag_lateral",
      "air_bag_cortina",
    ],
  };
  assert.ok(isApprovedEquipmentEvidence(record));
  const result = resolveVehicleEquipment(vehicle, [record]);
  assert.deepEqual(ids(result), ["airbags-6"]);
  assert.equal(result.items[0].source, "manufacturer-standard");
  assert.deepEqual(result.items[0].evidenceIds, [record.id]);
  assert.equal(result.items[0].sourceTags.length, 4);
  assert.deepEqual(
    ids(
      resolveVehicleEquipment(
        { ...vehicle, modelo: "NIVUS COMFORTLINE TURBO" },
        [record],
      ),
    ),
    ["airbag-protection"],
  );
  assert.deepEqual(ids(resolveVehicleEquipment(vehicle)), [
    "airbag-protection",
  ]);
  assert.ok(
    equipmentEvidenceRegistry.every(
      (entry) => entry.action.toTag !== "airbags_6",
    ),
  );
});

test("additional known capabilities are eligible for evidence but unknown inventions are not", () => {
  for (const toTag of ["camera_360", "apple_carplay_sem_fio", "airbags_8"]) {
    assert.ok(
      isApprovedEquipmentEvidence({
        ...equipmentEvidenceRegistry[0],
        action: { type: "add", toTag },
      }),
    );
  }
  assert.equal(
    isApprovedEquipmentEvidence({
      ...equipmentEvidenceRegistry[0],
      action: { type: "add", toTag: "unknown-self-driving-feature" },
    }),
    false,
  );
});

test("explicit contradictory presence blocks sunroof and ACC in either XML order", () => {
  for (const [tag, positive, negative] of [
    ["teto_solar", "Teto Solar", "Sem teto solar"],
    [
      "piloto_adaptativo",
      "Piloto Automático Adaptativo",
      "Não possui piloto automático adaptativo",
    ],
  ]) {
    const rows = [
      { tag, descricao: positive },
      { tag, descricao: negative },
    ];
    for (const ordered of [rows, [...rows].reverse()]) {
      const result = resolve(...ordered);
      assert.deepEqual(result.items, []);
      assert.ok(
        result.suppressed.some((item) => item.reason === "explicitly-absent"),
      );
      assert.ok(
        result.suppressed.some(
          (item) => item.reason === "conflicting-presence",
        ),
      );
    }
  }
});

test("an explicit negative blocks a known identity even when the positive uses another tag", () => {
  const result = resolve(
    { tag: "custom_negative", descricao: "Ausência de teto solar" },
    { tag: "custom_positive", descricao: "Teto solar" },
  );
  assert.deepEqual(result.items, []);
  assert.deepEqual(
    resolve("Sem acessório especial", "Acessório especial").items,
    [],
  );
});

test("a tag conflict cannot be bypassed by changing its positive description", () => {
  const result = resolve(
    { tag: "park_assist", descricao: "Sem sensor de estacionamento" },
    { tag: "park_assist", descricao: "Park Assist" },
  );
  assert.deepEqual(result.items, []);
});

test("wireless wording never marks connectivity absent", () => {
  const result = resolve(
    { tag: "sem-_fio", descricao: "Sem fio" },
    "sem-_fio",
    "Android Auto sem fio",
    "Apple CarPlay sem fio",
  );
  assert.ok(ids(result).includes("wireless-carplay-android"));
  assert.ok(result.items.some((item) => item.description === "Sem fio"));
  assert.ok(
    !result.suppressed.some(
      (item) =>
        item.reason === "explicitly-absent" ||
        item.reason === "conflicting-presence",
    ),
  );
});

test("a negative source or target blocks an otherwise approved manufacturer correction", () => {
  for (const negative of [
    { tag: "cambio_sete", descricao: "Sem câmbio de 7 marchas" },
    {
      tag: "cambio_automatico_6_marchas",
      descricao: "Sem câmbio automático de 6 velocidades",
    },
  ]) {
    for (const opcionais of [
      [...nivus.opcionais, negative],
      [negative, ...nivus.opcionais],
    ]) {
      const result = resolveVehicleEquipment({ ...nivus, opcionais });
      assert.ok(!ids(result).includes("automatic-6"));
      const blocked = result.suppressed.find(
        (item) => item.reason === "manufacturer-blocked-by-absence",
      );
      assert.ok(blocked);
      assert.deepEqual(blocked.evidenceIds, [equipmentEvidenceRegistry[0].id]);
    }
  }
});

test("explicit absence blocks an approved additive evidence record in either order", () => {
  const record = {
    ...equipmentEvidenceRegistry[0],
    id: "test-fixture-acc",
    action: { type: "add", toTag: "piloto_adaptativo" },
  };
  const positive = {
    tag: "piloto_adaptativo",
    descricao: "Piloto automático adaptativo",
  };
  const negative = { tag: "custom_negative", descricao: "Não tem ACC" };
  for (const opcionais of [
    [positive, negative],
    [negative, positive],
  ]) {
    const result = resolveVehicleEquipment({ ...nivus, opcionais }, [record]);
    assert.deepEqual(result.items, []);
    assert.ok(
      result.suppressed.some(
        (item) => item.reason === "manufacturer-blocked-by-absence",
      ),
    );
  }
});
