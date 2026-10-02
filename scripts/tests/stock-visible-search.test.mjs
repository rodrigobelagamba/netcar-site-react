import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
let server;
let matchesVehicleSearch;
let StockSearchField;
let renderer;

const renegade = {
  id: "20040",
  name: "JEEP RENEGADE LONGITUDE T270 TURBO",
  slug: "jeep-renegade-20040",
  marca: "JEEP",
  modelo: "RENEGADE LONGITUDE T270 TURBO",
  year: 2024,
  price: 99_900,
  valor_formatado: "R$ 99.900,00",
  cor: "CINZA",
  cambio: "AUTOMÁTICO",
  combustivel: "FLEX",
  motor: "1.3",
  placa: "ABC1D23",
  km: 12_000,
  images: [],
};

const tcross = {
  ...renegade,
  id: "30000",
  name: "VOLKSWAGEN T-CROSS HIGHLINE",
  slug: "volkswagen-t-cross-30000",
  marca: "VOLKSWAGEN",
  modelo: "T-CROSS HIGHLINE",
  year: 2023,
  cor: "PRATA",
};

before(async () => {
  server = await createServer({
    root,
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true, hmr: false },
    logLevel: "error",
    resolve: { alias: { "@": resolve(root, "src") } },
  });
  ({ matchesVehicleSearch } = await server.ssrLoadModule(
    "/src/lib/vehicleSearch.ts",
  ));
  ({ StockSearchField } = await server.ssrLoadModule(
    "/src/modules/seminovos/components/StockSearchField.tsx",
  ));
});

afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
});

after(async () => {
  await server?.close();
});

test("free text finds partial models and combines brand, year and color", () => {
  for (const term of ["Rene", "jeep", "Jeep 2024 Cinza", "cinza rene 2024"]) {
    assert.equal(matchesVehicleSearch(renegade, term), true, term);
  }
  for (const term of ["Jeep 2023", "Renegade prata", "Volkswagen 2024 Cinza"]) {
    assert.equal(matchesVehicleSearch(renegade, term), false, term);
  }
});

test("accents, casing and hyphens do not hide matching vehicles", () => {
  for (const term of ["automatico", "AUTOMÁTICO", "  jeep   automático  "]) {
    assert.equal(matchesVehicleSearch(renegade, term), true, term);
  }
  for (const term of ["T-Cross", "t cross", "volkswagen t-cross prata"]) {
    assert.equal(matchesVehicleSearch(tcross, term), true, term);
  }
  assert.equal(matchesVehicleSearch(renegade, "T-Cross"), false);
  assert.equal(
    matchesVehicleSearch(
      { marca: "TOYOTA", modelo: "COROLLA CROSS" },
      "T-Cross",
    ),
    false,
  );
});

test("empty searches include every vehicle and optional missing fields are safe", () => {
  const sparseVehicle = {
    id: "40000",
    name: "FIAT MOBI",
    slug: "fiat-mobi-40000",
    year: 2022,
    price: 0,
    km: 0,
    images: [],
  };
  for (const vehicle of [renegade, tcross, sparseVehicle]) {
    for (const term of ["", "   "]) {
      assert.equal(matchesVehicleSearch(vehicle, term), true);
    }
  }
  assert.equal(matchesVehicleSearch(sparseVehicle, "mobi 2022"), true);
  assert.equal(matchesVehicleSearch(sparseVehicle, "cinza"), false);
});

async function renderField(props, createNodeMock) {
  await act(async () => {
    const element = React.createElement(StockSearchField, props);
    if (renderer) renderer.update(element);
    else renderer = TestRenderer.create(element, { createNodeMock });
  });
  return renderer.root.findByType("input");
}

test("visible search is controlled by the current route value", async () => {
  const changes = [];
  const onChange = (value) => changes.push(value);
  let input = await renderField({ value: "Jeep", onChange });
  assert.equal(input.props.value, "Jeep");

  await act(async () => {
    input.props.onChange({ target: { value: "Jeep 2024 Cinza" } });
  });
  assert.deepEqual(changes, ["Jeep 2024 Cinza"]);

  input = await renderField({ value: "Jeep 2024 Cinza", onChange });
  assert.equal(input.props.value, "Jeep 2024 Cinza");

  // A history change must replace the displayed term, without local draft state.
  input = await renderField({ value: "T-Cross", onChange });
  assert.equal(input.props.value, "T-Cross");
  assert.deepEqual(changes, ["Jeep 2024 Cinza"]);
});

test("clearing search emits an empty term and returns focus to the input", async () => {
  const changes = [];
  let focusCalls = 0;
  await renderField(
    { value: "Rene", onChange: (value) => changes.push(value) },
    (element) =>
      element.type === "input" ? { focus: () => focusCalls++ } : null,
  );
  const clear = renderer.root
    .findAllByType("button")
    .find((button) => /limpar/i.test(String(button.props["aria-label"] || "")));
  assert.ok(clear, "Search must provide an accessible clear button");
  assert.equal(clear.props.type, "button", "Clearing must not submit the form");
  const previousFocusCalls = focusCalls;
  await act(async () => clear.props.onClick());
  assert.deepEqual(changes, [""]);
  assert.equal(focusCalls, previousFocusCalls + 1);

  const input = await renderField({ value: "", onChange: () => {} });
  assert.equal(input.props.value, "");
});

test("submitting visible search prevents a page reload and retains the term", async () => {
  const changes = [];
  await renderField({
    value: "Jeep 2024",
    onChange: (value) => changes.push(value),
  });
  const form = renderer.root.findByType("form");
  let prevented = false;
  await act(async () => {
    form.props.onSubmit({
      preventDefault: () => {
        prevented = true;
      },
    });
  });
  assert.equal(prevented, true, "Enter must not reload the page");
  assert.equal(renderer.root.findByType("input").props.value, "Jeep 2024");
  assert.ok(!changes.includes(""), "Submitting must not clear the search");
});
