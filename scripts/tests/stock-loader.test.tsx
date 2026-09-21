import assert from "node:assert/strict";
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
          __NETCAR_STOCK__: { vehicles: [{ id: "123", modelo: "TEST", images: ["/car.png"] }] },
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
