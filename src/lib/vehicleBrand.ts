function normalizeBrandText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Canonical search identity; keep the catalog's original value for API filters. */
export function normalizeVehicleBrand(value: unknown): string {
  const normalized = normalizeBrandText(value);
  switch (normalized.replace(/\s/g, "")) {
    case "gm":
    case "generalmotors":
    case "chevy":
    case "chevrolet":
      return "chevrolet";
    case "vw":
    case "volks":
    case "volkswagen":
      return "volkswagen";
    case "caoachery":
    case "chery":
      return "chery";
    default:
      return normalized;
  }
}

/** Supports canonical aliases and partial brand names without changing values. */
export function matchesVehicleBrand(brand: unknown, query: unknown): boolean {
  return (
    normalizeVehicleBrand(brand).includes(normalizeVehicleBrand(query)) ||
    normalizeBrandText(brand).includes(normalizeBrandText(query))
  );
}
