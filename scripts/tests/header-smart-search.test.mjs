import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
let server;
let vehicleSearch;
let whatsappMessages;
let seminovosSearch;
let slug;

const vehicles = [
  {
    id: "30001",
    name: "HYUNDAI HB20 COMFORT",
    marca: "HYUNDAI",
    modelo: "HB20 COMFORT",
    categoria: "HATCH",
    year: 2022,
    price: 90_000,
    km: 45_000,
    cambio: "AUTOMÁTICO",
    combustivel: "FLEX",
    cor: "BRANCA",
    placa: "ABC1D23",
  },
  {
    id: "30002",
    name: "CHEVROLET ONIX LT",
    marca: "CHEVROLET",
    modelo: "ONIX LT",
    categoria: "HATCH",
    year: 2021,
    price: 80_000,
    km: 30_000,
    cambio: "MANUAL",
    combustivel: "FLEX",
    cor: "CINZA",
    placa: "XYZ9H87",
  },
];

before(async () => {
  server = await createServer({
    root,
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
    logLevel: "error",
    resolve: { alias: { "@": resolve(root, "src") } },
  });
  [vehicleSearch, whatsappMessages, seminovosSearch, slug] = await Promise.all([
    server.ssrLoadModule("/src/lib/vehicleSearch.ts"),
    server.ssrLoadModule("/src/lib/whatsappMessages.ts"),
    server.ssrLoadModule("/src/lib/seminovos-search.ts"),
    server.ssrLoadModule("/src/lib/slug.ts"),
  ]);
});

after(async () => server?.close());

// Execute the actual Header and handlers while isolating navigation and effects.
// This verifies keyboard interaction, not CSS visibility or browser focus behavior.
function createHarness() {
  const state = [];
  const navigations = [];
  let cursor = 0;
  let searchTerm = "";
  const dependencies = {
    react: {
      ...React,
      useState(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
        return [state[index], (next) => {
          state[index] = typeof next === "function" ? next(state[index]) : next;
        }];
      },
      useRef(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = { current: initial };
        return state[index];
      },
      useMemo: (calculate) => calculate(),
      useEffect: () => {},
    },
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": new Proxy({}, { get: () => "svg" }),
    "@tanstack/react-router": {
      Link: "router-link",
      useNavigate: () => (target) => navigations.push(target),
      useLocation: () => ({ pathname: "/", href: "/" }),
      useSearch: () => ({}),
    },
    "@/catalog/queries/useSiteQuery": {
      useWhatsAppQuery: () => ({ data: undefined }),
    },
    "@/catalog/queries/useVehiclesQuery": {
      useVehiclesQuery: () => ({ data: vehicles }),
    },
    "@/contexts/SearchContext": {
      useSearchContext: () => ({
        searchTerm,
        setSearchTerm: (next) => { searchTerm = next; },
      }),
    },
    "@/lib/vehicleSearch": vehicleSearch,
    "@/lib/whatsappMessages": whatsappMessages,
    "@/lib/seminovos-search": seminovosSearch,
    "@/lib/slug": slug,
    "@/assets/images/logo-netcar.png": "logo-test.png",
  };
  const path = "src/design-system/components/layout/Header.tsx";
  const { outputText } = ts.transpileModule(readFileSync(resolve(root, path), "utf8"), {
    fileName: path,
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const module = { exports: {} };
  runInNewContext(outputText, {
    module,
    exports: module.exports,
    require(name) {
      assert.ok(name in dependencies, `Unexpected Header dependency: ${name}`);
      return dependencies[name];
    },
  }, { filename: path });

  const render = () => {
    cursor = 0;
    return module.exports.Header();
  };
  const input = () => find(render(), (element) =>
    element.type === "input" && element.props.placeholder?.startsWith("Buscar por"));
  find(render(), (element) => element.props["aria-label"] === "Abrir menu").props.onClick();
  return {
    navigations,
    render,
    type(value) {
      input().props.onChange({ target: { value } });
    },
    key(key) {
      let prevented = false;
      input().props.onKeyDown({ key, preventDefault: () => { prevented = true; } });
      return prevented;
    },
  };
}

function descendants(node) {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!React.isValidElement(node)) return [];
  return [node, ...descendants(node.props.children)];
}

function find(node, predicate) {
  const element = descendants(node).find(predicate);
  assert.ok(element, "Expected Header element was not rendered");
  return element;
}

function assertFullSearch(harness, query) {
  assert.equal(harness.navigations.length, 1);
  assert.equal(harness.navigations[0].to, "/seminovos");
  assert.equal(harness.navigations[0].search.busca, query);
}

test("mobile Enter searches the complete inventory query without choosing the first suggestion", () => {
  const harness = createHarness();
  const query = "hatch até 100 mil";
  harness.type(query);
  const suggestions = descendants(harness.render()).filter((element) => element.props.onMouseEnter);
  assert.equal(suggestions.length, 2, "Fixture must produce actual matching suggestions");
  assert.equal(harness.key("Enter"), true);
  assertFullSearch(harness, query);
});

test("an explicit ArrowDown selection followed by Enter opens the selected car", () => {
  const harness = createHarness();
  harness.type("hatch até 100 mil");
  assert.equal(harness.key("ArrowDown"), true);
  assert.equal(harness.key("ArrowDown"), true);
  harness.key("Enter");
  assert.equal(harness.navigations.length, 1);
  assert.equal(harness.navigations[0].to, `/veiculo/${slug.generateVehicleSlug(vehicles[1])}`);
});

test("typing after arrow navigation removes the stale suggestion selection", () => {
  const harness = createHarness();
  harness.type("hatch");
  harness.key("ArrowDown");
  harness.type("hatch até 100 mil");
  harness.key("Enter");
  assertFullSearch(harness, "hatch até 100 mil");
});

test("Escape closes suggestions and Enter returns to the complete query", () => {
  const harness = createHarness();
  harness.type("hatch até 100 mil");
  harness.key("ArrowDown");
  harness.key("Escape");
  harness.key("Enter");
  assertFullSearch(harness, "hatch até 100 mil");
});

test("ArrowUp can clear the first selection instead of forcing a vehicle visit", () => {
  const harness = createHarness();
  harness.type("hatch até 100 mil");
  harness.key("ArrowDown");
  harness.key("ArrowUp");
  harness.key("Enter");
  assertFullSearch(harness, "hatch até 100 mil");
});
