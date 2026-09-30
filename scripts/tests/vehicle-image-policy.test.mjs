import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { sanitizeVehicleImages } from "../../src/lib/vehicleImagePolicy.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const policy = JSON.parse(readFileSync(new URL("../../public/vehicle-image-exclusions.json", import.meta.url), "utf8"));
// These are the wrong Creta files actually attached to stock unit 20023. Keep
// the expectation independent of the policy so widening its scope fails loudly.
const stems = [
  ...Array.from({ length: 11 }, (_, index) => `26092026CRETA SPORT IZE3C02${index + 1}`),
  "26092026CRETA SPORT IZE3C02CAPA",
];
const source = (stem, extension = "avif") => `./imagens/veiculos_automacar/${stem}.${extension}`;
const oldImages = stems.map((stem) => source(stem));
const replacement = source("01102026208 GRIFFE IUL0D121");
const replacementCover = source("01102026208 GRIFFE IUL0D12CAPA", "png");
const oldCover = stems.at(-1);

function rawVehicle(id = "20023") {
  return {
    id,
    marca: "PEUGEOT",
    modelo: "208 GRIFFE",
    valor: 47900,
    have_galery: 1,
    pdf: "CheckAuto_IUL0D12_1017.pdf",
    opcionais: [{ tag: "ar", descricao: "Ar condicionado" }],
    imagens: { thumb: [...oldImages], full: [...oldImages] },
    imagens_site: {
      capa: source(oldCover, "png"),
      capa_thumb: source(`${oldCover}_small`, "png"),
      capa_opengraph: source(oldCover, "jpg"),
      galeria: [...oldImages],
      tem_fotos: 1,
    },
  };
}

function normalizedVehicle() {
  const vehicle = rawVehicle();
  delete vehicle.imagens;
  delete vehicle.have_galery;
  return {
    ...vehicle,
    name: "PEUGEOT 208 GRIFFE",
    images: [...oldImages],
    fullImages: [...oldImages],
    fotos: [...oldImages],
  };
}

function mixedVehicle() {
  const vehicle = normalizedVehicle();
  vehicle.images.push(replacement);
  vehicle.fullImages.push(replacement);
  vehicle.fotos.push(replacement);
  vehicle.imagens_site.galeria.push(replacement);
  vehicle.imagens_site.capa = replacementCover;
  return vehicle;
}

function newVehicle() {
  const vehicle = rawVehicle();
  vehicle.imagens = { thumb: [replacement], full: [replacement] };
  vehicle.imagens_site = {
    capa: replacementCover,
    capa_thumb: replacementCover,
    capa_opengraph: replacementCover,
    galeria: [replacement],
    tem_fotos: 1,
  };
  return vehicle;
}

function deepFreeze(value) {
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}

test("the quarantine names only the 12 confirmed wrong files on vehicle 20023", () => {
  assert.equal(policy.schemaVersion, 1);
  assert.deepEqual(Object.keys(policy.vehicles), ["20023"]);
  assert.deepEqual([...policy.vehicles["20023"].stems].sort(), [...stems].sort());
  assert.ok(policy.vehicles["20023"].reason.trim());
});

test("raw API images, gallery and cover variants are all removed without changing the source", () => {
  const input = rawVehicle();
  const before = structuredClone(input);
  deepFreeze(input);
  const result = sanitizeVehicleImages(input);
  assert.deepEqual(result.imagens, { thumb: [], full: [] });
  assert.deepEqual(result.imagens_site, {
    capa: null, capa_thumb: null, capa_opengraph: null, galeria: [], tem_fotos: 0,
  });
  assert.equal(result.have_galery, 0);
  assert.equal(result.pdf, before.pdf);
  assert.equal(result.valor, before.valor);
  assert.deepEqual(result.opcionais, before.opcionais);
  assert.deepEqual(input, before);
});

test("normalized images and deprecated gallery fallback cannot revive excluded photos", () => {
  const result = sanitizeVehicleImages(normalizedVehicle());
  assert.deepEqual(result.images, []);
  assert.deepEqual(result.fullImages, []);
  assert.deepEqual(result.fotos, []);
  assert.deepEqual(result.imagens_site.galeria, []);
  assert.equal(result.imagens_site.tem_fotos, 0);
  assert.equal(Object.hasOwn(result, "have_galery"), false);
});

test("a bootstrap record with only an old thumbnail is cleared", () => {
  const input = {
    id: "20023", price: 47900, images: [oldImages[0]],
    imagens_site: { capa: null, capa_thumb: null, capa_opengraph: null, galeria: [], tem_fotos: 1 },
  };
  const result = sanitizeVehicleImages(input);
  assert.deepEqual(result.images, []);
  assert.equal(result.imagens_site.tem_fotos, 0);
  assert.equal(Object.hasOwn(result, "fullImages"), false);
  assert.equal(Object.hasOwn(result, "fotos"), false);
});

test("partial image payloads do not acquire unrelated image fields", () => {
  const input = { id: "20023", imagens: { thumb: [oldImages[0]] } };
  assert.deepEqual(sanitizeVehicleImages(input), { id: "20023", imagens: { thumb: [] } });
});

test("the exact vehicle ID is required; the real Creta and all other units retain their photos", () => {
  for (const id of ["19900", "200230", "208", "", undefined]) {
    const vehicle = rawVehicle(id);
    if (id === undefined) delete vehicle.id;
    assert.strictEqual(sanitizeVehicleImages(vehicle), vehicle);
  }
  assert.deepEqual(sanitizeVehicleImages(rawVehicle(20023)).imagens.full, []);
});

test("mixed old and replacement photos show only the new images immediately", () => {
  const result = sanitizeVehicleImages(mixedVehicle());
  assert.deepEqual(result.images, [replacement]);
  assert.deepEqual(result.fullImages, [replacement]);
  assert.deepEqual(result.fotos, [replacement]);
  assert.deepEqual(result.imagens_site.galeria, [replacement]);
  assert.equal(result.imagens_site.capa, replacementCover);
  assert.equal(result.imagens_site.capa_thumb, null);
  assert.equal(result.imagens_site.tem_fotos, 1);
});

test("an entirely new gallery returns automatically without removing the quarantine", () => {
  const vehicle = newVehicle();
  assert.strictEqual(sanitizeVehicleImages(vehicle), vehicle);
  assert.equal(sanitizeVehicleImages(vehicle).have_galery, 1);
  assert.deepEqual(sanitizeVehicleImages(vehicle).imagens_site.galeria, [replacement]);
  assert.equal(policy.vehicles["20023"].stems.length, 12);
});

const imageVariants = [
  ...oldImages,
  `https://www.netcarmultimarcas.com.br/imagens/veiculos_automacar/big/${stems[0]}.JPG`,
  `/imagens/veiculos_automacar/${encodeURIComponent(stems[0])}.avif?v=2#preview`,
  `/imagens/veiculos_automacar/${encodeURIComponent(oldCover)}_small.jpeg`,
  `/imagens/veiculos_automacar/${oldCover.toLowerCase()}.webp`,
  `/imagens/veiculos_automacar/small/${oldCover}.PNG?width=480`,
  `.\\imagens\\veiculos_automacar\\${oldCover}.png`,
];

test("exact filenames match encoded spaces, URL suffixes and generated image formats", () => {
  const result = sanitizeVehicleImages({ id: "20023", images: imageVariants });
  assert.deepEqual(result.images, []);
  assert.equal(Object.hasOwn(result, "imagens_site"), false);
  assert.equal(Object.hasOwn(result, "have_galery"), false);
});

const allowedLookalikes = [
  source("26092026CRETA SPORT IZE3C02111"),
  source("26092026CRETA SPORT IZE3C0212"),
  source("01102026CRETA SPORT IZE3C021"),
  source("26092026CRETA SPORT IZE3C021-corrected"),
  source("26092026CRETA SPORT IZE3C02CAPA2"),
  source("26092026CRETA SPORT IZE3C021", "svg"),
  replacement,
];

test("file matching is not a prefix, model name or plate blacklist", () => {
  const input = { id: "20023", images: allowedLookalikes };
  assert.strictEqual(sanitizeVehicleImages(input), input);
  assert.deepEqual(sanitizeVehicleImages(input).images, allowedLookalikes);
});

test("unrelated empty galleries and photo flags remain untouched", () => {
  for (const input of [
    { id: "20023", images: [], have_galery: 1 },
    { id: "20023", images: [], imagens_site: { galeria: [], tem_fotos: 1 } },
    { id: "20023", images: ["/imagens/banner/CarroSemFoto.png"], imagens_site: { galeria: [], tem_fotos: 0 } },
  ]) assert.strictEqual(sanitizeVehicleImages(input), input);
});

test("repeated sanitation is idempotent for all supported inventory representations", () => {
  for (const input of [rawVehicle(), normalizedVehicle(), mixedVehicle(), newVehicle()]) {
    const once = sanitizeVehicleImages(input);
    assert.deepEqual(sanitizeVehicleImages(once), once);
    assert.strictEqual(sanitizeVehicleImages(once), once);
  }
});

const php = process.env.NETCAR_PHP_BINARY || "php";
const hasPhp = spawnSync(php, ["-v"], { encoding: "utf8" }).status === 0;

test("CI has a PHP runtime to verify server/browser image-policy parity", () => {
  if (process.env.CI) assert.ok(hasPhp, "Install PHP or set NETCAR_PHP_BINARY before running CI");
});

test("PHP and JavaScript apply exactly the same policy to API, bootstrap and new XML photos", {
  skip: hasPhp ? false : "PHP CLI unavailable; set NETCAR_PHP_BINARY to run server parity locally",
}, () => {
  const fixtures = [
    rawVehicle(), rawVehicle(20023), rawVehicle("19900"), normalizedVehicle(),
    mixedVehicle(), newVehicle(),
    { id: "20023", images: imageVariants },
    { id: "20023", images: allowedLookalikes },
    { id: "20023", imagens: { thumb: [oldImages[0]] } },
    { id: "20023", images: [], have_galery: 1 },
    { id: "20023", images: [oldImages[0]], imagens_site: { galeria: [], tem_fotos: 1 } },
    { id: "20023", images: [oldImages[0]], imagens_site: { capa: replacementCover, galeria: [], tem_fotos: 1 } },
  ];
  const harness = `require $argv[1];
    $vehicles = json_decode(stream_get_contents(STDIN), true);
    echo json_encode(array_map('netcarSanitizeVehicleImages', $vehicles), JSON_UNESCAPED_SLASHES);`;
  const result = spawnSync(php, ["-r", harness, `${root}public/vehicle-images.php`], {
    input: JSON.stringify(fixtures), encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), fixtures.map(sanitizeVehicleImages));
});
