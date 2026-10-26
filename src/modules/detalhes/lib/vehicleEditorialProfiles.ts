import profileData from "../../../data/vehicle-editorial-profiles.json";
import {
  normalizeEquipmentTag,
  type EquipmentVehicle,
} from "../../../lib/vehicleEquipment";

export interface VehicleEditorialProfile {
  id: string;
  reviewedAt: string;
  match: { brand: string; model: string; modelYear: number };
  /** Membership only: order always comes from the shared equipment resolver. */
  topics: readonly string[];
}

export interface VehicleEditorialReview {
  /** Internal metadata, not a factory-validation or public equipment claim. */
  status: "profile-applied" | "needs-editorial-review";
  provenance: string;
  profileId?: string;
  reviewedAt?: string;
  reason?: "no-exact-profile" | "ambiguous-profile" | "unavailable-topics";
  unavailableTopics: string[];
}

export const vehicleEditorialProfiles: readonly VehicleEditorialProfile[] =
  profileData.profiles;

/**
 * Select only among candidate topics already built from resolved equipment.
 * An exact version/year profile cannot add an item, promote an alias, carry a
 * unit's accessory to another car, or override inventory/evidence conflicts.
 */
export function selectVehicleEditorialTopics(
  vehicle: EquipmentVehicle,
  availableTopics: readonly string[],
): { topics: ReadonlySet<string> | null; review: VehicleEditorialReview } {
  const matches = vehicleEditorialProfiles.filter(
    ({ match }) =>
      normalizeEquipmentTag(vehicle.marca || "") ===
        normalizeEquipmentTag(match.brand) &&
      normalizeEquipmentTag(vehicle.modelo || "") ===
        normalizeEquipmentTag(match.model) &&
      Number(vehicle.year) === match.modelYear,
  );
  if (matches.length !== 1) {
    return {
      topics: null,
      review: {
        status: "needs-editorial-review",
        provenance: profileData.provenance,
        reason: matches.length ? "ambiguous-profile" : "no-exact-profile",
        unavailableTopics: [],
      },
    };
  }

  const profile = matches[0];
  const available = new Set(availableTopics);
  const unavailableTopics = profile.topics.filter(
    (topic) => !available.has(topic),
  );
  return {
    topics: new Set(profile.topics.filter((topic) => available.has(topic))),
    review: {
      status: unavailableTopics.length
        ? "needs-editorial-review"
        : "profile-applied",
      provenance: profileData.provenance,
      profileId: profile.id,
      reviewedAt: profile.reviewedAt,
      ...(unavailableTopics.length
        ? { reason: "unavailable-topics" as const }
        : {}),
      unavailableTopics,
    },
  };
}
