import type { WarrantyCatalogVehicle } from "./factoryWarranty";

export function factoryWarrantyUnitKey(vehicle: unknown): string | undefined;

/** Invalid original fields stay absent so the canonical gate rejects them. */
export function factoryWarrantyCatalogFromApi(
  vehicle: unknown,
  options?: { observedAt?: number },
): WarrantyCatalogVehicle | null;
