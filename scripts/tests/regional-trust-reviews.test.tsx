import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { GOOGLE_PRIMARY_PROFILE } from "../../src/social/googlePlaces";

function renderTrust(scope?: string, includeGoogle = true) {
  const dependencies: Record<string, unknown> = {
    "react/jsx-runtime": jsxRuntime,
    "@tanstack/react-router": { Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a> },
    "lucide-react": { ArrowLeftRight: "svg", CreditCard: "svg", FileCheck2: "svg", Star: "svg" },
    "@/design-system/components/patterns/social/GoogleGIcon": { GoogleGIcon: "svg" },
    "@/social/googlePlaces": { GOOGLE_PRIMARY_PROFILE },
    "@/social/queries/useGoogleReviewsQuery": {
      useGoogleReviewsQuery: () => ({ data: { summary: {
        rating: 4.9, totalCount: 897, scope,
        placeUrl: "https://example.test/incorrect-global-destination",
      } } }),
    },
  };
  const source = readFileSync(new URL("../../src/modules/seo/components/RegionalTrustSignals.tsx", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } });
  const module = { exports: {} as any };
  runInNewContext(outputText, { module, exports: module.exports, require: (id: string) => {
    if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`);
    return dependencies[id];
  } });
  return renderToStaticMarkup(<module.exports.RegionalTrustSignals includeGoogle={includeGoogle} />);
}

test("regional trust labels the combined total while its new interaction goes to the principal profile", () => {
  const html = renderTrust("all_locations");
  assert.ok(html.includes("897 avaliações das duas unidades"));
  assert.ok(html.includes("cid=9144067949621682127"));
  assert.equal(html.includes("cid=10839197980729051544"), false);
  assert.equal(html.includes("incorrect-global-destination"), false);
});

test("legacy scope stays neutral and disabling Google removes its links", () => {
  const legacy = renderTrust();
  assert.ok(legacy.includes("897 avaliações da Netcar"));
  assert.equal(legacy.includes("das duas unidades"), false);
  assert.equal(renderTrust("all_locations", false).includes("cid="), false);
});
