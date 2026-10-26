import copyData from "../../../data/vehicle-editorial-copy.json";
import type { EquipmentVehicle } from "../../../lib/vehicleEquipment";
import { matchesEditorialIdentity } from "./vehicleEditorialIdentity";

/** Reviewed unit copy is valid only for the exact set of facts it explains. */
export function resolveVehicleEditorialCopy(
  vehicle: EquipmentVehicle,
  topic: string,
  equipmentIds: readonly string[],
) {
  const units = copyData.units.filter(
    (unit) =>
      String(vehicle.id) === unit.vehicleId &&
      matchesEditorialIdentity(vehicle, unit.match),
  );
  if (units.length !== 1) return undefined;
  return units[0].copies.find(
    (copy) =>
      copy.topic === topic &&
      copy.equipmentIds.length === equipmentIds.length &&
      copy.equipmentIds.every((id) => equipmentIds.includes(id)),
  );
}
