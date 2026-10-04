import {
  resolveFactoryWarranty,
  type FactoryWarrantyMatrix,
  type WarrantyCatalogVehicle,
} from "./factoryWarranty";

export const isFactoryWarrantyPreviewEnabled =
  import.meta.env.DEV && import.meta.env.VITE_WARRANTY_PREVIEW === "1";

/**
 * Uses the same reviewed records and runtime gate as production. Only the
 * release switch is overridden in DEV; no ID-only fixture or data overrides.
 */
export function factoryWarrantyPreviewFor(
  vehicle: WarrantyCatalogVehicle,
  matrix: FactoryWarrantyMatrix,
) {
  if (!isFactoryWarrantyPreviewEnabled) return undefined;
  const stamp = resolveFactoryWarranty(vehicle, { ...matrix, enabled: true });
  return stamp ? { ...stamp, mode: "visual-example" as const } : undefined;
}
