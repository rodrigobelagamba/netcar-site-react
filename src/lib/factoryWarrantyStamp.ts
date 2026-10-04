import registry from "@/data/factoryWarrantyMatrix.json";
import {
  resolveFactoryWarranty,
  type FactoryWarrantyMatrix,
  type WarrantyCatalogVehicle,
} from "./factoryWarranty";
import {
  factoryWarrantyPreviewFor,
  isFactoryWarrantyPreviewEnabled,
} from "./factoryWarrantyPreview";

// The approved release contains five reviewed units; all other units fail closed.
export const factoryWarrantyMatrix = registry as FactoryWarrantyMatrix;
export const isFactoryWarrantyLayoutEnabled =
  isFactoryWarrantyPreviewEnabled || factoryWarrantyMatrix.enabled;

export function factoryWarrantyStampFor(vehicle: WarrantyCatalogVehicle) {
  if (!Number.isFinite(vehicle.price) || vehicle.price <= 0) return undefined;
  const preview = factoryWarrantyPreviewFor(vehicle, factoryWarrantyMatrix);
  if (preview) return preview;
  return resolveFactoryWarranty(vehicle, factoryWarrantyMatrix);
}
