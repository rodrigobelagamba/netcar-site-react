import {
  normalizeEquipmentTag,
  type EquipmentVehicle,
} from "../../../lib/vehicleEquipment";

export interface VehicleEditorialIdentity {
  brand: string;
  model: string;
  modelYear: number;
  engine?: string;
  transmission?: string;
}

/** No family, fabrication-year, display-name or missing-specification fallback. */
export function matchesEditorialIdentity(
  vehicle: EquipmentVehicle,
  match: VehicleEditorialIdentity,
): boolean {
  const same = (actual: string | undefined, expected: string) =>
    normalizeEquipmentTag(actual || "") === normalizeEquipmentTag(expected);
  return (
    (!vehicle.market || vehicle.market === "BR") &&
    same(vehicle.marca, match.brand) &&
    same(vehicle.modelo, match.model) &&
    Number(vehicle.year) === match.modelYear &&
    (!match.engine || same(vehicle.motor, match.engine)) &&
    (!match.transmission || same(vehicle.cambio, match.transmission))
  );
}
