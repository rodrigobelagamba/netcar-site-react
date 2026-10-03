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
let parseVehicleSearch;
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
    server: { middlewareMode: true, hmr: false, ws: false },
    logLevel: "error",
    resolve: { alias: { "@": resolve(root, "src") } },
  });
  ({ matchesVehicleSearch, parseVehicleSearch } = await server.ssrLoadModule(
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

function nodeText(node) {
  return typeof node === "string"
    ? node
    : (node.children || []).map(nodeText).join(" ");
}

test("the understanding follows typing and history without requiring submit", async () => {
  await renderField({ value: "50000 quilometragem", onChange: () => {} });
  assert.match(
    nodeText(renderer.root.findByProps({ id: "stock-search-understanding" })),
    /50\.000 km/,
  );
  assert.doesNotMatch(
    nodeText(renderer.root.findByProps({ id: "stock-search-understanding" })),
    /R\$/,
  );
  await renderField({ value: "vw", onChange: () => {}, vehicles: [tcross] });
  assert.match(
    nodeText(renderer.root.findByProps({ id: "stock-search-understanding" })),
    /volkswagen/i,
  );
  await renderField({ value: "", onChange: () => {} });
  assert.equal(
    renderer.root.findAllByProps({ id: "stock-search-understanding" }).length,
    0,
  );
});

test("ambiguous amounts offer price and mileage without auto-selecting either", async () => {
  const changes = [];
  const input = await renderField({
    value: "50 mil",
    onChange: (q) => changes.push(q),
  });
  await act(async () => renderer.root.findByType("form").props.onFocus());
  const options = renderer.root.findAllByProps({ role: "option" });
  assert.ok(options.some((o) => /R\$/.test(nodeText(o))));
  assert.ok(options.some((o) => /km/.test(nodeText(o))));
  assert.equal(input.props["aria-expanded"], true);
  assert.equal(input.props["aria-activedescendant"], undefined);
  assert.deepEqual(changes, []);
  await act(async () =>
    options.find((o) => /km/.test(nodeText(o))).props.onClick(),
  );
  assert.equal(changes.length, 1);
  const parsed = parseVehicleSearch(changes[0]);
  assert.equal(parsed.filters.kmMax, 50_000);
  assert.equal(parsed.filters.priceMax, undefined);
});

test("arrows select a suggestion and Enter applies only an explicit selection", async () => {
  const changes = [];
  const input = await renderField({
    value: "50 mil",
    onChange: (q) => changes.push(q),
  });
  await act(async () =>
    input.props.onKeyDown({ key: "ArrowDown", preventDefault() {} }),
  );
  assert.equal(
    input.props["aria-activedescendant"],
    "stock-search-suggestion-0",
  );
  await act(async () =>
    renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }),
  );
  assert.equal(changes.length, 1);
  assert.equal(parseVehicleSearch(changes[0]).filters.priceMax, 50_000);
  assert.equal(input.props["aria-expanded"], false);
});

test("Escape closes suggestions and ordinary Enter preserves the original query", async () => {
  const changes = [];
  const input = await renderField({
    value: "50 mil",
    onChange: (q) => changes.push(q),
  });
  await act(async () => renderer.root.findByType("form").props.onFocus());
  await act(async () =>
    input.props.onKeyDown({ key: "ArrowDown", preventDefault() {} }),
  );
  await act(async () =>
    input.props.onKeyDown({ key: "Escape", preventDefault() {} }),
  );
  assert.equal(input.props["aria-expanded"], false);
  await act(async () =>
    renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }),
  );
  assert.deepEqual(changes, []);
});

test("editing clears the highlighted choice before the next Enter", async () => {
  const changes = [];
  const onChange = (q) => changes.push(q);
  let input = await renderField({ value: "50 mil", onChange });
  await act(async () =>
    input.props.onKeyDown({ key: "ArrowDown", preventDefault() {} }),
  );
  await act(async () =>
    input.props.onChange({ target: { value: "50 mil km" } }),
  );
  input = await renderField({ value: "50 mil km", onChange });
  assert.equal(input.props["aria-activedescendant"], undefined);
  await act(async () =>
    renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }),
  );
  assert.deepEqual(changes, ["50 mil km"]);
});

test("unsupported syntax gives guidance without claiming a positive filter", async () => {
  for (const value of ["sem suv", "GM ou VW", "baixa km"]) {
    await renderField({ value, onChange: () => {} });
    const text = nodeText(
      renderer.root.findByProps({ id: "stock-search-understanding" }),
    );
    assert.match(text, /Vamos refinar/);
    assert.doesNotMatch(text, /Entendi assim/);
  }
});

test("history changes cannot keep an old highlighted suggestion", async () => {
  const changes = [];
  const onChange = (q) => changes.push(q);
  let input = await renderField({ value: "50 mil", onChange });
  await act(async () =>
    input.props.onKeyDown({ key: "ArrowDown", preventDefault() {} }),
  );
  input = await renderField({ value: "50k", onChange });
  assert.equal(input.props["aria-activedescendant"], undefined);
  await act(async () =>
    renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }),
  );
  assert.deepEqual(changes, []);
});

test("suggestions refresh when applied category and fuel filters narrow the supplied stock", async () => {
  const onix = {
    ...renegade,
    id: "onix",
    marca: "CHEVROLET",
    modelo: "ONIX LT",
    name: "CHEVROLET ONIX LT",
    categoria: "HATCH",
  };
  const crvFlex = {
    ...renegade,
    id: "crv-flex",
    marca: "HONDA",
    modelo: "CR-V EXL",
    name: "HONDA CR-V EXL",
    categoria: "SUV",
  };
  const crvHybrid = {
    ...crvFlex,
    id: "crv-hybrid",
    modelo: "CR-V TOURING",
    name: "HONDA CR-V TOURING",
    combustivel: "HIBRIDO",
  };
  const onChange = () => {};
  const options = () =>
    renderer.root.findAllByProps({ role: "option" }).map(nodeText).join(" ");

  await renderField({
    value: "on",
    onChange,
    vehicles: [onix, crvFlex, crvHybrid],
  });
  await act(async () => renderer.root.findByType("form").props.onFocus());
  assert.match(options(), /ONIX LT/);
  assert.match(options(), /HONDA/);

  // Same text, new context from the page's applied SUV filter. Suggestions
  // must recompute rather than retain the previously available hatch.
  await renderField({ value: "on", onChange, vehicles: [crvFlex, crvHybrid] });
  assert.doesNotMatch(options(), /ONIX/);
  assert.match(options(), /HONDA/);

  await renderField({ value: "cr", onChange, vehicles: [crvFlex, crvHybrid] });
  assert.match(options(), /CR-V EXL/);
  assert.match(options(), /CR-V TOURING/);
  await renderField({ value: "cr", onChange, vehicles: [crvHybrid] });
  assert.doesNotMatch(options(), /CR-V EXL/);
  assert.match(options(), /CR-V TOURING/);
});

test("empty and whitespace-only inputs never reveal or apply assistance examples", async () => {
  const changes = [];
  const onChange = (value) => changes.push(value);
  const checkEmpty = () => {
    for (const props of [
      { "data-search-assist-line": true },
      { role: "listbox" },
      { role: "option" },
      { id: "stock-search-understanding" },
    ]) {
      assert.equal(renderer.root.findAllByProps(props).length, 0);
    }
    const input = renderer.root.findByType("input");
    assert.equal(input.props["aria-expanded"], false);
    assert.equal(input.props["aria-controls"], undefined);
    assert.equal(input.props["aria-activedescendant"], undefined);
    assert.equal(input.props["aria-describedby"], undefined);
  };

  for (const value of ["", "   "]) {
    const input = await renderField({ value, onChange });
    checkEmpty();
    await act(async () => renderer.root.findByType("form").props.onFocus());
    checkEmpty();
    await act(async () =>
      input.props.onKeyDown({ key: "ArrowDown", preventDefault() {} }),
    );
    checkEmpty();
    await act(async () =>
      renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }),
    );
    checkEmpty();
    await act(async () =>
      renderer.root.findByType("form").props.onBlur({
        currentTarget: { contains: () => false },
        relatedTarget: null,
      }),
    );
    checkEmpty();
    assert.equal(input.props.value, value);
  }
  assert.deepEqual(
    changes,
    [],
    "ArrowDown and Enter cannot insert examples into an empty query",
  );
});

test("filled queries share one fixed-height line for suggestions and interpretation", async () => {
  const onChange = () => {};
  const checkStrip = (showSuggestions) => {
    const strips = renderer.root.findAllByProps({
      "data-search-assist-line": true,
    });
    assert.equal(
      strips.length,
      1,
      "Only one help strip may occupy space below the input",
    );
    const strip = strips[0];
    assert.ok(strip.props.className.split(/\s+/).includes("h-9"));
    const visibleContent = strip.findAll(
      (node) =>
        ["p", "ul"].includes(node.type) &&
        !node.props.className?.split(/\s+/).includes("sr-only"),
    );
    assert.equal(
      visibleContent.length,
      1,
      "Interpretation and suggestions cannot add separate visible rows",
    );
    if (showSuggestions) {
      assert.equal(visibleContent[0].props.role, "listbox");
      assert.ok(
        visibleContent[0].props.className
          .split(/\s+/)
          .includes("whitespace-nowrap"),
      );
    } else {
      assert.equal(visibleContent[0].type, "p");
      assert.ok(
        visibleContent[0].props.className.split(/\s+/).includes("truncate"),
      );
    }
  };

  await renderField({ value: "50 mil", onChange });
  checkStrip(false);
  await act(async () => renderer.root.findByType("form").props.onFocus());
  checkStrip(true);
  await act(async () =>
    renderer.root
      .findByType("input")
      .props.onKeyDown({ key: "Escape", preventDefault() {} }),
  );
  checkStrip(false);
  await renderField({ value: "não automático", onChange });
  checkStrip(false);
  await renderField({ value: "de 100 a 50 mil", onChange });
  checkStrip(false);
});

test("full interpretation remains accessible while suggestions occupy the visible line", async () => {
  const input = await renderField({ value: "50 mil", onChange: () => {} });
  const descriptionId = input.props["aria-describedby"];
  const description = () => renderer.root.findByProps({ id: descriptionId });
  const fullText = nodeText(description());
  assert.match(fullText, /preço ou quilometragem/);
  assert.equal(description().props.title, fullText);

  await act(async () => renderer.root.findByType("form").props.onFocus());
  assert.equal(description().props.className, "sr-only");
  assert.equal(nodeText(description()), fullText);
  assert.equal(input.props["aria-describedby"], descriptionId);
  assert.equal(renderer.root.findAllByProps({ id: descriptionId }).length, 1);
  const options = renderer.root.findAllByProps({ role: "option" });
  assert.equal(options.length, 2);
  for (const option of options) {
    const detail = option.findByProps({ className: "sr-only" });
    assert.equal(nodeText(detail), option.props.title);
    assert.match(nodeText(detail), /máxim[ao]/);
  }

  await act(async () =>
    input.props.onKeyDown({ key: "Escape", preventDefault() {} }),
  );
  assert.notEqual(description().props.className, "sr-only");
  assert.equal(nodeText(description()), fullText);
});

test("arrow selection reveals horizontal options without moving input focus", async () => {
  const scrolled = [];
  let focusCalls = 0;
  let blurCalls = 0;
  const input = await renderField(
    { value: "50 mil", onChange: () => {} },
    (element) => {
      if (element.type === "input") {
        return { focus: () => focusCalls++, blur: () => blurCalls++ };
      }
      if (element.props.role === "option") {
        return {
          scrollIntoView: (options) =>
            scrolled.push({ id: element.props.id, options }),
        };
      }
      return null;
    },
  );
  await act(async () => renderer.root.findByType("form").props.onFocus());
  assert.equal(
    renderer.root.findByProps({ role: "listbox" }).props["aria-orientation"],
    "horizontal",
  );
  assert.deepEqual(scrolled, []);

  for (const index of [0, 1]) {
    await act(async () =>
      input.props.onKeyDown({ key: "ArrowDown", preventDefault() {} }),
    );
    const id = `stock-search-suggestion-${index}`;
    assert.equal(input.props["aria-activedescendant"], id);
    assert.equal(
      renderer.root.findByProps({ id }).props["aria-selected"],
      true,
    );
    assert.deepEqual(scrolled.at(-1), {
      id,
      options: { block: "nearest", inline: "nearest" },
    });
  }
  assert.equal(focusCalls, 0);
  assert.equal(blurCalls, 0);
  const scrollCount = scrolled.length;
  await act(async () =>
    input.props.onKeyDown({
      key: "ArrowRight",
      preventDefault() {
        assert.fail("Left/right must remain available for editing the input");
      },
    }),
  );
  assert.equal(scrolled.length, scrollCount);
  assert.equal(input.props.value, "50 mil");
});
