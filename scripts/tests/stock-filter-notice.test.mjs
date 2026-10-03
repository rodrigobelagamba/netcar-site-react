import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
let server;
let StockFilterNotice;
let renderer;

before(async () => {
  server = await createServer({
    root,
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
    logLevel: "error",
    resolve: { alias: { "@": resolve(root, "src") } },
  });
  ({ StockFilterNotice } = await server.ssrLoadModule(
    "/src/modules/seminovos/components/StockFilterNotice.tsx",
  ));
});

afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
});

after(async () => {
  await server?.close();
});

async function renderNotice(props = {}) {
  await act(async () => {
    const element = React.createElement(StockFilterNotice, {
      active: true,
      resultCount: 2,
      updating: false,
      onClear: () => {},
      ...props,
    });
    if (renderer) renderer.update(element);
    else renderer = TestRenderer.create(element);
  });
}

function summary() {
  return renderer.root.findAllByType("p")[1];
}

test("the complete inventory has no filtered notice or reset action", async () => {
  for (const updating of [false, true]) {
    await renderNotice({ active: false, updating });
    assert.equal(renderer.toJSON(), null);
  }
});

test("filtered results describe zero, one and multiple vehicles in the selection", async () => {
  for (const [resultCount, expected] of [
    [0, "Nenhum veículo corresponde a esta seleção."],
    [1, "1 veículo encontrado nesta seleção."],
    [27, "27 veículos encontrados nesta seleção."],
  ]) {
    await renderNotice({ resultCount });
    assert.equal(summary().children.join(""), expected);
    assert.equal(
      renderer.root.findByType("section").props["aria-label"],
      "Estoque filtrado",
    );
  }
});

test("the notice explicitly warns that the full inventory is not being shown", async () => {
  await renderNotice();
  assert.equal(
    renderer.root.findAllByType("p")[0].children.join(""),
    "Estoque filtrado — você não está vendo todos os carros",
  );
  assert.doesNotMatch(renderer.root.findByType("section").props.className, /(?:^|\s)(?:\S*:)?hidden(?:\s|$)/);
});

test("updating results never announce an empty or stale final count", async () => {
  for (const resultCount of [0, 1, 27]) {
    await renderNotice({ resultCount, updating: true });
    assert.equal(
      summary().children.join(""),
      "Atualizando os resultados da sua seleção…",
    );
    assert.doesNotMatch(summary().children.join(""), /\d|Nenhum|encontrad/);
  }
});

test("the whole-inventory button runs the reset callback without submitting", async () => {
  let clearCalls = 0;
  await renderNotice({ onClear: () => clearCalls++ });
  const button = renderer.root.findByType("button");
  assert.equal(button.children.join(""), "Ver todo o estoque");
  assert.equal(button.props.type, "button");
  await act(async () => button.props.onClick());
  assert.equal(clearCalls, 1);
});

test("the whole-inventory action remains usable while results update", async () => {
  let clearCalls = 0;
  await renderNotice({ updating: true, onClear: () => clearCalls++ });
  const button = renderer.root.findByType("button");
  assert.notEqual(button.props.disabled, true);
  await act(async () => button.props.onClick());
  assert.equal(clearCalls, 1);
});

test("the summary changes from updating to the final count and hides after reset", async () => {
  await renderNotice({ updating: true, resultCount: 0 });
  assert.match(summary().children.join(""), /^Atualizando/);

  await renderNotice({ updating: false, resultCount: 3 });
  assert.equal(
    summary().children.join(""),
    "3 veículos encontrados nesta seleção.",
  );

  await renderNotice({ active: false, resultCount: 40 });
  assert.equal(renderer.toJSON(), null);
});
