import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import {
  cityPages,
  landingPages,
  regionalInventoryPages,
} from "../../src/data/seo";
import regionalFocus from "../../src/data/seo/regional-focus.json";

function loadComponent(path: string, dependencies: Record<string, unknown>) {
  const source = readFileSync(
    new URL(`../../${path}`, import.meta.url),
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
  return exports;
}

function renderCity(citySlug: string, pages = regionalInventoryPages) {
  const dependencies: Record<string, unknown> = {
    react: { ...React, useEffect: () => {}, useRef: () => ({ current: null }) },
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": new Proxy({}, { get: () => "svg" }),
    "@tanstack/react-router": {
      useParams: () => ({ citySlug }),
      Link: ({ to, params, children, ...rest }: any) => (
        <a
          href={to.replace(
            /\{\$(\w+)\}/g,
            (_: string, key: string) => params[key],
          )}
          {...rest}
        >
          {children}
        </a>
      ),
    },
    "@/data/seo": {
      getCityPage: (slug: string) =>
        cityPages.find((city) => city.slug === slug),
      regionalInventoryPages: pages,
      nearbyPriorityCityPages: [],
    },
    "@/data/seo/regional-focus.json": { default: regionalFocus },
    "@/hooks/useMetaTags": { useMetaTags: () => {} },
    "@/modules/seo/useRegionalPageSchema": { useRegionalPageSchema: () => {} },
    "@/lib/analytics": { trackTrustSectionView: () => {} },
    "@/modules/seo/components/RegionalStockPreview": {
      RegionalStockPreview: () => <section data-test-stock="true" />,
    },
  };
  for (const [path, name] of [
    ["@/design-system/components/layout/LazyLocalizacao", "LazyLocalizacao"],
    ["@/design-system/components/layout/IanBot", "IanBot"],
    ["@/components/NotFoundRedirect", "NotFoundRedirect"],
    ...[
      "RelatedCitiesNav",
      "RegionalActionCtas",
      "RegionalTrustSignals",
      "RegionalBreadcrumbs",
      "RegionalVisitPlanner",
      "RegionalSelectionNote",
    ].map((name) => [`@/modules/seo/components/${name}`, name]),
  ]) {
    dependencies[path] = { [name]: () => null };
  }
  for (const name of ["RegionalCrossLinks", "RegionalSeoHero"]) {
    dependencies[`@/modules/seo/components/${name}`] = loadComponent(
      `src/modules/seo/components/${name}.tsx`,
      dependencies,
    );
  }
  const { CityLandingPage } = loadComponent(
    "src/modules/seo/pages/CityLandingPage.tsx",
    dependencies,
  );
  return renderToStaticMarkup(<CityLandingPage />);
}

test("city pages move four existing budget/category shortcuts before stock without duplicating links", () => {
  const introSlugs = new Set(regionalFocus.inventorySlugs.slice(0, 4));
  for (const city of cityPages) {
    const html = renderCity(city.slug);
    const stockPosition = html.indexOf('data-test-stock="true"');
    assert.ok(stockPosition > 0, `${city.slug}: stock preview missing`);
    assert.ok(
      html.indexOf(`Atalhos por preço e categoria para ${city.name}`) <
        stockPosition,
      `${city.slug}: shortcuts must precede stock`,
    );
    assert.equal(
      (html.match(/data-regional-action="city_inventory_/g) ?? []).length,
      regionalInventoryPages.length,
    );
    for (const landing of regionalInventoryPages) {
      const action = `data-regional-action="city_inventory_${landing.slug}"`;
      assert.equal(
        html.split(action).length - 1,
        1,
        `${city.slug}: ${landing.slug} duplicated`,
      );
      assert.equal(
        html.indexOf(action) < stockPosition,
        introSlugs.has(landing.slug),
        `${city.slug}: ${landing.slug} in the wrong section`,
      );
      assert.ok(html.includes(`href="/comprar-${landing.slug}"`));
    }
    assert.match(
      html,
      /<\/nav><\/div><\/div><\/section><section data-test-stock="true"/,
    );
  }
});

test("unavailable early selections do not promote models into the introduction", () => {
  const introSlugs = new Set(regionalFocus.inventorySlugs.slice(0, 4));
  const remainingPages = regionalInventoryPages.filter(
    (page) => !introSlugs.has(page.slug),
  );
  const html = renderCity("canoas", remainingPages);
  assert.doesNotMatch(html, /Atalhos por preço e categoria/);
  assert.ok(
    html.indexOf('data-test-stock="true"') <
      html.indexOf('data-regional-action="city_inventory_'),
  );
  assert.doesNotMatch(
    renderCity("canoas", []),
    /data-regional-action="city_inventory_/,
  );
});

test("crawler HTML keeps the same shortcut groups and places the compact group before stock", () => {
  const source = readFileSync(
    new URL("../generate-seo-assets.js", import.meta.url),
    "utf8",
  );
  const ast = ts.createSourceFile(
    "generate-seo-assets.js",
    source,
    ts.ScriptTarget.ES2020,
    true,
    ts.ScriptKind.JS,
  );
  const functions = ["regionalInventoryHtml", "escapeHtml"].map((name) => {
    const declaration = ast.statements.find(
      (node) => ts.isFunctionDeclaration(node) && node.name?.text === name,
    );
    assert.ok(declaration, `Generator function missing: ${name}`);
    return declaration.getText(ast);
  });
  const renderNav = runInNewContext(
    `${functions.join("\n")}\nregionalInventoryHtml`,
    {
      SITE: "https://www.netcarmultimarcas.com.br",
      landings: landingPages,
      regionalInventorySlugs: regionalFocus.inventorySlugs,
    },
  );
  const intro = renderNav("Canoas", "intro");
  const remaining = renderNav("Canoas");
  const introSlugs = new Set(regionalFocus.inventorySlugs.slice(0, 4));
  for (const page of regionalInventoryPages) {
    const href = `href="https://www.netcarmultimarcas.com.br/comprar-${page.slug}"`;
    assert.equal((intro + remaining).split(href).length - 1, 1);
    assert.equal(intro.includes(href), introSlugs.has(page.slug));
    assert.equal(remaining.includes(href), !introSlugs.has(page.slug));
  }
  assert.doesNotMatch(intro, /<h2|<p>/);
  const introPosition = source.indexOf(
    '${regionalInventoryHtml(city.name, "intro")}',
  );
  const stockPosition = source.indexOf('<section id="estoque-regional">');
  assert.ok(introPosition > 0 && introPosition < stockPosition);
  assert.ok(
    source.indexOf("${regionalInventoryHtml(city.name)}") > stockPosition,
  );
});
