import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PageLoader } from "../../src/components/layout/PageLoader";

test("stock Suspense fallback never flashes a standalone car", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    for (const pathname of ["/seminovos", "/seminovos/"]) {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          location: { pathname },
          __NETCAR_STOCK__: {
            vehicles: [{ id: "123", modelo: "TEST", images: ["/car.png"] }],
          },
        },
      });
      const html = renderToStaticMarkup(<PageLoader />);
      assert.doesNotMatch(html, /<img/);
      assert.match(html, /aria-hidden="true"/);
      assert.match(html, /min-h-/);
    }
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("home and detail loading images match the responsive variant selected by their final heroes", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  const source = "/imagens/test-cover.jpg";
  try {
    for (const [pathname, sizes] of [
      ["/", "(max-width: 767px) 50vw, 70vw"],
      ["/veiculo/test-123", "(max-width: 1023px) 100vw, 70vw"],
    ]) {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          location: { pathname },
          __NETCAR_HOME_HERO__: { image: source },
          __NETCAR_STOCK__: {
            vehicles: [{ id: "123", modelo: "TEST", images: [source] }],
          },
        },
      });
      const html = renderToStaticMarkup(<PageLoader />);
      assert.ok(html.includes(`sizes="${sizes}"`));
      assert.match(html, /src="[^"]+&amp;w=960"/);
      const srcset = html.match(/srcSet="([^"]+)"/)?.[1];
      assert.ok(srcset);
      assert.deepEqual(
        [...srcset.matchAll(/ (\d+)w/g)].map((match) => Number(match[1])),
        [480, 640, 768, 960, 1280],
      );
      const hero = readFileSync(
        new URL(
          pathname === "/"
            ? "../../src/design-system/components/patterns/HomeHero.tsx"
            : "../../src/modules/detalhes/pages/DetalhesPage.tsx",
          import.meta.url,
        ),
        "utf8",
      );
      assert.ok(hero.includes(`sizes="${sizes}"`));
    }
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("PHP detail shell and preload use the same desktop image size as the rendered hero", () => {
  const php = readFileSync(
    new URL("../../public/index.php", import.meta.url),
    "utf8",
  );
  for (const name of [
    "netcar_stock_critical_preload",
    "netcar_stock_initial_lcp",
  ]) {
    const functionBody = php
      .split(`function ${name}($path)`)[1]
      ?.split("\nfunction ")[0];
    assert.ok(functionBody, `Missing PHP function ${name}`);
    assert.match(
      functionBody,
      /\$sizes = \$isStock \? '\(max-width: 767px\) 50vw, 25vw' : '\(max-width: 1023px\) 100vw, 70vw';/,
    );
  }
});
