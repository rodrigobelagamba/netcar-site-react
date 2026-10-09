import registry from "@/data/factoryWarrantyMatrix.json";
import {
  resolveFactoryWarranty,
  resolveFactoryPowertrainWarranty,
  resolveFactoryTractionBatteryWarranty,
  type FactoryWarrantyMatrix,
  type WarrantyCatalogVehicle,
} from "./factoryWarranty";
import {
  factoryWarrantyPreviewFor,
  isFactoryWarrantyPreviewEnabled,
} from "./factoryWarrantyPreview";
import { reconcileFactoryWarrantyVehicle } from "./factoryWarrantyReconciliation";

// Only explicitly reviewed, compatible units can display a warranty.
export const factoryWarrantyMatrix = registry as FactoryWarrantyMatrix;
export const isFactoryWarrantyLayoutEnabled =
  isFactoryWarrantyPreviewEnabled || factoryWarrantyMatrix.enabled;

type WarrantyStampVehicle = WarrantyCatalogVehicle & {
  factoryWarrantyVehicle?: WarrantyCatalogVehicle | null;
};

/** Compartilha os dados originais entre os gates, sem fallbacks visuais. */
export function factoryWarrantyVehicleFor(vehicle: WarrantyStampVehicle) {
  if (!Number.isFinite(vehicle.price) || vehicle.price <= 0) return undefined;
  const original = Object.prototype.hasOwnProperty.call(
    vehicle,
    "factoryWarrantyVehicle",
  )
    ? vehicle.factoryWarrantyVehicle
    : vehicle;
  if (
    !original ||
    original.id !== vehicle.id ||
    !Number.isFinite(original.price) ||
    original.price <= 0
  ) {
    return undefined;
  }
  return original;
}

export function factoryWarrantyStampFor(vehicle: WarrantyStampVehicle, matrix = factoryWarrantyMatrix, today?: string) {
  const original = factoryWarrantyVehicleFor(vehicle);
  if (!original) return undefined;
  const preview = factoryWarrantyPreviewFor(original, matrix);
  if (preview) return preview;
  const reconciled = reconcileFactoryWarrantyVehicle(original, matrix, today);
  if (reconciled.status !== "eligible") return undefined;
  return resolveFactoryWarranty(original, reconciled.matrix, today);
}

/** Prazo revisado de motor/câmbio; não substitui a garantia básica do veículo. */
export function factoryPowertrainStampFor(vehicle: WarrantyStampVehicle, matrix = factoryWarrantyMatrix, today?: string) {
  const original = factoryWarrantyVehicleFor(vehicle);
  if (!original) return undefined;
  const reconciled = reconcileFactoryWarrantyVehicle(original, matrix, today);
  if (reconciled.status !== "eligible") return undefined;
  return resolveFactoryPowertrainWarranty(original, reconciled.matrix, today);
}

/** A cobertura restrita nunca substitui o resultado/rótulo da garantia geral. */
export function factoryTractionBatteryStampFor(vehicle: WarrantyStampVehicle, matrix = factoryWarrantyMatrix, today?: string) {
  const original = factoryWarrantyVehicleFor(vehicle);
  if (!original) return undefined;
  const reconciled = reconcileFactoryWarrantyVehicle(original, matrix, today);
  if (reconciled.status !== "eligible") return undefined;
  return resolveFactoryTractionBatteryWarranty(original, reconciled.matrix, today);
}
