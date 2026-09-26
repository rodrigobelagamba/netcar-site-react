import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { Vehicle } from "../../src/catalog/endpoints/vehicles";
import { isAvailableHomeStockVehicle } from "../../src/lib/homeStock";
import { sortShowroomVehicles } from "../../src/lib/showroomStock";
import { emptySeminovosSearch } from "../../src/lib/seminovos-search";

type QueryState = {
  data?: Vehicle[];
  isLoading?: boolean;
  isError?: boolean;
  isFetching?: boolean;
};

function vehicle(id: string, modelo: string, price = 79_900): Vehicle {
  return {
    id,
    modelo,
    name: modelo,
    marca: "TEST",
    price,
    year: 2024,
    km: 10_000,
    imagens_site: { tem_fotos: 1 },
  } as Vehicle;
}

// Execute the real component with an isolated query response and UI leaves.
// No network request, analytics call or browser navigation happens here.
function renderPreview(state: QueryState, props: Record<string, unknown> = {}) {
  const calls: unknown[][] = [];
  let retryCount = 0;
  const dependencies: Record<string, unknown> = {
    react: { ...React, useMemo: (calculate: () => unknown) => calculate() },
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": { ArrowRight: "svg" },
    "@tanstack/react-router": {
      Link: ({ children, to, search, ...rest }: any) => (
        <a href={to} data-test-search={JSON.stringify(search)} {...rest}>
          {children}
        </a>
      ),
    },
    "@/catalog/queries/useVehiclesQuery": {
      useVehiclesQuery: (...args: unknown[]) => {
        calls.push(args);
        return {
          isLoading: false,
          isError: false,
          isFetching: false,
          ...state,
          refetch: () => {
            retryCount += 1;
          },
        };
      },
    },
    "@/design-system/components/patterns/VehicleCard": {
      VehicleCard: ({ id, whatsAppSource, showWhatsAppInterest }: any) => (
        <article
          data-vehicle-id={id}
          data-wa-source={whatsAppSource}
          data-interest={showWhatsAppInterest}
        />
      ),
    },
    "@/lib/seminovos-search": { emptySeminovosSearch },
    "@/lib/homeStock": { isAvailableHomeStockVehicle },
    "@/lib/showroomStock": { sortShowroomVehicles },
  };
  const source = readFileSync(
    new URL(
      "../../src/modules/seo/components/RegionalStockPreview.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const exports: Record<string, any> = {};
  runInNewContext(outputText, {
    exports,
    require: (name: string) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  const element = exports.RegionalStockPreview(props);
  return {
    html: renderToStaticMarkup(element),
    element,
    calls,
    get retryCount() {
      return retryCount;
    },
  };
}

function findElement(node: React.ReactNode, type: string): any {
  if (!React.isValidElement<Record<string, any>>(node)) return undefined;
  if (node.type === type) return node;
  for (const child of React.Children.toArray(node.props.children)) {
    const result = findElement(child, type);
    if (result) return result;
  }
  return undefined;
}

test("regional preview requests fresh full stock and sorts before applying the limit", () => {
  const result = renderPreview(
    {
      data: [
        vehicle("3", "POLO"),
        vehicle("1", "ARGO"),
        vehicle("2", "KICKS"),
        vehicle("4", "A3", 0),
      ],
    },
    { limit: 2 },
  );
  assert.equal(
    JSON.stringify(result.calls),
    JSON.stringify([[{ fetchAll: true }, { refreshImmediately: true }]]),
  );
  assert.deepEqual(
    [...result.html.matchAll(/data-vehicle-id="([^"]+)"/g)].map(
      (match) => match[1],
    ),
    ["1", "2"],
  );
  assert.match(result.html, /data-wa-source="regional_stock"/);
  assert.match(result.html, /data-interest="true"/);
  assert.match(result.html, /data-regional-action="view_stock_more"/);
});

test("empty bootstrap refreshing shows loading, not a claim of no inventory", () => {
  const { html } = renderPreview({ data: [], isFetching: true });
  assert.match(html, /Carregando estoque/);
  assert.doesNotMatch(html, /Não há veículos|Nenhum veículo/);
});

test("a failed first load is distinguishable from a successful empty result and can retry", () => {
  const failed = renderPreview({ isError: true });
  assert.match(failed.html, /Não foi possível carregar o estoque/);
  assert.doesNotMatch(failed.html, /Não há veículos|Nenhum veículo/);
  findElement(failed.element, "button").props.onClick();
  assert.equal(failed.retryCount, 1);
  const empty = renderPreview({ data: [] });
  assert.match(empty.html, /Não há veículos para exibir nesta seleção/);
  assert.doesNotMatch(empty.html, /Não foi possível/);
});

test("refresh failure preserves prior cards with a warning and disables a pending retry", () => {
  const result = renderPreview({
    data: [vehicle("1", "ARGO")],
    isError: true,
    isFetching: true,
  });
  assert.match(result.html, /data-vehicle-id="1"/);
  assert.match(result.html, /Não foi possível atualizar o estoque/);
  assert.match(result.html, /confirme a disponibilidade com a equipe/);
  assert.doesNotMatch(result.html, /Não há veículos|Nenhum veículo/);
  assert.equal(findElement(result.element, "button").props.disabled, true);
});

test("regional focus adds Nova Santa Rita once without removing the existing markets", () => {
  const focus = JSON.parse(
    readFileSync(
      new URL("../../src/data/seo/regional-focus.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(focus.citySlugs, [
    "canoas",
    "sapucaia-do-sul",
    "nova-santa-rita",
    "sao-leopoldo",
    "gravatai",
  ]);
  const generator = readFileSync(
    new URL("../generate-seo-assets.js", import.meta.url),
    "utf8",
  );
  const runtime = readFileSync(
    new URL("../../src/data/seo/index.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    generator,
    /const regionalFocusSlugs = regionalFocus\.citySlugs/,
  );
  assert.match(
    runtime,
    /nearbyPriorityCityPages = regionalFocusJson\.citySlugs/,
  );
});

test("regional filter links do not advertise build-time counts as current inventory", () => {
  const source = readFileSync(
    new URL(
      "../../src/modules/seo/components/RegionalCrossLinks.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.doesNotMatch(source, /landing\.count/);
  assert.match(
    source,
    /data-regional-action=\{`city_inventory_\$\{landing\.slug\}`\}/,
  );
});

test("buy and sell crawler previews preserve the same filtered A–Z stock order", () => {
  const source = readFileSync(
    new URL("../generate-seo-assets.js", import.meta.url),
    "utf8",
  );
  const sections = [
    ...source.matchAll(/<section id="estoque-regional">[\s\S]*?<\/section>/g),
  ];
  assert.equal(
    sections.length,
    2,
    "Both regional buy and sell previews must be covered",
  );
  for (const [section] of sections) {
    assert.match(
      section,
      /vehicles:\s*landingStockOrder\(stock\.filter\(hasHomePhoto\)\)/,
    );
    assert.match(section, /preserveOrder:\s*true/);
    assert.match(section, /limit:\s*8/);
  }

  // Run the generator's own pure functions without running its network/build steps.
  const ast = ts.createSourceFile(
    "generate-seo-assets.js",
    source,
    ts.ScriptTarget.ES2020,
    true,
    ts.ScriptKind.JS,
  );
  const functionNames = [
    "hasHomePhoto",
    "landingStockOrder",
    "regionalInventoryHtml",
    "escapeHtml",
  ];
  const functions = functionNames.map((name) => {
    const statement = ast.statements.find(
      (node) => ts.isFunctionDeclaration(node) && node.name?.text === name,
    );
    assert.ok(statement, `Generator function missing: ${name}`);
    return statement.getText(ast);
  });
  const generator = runInNewContext(
    `${functions.join("\n")}\n({ ${functionNames.join(", ")} })`,
    {
      SITE: "https://www.netcarmultimarcas.com.br",
      regionalInventorySlugs: ["automaticos-ate-80-mil", "suv", "hatch"],
      landings: [
        {
          slug: "automaticos-ate-80-mil",
          name: "Automáticos até R$ 80 mil",
          count: 777,
          indexable: true,
        },
        { slug: "suv", name: "SUVs", count: 0, indexable: true },
        { slug: "hatch", name: "Hatches", count: 3, indexable: false },
      ],
    },
  );
  const fixtures = [
    vehicle("3", "POLO"),
    vehicle("1", "ARGO"),
    vehicle("2", "KICKS"),
    vehicle("4", "A3", 0),
    { ...vehicle("5", "A1"), imagens_site: { tem_fotos: 0 } },
    { ...vehicle("6", "A2"), imagens_site: undefined },
    { ...vehicle("7", "A4"), modelo: "", marca: "AUDI", name: "AUDI A4" },
  ] as Vehicle[];
  const crawlerIds = generator
    .landingStockOrder(
      fixtures
        .map((item) => ({ ...item, valor: item.price }))
        .filter(generator.hasHomePhoto),
    )
    .map((item: Vehicle) => item.id);
  const runtimeIds = sortShowroomVehicles(
    fixtures.filter(isAvailableHomeStockVehicle),
    "az",
  ).map((item) => item.id);
  assert.equal(JSON.stringify(crawlerIds), JSON.stringify(runtimeIds));
  assert.deepEqual(runtimeIds, ["7", "1", "2", "3"]);

  const nav = generator.regionalInventoryHtml("Nova Santa Rita");
  assert.match(
    nav,
    /href="https:\/\/www.netcarmultimarcas.com.br\/comprar-automaticos-ate-80-mil"/,
  );
  assert.match(nav, /Automáticos até R\$ 80 mil/);
  assert.doesNotMatch(nav, /777|\d+ no estoque|comprar-suv|comprar-hatch/);
});
