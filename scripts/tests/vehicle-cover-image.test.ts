import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeVehicleImages } from "../../src/lib/vehicleImagePolicy.mjs";
import {
  resolveVehicleCoverImage,
  VEHICLE_COVER_PLACEHOLDER,
} from "../../src/lib/vehicleCoverImage";

const cover = "https://www.netcarmultimarcas.com.br/imagens/unit-cover.png";
const thumb = "https://www.netcarmultimarcas.com.br/imagens/unit-cover_small.png";

test("explicit cover URLs retain catalog priority even when the photo flag is zero", () => {
  const vehicle = {
    images: ["https://www.netcarmultimarcas.com.br/imagens/legacy.png"],
    imagens_site: { capa: cover, capa_thumb: thumb, tem_fotos: 0 },
  };
  assert.equal(resolveVehicleCoverImage(vehicle), cover);
  assert.equal(resolveVehicleCoverImage(vehicle, true), thumb);
  assert.equal(
    resolveVehicleCoverImage({
      ...vehicle,
      imagens_site: { capa: null, capa_thumb: thumb, tem_fotos: 0 },
    }),
    thumb,
  );
  assert.equal(
    resolveVehicleCoverImage({ ...vehicle, imagens_site: { capa: cover } }, true),
    cover,
  );
});

test("the legacy fallback keeps PNG selection and does not promote other image formats", () => {
  const png = "https://www.netcarmultimarcas.com.br/imagens/legacy.PNG";
  const imageSources = ["photo.jpg", "photo.avif", "photo.webp"];
  assert.equal(
    resolveVehicleCoverImage({ images: imageSources }),
    VEHICLE_COVER_PLACEHOLDER,
  );
  assert.equal(
    resolveVehicleCoverImage({ images: [...imageSources, png, cover] }),
    png,
  );
  assert.equal(
    resolveVehicleCoverImage({ images: ["photo.png?version=2"] }),
    "photo.png?version=2",
  );
  assert.equal(
    resolveVehicleCoverImage({ images: ["photo.PNG?version=2"] }),
    VEHICLE_COVER_PLACEHOLDER,
  );
});

test("the problematic first PNG remains a placeholder instead of falling through to another image", () => {
  for (const extension of ["png", "PNG"]) {
    const problematic = `https://www.netcarmultimarcas.com.br/imagens/271_131072IMG_8213.${extension}`;
    for (const compact of [false, true]) {
      assert.equal(
        resolveVehicleCoverImage({ images: [problematic, cover] }, compact),
        VEHICLE_COVER_PLACEHOLDER,
      );
    }
  }
});

test("the quarantined 20023 files cannot return through the shared cover fallback", () => {
  const wrongCover =
    "https://www.netcarmultimarcas.com.br/imagens/veiculos_automacar/26092026CRETA%20SPORT%20IZE3C02CAPA.png";
  const wrongThumb = wrongCover.replace(".png", "_small.png");
  const vehicle = sanitizeVehicleImages({
    id: "20023",
    images: [wrongCover, wrongThumb],
    fullImages: [wrongCover],
    imagens_site: {
      capa: wrongCover,
      capa_thumb: wrongThumb,
      galeria: [wrongCover],
      tem_fotos: 1,
    },
  });
  for (const compact of [false, true]) {
    assert.equal(
      resolveVehicleCoverImage(vehicle, compact),
      VEHICLE_COVER_PLACEHOLDER,
    );
  }
});

test("new unit photos survive quarantine when mixed with the excluded 20023 filenames", () => {
  const wrongCover =
    "https://www.netcarmultimarcas.com.br/imagens/veiculos_automacar/26092026CRETA%20SPORT%20IZE3C02CAPA.png";
  const newCover =
    "https://www.netcarmultimarcas.com.br/imagens/veiculos_automacar/20023-reviewed-new-cover.png";
  const vehicle = sanitizeVehicleImages({
    id: "20023",
    images: [wrongCover, newCover],
    imagens_site: { capa: wrongCover, tem_fotos: 1 },
  });
  assert.equal(resolveVehicleCoverImage(vehicle), newCover);
});
