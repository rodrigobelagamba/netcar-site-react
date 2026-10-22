import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import TestRenderer, { act } from "react-test-renderer";
import ts from "typescript";
import type { Vehicle } from "../../src/catalog/endpoints/vehicles";
import { sortShowroomVehicles } from "../../src/lib/showroomStock";
import { emptySeminovosSearch } from "../../src/lib/seminovos-search";
import {
  resolveLandingFaq,
  resolveLandingParagraphs,
} from "../../src/lib/landingStockCopy.mjs";
import { marcaLanding } from "../generate-landings.js";

type State = {
  data?: Vehicle[];
  isLoading?: boolean;
  isError?: boolean;
  isFetching?: boolean;
};
const landing = marcaLanding(
  "CHERY",
  4,
  {
    minPrice: "R$ 137.900",
    maxPrice: "R$ 151.900",
    minYear: 2023,
    maxYear: 2025,
  },
  6,
);

const stock = [
  {
    id: "101",
    price: 137900,
    year: 2023,
    name: "Tiggo A",
    modelo: "Tiggo A",
    marca: "CHERY",
  },
  {
    id: "102",
    price: 151900,
    year: 2025,
    name: "Tiggo B",
    modelo: "Tiggo B",
    marca: "CHERY",
  },
  {
    id: "103",
    price: 149900,
    year: 2024,
    name: "Tiggo C",
    modelo: "Tiggo C",
    marca: "CHERY",
  },
  {
    id: "104",
    price: 149900,
    year: 2024,
    name: "Tiggo D",
    modelo: "Tiggo D",
    marca: "CHERY",
  },
] as Vehicle[];

const source = ts.transpileModule(
  readFileSync(
    new URL(
      "../../src/modules/seo/pages/EstoqueLandingPage.tsx",
      import.meta.url,
    ),
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

// Mount the real page and effects; isolate only query transport and UI leaves.
// The mutable query state models bootstrap -> API refresh in a single mount.
function loadPage(initial: State) {
  let state = initial;
  const scripts = new Map<
    string,
    { textContent: string; key: string; remove(): void }
  >();
  let retries = 0;
  const empty = () => null;
  const deps: Record<string, unknown> = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": { ArrowRight: "svg" },
    "@tanstack/react-router": {
      useParams: () => ({ landingSlug: "chery" }),
      Link: ({ children }: any) => <a>{children}</a>,
    },
    "@/data/seo": {
      getLandingPage: () => landing,
      getRelatedLandingPages: () => [],
      matchesLandingFilters: (vehicle: Vehicle) => vehicle.marca === "CHERY",
    },
    "@/hooks/useMetaTags": { useMetaTags: empty },
    "@/catalog/queries/useVehiclesQuery": {
      useVehiclesQuery: () => ({
        isError: false,
        isLoading: false,
        isFetching: false,
        ...state,
        refetch: () => {
          retries += 1;
        },
      }),
    },
    "@/design-system/components/patterns/VehicleCard": {
      VehicleCard: ({ id, price }: any) => (
        <article data-vehicle-id={id} data-price={price} />
      ),
    },
    "@/design-system/components/layout/LazyLocalizacao": {
      LazyLocalizacao: empty,
    },
    "@/design-system/components/layout/IanBot": { IanBot: empty },
    "@/components/NotFoundRedirect": { NotFoundRedirect: empty },
    "@/lib/seminovos-search": { emptySeminovosSearch },
    "@/modules/seo/components/RegionalActionCtas": {
      RegionalActionCtas: empty,
    },
    "@/modules/seo/components/RegionalTrustSignals": {
      RegionalTrustSignals: empty,
    },
    "@/modules/seo/components/RegionalSeoHero": { RegionalSeoHero: empty },
    "@/modules/seo/components/RegionalCrossLinks": { NearbyMarketsNav: empty },
    "@/lib/slug": { generateVehicleSlug: (vehicle: Vehicle) => vehicle.id },
    "@/lib/showroomStock": { sortShowroomVehicles },
    "@/lib/landingStockCopy.mjs": {
      resolveLandingFaq,
      resolveLandingParagraphs,
    },
  };
  const exports: Record<string, any> = {};
  runInNewContext(source, {
    exports,
    require: (name: string) => {
      assert.ok(name in deps, `Unexpected dependency ${name}`);
      return deps[name];
    },
    document: {
      querySelector: (selector: string) =>
        scripts.get(selector.match(/data-schema="([^"]+)"/)?.[1] || ""),
      createElement: () => {
        const script = {
          key: "",
          textContent: "",
          setAttribute(_name: string, value: string) {
            script.key = value;
          },
          remove() {
            scripts.delete(script.key);
          },
        };
        return script;
      },
      head: { appendChild: (script: any) => scripts.set(script.key, script) },
    },
  });
  return {
    Component: exports.EstoqueLandingPage,
    setState(next: State) {
      state = next;
    },
    schema(key: string) {
      return JSON.parse(scripts.get(key)!.textContent);
    },
    retries: () => retries,
  };
}

function text(renderer: TestRenderer.ReactTestRenderer) {
  return JSON.stringify(renderer.toJSON());
}

test("mounted landing replaces sold bootstrap card and price/year range together, then tracks a price change", () => {
  const page = loadPage({ data: stock, isFetching: true });
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<page.Component />);
  });
  assert.match(text(renderer), /R\$ 151\.900/);
  assert.equal(renderer.root.findAllByType("article").length, 4);

  const fresh = stock.map((vehicle) =>
    vehicle.id === "102" ? { ...vehicle, price: 0 } : vehicle,
  );
  act(() => {
    page.setState({ data: fresh });
    renderer.update(<page.Component />);
  });
  assert.equal(renderer.root.findAllByType("article").length, 3);
  assert.doesNotMatch(text(renderer), /151\.900|2025/);
  assert.match(text(renderer), /R\$ 137\.900 a R\$ 149\.900/);
  assert.match(text(renderer), /2023 a 2024/);
  const schema = page.schema("landing-page");
  assert.equal(schema.mainEntity.numberOfItems, 3);
  assert.deepEqual(
    schema.mainEntity.itemListElement.map((item: any) =>
      item.url.split("/").pop(),
    ),
    ["101", "103", "104"],
  );

  act(() => {
    page.setState({
      data: fresh.map((vehicle) =>
        vehicle.id === "104"
          ? { ...vehicle, price: 146900 }
          : vehicle.id === "103"
            ? { ...vehicle, price: 145900 }
            : vehicle,
      ),
    });
    renderer.update(<page.Component />);
  });
  assert.match(text(renderer), /R\$ 137\.900 a R\$ 146\.900/);
  assert.doesNotMatch(text(renderer), /149\.900|151\.900/);
  act(() => renderer.unmount());
});

test("failed refresh and confirmed empty selection remain distinct without stale ranges or FAQ claims", () => {
  const page = loadPage({ data: stock });
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<page.Component />);
  });
  act(() => {
    page.setState({ data: stock, isError: true });
    renderer.update(<page.Component />);
  });
  assert.equal(renderer.root.findAllByType("article").length, 4);
  assert.match(text(renderer), /Não foi possível atualizar o estoque/);
  assert.doesNotMatch(text(renderer), /151\.900|Nenhum veículo anunciado/);
  assert.equal(page.schema("landing-page").mainEntity, undefined);
  assert.match(
    page.schema("landing-faq").mainEntity[0].acceptedAnswer.text,
    /Consulte o estoque atualizado/,
  );
  act(() => renderer.root.findByType("button").props.onClick());
  assert.equal(page.retries(), 1);

  act(() => {
    page.setState({ data: [] });
    renderer.update(<page.Component />);
  });
  assert.equal(renderer.root.findAllByType("article").length, 0);
  assert.match(text(renderer), /Nenhum veículo anunciado nesta seleção/);
  assert.doesNotMatch(text(renderer), /151\.900|Não foi possível atualizar/);
  assert.equal(page.schema("landing-page").mainEntity.numberOfItems, 0);

  act(() => {
    page.setState({ isLoading: true, isFetching: true });
    renderer.update(<page.Component />);
  });
  assert.match(text(renderer), /Carregando estoque/);
  assert.doesNotMatch(text(renderer), /151\.900|Nenhum veículo anunciado/);
  act(() => renderer.unmount());
});
