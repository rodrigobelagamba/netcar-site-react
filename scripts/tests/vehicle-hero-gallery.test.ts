import assert from "node:assert/strict";
import { test } from "node:test";
import { buildVehicleHeroGallery } from "../../src/modules/detalhes/lib/vehicleHeroGallery";

const root = "https://www.netcarmultimarcas.com.br/imagens/veiculos_automacar/";
const cover = `${root}reviewed%20unitCAPA.png`;

test("mobile starts with the cover and preserves gallery order and original indexes", () => {
  const gallery = [
    `${root}second.avif`,
    `${root}first.avif`,
    `${root}reviewed%20unitCAPA.avif`,
    `${root}third.avif`,
  ];
  const captions = [
    "Segundo ângulo",
    "Primeiro ângulo",
    "Capa conferida",
    "Interior",
  ];
  const original = structuredClone({ gallery, captions });
  const slides = buildVehicleHeroGallery(cover, gallery, captions, "Capa");
  assert.deepEqual(
    slides.map((slide) => slide.image),
    [cover, gallery[0], gallery[1], gallery[3]],
  );
  assert.deepEqual(
    slides.map((slide) => slide.canonicalIndex),
    [2, 0, 1, 3],
  );
  assert.deepEqual(
    slides.map((slide) => slide.caption),
    ["Capa conferida", "Segundo ângulo", "Primeiro ângulo", "Interior"],
  );
  assert.deepEqual(
    slides.map((slide) => slide.isCover),
    [true, false, false, false],
  );
  assert.deepEqual({ gallery, captions }, original);
});

test("known cover sizes and encoded spaces identify the same cover rendition", () => {
  const smallCover = `${root}small/reviewed%20unitCAPA_small.png`;
  const gallery = [
    `${root}big/reviewed unitCAPA.jpg`,
    `${root}reviewed%20unitCAPA.avif`,
    `${root}interior.avif`,
  ];
  const slides = buildVehicleHeroGallery(
    smallCover,
    gallery,
    ["Frente", "Frente", "Interior"],
    "Capa",
  );
  assert.deepEqual(
    slides.map((slide) => slide.image),
    [smallCover, gallery[2]],
  );
  assert.equal(slides[0].canonicalIndex, 0);
});

test("a distinct cover has no original gallery index and retains its own caption", () => {
  const gallery = [`${root}exterior.avif`, `${root}interior.avif`];
  const slides = buildVehicleHeroGallery(
    cover,
    gallery,
    ["Exterior", "Interior"],
    "Foto principal",
  );
  assert.equal(slides.length, 3);
  assert.equal(slides[0].canonicalIndex, null);
  assert.equal(slides[0].caption, "Foto principal");
});

test("exact URL duplicates disappear without sorting or merging different versions", () => {
  const relative = "/imagens/veiculos_automacar/photo.avif";
  const gallery = [
    relative,
    `${root}photo.avif`,
    `${root}photo.avif?v=2`,
    relative,
  ];
  const slides = buildVehicleHeroGallery(
    "",
    gallery,
    ["Original", "Duplicate", "Atualizada", "Duplicate"],
    "",
  );
  assert.deepEqual(
    slides.map((slide) => slide.canonicalIndex),
    [0, 2],
  );
  assert.deepEqual(
    slides.map((slide) => slide.caption),
    ["Original", "Atualizada"],
  );
  assert.ok(slides.every((slide) => !slide.isCover));
});

test("similar filenames outside the known directory or on another host stay distinct", () => {
  const gallery = [
    "https://other.example/imagens/veiculos_automacar/reviewed%20unitCAPA.avif",
    "https://www.netcarmultimarcas.com.br/other/reviewed%20unitCAPA.avif",
    `${root}different%20unitCAPA.avif`,
    `${root}reviewed%20unitCAPA.avif?v=2`,
  ];
  assert.equal(buildVehicleHeroGallery(cover, gallery, [], "Capa").length, 5);
  const genericCover = `${root}photo.png`;
  assert.equal(
    buildVehicleHeroGallery(genericCover, [`${root}photo.avif`], [], "Capa")
      .length,
    2,
  );
});

test("exact cover duplicates work outside rendition rules and missing captions stay aligned", () => {
  const custom = "https://other.example/cover.png";
  const slides = buildVehicleHeroGallery(
    custom,
    [custom, `${root}interior.avif`],
    [],
    "Foto principal",
  );
  assert.equal(slides[0].canonicalIndex, 0);
  assert.equal(slides[0].caption, "Foto principal");
  assert.equal(slides[1].canonicalIndex, 1);
  assert.equal(slides[1].caption, "");
  assert.deepEqual(buildVehicleHeroGallery("", [], [], ""), []);
});
