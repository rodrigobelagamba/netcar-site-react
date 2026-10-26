import profileData from "../../../data/vehicle-editorial-profiles.json";
import { type EquipmentVehicle } from "../../../lib/vehicleEquipment";
import {
  matchesEditorialIdentity,
  type VehicleEditorialIdentity,
} from "./vehicleEditorialIdentity";

export interface VehicleEditorialProfile {
  id: string;
  reviewedAt: string;
  match: VehicleEditorialIdentity;
  /** Membership only: order always comes from the shared equipment resolver. */
  topics: readonly string[];
  /** A completed review may legitimately have no differentiating facts. */
  emptySelectionReason?: "no-eligible-topics";
  research?: {
    status: "exact" | "partial" | "conflict" | "insufficient-data";
    evidenceId: string;
  };
}

export interface VehicleEditorialReview {
  /** Internal metadata, not a factory-validation or public equipment claim. */
  status: "profile-applied" | "needs-editorial-review";
  provenance: string;
  profileId?: string;
  reviewedAt?: string;
  reason?:
    | "no-exact-profile"
    | "ambiguous-profile"
    | "unavailable-topics"
    | "no-supported-topics";
  unavailableTopics: string[];
  researchStatus?: NonNullable<VehicleEditorialProfile["research"]>["status"];
}

export const vehicleEditorialProfiles: readonly VehicleEditorialProfile[] =
  profileData.profiles as readonly VehicleEditorialProfile[];

/**
 * Select only among candidate topics already built from resolved equipment.
 * An exact version/year profile cannot add an item, promote an alias, carry a
 * unit's accessory to another car, or override inventory/evidence conflicts.
 */
export function selectVehicleEditorialTopics(
  vehicle: EquipmentVehicle,
  availableTopics: readonly string[],
): { topics: ReadonlySet<string> | null; review: VehicleEditorialReview } {
  const matches = vehicleEditorialProfiles.filter(({ match }) =>
    matchesEditorialIdentity(vehicle, match),
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
  const unsupportedEmpty =
    !profile.topics.length &&
    !(
      profile.emptySelectionReason === "no-eligible-topics" &&
      available.size === 0
    );
  return {
    topics: new Set(profile.topics.filter((topic) => available.has(topic))),
    review: {
      status:
        unavailableTopics.length || unsupportedEmpty
          ? "needs-editorial-review"
          : "profile-applied",
      provenance: profileData.provenance,
      profileId: profile.id,
      reviewedAt: profile.reviewedAt,
      ...(profile.research ? { researchStatus: profile.research.status } : {}),
      ...(unsupportedEmpty ? { reason: "no-supported-topics" as const } : {}),
      ...(unavailableTopics.length
        ? { reason: "unavailable-topics" as const }
        : {}),
      unavailableTopics,
    },
  };
}
