import assert from "node:assert/strict";
import { test } from "node:test";
import { isActiveSiteBannerImage } from "../../src/lib/siteBanners";

test("retira os dois banners da campanha ainda cadastrados na API", () => {
  const images = [
    "/imagens/banner/666_69632NetCar-Banner-0109.jpg",
    "https://www.netcarmultimarcas.com.br/imagens/banner/667_126976NetCar-Banner-0109.jpg",
    "/images/campaigns/acelerou-levou/banner.jpg",
    "/IMAGENS/BANNER/666_69632NETCAR-BANNER-0109.JPG?v=2",
  ];
  assert.deepEqual(images.filter(isActiveSiteBannerImage), []);
});

test("preserva banners novos após um banner encerrado", () => {
  const currentImage = "/imagens/banner/668_banner-institucional.jpg";
  const images = [
    "/imagens/banner/666_69632NetCar-Banner-0109.jpg",
    currentImage,
  ];
  assert.deepEqual(images.filter(isActiveSiteBannerImage), [currentImage]);
});
