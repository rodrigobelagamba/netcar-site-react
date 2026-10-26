import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import reviews from "../../src/data/vehicle-photo-reviews.json";
import { matchesEditorialIdentity } from "../../src/modules/detalhes/lib/vehicleEditorialIdentity";
import { resolveVehicleEditorialCopy } from "../../src/modules/detalhes/lib/vehicleEditorialCopy";
import {
  buildVehiclePhotoCaptions,
  reviewedPhotoLocationKey,
} from "../../src/modules/detalhes/lib/vehiclePhotoCaptions";
import type { EquipmentVehicle } from "../../src/lib/vehicleEquipment";

const tera: EquipmentVehicle = {
  id: "19587",
  marca: "VOLKSWAGEN",
  modelo: "TERA HIGH TURBO",
  year: 2026,
  motor: "1.0",
  cambio: "AUTOMATICO",
  opcionais: ["botao"],
};

test("unit copy is withdrawn when identity or the exact explained fact set changes", () => {
  const facts = ["keyless", "push-start"];
  assert.equal(
    resolveVehicleEditorialCopy(tera, "everyday-convenience", facts)?.title,
    "Acesso e partida sem tirar a chave do bolso",
  );
  for (const change of [
    { id: "99999" },
    { motor: "1.4" },
    { cambio: "MANUAL" },
    { year: 2027 },
    { modelo: "TERA COMFORT TURBO" },
    { market: "AR" },
  ]) {
    assert.equal(
      resolveVehicleEditorialCopy(
        { ...tera, ...change },
        "everyday-convenience",
        facts,
      ),
      undefined,
    );
  }
  for (const changed of [["keyless"], [...facts, "wireless-charging"]]) {
    assert.equal(
      resolveVehicleEditorialCopy(tera, "everyday-convenience", changed),
      undefined,
    );
  }
  assert.match(
    resolveVehicleEditorialCopy(tera, "phone-connectivity", [
      "multimedia",
      "wireless-carplay-android",
    ])?.description || "",
    /10,1″/,
  );
  assert.equal(
    resolveVehicleEditorialCopy(tera, "phone-connectivity", [
      "multimedia",
      "apple-carplay",
    ]),
    undefined,
  );
});

test("exact version/year profiles also separate engine, transmission and market", () => {
  const match = {
    brand: "FIAT",
    model: "CRONOS DRIVE",
    modelYear: 2025,
    engine: "1.3",
    transmission: "MANUAL",
  };
  const vehicle = {
    marca: "FIAT",
    modelo: "CRONOS DRIVE",
    year: 2025,
    motor: "1.3",
    cambio: "MANUAL",
  };
  assert.equal(matchesEditorialIdentity(vehicle, match), true);
  for (const change of [
    { cambio: "AUTOMATICO" },
    { motor: "1.0" },
    { motor: undefined },
    { cambio: undefined },
    { year: undefined, anoFabricacao: 2025 },
    { modelo: undefined, name: "CRONOS DRIVE" },
    { market: "AR" },
  ]) {
    assert.equal(
      matchesEditorialIdentity({ ...vehicle, ...change }, match),
      false,
    );
  }
});

test("reviewed locations are origin-bound and distinct from content checksums", () => {
  const url = "https://www.netcarmultimarcas.com.br/imagens/example-photo.avif";
  assert.equal(
    reviewedPhotoLocationKey(url + "#gallery"),
    createHash("sha256").update(url).digest("hex"),
  );
  assert.equal(
    reviewedPhotoLocationKey("/imagens/example-photo.avif"),
    reviewedPhotoLocationKey(url),
  );
  assert.notEqual(
    reviewedPhotoLocationKey(url + "?v=2"),
    reviewedPhotoLocationKey(url),
  );
  assert.equal(
    reviewedPhotoLocationKey("https://example.com/imagens/example-photo.avif"),
    undefined,
  );
  assert.equal(
    reviewedPhotoLocationKey(
      "https://user@www.netcarmultimarcas.com.br/imagens/example-photo.avif",
    ),
    undefined,
  );
  assert.equal(
    reviews.units.reduce((n, unit) => n + Object.keys(unit.captions).length, 0),
    21,
  );
  for (const unit of reviews.units)
    for (const [key, caption] of Object.entries(unit.captions)) {
      assert.match(key, /^[a-f0-9]{64}$/);
      assert.match(caption!.contentSha256, /^[a-f0-9]{64}$/);
      assert.notEqual(key, caption!.contentSha256);
    }
});

test("hash-bound captions follow files across order changes and retain equipment fallback", () => {
  const images = ["/imagens/test-front.avif", "/imagens/test-controls.avif"];
  const unit = reviews.units[0];
  const captions = unit.captions as Record<
    string,
    {
      visual: string;
      contentSha256: string;
      equipmentId?: string;
      withEquipment?: string;
    }
  >;
  const keys = images.map((url) => reviewedPhotoLocationKey(url)!);
  const before = { ...captions };
  try {
    captions[keys[0]] = {
      visual: "Vista dianteira",
      contentSha256: "0".repeat(64),
    };
    captions[keys[1]] = {
      visual: "Comandos junto ao volante",
      contentSha256: "1".repeat(64),
      equipmentId: "push-start",
      withEquipment: "Partida por botão",
    };
    assert.deepEqual(buildVehiclePhotoCaptions(tera, images), [
      "Vista dianteira",
      "Partida por botão",
    ]);
    assert.deepEqual(buildVehiclePhotoCaptions(tera, [...images].reverse()), [
      "Partida por botão",
      "Vista dianteira",
    ]);
    assert.deepEqual(
      buildVehiclePhotoCaptions({ ...tera, opcionais: [] }, images),
      ["Vista dianteira", "Comandos junto ao volante"],
    );
    assert.deepEqual(
      buildVehiclePhotoCaptions({ ...tera, id: "99999" }, images),
      ["", ""],
    );
    assert.deepEqual(
      buildVehiclePhotoCaptions(tera, ["/imagens/new-photo.avif"]),
      [""],
    );
  } finally {
    for (const key of keys) {
      if (before[key]) captions[key] = before[key];
      else delete captions[key];
    }
  }
});
