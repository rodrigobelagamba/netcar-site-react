import type { Vehicle } from "../../../catalog/endpoints/vehicles";

export interface TabletFilters {
  search: string;
  marca: string;
  cambio: string;
  precoMin: string;
  precoMax: string;
  anoMin: string;
  anoMax: string;
  kmMin: string;
  kmMax: string;
  sort: "price-asc" | "price-desc" | "year-desc" | "km-asc" | "name";
}

export const DEFAULT_TABLET_FILTERS: Readonly<TabletFilters> = Object.freeze({
  search: "",
  marca: "",
  cambio: "",
  precoMin: "",
  precoMax: "",
  anoMin: "",
  anoMax: "",
  kmMin: "",
  kmMax: "",
  sort: "price-asc",
});

type RangeKey = "preco" | "ano" | "km";
type NumericRange = { min: number | null; max: number | null };
type ParsedRange = NumericRange & { error?: string };
export type TabletFilterErrors = Partial<Record<RangeKey, string>>;

const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();

const searchText = (value: string): string =>
  normalize(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function parseLimit(value: string, integer: boolean): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+(?:[.,]\d+)?$/.test(trimmed)) return NaN;
  const parsed = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(parsed) || (integer && !Number.isInteger(parsed)))
    return NaN;
  return parsed;
}

function parseRange(
  minValue: string,
  maxValue: string,
  key: RangeKey,
): ParsedRange {
  const min = parseLimit(minValue, key === "ano");
  const max = parseLimit(maxValue, key === "ano");
  if (
    (min !== null && !Number.isFinite(min)) ||
    (max !== null && !Number.isFinite(max))
  ) {
    return {
      min,
      max,
      error:
        key === "ano"
          ? "Informe anos inteiros, sem valores negativos."
          : "Informe valores válidos, sem valores negativos.",
    };
  }
  if (min !== null && max !== null && min > max) {
    return { min, max, error: "O mínimo não pode ser maior que o máximo." };
  }
  return { min, max };
}

function parseRanges(filters: TabletFilters): Record<RangeKey, ParsedRange> {
  return {
    preco: parseRange(filters.precoMin, filters.precoMax, "preco"),
    ano: parseRange(filters.anoMin, filters.anoMax, "ano"),
    km: parseRange(filters.kmMin, filters.kmMax, "km"),
  };
}

export function getTabletFilterErrors(
  filters: TabletFilters,
): TabletFilterErrors {
  const ranges = parseRanges(filters);
  const errors: TabletFilterErrors = {};
  for (const key of ["preco", "ano", "km"] as const) {
    if (ranges[key].error) errors[key] = ranges[key].error;
  }
  return errors;
}

function validNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validYear(value: unknown): number | null {
  return validNumber(value) && value > 0 && Number.isInteger(value)
    ? value
    : null;
}

function matchesRange(value: unknown, range: NumericRange): boolean {
  if (range.min === null && range.max === null) return true;
  if (!validNumber(value)) return false;
  return (
    (range.min === null || value >= range.min) &&
    (range.max === null || value <= range.max)
  );
}

function compareNumbers(a: unknown, b: unknown, descending = false): number {
  const aValid = validNumber(a);
  const bValid = validNumber(b);
  if (!aValid) return bValid ? 1 : 0;
  if (!bValid) return -1;
  return descending ? b - a : a - b;
}

/** Local-only filtering keeps typing instant and does not expose private plate data in search. */
export function filterTabletVehicles(
  vehicles: readonly Vehicle[],
  filters: TabletFilters,
): Vehicle[] {
  const ranges = parseRanges(filters);
  if (Object.values(ranges).some((range) => range.error)) return [];

  const tokens = searchText(filters.search).split(/\s+/).filter(Boolean);
  const marca = normalize(filters.marca);
  const cambio = normalize(filters.cambio);

  return vehicles
    .map((vehicle, index) => ({ vehicle, index }))
    .filter(({ vehicle }) => {
      if (!validNumber(vehicle.price) || vehicle.price <= 0) return false;
      if (marca && normalize(vehicle.marca ?? "") !== marca) return false;
      if (cambio && normalize(vehicle.cambio ?? "") !== cambio) return false;
      if (!matchesRange(vehicle.price, ranges.preco)) return false;
      if (!matchesRange(validYear(vehicle.year), ranges.ano)) return false;
      if (!matchesRange(vehicle.km, ranges.km)) return false;
      const searchable = searchText(
        [vehicle.marca, vehicle.modelo, vehicle.name, validYear(vehicle.year)]
          .filter(Boolean)
          .join(" "),
      );
      return tokens.every((token) => searchable.includes(token));
    })
    .sort((a, b) => {
      let result: number;
      switch (filters.sort) {
        case "price-desc":
          result = compareNumbers(a.vehicle.price, b.vehicle.price, true);
          break;
        case "year-desc":
          result = compareNumbers(
            validYear(a.vehicle.year),
            validYear(b.vehicle.year),
            true,
          );
          break;
        case "km-asc":
          result = compareNumbers(a.vehicle.km, b.vehicle.km);
          break;
        case "name":
          result = normalize(a.vehicle.name).localeCompare(
            normalize(b.vehicle.name),
            "pt-BR",
          );
          break;
        default:
          result = compareNumbers(a.vehicle.price, b.vehicle.price);
      }
      return result || a.index - b.index;
    })
    .map(({ vehicle }) => vehicle);
}
