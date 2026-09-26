import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Vehicle } from "../../src/catalog/endpoints/vehicles";
import { ComparisonVehicleImage } from "../../src/modules/seo/components/ComparisonVehicleImage";

const vehicle: Vehicle = {
  id: "19801",
  name: "Honda HR-V EX",
  marca: "Honda",
  modelo: "HR-V EX",
  year: 2022,
  price: 129_900,
  km: 10_000,
  slug: "hr-v-ex-2022-19801",
  images: ["/images/card.jpg"],
  fullImages: ["/images/full.jpg"],
  imagens_site: {
    capa: "/images/cover.jpg",
    capa_thumb: "/images/thumbnail.jpg",
    capa_opengraph: null,
    galeria: [],
  },
};

function renderImage(
  props: Partial<React.ComponentProps<typeof ComparisonVehicleImage>> = {},
) {
  return renderToStaticMarkup(
    <ComparisonVehicleImage vehicle={vehicle} {...props} />,
  );
}

function attribute(html: string, name: string) {
  return html
    .match(new RegExp(`\\b${name}="([^"]*)"`, "i"))?.[1]
    .replaceAll("&amp;", "&");
}

test("comparison photo prefers the full cover and supplies responsive variants", () => {
  const html = renderImage({ sizes: "(max-width: 639px) 160px, 320px" });
  const src = new URL(attribute(html, "src")!);
  assert.equal(src.pathname, "/img.php");
  assert.equal(src.searchParams.get("src"), "/images/cover.jpg");
  assert.equal(src.searchParams.get("w"), "640");
  const variants = attribute(html, "srcset")!.split(", ");
  assert.deepEqual(
    variants.map((variant) => {
      const [url, width] = variant.split(" ");
      const parsed = new URL(url);
      assert.equal(parsed.searchParams.get("src"), "/images/cover.jpg");
      assert.equal(`${parsed.searchParams.get("w")}w`, width);
      return width;
    }),
    ["240w", "320w", "480w", "640w", "960w"],
  );
  assert.equal(attribute(html, "sizes"), "(max-width: 639px) 160px, 320px");
  assert.doesNotMatch(html, /thumbnail|full\.jpg|card\.jpg/);
});

test("comparison photo falls back through the available image sources", () => {
  const cases: Array<[Vehicle, string]> = [
    [
      { ...vehicle, imagens_site: { ...vehicle.imagens_site!, capa: null } },
      "/images/thumbnail.jpg",
    ],
    [{ ...vehicle, imagens_site: undefined }, "/images/full.jpg"],
    [
      { ...vehicle, imagens_site: undefined, fullImages: [] },
      "/images/card.jpg",
    ],
    [
      { ...vehicle, imagens_site: undefined, fullImages: [], images: [] },
      "/images/semcapa.webp",
    ],
  ];
  for (const [item, expected] of cases) {
    const src = new URL(attribute(renderImage({ vehicle: item }), "src")!);
    assert.equal(src.searchParams.get("src"), expected);
  }
});

test("gallery AVIF covers use the optimized large JPEG preview", () => {
  const html = renderImage({
    vehicle: {
      ...vehicle,
      imagens_site: {
        ...vehicle.imagens_site!,
        capa: "/imagens/veiculos_automacar/hrv.avif",
      },
    },
  });
  const src = new URL(attribute(html, "src")!);
  assert.equal(
    src.searchParams.get("src"),
    "/imagens/veiculos_automacar/big/hrv.jpg",
  );
  assert.match(attribute(html, "srcset")!, /960w/);
});

test("image preserves the whole vehicle and a descriptive accessible label", () => {
  const html = renderImage({ className: "comparison-test" });
  assert.match(html, /^<img /);
  assert.equal(attribute(html, "alt"), "Honda HR-V EX 2022 — foto do veículo");
  assert.equal(attribute(html, "width"), "640");
  assert.equal(attribute(html, "height"), "480");
  const classes = new Set(attribute(html, "class")!.split(/\s+/));
  for (const name of [
    "!h-full",
    "w-full",
    "object-contain",
    "comparison-test",
  ]) {
    assert(classes.has(name));
  }
  assert.equal(attribute(html, "decoding"), "async");
  assert.equal(attribute(html, "loading"), "lazy");
  assert.equal(attribute(renderImage({ priority: true }), "loading"), "eager");
});

test("unresizable sources do not get duplicate responsive URLs", () => {
  const html = renderImage({
    vehicle: {
      ...vehicle,
      imagens_site: {
        ...vehicle.imagens_site!,
        capa: "https://cdn.example/car.avif",
      },
    },
  });
  assert.equal(attribute(html, "src"), "https://cdn.example/car.avif");
  assert.equal(attribute(html, "srcset"), undefined);
});

test("React error handler removes srcset and stops after one fallback attempt", () => {
  const element = ComparisonVehicleImage({ vehicle });
  let currentSrc = element.props.src;
  const assignments: string[] = [];
  const removedAttributes: string[] = [];
  const image = {
    get src() {
      return currentSrc;
    },
    set src(value: string) {
      currentSrc = value;
      assignments.push(value);
    },
    removeAttribute(name: string) {
      removedAttributes.push(name);
    },
  };

  element.props.onError({ currentTarget: image });
  element.props.onError({ currentTarget: image });
  assert.deepEqual(removedAttributes, ["srcset", "srcset"]);
  assert.equal(assignments.length, 1);
  const fallback = new URL(currentSrc);
  assert.equal(fallback.searchParams.get("src"), "/images/semcapa.webp");
  assert.equal(fallback.searchParams.get("w"), "640");

  // An already missing cover must also tolerate an unavailable placeholder.
  const noCover = ComparisonVehicleImage({
    vehicle: {
      ...vehicle,
      imagens_site: undefined,
      fullImages: [],
      images: [],
    },
  });
  currentSrc = noCover.props.src;
  noCover.props.onError({ currentTarget: image });
  assert.equal(assignments.length, 1);
});
