import conflictData from "../data/vehicle-equipment-conflicts.json";
import type { EquipmentVehicle } from "./vehicleEquipment";

/** A reviewed factory incompatibility is a publication hold, not physical absence. */
export interface EquipmentConflictRule {
  id: string;
  approved: boolean;
  market: "BR";
  reviewedAt: string;
  match: {
    brand: string;
    model: string;
    modelYear: number;
    engine: string;
    transmission: string;
  };
  equipmentIds: string[];
  sourceUrl: string;
  sourceTitle: string;
  sourceLocator: string;
  reason: string;
}

export const equipmentConflictRegistry: readonly EquipmentConflictRule[] =
  conflictData.records as EquipmentConflictRule[];

// Exact documents reviewed for these conflicts. An official-looking hostname
// or a newer/foreign catalogue is not enough to authorize another rule.
const reviewedConflictSources: Readonly<Record<string, readonly string[]>> = {
  honda: [
    "https://saladeimprensa.honda.com.br/releases/honda-lanca-linha-2020-do-hr-v",
  ],
  volkswagen: ["https://www.vwnews.com.br/news/2260"],
  jeep: [
    "https://www.media.stellantis.com/br-pt/download-model-document/133?v=1774006099",
  ],
};

const normalized = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export function isApprovedEquipmentConflict(
  value: unknown,
): value is EquipmentConflictRule {
  if (!value || typeof value !== "object") return false;
  const rule = value as Partial<EquipmentConflictRule>;
  if (
    rule.approved !== true ||
    rule.market !== "BR" ||
    typeof rule.id !== "string" ||
    !/^[a-z0-9-]+$/.test(rule.id) ||
    typeof rule.reviewedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(rule.reviewedAt)
  )
    return false;
  const date = new Date(`${rule.reviewedAt}T00:00:00Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== rule.reviewedAt
  )
    return false;
  const match = rule.match;
  if (
    !match ||
    !Number.isInteger(match.modelYear) ||
    match.modelYear < 1900 ||
    match.modelYear > 2100 ||
    ![match.brand, match.model, match.engine, match.transmission].every(
      (field) =>
        typeof field === "string" &&
        field.trim().length > 0 &&
        !/[.*+?^${}()|[\]\\]/.test(field.replace(/\.(?=\d)/g, "")),
    )
  )
    return false;
  if (
    ![rule.sourceUrl, rule.sourceTitle, rule.sourceLocator, rule.reason].every(
      (field) => typeof field === "string" && field.trim().length > 0,
    ) ||
    !reviewedConflictSources[normalized(match.brand)]?.includes(rule.sourceUrl!)
  )
    return false;
  return (
    Array.isArray(rule.equipmentIds) &&
    rule.equipmentIds.length > 0 &&
    rule.equipmentIds.length <= 30 &&
    rule.equipmentIds.every(
      (id) => typeof id === "string" && /^[a-z0-9-]+$/.test(id),
    ) &&
    new Set(rule.equipmentIds).size === rule.equipmentIds.length
  );
}

export function matchingEquipmentConflicts(
  vehicle: EquipmentVehicle,
  records: readonly unknown[] = equipmentConflictRegistry,
): EquipmentConflictRule[] {
  // Unknown market may conservatively hold a disputed claim; it never supplies
  // proof or adds equipment. An explicitly different market cannot use BR rules.
  if (vehicle.market?.trim() && normalized(vehicle.market) !== "br") return [];
  return records.filter(
    (record): record is EquipmentConflictRule =>
      isApprovedEquipmentConflict(record) &&
      normalized(vehicle.marca || "") === normalized(record.match.brand) &&
      normalized(vehicle.modelo || "") === normalized(record.match.model) &&
      Number(vehicle.year) === record.match.modelYear &&
      normalized(vehicle.motor || "") === normalized(record.match.engine) &&
      normalized(vehicle.cambio || "") ===
        normalized(record.match.transmission),
  );
}

const sensitiveEquipmentIds: ReadonlySet<string> = new Set([
  "keyless",
  "adaptive-cruise-control",
  "park-assist",
  "lane-assist",
  "automatic-emergency-braking",
  "collision-warning",
  "blind-spot",
  "android-auto",
  "apple-carplay",
  "wireless-carplay-android",
  "wireless-carplay",
  "wireless-android",
  "sunroof",
  "panoramic-roof",
  "camera-360",
  "seven-seats",
  "traction-awd",
  "traction-4x4",
  "power-seat",
]);

/** Review priority only: this list never proves that an unverified item is absent. */
export function isSensitiveEquipmentClaim(id: string): boolean {
  return sensitiveEquipmentIds.has(id) || /^airbags-\d+$/.test(id);
}
