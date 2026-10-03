import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import TestRenderer, { act } from "react-test-renderer";
import ts from "typescript";

const path = "src/design-system/components/patterns/SearchBar.tsx";
const source = readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  fileName: path,
  compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});
const brandModule = { exports: {} };
runInNewContext(
  ts.transpileModule(
    readFileSync(new URL("../../src/lib/vehicleBrand.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
  ).outputText,
  { module: brandModule, exports: brandModule.exports },
);
let renderer;

afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
});

async function createHarness() {
  const navigations = [];
  const matches = [];
  const parsedQueries = [];
  let actionCalls = 0;
  const vehicles = [
    { id: "1", marca: "FIAT", modelo: "ARGO", year: 2023 },
    { id: "2", marca: "JEEP", modelo: "COMPASS", year: 2024 },
  ];
  const dependencies = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": new Proxy({}, { get: () => "svg" }),
    "framer-motion": {
      motion: { div: "div" },
      AnimatePresence: React.Fragment,
    },
    "@tanstack/react-router": {
      Link: "router-link",
      useNavigate: () => (route) => navigations.push(route),
      useLocation: () => ({ search: "" }),
    },
    "@/catalog/queries/useVehiclesQuery": {
      useVehiclesQuery: () => ({ data: vehicles }),
    },
    "@/catalog/queries/useStockQuery": {
      useAllStockDataQuery: () => ({ data: { enterprises: ["FIAT", "JEEP", "CHEVROLET"] } }),
    },
    "@/catalog/queries/useSiteQuery": { useWhatsAppQuery: () => ({}) },
    "@/lib/whatsappMessages": {
      buildWhatsAppUrl: () => "#",
      siteWhatsAppMessage: (value) => value,
    },
    "@/lib/seminovos-search": {
      emptySeminovosSearch: { busca: undefined, modelo: undefined },
    },
    "@/lib/vehicleBrand": brandModule.exports,
    "@/lib/vehicleSearch": {
      normalizeVehicleSearch: (value) => value.toLowerCase(),
      parseVehicleSearch: (query) => {
        const parsed = { query };
        parsedQueries.push(parsed);
        return parsed;
      },
      matchesVehicleSearch: (vehicle, query) => {
        matches.push({ id: vehicle.id, query });
        return vehicle.id === "1";
      },
    },
  };
  const module = { exports: {} };
  runInNewContext(outputText, {
    module,
    exports: module.exports,
    URLSearchParams,
    setTimeout: () => {
      throw new Error("Search submission must not depend on timers");
    },
    require: (name) => {
      assert.ok(name in dependencies, `Missing dependency: ${name}`);
      return dependencies[name];
    },
  });
  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(module.exports.SearchBar, {
        onAction: () => actionCalls++,
      }),
    );
  });
  const input = () => renderer.root.findByType("input");
  const type = async (query) => {
    await act(async () => {
      input().props.onFocus();
      input().props.onChange({ target: { value: query } });
    });
  };
  return { navigations, matches, parsedQueries, type, input, actionCalls: () => actionCalls };
}

test("home Enter submits the complete query, not the first matching vehicle", async () => {
  const harness = await createHarness();
  await harness.type("  hatch automático até 100 mil  ");
  let prevented = false;
  await act(async () =>
    harness.input().props.onKeyDown({
      key: "Enter",
      preventDefault: () => {
        prevented = true;
      },
    }),
  );
  assert.equal(prevented, true);
  assert.equal(harness.navigations.at(-1).to, "/seminovos");
  assert.equal(
    harness.navigations.at(-1).search.busca,
    "hatch automático até 100 mil",
  );
  assert.equal(harness.navigations.at(-1).search.modelo, undefined);
  assert.equal(harness.actionCalls(), 1);
});

test("home suggestions use the shared matcher with the whole typed query", async () => {
  const harness = await createHarness();
  await harness.type("hatch até 100mil");
  assert.equal(harness.matches.length, 2);
  assert.equal(harness.parsedQueries.length, 1, "Parse once for all suggestions");
  assert.equal(harness.parsedQueries[0].query, "hatch até 100mil");
  assert.ok(harness.matches.every(({ query }) => query === harness.parsedQueries[0]));
  const labels = renderer.root.findAllByType("button").map((button) =>
    button
      .findAllByType("span")
      .map((span) => span.children.join(""))
      .join(" "),
  );
  assert.ok(labels.some((label) => label.includes("FIAT ARGO")));
  assert.ok(!labels.some((label) => label.includes("JEEP COMPASS")));
});

test("home brand suggestions accept GM and preserve the Chevrolet API filter", async () => {
  const harness = await createHarness();
  await harness.type("GM");
  const suggestion = renderer.root.findAllByType("button").find((button) =>
    button.findAllByType("span").some((span) => span.children.join("") === "CHEVROLET"),
  );
  assert.ok(suggestion);
  await act(async () => suggestion.props.onClick());
  assert.equal(harness.navigations.at(-1).search.marca, "CHEVROLET");
});

test("clicking a complete-query suggestion submits immediately without stale state", async () => {
  const harness = await createHarness();
  await harness.type("até 70 mil");
  await harness.type("até 100mil");
  const suggestion = renderer.root
    .findAllByType("button")
    .find((button) =>
      button
        .findAllByType("span")
        .some((span) => span.children.join("") === "Buscar “até 100mil”"),
    );
  assert.ok(suggestion);
  await act(async () => suggestion.props.onClick());
  assert.equal(harness.navigations.at(-1).search.busca, "até 100mil");
  assert.equal(harness.actionCalls(), 1);
});

test("numeric model names remain text for the shared interpreter", async () => {
  const harness = await createHarness();
  await harness.type("Peugeot 208 2021");
  await act(async () =>
    harness.input().props.onKeyDown({ key: "Enter", preventDefault() {} }),
  );
  assert.equal(harness.navigations.at(-1).search.busca, "Peugeot 208 2021");
  assert.equal(harness.navigations.at(-1).search.precoMax, undefined);
});

test("clicking a vehicle suggestion retains the complete query constraints", async () => {
  const harness = await createHarness();
  const query = "hatch até 100 mil de 2023 até 50 mil km";
  await harness.type(query);
  const suggestion = renderer.root.findAllByType("button").find((button) =>
    button.findAllByType("span").some((span) => span.children.join("") === "FIAT ARGO")
  );
  assert.ok(suggestion);
  await act(async () => suggestion.props.onClick());
  const route = harness.navigations.at(-1);
  assert.equal(route.to, "/seminovos");
  assert.equal(route.search.marca, "FIAT");
  assert.equal(route.search.modelo, "ARGO");
  assert.equal(route.search.busca, query, "Budget, year and mileage must survive selection");
  assert.equal(harness.actionCalls(), 1);
});

test("desktop budget quick filter passes its own value to shared search", async () => {
  const harness = await createHarness();
  await harness.type("suv");
  const budget = renderer.root
    .findAllByType("button")
    .find((button) => button.children.join("") === "Até R$ 100k");
  assert.ok(budget);
  await act(async () => budget.props.onClick());
  assert.equal(harness.navigations.at(-1).search.busca, "Até R$ 100k");
  assert.equal(harness.actionCalls(), 1);
});
