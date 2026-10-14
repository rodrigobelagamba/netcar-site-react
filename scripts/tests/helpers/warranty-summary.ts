import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";
import * as badges from "../../../src/design-system/components/patterns/FactoryWarrantyBadge";
import type { useFactoryWarrantyStamps } from "../../../src/lib/useFactoryWarrantyStamps";

type SummaryModule = typeof import("../../../src/design-system/components/patterns/VehicleWarrantySummary");
export type WarrantyStamps = ReturnType<typeof useFactoryWarrantyStamps>;

const { outputText } = ts.transpileModule(
  readFileSync(new URL("../../../src/design-system/components/patterns/VehicleWarrantySummary.tsx", import.meta.url), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  },
);

/** Render the real stamp and note; only the remote warranty result is isolated. */
export function loadWarrantySummary(stampsById: Record<string, WarrantyStamps> = {}) {
  const dependencies: Record<string, unknown> = {
    "react/jsx-runtime": jsxRuntime,
    "./FactoryWarrantyBadge": badges,
    "@/lib/useFactoryWarrantyStamps": {
      useFactoryWarrantyStamps: (vehicle?: { id: string }) =>
        vehicle ? stampsById[vehicle.id] ?? {} : {},
    },
  };
  const exports: Record<string, unknown> = {};
  runInNewContext(outputText, {
    exports,
    require: (name: string) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports as SummaryModule;
}
