import type { Vehicle } from "../catalog/endpoints/vehicles";
import definitions from "../data/seo/comparisons.json";

export type ComparisonDefinition = {
  slug: string;
  label: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  left: { brand: string; model: string; label: string };
  right: { brand: string; model: string; label: string };
  sections: { title: string; text: string }[];
  checks: string[];
  stockNote: string;
};

export const comparisonDefinitions = definitions as ComparisonDefinition[];

export function normalizeComparisonText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function matchesComparisonSearch(vehicle: Vehicle, query: string) {
  const compact = (value: string) =>
    normalizeComparisonText(value).replace(/\s/g, "");
  return compact(
    `${vehicle.marca || ""} ${vehicle.modelo || vehicle.name || ""}`,
  ).includes(compact(query));
}

export function comparisonCandidates(
  vehicles: Vehicle[],
  model: ComparisonDefinition["left"],
) {
  const target = normalizeComparisonText(model.model).replace(/\s/g, "");
  return vehicles.filter(
    (vehicle) =>
      Number.isFinite(vehicle.price) &&
      vehicle.price > 0 &&
      normalizeComparisonText(vehicle.marca) ===
        normalizeComparisonText(model.brand) &&
      normalizeComparisonText(vehicle.modelo || vehicle.name)
        .replace(/\s/g, "")
        .includes(target),
  );
}

/** Same selection rule as the static SEO renderer: nearest announced prices. */
export function closestComparisonPair(left: Vehicle[], right: Vehicle[]) {
  let result: { left: Vehicle; right: Vehicle; difference: number } | undefined;
  for (const a of left) {
    for (const b of right) {
      if (a.id === b.id) continue;
      const difference = Math.abs(a.price - b.price);
      if (!result || difference < result.difference) {
        result = { left: a, right: b, difference };
      }
    }
  }
  return result;
}
