import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "lucide-react";
import ts from "typescript";
import type { Vehicle } from "../../src/catalog/endpoints/vehicles";
import definitions from "../../src/data/seo/comparisons.json";
import {
  comparisonCandidates,
  comparisonDefinitions,
  closestComparisonPair,
  normalizeComparisonText,
  matchesComparisonSearch,
} from "../../src/lib/vehicleComparisons";
import {
  comparisonVehicleLabel,
  comparisonWhatsAppMessage,
} from "../../src/lib/comparisonContact";
import { resolvedVehicleCategory } from "../../src/lib/vehicleCategory";
import { generateVehicleSlug } from "../../src/lib/slug";
import { buildWhatsAppUrl } from "../../src/lib/whatsappMessages";
import { ComparisonVehicleImage } from "../../src/modules/seo/components/ComparisonVehicleImage";

type LandingModule =
  typeof import("../../src/modules/seo/pages/ComparisonLandingPage");
type QueryState = {
  data?: Vehicle[];
  isLoading?: boolean;
  isError?: boolean;
};

function vehicle(id: string, overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id,
    name: "Honda HR-V EX",
    marca: "HONDA",
    modelo: "HR-V EX",
    slug: `honda-hr-v-ex-2022-${id}`,
    year: 2022,
    price: 129_900,
    km: 42_321,
    preco_com_troca: 149_789,
    images: [`/images/comparison-unit-${id}.jpg`],
    cambio: "Automático",
    motor: "1.8",
    combustivel: "Flex",
    potencia: "140 cv",
    portas: 4,
    cor: "Branco",
    categoria: "SUV",
    ...overrides,
  };
}

const compass = vehicle("81001", {
  name: "Jeep Compass Longitude",
  marca: "JEEP",
  modelo: "COMPASS LONGITUDE",
  slug: "jeep-compass-longitude-2022-81001",
  price: 128_900,
});
const hrv = vehicle("81002");
const firstDefinition = comparisonDefinitions[0];

function transpile(path: string) {
  return ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
}

const tableSource = transpile(
  "../../src/modules/seo/components/VehicleComparisonTable.tsx",
);
const landingSource = transpile(
  "../../src/modules/seo/pages/ComparisonLandingPage.tsx",
);

// Render the actual landing, table, image and selection helpers. Only routing,
// remote query state, metadata side effects and analytics are isolated.
function renderLanding(
  query: QueryState = { data: [compass, hrv] },
  slug = firstDefinition.slug,
) {
  const metadata: Record<string, unknown>[] = [];
  const dependencies: Record<string, unknown> = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": icons,
    "@tanstack/react-router": {
      useParams: () => ({ comparisonSlug: slug }),
      useNavigate: () => () => {},
      Link: ({
        to,
        params = {},
        children,
        ...rest
      }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
        to: string;
        params?: Record<string, string>;
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
        ...query,
      }),
    },
    "@/catalog/queries/useSiteQuery": {
      useWhatsAppQuery: () => ({ data: { numero: " (51) 98888-7777 " } }),
    },
    "@/hooks/useMetaTags": {
      useMetaTags: (props: Record<string, unknown>) => metadata.push(props),
    },
    "@/components/NotFoundRedirect": {
      NotFoundRedirect: () => <main data-not-found="true">404</main>,
    },
    "@/lib/analytics": { trackCompareInteraction: () => {} },
    "@/lib/comparisonContact": {
      comparisonVehicleLabel,
      comparisonWhatsAppMessage,
    },
    "@/lib/vehicleCategory": { resolvedVehicleCategory },
    "@/lib/slug": { generateVehicleSlug },
    "@/lib/whatsappMessages": { buildWhatsAppUrl },
    "@/lib/vehicleComparisons": {
      comparisonCandidates,
      comparisonDefinitions,
      closestComparisonPair,
    },
    "./ComparisonVehicleImage": { ComparisonVehicleImage },
    "../components/ComparisonVehicleImage": { ComparisonVehicleImage },
    "./comparador.css": {},
  };
  function loadModule(source: string) {
    const exports: Record<string, unknown> = {};
    runInNewContext(source, {
      exports,
      require: (name: string) => {
        assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
        return dependencies[name];
      },
    });
    return exports;
  }
  dependencies["../components/VehicleComparisonTable"] =
    loadModule(tableSource);
  const { ComparisonLandingPage } = loadModule(landingSource) as LandingModule;
  return {
    html: renderToStaticMarkup(<ComparisonLandingPage />),
    metadata,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
}

function assertEditorial(html: string, definition = firstDefinition) {
  for (const text of [
    definition.h1,
    definition.intro,
    definition.stockNote,
    ...definition.sections.flatMap((section) => [section.title, section.text]),
    ...definition.checks,
  ]) {
    assert.ok(
      html.includes(escapeHtml(text)),
      `Missing editorial copy: ${text}`,
    );
  }
}

test("pair definitions use the shared four-page JSON contract", () => {
  assert.equal(comparisonDefinitions.length, 4);
  assert.deepEqual(comparisonDefinitions, definitions);
  assert.equal(new Set(comparisonDefinitions.map((item) => item.slug)).size, 4);
});

test("model matching accepts HR-V and T-Cross punctuation without crossing brands", () => {
  assert.equal(normalizeComparisonText("  Hónda — HR-V  "), "HONDA HR V");
  const hrvForms = ["HR-V EX", "HRV LX", "HR V TOURING", "HR.V EXL"];
  const tcrossForms = ["T-CROSS HIGHLINE", "T CROSS SENSE", "TCROSS 200 TSI"];
  const stock = [
    ...hrvForms.map((modelo, index) => vehicle(`h${index}`, { modelo })),
    ...tcrossForms.map((modelo, index) =>
      vehicle(`t${index}`, { marca: "VOLKSWAGEN", modelo }),
    ),
    vehicle("other-brand", { marca: "JEEP", modelo: "HR-V" }),
    vehicle("other-model", { modelo: "CR-V" }),
    vehicle("name-fallback", { modelo: undefined, name: "Honda HR-V EX" }),
  ];
  assert.deepEqual(
    comparisonCandidates(stock, firstDefinition.right).map((item) => item.id),
    ["h0", "h1", "h2", "h3", "name-fallback"],
  );
  assert.deepEqual(
    comparisonCandidates(stock, comparisonDefinitions[3].right).map(
      (item) => item.id,
    ),
    ["t0", "t1", "t2"],
  );
});

test("comparator search ignores model spacing, punctuation and accents", () => {
  const honda = vehicle("hrv", { modelo: "HRV EX" });
  const vw = vehicle("tcross", { marca: "VOLKSWAGEN", modelo: "T CROSS HIGHLINE" });
  for (const query of ["HR-V", "hr v", "Hónda HRV", ""]) {
    assert.equal(matchesComparisonSearch(honda, query), true);
  }
  for (const query of ["TCross", "t-cross", "Volkswagen T Cross"]) {
    assert.equal(matchesComparisonSearch(vw, query), true);
  }
  assert.equal(matchesComparisonSearch(honda, "CR-V"), false);
  assert.equal(matchesComparisonSearch(vw, "Fiat T Cross"), false);
});

test("only finite positive announced prices qualify for permanent pairs", () => {
  const stock = [
    vehicle("valid"),
    ...[0, -1, Number.NaN, Infinity, -Infinity].map((price, index) =>
      vehicle(`invalid-${index}`, { price }),
    ),
    vehicle("missing", { price: undefined as unknown as number }),
    vehicle("string", { price: "129900" as unknown as number }),
  ];
  assert.deepEqual(
    comparisonCandidates(stock, firstDefinition.right).map((item) => item.id),
    ["valid"],
  );
});

test("closest pair examines all candidates, preserves inputs and never repeats a unit", () => {
  const left = [compass, { ...compass, id: "81003", price: 149_000 }];
  const right = [hrv, { ...hrv, id: "81004", price: 148_900 }];
  const before = JSON.stringify({ left, right });
  assert.deepEqual(closestComparisonPair(left, right), {
    left: left[1],
    right: right[1],
    difference: 100,
  });
  assert.equal(JSON.stringify({ left, right }), before);
  assert.equal(closestComparisonPair([compass], [compass]), undefined);
  assert.equal(closestComparisonPair([], right), undefined);
  assert.equal(closestComparisonPair(left, []), undefined);
});

test("all four permanent pages retain shared editorial copy and crawlable related links", () => {
  for (const definition of comparisonDefinitions) {
    const { html, metadata } = renderLanding({ data: [] }, definition.slug);
    assertEditorial(html, definition);
    assert.equal(metadata[0].title, definition.title);
    assert.equal(metadata[0].description, definition.description);
    assert.equal(
      metadata[0].url,
      `https://www.netcarmultimarcas.com.br/comparar/${definition.slug}`,
    );
    assert.equal(metadata[0].robots, undefined);
    const related = html.match(
      /<nav\b[^>]*aria-label="Outras comparações prontas"[\s\S]*?<\/nav>/,
    )?.[0];
    assert.ok(related, "Related comparisons must have a navigation landmark");
    for (const other of comparisonDefinitions) {
      const href = `href="/comparar/${other.slug}"`;
      assert.equal(related.includes(href), other.slug !== definition.slug);
    }
    assert.ok(related.includes('href="/comparar"'));
    assert.doesNotMatch(related, /\$comparisonSlug|href="#"/);
  }
});

test("permanent pair shows the closest actual units without remove, mileage or trade controls", () => {
  const closerHrv = { ...hrv, id: "81005", price: 129_000 };
  const { html } = renderLanding({ data: [compass, hrv, closerHrv] });
  assertEditorial(html);
  assert.match(html, /<table\b/);
  assert.match(html, /Cód\. 81001/);
  assert.match(html, /Cód\. 81005/);
  assert.doesNotMatch(html, /Cód\. 81002/);
  assert.match(html, /R\$ 128\.900/);
  assert.match(html, /R\$ 129\.000/);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /Só diferenças/);
  assert.equal([...html.matchAll(/<img\b/g)].length, 2);
  for (const selected of [compass, closerHrv]) {
    assert.ok(
      html.includes(`href="/veiculo/${generateVehicleSlug(selected)}"`),
    );
  }
  assert.doesNotMatch(html, /aria-label="Remover|Adicionar carro/);
  assert.doesNotMatch(
    html,
    /quilometragem|\bkm\b|42\.321|preço com troca|149\.789/i,
  );
});

test("one missing model shows only its available counterpart and keeps the full guide", () => {
  for (const available of [compass, hrv]) {
    const { html } = renderLanding({ data: [available] });
    assertEditorial(html);
    assert.match(html, /Ainda não há duas opções disponíveis para este par/);
    assert.doesNotMatch(html, /<table\b/);
    assert.equal([...html.matchAll(/<img\b/g)].length, 1);
    assert.ok(
      html.includes(`href="/veiculo/${generateVehicleSlug(available)}"`),
    );
    const absent = available.id === compass.id ? hrv : compass;
    assert.ok(!html.includes(`href="/veiculo/${generateVehicleSlug(absent)}"`));
  }
});

test("empty, loading and failed stock never invent cars or prices and keep editorial content", () => {
  const cases = [
    {
      query: { data: [] },
      message: "Ainda não há duas opções disponíveis para este par",
    },
    {
      query: { isLoading: true },
      message: "Carregando os carros disponíveis…",
    },
    {
      query: { isError: true },
      message: "Não foi possível atualizar o estoque agora",
    },
    {
      query: {
        data: [
          { ...compass, price: 0 },
          { ...hrv, price: Infinity },
        ],
      },
      message: "Ainda não há duas opções disponíveis para este par",
    },
  ];
  for (const { query, message } of cases) {
    const { html } = renderLanding(query);
    assertEditorial(html);
    assert.ok(html.includes(message));
    assert.doesNotMatch(html, /<table\b|<img\b|href="\/veiculo\/|R\$|Cód\./);
  }
});

test("an unknown permanent slug renders NotFound and requests noindex metadata", () => {
  const { html, metadata } = renderLanding(
    { data: [compass, hrv] },
    "modelo-inexistente-x-outro",
  );
  assert.match(html, /data-not-found="true"/);
  assert.doesNotMatch(html, /comparison-hero|<table\b|Continue comparando/);
  assert.equal(metadata[0].robots, "noindex, nofollow");
});
