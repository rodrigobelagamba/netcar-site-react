import registry from "../data/vehicle-color-confirmations.json";
import { vehiclePhysicalIdentityKey } from "./vehiclePhysicalIdentity";

export interface ColorVehicle {
  id?: unknown;
  marca?: unknown;
  modelo?: unknown;
  year?: unknown;
  anoFabricacao?: unknown;
  motor?: unknown;
  cambio?: unknown;
  cor?: unknown;
  placa?: unknown;
  physicalIdentityKey?: string | null;
}
export interface ColorConfirmation {
  id: string;
  status: "confirmed";
  vehicle: {
    id: string; brand: string; model: string; modelYear: number;
    manufactureYear: number; engine: string; transmission: string;
    genericColor: string; physicalIdentityKey: string;
  };
  officialName: string;
  /** Public-safe provenance only. Original evidence stays in the private audit. */
  evidence: {
    kind: "paint-code" | "factory-document" | "owner-confirmation";
    publicReference: string; verifiedAt: string; verifiedBy: "owner" | "document-review";
  };
  publication: { approved: true; publicReference: string };
}
const normalized = (value: unknown) => String(value ?? "").trim().normalize("NFC").toLocaleLowerCase("pt-BR");
const meaningful = (value: unknown) => typeof value === "string" && value.trim().length > 0;
const year = (value: unknown) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1900 && n <= 2100 ? n : null;
};

/** Exact per-unit overlay; never mutates API/XML, taxonomy or generic filters.
 * A catalogue palette alone is NOT evidence of the paint on this physical car. */
export function resolveVehicleColor(vehicle: ColorVehicle, input: unknown = registry) {
  const generic = typeof vehicle.cor === "string" ? vehicle.cor : "";
  const identity = {
    id: String(vehicle.id ?? ""), brand: normalized(vehicle.marca),
    model: normalized(vehicle.modelo), modelYear: year(vehicle.year),
    manufactureYear: year(vehicle.anoFabricacao), engine: normalized(vehicle.motor),
    transmission: normalized(vehicle.cambio), genericColor: normalized(generic),
    physicalIdentityKey: vehicle.physicalIdentityKey ?? vehiclePhysicalIdentityKey(vehicle.id, vehicle.placa),
  };
  const source = input as { schemaVersion?: unknown; records?: unknown } | null;
  const records = source?.schemaVersion === 1 && Array.isArray(source.records) ? source.records : [];
  const candidates = records.filter((record) => record?.vehicle?.id === identity.id);
  const valid = candidates.filter((record: ColorConfirmation) => {
    const match = record.vehicle;
    return record.status === "confirmed" && meaningful(record.id) &&
      meaningful(record.officialName) && record.officialName.length <= 120 &&
      !/[<>\r\n]/.test(record.officialName) &&
      identity.physicalIdentityKey != null && /^[a-f0-9]{64}$/.test(identity.physicalIdentityKey) &&
      match.physicalIdentityKey === identity.physicalIdentityKey &&
      identity.modelYear !== null && identity.manufactureYear !== null &&
      match.modelYear === identity.modelYear && match.manufactureYear === identity.manufactureYear &&
      (["brand", "model", "engine", "transmission", "genericColor"] as const)
        .every((key) => identity[key] !== "" && normalized(match[key]) === identity[key]) &&
      ["paint-code", "factory-document", "owner-confirmation"].includes(record.evidence?.kind) &&
      meaningful(record.evidence?.publicReference) && ["owner", "document-review"].includes(record.evidence?.verifiedBy) &&
      /^\d{4}-\d{2}-\d{2}/.test(record.evidence?.verifiedAt || "") &&
      Number.isFinite(Date.parse(record.evidence?.verifiedAt)) &&
      record.publication?.approved === true && meaningful(record.publication?.publicReference);
  });
  // Ambiguous/duplicate records fail closed even when their text agrees.
  const confirmed = candidates.length === 1 && valid.length === 1 ? valid[0] as ColorConfirmation : null;
  return {
    status: confirmed ? "confirmed" as const : candidates.length ? "blocked" as const : "pending" as const,
    display: confirmed ? `${generic} (${confirmed.officialName})` : generic,
    genericColor: generic,
    officialName: confirmed?.officialName ?? null,
    confirmationId: confirmed?.id ?? null,
    // Bind review to this car and registry, not timestamps; no raw plate/VIN.
    reviewInput: { identity, records: candidates },
    researchQuery: [vehicle.marca, vehicle.modelo, vehicle.year, vehicle.motor,
      vehicle.cambio, generic, "Brasil catálogo oficial código da pintura"].filter(Boolean).join(" "),
  };
}
