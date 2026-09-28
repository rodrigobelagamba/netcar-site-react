import {
  resolveVehicleEquipment,
  normalizeEquipmentTag,
  cleanEquipmentDescription,
  type EquipmentVehicle,
} from "../../../lib/vehicleEquipment";

export interface VehicleHighlight {
  id: string;
  category: string;
  title: string;
  description: string;
  sourceTags: string[];
  metric?: { value: string; unit: string };
}

export interface VehicleHighlightsPresentation {
  highlights: VehicleHighlight[];
  explainedTags: Set<string>;
  remainingOptionals: string[];
}

export const normalizeVehicleFeatureTag = normalizeEquipmentTag;
export const cleanOptionalDescription = cleanEquipmentDescription;

/**
 * Cards and list share inventory evidence, ranking and redundancy rules.
 * Marketing copy and similar vehicles are not equipment/specification sources.
 */
export function buildVehicleHighlights(
  vehicle: EquipmentVehicle,
): VehicleHighlightsPresentation {
  const equipment = resolveVehicleEquipment(vehicle);
  const selected = equipment.items.filter((item) => item.benefit).slice(0, 4);
  const selectedIds = new Set(selected.map((item) => item.id));
  return {
    highlights: selected.map((item) => ({
      id: item.id,
      category: item.category,
      title: item.description,
      description: item.benefit!,
      sourceTags: item.sourceTags,
    })),
    explainedTags: new Set(selected.flatMap((item) => item.sourceTags)),
    remainingOptionals: equipment.items
      .filter((item) => !selectedIds.has(item.id))
      .map((item) => item.description),
  };
}
