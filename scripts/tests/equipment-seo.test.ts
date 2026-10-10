import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import {
  createEquipmentManifest,
  equipmentFingerprint,
  generateEquipmentSeo,
} from "../generate-equipment-seo";
import {
  publicVehicle,
  writeSeoBuildStockSnapshot,
  readVersionedSeoStock,
} from "../lib/seo-stock-cache.js";
import {
  resolveVehicleEquipment,
  unitEquipmentConfirmations,
  isApprovedUnitEquipmentConfirmation,
} from "../../src/lib/vehicleEquipment";
import { mapVehicleOptional } from "../../src/catalog/lib/mapVehicleOptional";
import { vehiclePhysicalIdentityKey } from "../../src/lib/vehiclePhysicalIdentity";

const fixture = JSON.parse(
  readFileSync(
    new URL("../fixtures/vehicle-equipment-stock.json", import.meta.url),
    "utf8",
  ),
);
const vehicles = fixture.vehicles.map((vehicle: Record<string, unknown>) => ({
  ...vehicle,
  ano: vehicle.year,
  ano_fabricacao: vehicle.anoFabricacao,
  equipmentSourceComplete: true,
}));
const phpFile = fileURLToPath(
  new URL("../../public/vehicle-equipment.php", import.meta.url),
);
const hasPhp = spawnSync("php", ["-v"], { encoding: "utf8" }).status === 0;

function withDirectory(callback: (directory: string) => void) {
  const directory = mkdtempSync(
    resolve(tmpdir(), "netcar-equipment-seo-test-"),
  );
  try {
    callback(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("the SEO manifest uses exactly the shared resolver for all 60 audited vehicles", () => {
  const manifest = createEquipmentManifest(vehicles);
  assert.equal(Object.keys(manifest.vehicles).length, 60);
  for (const vehicle of vehicles) {
    const expected = resolveVehicleEquipment(vehicle).items.map(
      (item) => item.description,
    );
    assert.deepEqual(
      manifest.vehicles[vehicle.id].descriptions,
      expected,
      String(vehicle.id),
    );
    assert.equal(
      manifest.vehicles[vehicle.id].fingerprint,
      equipmentFingerprint(vehicle),
    );
  }
});

test("approved reviewed IDs survive an absent stock snapshot to block unsafe raw fallback", () => {
  const expected = [
    ...new Set(
      unitEquipmentConfirmations
        .filter(isApprovedUnitEquipmentConfirmation)
        .map((record) => String(record.match.vehicleId)),
    ),
  ].sort();
  const empty = createEquipmentManifest([]);
  assert.equal(empty.schemaVersion, 3);
  assert.deepEqual(empty.confirmedVehicleIds, expected);
  assert.deepEqual(empty.confirmedVehicleIds, ["20050", "20051", "20075"]);
  assert.deepEqual(
    createEquipmentManifest(vehicles).confirmedVehicleIds,
    expected,
  );
  assert.deepEqual(empty.vehicles, {});
});

test("fingerprints reject stale equipment, specs, identity and raw optional order", () => {
  const vehicle = vehicles[0];
  const original = equipmentFingerprint(vehicle);
  assert.match(original!, /^[a-f0-9]{64}$/);
  for (const key of [
    "id",
    "marca",
    "modelo",
    "ano",
    "ano_fabricacao",
    "motor",
    "cambio",
    "lugares",
  ]) {
    assert.notEqual(
      equipmentFingerprint({ ...vehicle, [key]: `${vehicle[key]} changed` }),
      original,
      key,
    );
  }
  assert.notEqual(
    equipmentFingerprint({
      ...vehicle,
      opcionais: [...vehicle.opcionais].reverse(),
    }),
    original,
  );
  assert.notEqual(
    equipmentFingerprint({
      ...vehicle,
      opcionais: [...vehicle.opcionais, "Teto solar"],
    }),
    original,
  );
  assert.notEqual(
    equipmentFingerprint({
      ...vehicle,
      opcionais: [
        { ...vehicle.opcionais[0], descricao: "changed" },
        ...vehicle.opcionais.slice(1),
      ],
    }),
    original,
  );
  assert.equal(
    equipmentFingerprint({ ...vehicle, opcionais: undefined }),
    null,
  );
  assert.equal(
    equipmentFingerprint({
      ...vehicle,
      opcionais: [{ tag: { invalid: true } }],
    }),
    null,
  );
  assert.equal(equipmentFingerprint({ ...vehicle, opcionais: [[]] }), null);
});

test("SEO signatures bind the physical unit without exporting source identifiers", () => {
  const original = { ...vehicles[0], placa: "ABC1D23" };
  assert.equal(
    equipmentFingerprint(original),
    equipmentFingerprint({ ...original, placa: "abc-1d23" }),
  );
  assert.notEqual(
    equipmentFingerprint(original),
    equipmentFingerprint({ ...original, placa: "DEF4G56" }),
  );
  assert.notEqual(
    equipmentFingerprint(original),
    equipmentFingerprint({ ...original, placa: undefined }),
  );
  const serialized = JSON.stringify(createEquipmentManifest([original]));
  assert.ok(!serialized.includes(original.placa));
  assert.ok(
    !serialized.includes(
      vehiclePhysicalIdentityKey(original.id, original.placa)!,
    ),
  );
});

test("SEO v2 confirmations require the same physical unit after import", () => {
  const vehicle = {
    id: "99901",
    marca: "TESTE",
    modelo: "MODELO EXATO",
    ano: 2024,
    ano_fabricacao: 2023,
    motor: "1.0",
    cambio: "AUTOMATICO",
    placa: "ABC1D23",
    opcionais: [],
    equipmentSourceComplete: true,
  };
  const record = {
    schemaVersion: 2,
    id: "synthetic-seo-99901",
    approved: true,
    source: "responsible-confirmation",
    confirmedAt: "2026-10-09",
    claim: "Confirmação sintética.",
    marketSource: "responsible-confirmation",
    match: {
      vehicleId: "99901",
      brand: "TESTE",
      model: "MODELO EXATO",
      modelYear: 2024,
      manufactureYear: 2023,
      engine: "1.0",
      transmission: "AUTOMATICO",
      market: "BR",
      physicalIdentityKey: vehiclePhysicalIdentityKey(
        vehicle.id,
        vehicle.placa,
      ),
    },
    presentTags: ["sensor_de_chuva"],
    absentTags: [],
  };
  const manifest = (input: Record<string, unknown>) =>
    createEquipmentManifest([input], "2026-10-09T15:00:00Z", [record]);
  assert.deepEqual(manifest(vehicle).vehicles["99901"].descriptions, [
    "Sensor de chuva",
  ]);
  assert.deepEqual(
    manifest({ ...vehicle, placa: "abc-1d23" }).vehicles["99901"].descriptions,
    ["Sensor de chuva"],
  );
  for (const placa of ["DEF4G56", "", "ABC****", undefined]) {
    assert.deepEqual(
      manifest({ ...vehicle, placa }).vehicles["99901"].descriptions,
      [],
    );
    assert.deepEqual(manifest({ ...vehicle, placa }).confirmedVehicleIds, [
      "99901",
    ]);
  }
});

test("the private stock projection only preserves allowed optional fields and proves completeness", () => {
  const input = {
    ...vehicles[0],
    opcionais: [
      {
        tag: "air_bag",
        descricao: "Air Bag",
        nome: "Airbag",
        secret: "PRIVATE_MARKER",
      },
    ],
  };
  const cached = publicVehicle(input);
  assert.equal(cached.equipmentSourceComplete, true);
  assert.deepEqual(cached.opcionais, [
    { tag: "air_bag", descricao: "Air Bag", nome: "Airbag" },
  ]);
  assert.equal(publicVehicle({ id: "1" }).equipmentSourceComplete, false);
  assert.equal(
    publicVehicle({ id: "1", opcionais: [], equipmentSourceComplete: false })
      .equipmentSourceComplete,
    false,
  );
  assert.equal(
    publicVehicle({ id: "1", opcionais: [] }).equipmentSourceComplete,
    true,
  );
  assert.equal(
    publicVehicle({
      id: "1",
      opcionais: [{ tag: { secret: "PRIVATE_MARKER" } }],
    }).equipmentSourceComplete,
    false,
  );
  const serialized = JSON.stringify(
    createEquipmentManifest([
      {
        ...cached,
        email: "PRIVATE_EMAIL",
        chassi: "PRIVATE_CHASSIS",
        token: "PRIVATE_TOKEN",
      },
    ]),
  );
  for (const forbidden of [
    "PRIVATE_MARKER",
    "PRIVATE_EMAIL",
    "PRIVATE_CHASSIS",
    "PRIVATE_TOKEN",
  ])
    assert.equal(serialized.includes(forbidden), false);
  const entry = Object.values(JSON.parse(serialized).vehicles)[0] as object;
  assert.deepEqual(Object.keys(entry).sort(), ["descriptions", "fingerprint"]);
});

test("absent or incomplete source never creates a resolved entry; explicit empty equipment can", () => {
  assert.equal(
    Object.keys(
      createEquipmentManifest([
        { ...vehicles[0], equipmentSourceComplete: false },
      ]).vehicles,
    ).length,
    0,
  );
  assert.equal(
    Object.keys(
      createEquipmentManifest([{ ...vehicles[0], opcionais: undefined }])
        .vehicles,
    ).length,
    0,
  );
  const empty = createEquipmentManifest([{ ...vehicles[0], opcionais: [] }]);
  assert.deepEqual(empty.vehicles[vehicles[0].id].descriptions, []);
});

test("nome is description evidence and cannot promote a weak feature through a strong legacy tag", () => {
  const vehicle = {
    ...vehicles[0],
    opcionais: [
      { tag: "park_assist", descricao: "", nome: "Sensor de Estacionamento" },
    ],
  };
  const items = createEquipmentManifest([vehicle]).vehicles[vehicle.id]
    .descriptions;
  assert.deepEqual(
    items,
    resolveVehicleEquipment(vehicle).items.map((item) => item.description),
  );
  assert.equal(
    items.some((description) => /Park Assist/i.test(description)),
    false,
  );
  assert.equal(items.length, 1);
  assert.notEqual(
    equipmentFingerprint(vehicle),
    equipmentFingerprint({
      ...vehicle,
      opcionais: [{ ...vehicle.opcionais[0], nome: "Park Assist" }],
    }),
  );
});

test("SEO and React use the same adapter for raw string tags, descriptions and nome objects", () => {
  const vehicle = {
    ...vehicles[0],
    opcionais: [
      "air_bag_duplo",
      "Piloto Automático",
      "6 airbags",
      { tag: "park_assist", nome: "Sensor de Estacionamento" },
      { tag: "teto_solar", descricao: "Teto panorâmico", nome: "Teto solar" },
    ],
  };
  const browserInput = {
    ...vehicle,
    opcionais: vehicle.opcionais.map(mapVehicleOptional),
  };
  assert.deepEqual(
    createEquipmentManifest([vehicle]).vehicles[vehicle.id].descriptions,
    resolveVehicleEquipment(browserInput).items.map((item) => item.description),
  );
});

test("the generator consumes the frozen snapshot without network and replaces stale output on missing source", () => {
  withDirectory((directory) => {
    writeSeoBuildStockSnapshot(
      directory,
      vehicles.map((vehicle: Record<string, unknown>) => ({
        ...vehicle,
        valor: 1,
      })),
      { source: "api" },
    );
    const complete = generateEquipmentSeo(directory);
    assert.equal(Object.keys(complete.vehicles).length, 60);
    const file = resolve(directory, "public/seo/vehicle-equipment.json");
    assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), complete);
    rmSync(resolve(directory, ".devops/seo-build-stock.json"));
    assert.deepEqual(generateEquipmentSeo(directory).vehicles, {});
    assert.deepEqual(JSON.parse(readFileSync(file, "utf8")).vehicles, {});
  });
});

test("versioned public bootstrap empty equipment is never considered a complete source", () => {
  withDirectory((directory) => {
    mkdirSync(resolve(directory, "public/seo"), { recursive: true });
    writeFileSync(
      resolve(directory, "public/seo/stock-bootstrap.json"),
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        vehicles: [{ ...vehicles[0], price: 1, opcionais: [] }],
      }),
    );
    const fallback = readVersionedSeoStock(directory);
    assert.ok(fallback);
    assert.equal(fallback.vehicles[0].equipmentSourceComplete, false);
    assert.deepEqual(createEquipmentManifest(fallback.vehicles).vehicles, {});
  });
});

test(
  "PHP fingerprint parity, exact snapshot and conservative fallback",
  {
    skip:
      !hasPhp &&
      "PHP CLI is not installed; server runtime test remains required",
  },
  () => {
    withDirectory((directory) => {
      const unicode = {
        ...vehicles[0],
        id: "987654",
        marca: "Ação 😀",
        modelo: "A\u2028B\u2029C/e\u0301",
        motor: "1.0",
        placa: "abc-1d23",
        opcionais: [
          "😀 /çã",
          {
            tag: "car_play",
            descricao: "Navegação / Câmera de Ré",
            nome: "é/e\u0301",
          },
        ],
      };
      const all = [...vehicles, unicode];
      const manifest = createEquipmentManifest(all);
      const manifestFile = resolve(directory, "manifest.json");
      writeFileSync(manifestFile, JSON.stringify(manifest));
      const modified = {
        ...vehicles[0],
        modelo: "Changed model",
        opcionais: [
          { descricao: "", nome: ". Teto especial" },
          { descricao: ". Teto especial" },
        ],
      };
      const input = [
        ...all,
        modified,
        { ...vehicles[0], opcionais: undefined },
      ];
      const result = spawnSync(
        "php",
        [
          "-r",
          'require $argv[1]; $rows=json_decode(stream_get_contents(STDIN),true); echo json_encode(array_map(function($v) use ($argv) { return array("hash"=>netcarEquipmentFingerprint($v),"items"=>netcarEquipmentDescriptions($v,$argv[2])); },$rows));',
          phpFile,
          manifestFile,
        ],
        { input: JSON.stringify(input), encoding: "utf8" },
      );
      assert.equal(result.status, 0, result.stderr);
      const output = JSON.parse(result.stdout);
      all.forEach((vehicle, index) => {
        assert.equal(
          output[index].hash,
          equipmentFingerprint(vehicle),
          String(vehicle.id),
        );
        assert.deepEqual(
          output[index].items,
          manifest.vehicles[vehicle.id].descriptions,
          String(vehicle.id),
        );
      });
      assert.deepEqual(output[all.length].items, ["Teto especial"]);
      assert.deepEqual(output[all.length + 1], { hash: null, items: [] });
    });
  },
);

test(
  "PHP cannot restore denied unit equipment through stale, malformed or missing snapshots",
  {
    skip:
      !hasPhp &&
      "PHP CLI is not installed; server runtime test remains required",
  },
  () => {
    withDirectory((directory) => {
      const manifest = createEquipmentManifest(vehicles);
      const reviewed = vehicles.filter((vehicle: Record<string, unknown>) =>
        manifest.confirmedVehicleIds.includes(String(vehicle.id)),
      );
      assert.equal(reviewed.length, 2);
      const manifestFile = resolve(directory, "manifest.json");
      const runPhp = (rows: Record<string, unknown>[]) => {
        const result = spawnSync(
          "php",
          [
            "-r",
            "require $argv[1]; $rows=json_decode(stream_get_contents(STDIN),true); echo json_encode(array_map(function($v) use ($argv) { return netcarEquipmentDescriptions($v,$argv[2]); },$rows));",
            phpFile,
            manifestFile,
          ],
          { input: JSON.stringify(rows), encoding: "utf8" },
        );
        assert.equal(result.status, 0, result.stderr);
        return JSON.parse(result.stdout);
      };
      const stale = reviewed.map((vehicle: Record<string, unknown>) => ({
        ...vehicle,
        // Even unrelated inventory changes make the snapshot stale. The raw
        // records still carry denied Park Assist/ACC: do not fall back to them.
        opcionais: [
          ...(vehicle.opcionais as unknown[]),
          { tag: "park_assist", descricao: "Park Assist" },
          { tag: "piloto_adaptativo", descricao: "Piloto adaptativo" },
        ],
      }));
      writeFileSync(manifestFile, JSON.stringify(manifest));
      assert.deepEqual(runPhp(stale), [[], []]);
      assert.deepEqual(
        runPhp(
          reviewed.map((vehicle: Record<string, unknown>) => ({
            ...vehicle,
            opcionais: null,
          })),
        ),
        [[], []],
      );

      for (const entry of [
        null,
        { fingerprint: "bad", descriptions: ["Park Assist"] },
        {
          fingerprint: manifest.vehicles["20050"].fingerprint,
          descriptions: [null],
        },
      ]) {
        writeFileSync(
          manifestFile,
          JSON.stringify({ ...manifest, vehicles: { "20050": entry } }),
        );
        assert.deepEqual(runPhp(reviewed), [[], []]);
      }

      // Fail closed globally only if the protection list itself is unavailable
      // or untrustworthy. Normal unreviewed stale fallback is tested above.
      const raw = [
        ...reviewed,
        vehicles.find(
          (vehicle: Record<string, unknown>) =>
            !manifest.confirmedVehicleIds.includes(String(vehicle.id)),
        ),
      ];
      for (const invalid of [
        "not JSON",
        JSON.stringify({ ...manifest, schemaVersion: 1 }),
        JSON.stringify({ ...manifest, schemaVersion: 2 }),
        JSON.stringify({ ...manifest, confirmedVehicleIds: undefined }),
        JSON.stringify({ ...manifest, confirmedVehicleIds: [20050] }),
        JSON.stringify({ ...manifest, confirmedVehicleIds: ["invalid-id"] }),
      ]) {
        writeFileSync(manifestFile, invalid);
        assert.deepEqual(runPhp(raw), [[], [], []]);
      }
      rmSync(manifestFile);
      assert.deepEqual(runPhp(raw), [[], [], []]);
    });
  },
);

test(
  "PHP hashes physical identities exactly and rejects same-ID plate reuse",
  {
    skip:
      !hasPhp &&
      "PHP CLI is not installed; server runtime test remains required",
  },
  () => {
    withDirectory((directory) => {
      const reviewed = {
        ...vehicles.find(
          (vehicle: Record<string, unknown>) => String(vehicle.id) === "20050",
        ),
        placa: "ABC1D23",
      };
      const manifest = createEquipmentManifest([reviewed]);
      const manifestFile = resolve(directory, "manifest.json");
      writeFileSync(manifestFile, JSON.stringify(manifest));
      const variants = [
        "ABC1D23",
        "abc-1d23",
        " DEF4G56 ",
        "",
        null,
        "ABC****",
        "ſBC1D23",
        "ABC\u00a01D23",
      ];
      const rows = variants.map((placa) => ({ ...reviewed, placa }));
      const result = spawnSync(
        "php",
        [
          "-r",
          'require $argv[1]; $rows=json_decode(stream_get_contents(STDIN),true); echo json_encode(array_map(function($v) use ($argv) { return array("physical"=>netcarEquipmentPhysicalIdentityKey($v),"hash"=>netcarEquipmentFingerprint($v),"items"=>netcarEquipmentDescriptions($v,$argv[2])); },$rows));',
          phpFile,
          manifestFile,
        ],
        { input: JSON.stringify(rows), encoding: "utf8" },
      );
      assert.equal(result.status, 0, result.stderr);
      const output = JSON.parse(result.stdout);
      rows.forEach((vehicle, index) => {
        assert.equal(
          output[index].physical,
          vehiclePhysicalIdentityKey(vehicle.id, vehicle.placa),
        );
        assert.equal(output[index].hash, equipmentFingerprint(vehicle));
        assert.deepEqual(
          output[index].items,
          index < 2 ? manifest.vehicles[String(vehicle.id)].descriptions : [],
        );
      });
    });
  },
);
