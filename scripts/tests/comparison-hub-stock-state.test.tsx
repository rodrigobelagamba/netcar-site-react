import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import TestRenderer, { act } from "react-test-renderer";
import * as icons from "lucide-react";
import ts from "typescript";
import type { Vehicle } from "../../src/catalog/endpoints/vehicles";
import comparison from "../../src/data/seo/comparison.json";
import { matchesComparisonSearch } from "../../src/lib/vehicleComparisons";

type HubModule = typeof import("../../src/modules/seo/pages/ComparadorPage");
type StockState = {
  data?: Vehicle[];
  isLoading?: boolean;
  isError?: boolean;
  isFetching?: boolean;
};

const car = {
  id: "81001",
  name: "Honda HR-V EX",
  marca: "HONDA",
  modelo: "HR-V EX",
  year: 2022,
  price: 129_900,
} as Vehicle;

const source = ts.transpileModule(
  readFileSync(
    new URL("../../src/modules/seo/pages/ComparadorPage.tsx", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  },
).outputText;

// Exercise the real hub state and retry handler. Keep remote queries, navigation
// and unrelated child components isolated; no requests or analytics are sent.
function loadHub(initial: StockState) {
  let state = initial;
  let refetchResult: Promise<unknown> = Promise.resolve({});
  const refetchCalls: unknown[] = [];
  const empty = () => null;
  const dependencies: Record<string, unknown> = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": icons,
    "@tanstack/react-router": {
      useSearch: () => ({}),
      Link: ({
        to,
        params = {},
        search: _search,
        children,
        ...rest
      }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
        to: string;
        params?: Record<string, string>;
        search?: unknown;
      }) => (
        <a
          href={to.replace(/\$(\w+)/g, (_, key) => params[key] || "")}
          {...rest}
        >
          {children}
        </a>
      ),
    },
    "@/catalog/queries/useVehiclesQuery": {
      useVehiclesQuery: () => ({
        data: undefined,
        isLoading: false,
        isError: false,
        isFetching: false,
        ...state,
        refetch: (options: unknown) => {
          refetchCalls.push(options);
          return refetchResult;
        },
      }),
    },
    "@/catalog/queries/useSiteQuery": {
      useWhatsAppQuery: () => ({ data: undefined }),
    },
    "@/hooks/useMetaTags": { useMetaTags: () => {} },
    "@/design-system/components/layout/LazyLocalizacao": {
      LazyLocalizacao: empty,
    },
    "@/design-system/components/layout/IanBot": { IanBot: empty },
    "@/design-system/components/patterns/VehicleWarrantySummary": {
      VehicleWarrantySummary: empty,
    },
    "@/lib/seminovos-search": { emptySeminovosSearch: {} },
    "@/modules/seo/components/RegionalTrustSignals": {
      RegionalTrustSignals: empty,
    },
    "@/lib/analytics": {
      resetComparisonTracking: () => {},
      trackCompareInteraction: () => {},
    },
    "@/lib/comparisonContact": {
      comparisonVehicleLabel: (vehicle: Vehicle) => vehicle.name,
    },
    "@/lib/slug": { generateVehicleSlug: (vehicle: Vehicle) => vehicle.id },
    "@/lib/vehicleComparisons": {
      comparisonDefinitions: [],
      matchesComparisonSearch,
    },
    "../components/ComparisonVehicleImage": { ComparisonVehicleImage: empty },
    "../components/VehicleComparisonTable": {
      VehicleComparisonTable: empty,
      comparisonPrice: (vehicle: Vehicle) => String(vehicle.price),
    },
    "../components/ComparisonGuide": { ComparisonGuide: empty },
    "@/data/seo/comparison.json": { default: comparison },
    "./comparador.css": {},
  };
  const exports: Record<string, unknown> = {};
  runInNewContext(source, {
    exports,
    require: (name: string) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return {
    Component: (exports as HubModule).ComparadorPage,
    refetchCalls,
    setState: (next: StockState) => {
      state = next;
    },
    setRefetchResult: (result: Promise<unknown>) => {
      refetchResult = result;
    },
  };
}

test("failed stock without cached cars offers retry instead of false empty search", () => {
  const { Component } = loadHub({ isError: true });
  const html = renderToStaticMarkup(<Component />);
  assert.match(html, /role="status">Estoque temporariamente indisponível/);
  assert.match(html, /Não foi possível carregar os carros agora/);
  assert.match(html, /Tentar novamente/);
  assert.doesNotMatch(
    html,
    /0 carros disponíveis|Nenhum carro encontrado|Limpar busca/,
  );
});

test("initial loading keeps the existing loading state without retry or empty search", () => {
  const { Component } = loadHub({ isLoading: true, isFetching: true });
  const html = renderToStaticMarkup(<Component />);
  assert.match(html, /Carregando estoque/);
  assert.match(html, /aria-busy="true"/);
  assert.doesNotMatch(
    html,
    /Tentar novamente|Nenhum carro encontrado|0 carros disponíveis/,
  );
});

test("failed background refresh preserves cached cars and selection controls", () => {
  const { Component } = loadHub({ data: [car], isError: true });
  const html = renderToStaticMarkup(<Component />);
  assert.match(html, /1 carros disponíveis para comparar/);
  assert.match(html, /HR-V EX/);
  assert.match(html, /Adicionar à comparação/);
  assert.doesNotMatch(
    html,
    /Estoque temporariamente indisponível|Tentar novamente/,
  );
});

test("retry is announced, cannot repeat while pending and restores cars on success", async () => {
  const hub = loadHub({ isError: true });
  const { Component } = hub;
  let finishRetry!: () => void;
  hub.setRefetchResult(
    new Promise<void>((resolve) => {
      finishRetry = resolve;
    }),
  );
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<Component />);
  });
  const retryButton = () =>
    renderer.root
      .findAllByType("button")
      .find((button) =>
        /Tentar novamente|Tentando novamente/.test(button.children.join("")),
      )!;

  act(() => retryButton().props.onClick());
  assert.equal(hub.refetchCalls.length, 1);
  assert.equal(
    (hub.refetchCalls[0] as { throwOnError: boolean }).throwOnError,
    false,
  );
  assert.equal(retryButton().props.disabled, true);
  assert.equal(retryButton().children.join(""), "Tentando novamente…");
  assert.equal(
    renderer.root.findByProps({ role: "status" }).children.join(""),
    "Carregando estoque…",
  );
  act(() => retryButton().props.onClick());
  assert.equal(hub.refetchCalls.length, 1);

  // TanStack clears the error when a retry starts. The pending retry must not
  // flicker into the empty-search state or offer an enabled duplicate request.
  hub.setState({ isLoading: true, isFetching: true });
  act(() => renderer.update(<Component />));
  assert.equal(retryButton().props.disabled, true);
  assert.doesNotMatch(
    JSON.stringify(renderer.toJSON()),
    /Nenhum carro encontrado/,
  );

  await act(async () => {
    hub.setState({ data: [car] });
    renderer.update(<Component />);
    finishRetry();
  });
  assert.equal(retryButton(), undefined);
  assert.match(JSON.stringify(renderer.toJSON()), /HR-V EX/);
  act(() => renderer.unmount());
});

test("a failed retry returns an enabled retry action without claiming stock is empty", async () => {
  const hub = loadHub({ isError: true });
  const { Component } = hub;
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<Component />);
  });
  await act(async () => {
    renderer.root
      .findAllByType("button")
      .find((button) => button.children.includes("Tentar novamente"))!
      .props.onClick();
  });
  const button = renderer.root
    .findAllByType("button")
    .find((candidate) => candidate.children.includes("Tentar novamente"))!;
  assert.equal(button.props.disabled, false);
  assert.equal(hub.refetchCalls.length, 1);
  assert.doesNotMatch(
    JSON.stringify(renderer.toJSON()),
    /0 carros disponíveis|Nenhum carro encontrado/,
  );
  act(() => renderer.unmount());
});
