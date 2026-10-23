import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import React, { lazy } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { DeferredRender } from "../../src/design-system/components/layout/DeferredRender";

test("deferred section keeps its reservation until the lazy chunk resolves, then uses natural height", async () => {
  const original = Object.getOwnPropertyDescriptor(
    globalThis,
    "IntersectionObserver",
  );
  let intersection: (entries: { isIntersecting: boolean }[]) => void;
  let rootMargin: string | undefined;
  let disconnects = 0;
  let resolveChunk: (value: { default: () => React.JSX.Element }) => void;
  let imports = 0;
  const chunk = new Promise<{ default: () => React.JSX.Element }>((resolve) => {
    resolveChunk = resolve;
  });
  const Content = lazy(() => {
    imports += 1;
    return chunk;
  });
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  try {
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      value: class {
        constructor(
          callback: typeof intersection,
          options: { rootMargin?: string },
        ) {
          intersection = callback;
          rootMargin = options.rootMargin;
        }
        observe() {}
        disconnect() {
          disconnects += 1;
        }
      },
    });
    await act(async () => {
      renderer = TestRenderer.create(
        <DeferredRender
          minHeight={520}
          rootMargin="300px"
          className="section-wrapper"
        >
          <Content />
        </DeferredRender>,
        { createNodeMock: () => ({}) },
      );
    });
    const reservations = () =>
      renderer!.root.findAll(
        (node) => node.type === "div" && node.props.style?.minHeight === 520,
      );
    assert.equal(imports, 0, "offscreen content must remain deferred");
    assert.equal(rootMargin, "300px");
    assert.equal(reservations().length, 1);

    await act(async () => intersection!([{ isIntersecting: false }]));
    assert.equal(imports, 0);
    await act(async () => intersection!([{ isIntersecting: true }]));
    assert.equal(imports, 1);
    assert.equal(
      reservations().length,
      1,
      "pending chunk must not collapse to zero height",
    );
    assert.equal(disconnects, 1);

    await act(async () => {
      resolveChunk!({
        default: () => <section style={{ height: 240 }}>Conteúdo</section>,
      });
      await chunk;
    });
    assert.equal(
      reservations().length,
      0,
      "loaded section must not retain artificial blank space",
    );
    assert.equal(renderer!.root.findByType("section").props.style.height, 240);
    assert.equal(
      renderer!.root.findByProps({ className: "section-wrapper" }).props.style,
      undefined,
    );
  } finally {
    act(() => renderer?.unmount());
    if (original)
      Object.defineProperty(globalThis, "IntersectionObserver", original);
    else Reflect.deleteProperty(globalThis, "IntersectionObserver");
  }
});

test("without IntersectionObserver the lazy fallback still reserves space", async () => {
  const original = Object.getOwnPropertyDescriptor(
    globalThis,
    "IntersectionObserver",
  );
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  try {
    Reflect.deleteProperty(globalThis, "IntersectionObserver");
    const Content = lazy(
      () => new Promise<{ default: () => React.JSX.Element }>(() => {}),
    );
    await act(async () => {
      renderer = TestRenderer.create(
        <DeferredRender minHeight={96}>
          <Content />
        </DeferredRender>,
        { createNodeMock: () => ({}) },
      );
    });
    assert.equal(
      renderer!.root.findByProps({ "aria-hidden": "true" }).props.style
        .minHeight,
      96,
    );
  } finally {
    act(() => renderer?.unmount());
    if (original)
      Object.defineProperty(globalThis, "IntersectionObserver", original);
    else Reflect.deleteProperty(globalThis, "IntersectionObserver");
  }
});

test("home lazy sections use the reserved DeferredRender boundary, not a nested empty fallback", () => {
  const home = readFileSync(
    new URL("../../src/modules/home/pages/HomePage.tsx", import.meta.url),
    "utf8",
  );
  assert.equal((home.match(/<DeferredRender\b/g) || []).length, 7);
  assert.doesNotMatch(home, /<Suspense\b/);
});

test("vehicle detail sections do not swallow suspension with an empty nested fallback", () => {
  const detail = readFileSync(
    new URL(
      "../../src/modules/detalhes/pages/DetalhesPage.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const sections = [
    ...detail.matchAll(/<DeferredRender\b[^>]*>([\s\S]*?)<\/DeferredRender>/g),
  ];
  assert.equal(sections.length, 3);
  assert.ok(sections.some((section) => section[1].includes("<FabricaDeValor")));
  for (const section of sections) {
    assert.doesNotMatch(
      section[1],
      /<(?:React\.)?Suspense\b[^>]*fallback=\{null\}/,
    );
  }
});
