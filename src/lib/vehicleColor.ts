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
  combustivel?: unknown;
  cor?: unknown;
  placa?: unknown;
  physicalIdentityKey?: string | null;
}

export interface ColorCatalogEvidence {
  market: "BR";
  brand: string;
  model: string;
  modelYear: number;
  engine: string;
  transmission: string;
  fuel: string;
  /** Reviewed complete palette for this exact version/model year. */
  complete: true;
  palette: { officialName: string; genericColor: string }[];
  sourceUrls: string[];
}

export interface ColorConfirmation {
  id: string;
  status: "confirmed";
  vehicle: {
    id: string;
    brand: string;
    model: string;
    modelYear: number;
    manufactureYear: number;
    engine: string;
    transmission: string;
    fuel: string;
    genericColor: string;
    physicalIdentityKey: string;
  };
  officialName: string;
  /** Public-safe provenance. No raw plate/VIN or private evidence. */
  evidence: {
    kind: "paint-code" | "factory-document" | "owner-confirmation" | "catalog-unique-match";
    publicReference: string;
    verifiedAt: string;
    verifiedBy: "owner" | "document-review" | "catalog-review";
    catalog?: ColorCatalogEvidence;
  };
  publication: { approved: true; publicReference: string };
}

const text = (value: unknown) =>
  typeof value === "string" ? value : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
const normalized = (value: unknown) =>
  text(value).trim().normalize("NFC").toLocaleLowerCase("pt-BR");
const meaningful = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const safeName = (value: unknown): value is string =>
  meaningful(value) && value.length <= 120 && !/[<>\r\n]/.test(value);
const year = (value: unknown) => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1900 && n <= 2100 ? n : null;
};
const sourceUrl = (value: unknown) => {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};

/** Factory-name lookup from the XML colour, not physical paint authentication.
 * A complete, reviewed OEM palette must yield exactly one compatible name. */
function uniqueCatalogMatch(record: ColorConfirmation) {
  const catalog = record.evidence.catalog;
  const identity = record.vehicle;
  if (
    record.evidence.verifiedBy !== "catalog-review" ||
    !catalog || catalog.market !== "BR" || catalog.complete !== true ||
    catalog.modelYear !== identity.modelYear ||
    !(["brand", "model", "engine", "transmission", "fuel"] as const).every(
      (key) => meaningful(catalog[key]) && normalized(catalog[key]) === normalized(identity[key]),
    ) ||
    !Array.isArray(catalog.sourceUrls) || !catalog.sourceUrls.length ||
    !catalog.sourceUrls.every(sourceUrl) ||
    !Array.isArray(catalog.palette) || !catalog.palette.length ||
    !catalog.palette.every((color) => safeName(color?.officialName) && meaningful(color?.genericColor))
  ) return false;

  // Multiple paints in the same generic group remain ambiguous. Duplicates
  // also fail closed: do not silently discard an alternative from a source.
  const matches = catalog.palette.filter(
    (color) => normalized(color.genericColor) === normalized(identity.genericColor),
  );
  return matches.length === 1 && normalized(matches[0].officialName) === normalized(record.officialName);
}

/** Per-unit display overlay. Never mutates API/XML, filters, feeds or photos. */
export function resolveVehicleColor(vehicle: ColorVehicle, input: unknown = registry) {
  const generic = typeof vehicle.cor === "string" ? vehicle.cor : "";
  const identity = {
    id: text(vehicle.id), brand: normalized(vehicle.marca),
    model: normalized(vehicle.modelo), modelYear: year(vehicle.year),
    manufactureYear: year(vehicle.anoFabricacao), engine: normalized(vehicle.motor),
    transmission: normalized(vehicle.cambio), fuel: normalized(vehicle.combustivel), genericColor: normalized(generic),
    physicalIdentityKey: vehicle.physicalIdentityKey ?? vehiclePhysicalIdentityKey(vehicle.id, vehicle.placa),
  };
  const source = input as { schemaVersion?: unknown; records?: unknown } | null;
  const records = source?.schemaVersion === 1 && Array.isArray(source.records) ? source.records : [];
  const candidates = records.filter((record) => record?.vehicle?.id === identity.id);
  const valid = candidates.filter((record: ColorConfirmation) => {
    const match = record.vehicle;
    const evidence = record.evidence;
    if (
      record.status !== "confirmed" || !meaningful(record.id) || !safeName(record.officialName) ||
      !meaningful(identity.physicalIdentityKey) || !/^[a-f0-9]{64}$/.test(identity.physicalIdentityKey) ||
      match.physicalIdentityKey !== identity.physicalIdentityKey ||
      identity.modelYear === null || identity.manufactureYear === null ||
      match.modelYear !== identity.modelYear || match.manufactureYear !== identity.manufactureYear ||
      !(["brand", "model", "engine", "transmission", "fuel", "genericColor"] as const)
        .every((key) => identity[key] !== "" && normalized(match[key]) === identity[key]) ||
      !meaningful(evidence?.publicReference) ||
      !meaningful(evidence?.verifiedAt) ||
      !/^\d{4}-\d{2}-\d{2}/.test(evidence.verifiedAt) ||
      !Number.isFinite(Date.parse(evidence?.verifiedAt)) ||
      record.publication?.approved !== true || !meaningful(record.publication?.publicReference)
    ) return false;

    if (evidence.kind === "catalog-unique-match") return uniqueCatalogMatch(record);
    return ["paint-code", "factory-document", "owner-confirmation"].includes(evidence.kind) &&
      ["owner", "document-review"].includes(evidence.verifiedBy);
  });
  const confirmed = candidates.length === 1 && valid.length === 1 ? valid[0] as ColorConfirmation : null;
  return {
    status: confirmed ? "confirmed" as const : candidates.length ? "blocked" as const : "pending" as const,
    display: confirmed?.officialName ?? generic,
    genericColor: generic,
    officialName: confirmed?.officialName ?? null,
    verificationBasis: confirmed
      ? confirmed.evidence.kind === "catalog-unique-match" ? "catalog-match" as const : "unit-evidence" as const
      : null,
    confirmationId: confirmed?.id ?? null,
    reviewInput: { identity, records: candidates },
    researchQuery: [vehicle.marca, vehicle.modelo, vehicle.year, vehicle.motor,
      vehicle.cambio, vehicle.combustivel, generic, "Brasil catálogo oficial cores pintura"].map(text).filter(Boolean).join(" "),
  };
}
