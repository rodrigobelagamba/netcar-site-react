import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import TestRenderer, { act } from "react-test-renderer";
import ts from "typescript";
import type { Vehicle } from "../../src/catalog/endpoints/vehicles";
import { isAvailableHomeStockVehicle } from "../../src/lib/homeStock";

type State = {
  data?: Vehicle[];
  isLoading?: boolean;
  isFetching?: boolean;
  isError?: boolean;
};

function vehicle(id: string, cambio: string, price = 89900): Vehicle {
  return {
    id,
    name: id,
    modelo: id,
    price,
    year: 2026,
    km: 10000,
    cambio,
    imagens_site: { tem_fotos: 1 },
  } as Vehicle;
}

function loadPage(initial: State) {
  let state = initial;
  let retries = 0;
  const calls: unknown[][] = [];
  const empty = () => null;
  const deps: Record<string, unknown> = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": { ArrowRight: "svg" },
    "@tanstack/react-router": {
      Link: ({ children }: any) => <a>{children}</a>,
    },
    "@/hooks/useDefaultMetaTags": { useDefaultMetaTags: empty },
    "@/catalog/queries/useVehiclesQuery": {
      useVehiclesQuery: (...args: unknown[]) => {
        calls.push(args);
        return {
          ...state,
          refetch: () => {
            retries += 1;
          },
        };
      },
    },
    "@/design-system/components/patterns/VehicleCard": {
      VehicleCard: ({ id, price, km, year }: any) => (
        <article
          data-id={id}
          data-price={price}
          data-km={km}
          data-year={year}
        />
      ),
    },
    "@/design-system/components/layout/LazyLocalizacao": {
      LazyLocalizacao: empty,
    },
    "@/design-system/components/layout/IanBot": { IanBot: empty },
    "@/lib/seminovos-search": { automaticSeminovosSearch: {} },
    "@/lib/homeStock": { isAvailableHomeStockVehicle },
    "@/modules/seo/components/RegionalActionCtas": {
      RegionalActionCtas: empty,
    },
    "@/modules/seo/components/RegionalTrustSignals": {
      RegionalTrustSignals: empty,
    },
    "@/modules/seo/components/RegionalSeoHero": { RegionalSeoHero: empty },
  };
  const source = ts.transpileModule(
    readFileSync(
      new URL(
        "../../src/modules/seo/pages/SeminovosAutomaticosPage.tsx",
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
  const exports: Record<string, any> = {};
  runInNewContext(source, {
    exports,
    require(name: string) {
      assert.ok(name in deps, `Unexpected dependency ${name}`);
      return deps[name];
    },
  });
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<exports.SeminovosAutomaticosPage />);
  });
  return {
    renderer,
    calls,
    retries: () => retries,
    text: () => JSON.stringify(renderer.toJSON()),
    cards: () =>
      renderer.root.findAllByType("article").map((node) => node.props),
    update(next: State) {
      state = next;
      act(() => {
        renderer.update(<exports.SeminovosAutomaticosPage />);
      });
    },
    close() {
      act(() => {
        renderer.unmount();
      });
    },
  };
}

test("automatics reads complete current stock including CVT and reacts to entry, exit and transmission changes", () => {
  const page = loadPage({
    data: [
      vehicle("1", "Automatico"),
      vehicle("2", "CVT"),
      vehicle("3", "Manual"),
      vehicle("4", "Automático"),
    ],
  });
  try {
    assert.equal(
      JSON.stringify(page.calls[0]),
      JSON.stringify([{ fetchAll: true }, { refreshImmediately: true }]),
    );
    assert.deepEqual(
      page.cards().map((card) => card["data-id"]),
      ["1", "2", "4"],
    );
    page.update({
      data: [
        vehicle("2", "Manual"),
        { ...vehicle("5", "CVT", 79900), km: 25000, year: 2024 },
        vehicle("4", "Automático", 0),
      ],
    });
    assert.deepEqual(
      page
        .cards()
        .map((card) => [
          card["data-id"],
          card["data-price"],
          card["data-km"],
          card["data-year"],
        ]),
      [["5", 79900, 25000, 2024]],
    );
    assert.doesNotMatch(page.text(), /vendid/i);
  } finally {
    page.close();
  }
});

test("automatics distinguishes failed refresh, pending empty refresh and confirmed empty selection", () => {
  const page = loadPage({ data: [vehicle("1", "Automatico")] });
  try {
    page.update({ data: [vehicle("1", "Automatico")], isError: true });
    assert.equal(page.cards().length, 0);
    assert.match(page.text(), /Não foi possível atualizar/);
    assert.doesNotMatch(page.text(), /Nenhum automático disponível|89900/);
    act(() => {
      page.renderer.root.findByType("button").props.onClick();
    });
    assert.equal(page.retries(), 1);
    page.update({ data: [], isFetching: true });
    assert.match(page.text(), /Carregando estoque/);
    assert.doesNotMatch(page.text(), /Nenhum automático disponível/);
    page.update({ data: [] });
    assert.match(page.text(), /Nenhum automático disponível/);
  } finally {
    page.close();
  }
});
