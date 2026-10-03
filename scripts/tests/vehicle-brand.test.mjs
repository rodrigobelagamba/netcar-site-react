import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
let server;
let normalizeVehicleBrand;
let matchesVehicleBrand;
let AutocompleteSelect;
let renderer;
const previousDocument = globalThis.document;

before(async () => {
  server = await createServer({
    root,
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
    logLevel: "error",
    resolve: { alias: { "@": resolve(root, "src") } },
  });
  ({ normalizeVehicleBrand, matchesVehicleBrand } = await server.ssrLoadModule(
    "/src/lib/vehicleBrand.ts",
  ));
  ({ AutocompleteSelect } = await server.ssrLoadModule(
    "/src/design-system/components/ui/AutocompleteSelect.tsx",
  ));
  globalThis.document = { addEventListener() {}, removeEventListener() {} };
});

afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
});

after(async () => {
  await server?.close();
  if (previousDocument === undefined) delete globalThis.document;
  else globalThis.document = previousDocument;
});

test("common brand names, spaced initials and punctuation share an identity", () => {
  for (const alias of ["GM", "G.M.", "G M", "General Motors", "Chevy", "CHEVROLET"]) {
    assert.equal(normalizeVehicleBrand(alias), "chevrolet", alias);
    assert.equal(matchesVehicleBrand("CHEVROLET", alias), true, alias);
    assert.equal(matchesVehicleBrand(alias, "chevrolet"), true, alias);
  }
  for (const alias of ["VW", "V.W.", "V W", "Volks", "VOLKSWAGEN"]) {
    assert.equal(normalizeVehicleBrand(alias), "volkswagen", alias);
    assert.equal(matchesVehicleBrand("VOLKSWAGEN", alias), true, alias);
  }
  assert.equal(normalizeVehicleBrand(" CAOA CHERY "), "chery");
  assert.equal(matchesVehicleBrand("CHERY", "caoa chery"), true);
  assert.equal(normalizeVehicleBrand("Citroën"), "citroen");
});

test("partial brand lookup preserves accents and original multiword names", () => {
  for (const [brand, query] of [
    ["CHEVROLET", "chev"],
    ["GM", "chevr"],
    ["VOLKSWAGEN", "volksw"],
    ["CAOA CHERY", "caoa"],
    ["CITROËN", "citro"],
    ["LAND ROVER", "land"],
    ["HYUNDAI", ""],
  ]) {
    assert.equal(matchesVehicleBrand(brand, query), true, `${brand}: ${query}`);
  }
  assert.equal(matchesVehicleBrand("FIAT", "GM"), false);
  assert.equal(matchesVehicleBrand("CHEVROLET", "gm automático"), false);
  assert.equal(normalizeVehicleBrand(undefined), "");
});

async function createSelect(matcher) {
  const selected = [];
  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(AutocompleteSelect, {
        options: [
          { value: "CHEVROLET", label: "CHEVROLET" },
          { value: "VOLKSWAGEN", label: "VOLKSWAGEN" },
        ],
        value: "",
        matchesOption: matcher,
        onChange: (value) => selected.push(value),
      }),
    );
  });
  await act(async () => {
    renderer.root.findByType("input").props.onChange({ target: { value: "G.M." } });
  });
  return selected;
}

test("the brand dropdown accepts GM and submits the original catalog value", async () => {
  const selected = await createSelect(matchesVehicleBrand);
  const options = renderer.root.findAllByType("li");
  assert.equal(options.length, 1);
  assert.equal(options[0].children.join(""), "CHEVROLET");
  await act(async () => options[0].props.onClick());
  assert.deepEqual(selected, ["CHEVROLET"]);
});

test("dropdowns without a brand matcher keep their existing literal search", async () => {
  await createSelect(undefined);
  assert.equal(
    renderer.root.findByType("li").children.join(""),
    "Nenhuma opção encontrada",
  );
});
