export interface WarrantyVehicleIdentity {
  vehicleId: string;
  brand: string;
  modelVersion: string;
  manufactureYear: number;
  modelYear: number;
}

export type WarrantyMileage =
  | { kind: "unlimited" }
  | { kind: "limited"; limitKm: number }
  | { kind: "unknown" };

export interface WarrantySource {
  sourceId: string;
  url: string;
  locator: string;
  revision: string;
  verification: {
    status: "verified" | "pending";
    documentCode: string;
    modelYear: number;
    reviewId: string;
    reviewedAt: string;
  };
}

export interface WarrantyCommonPolicy {
  kind: "documented-regime-intersection" | "documented-general-rule";
  reviewId: string;
  basis: string;
  branches: Array<{
    category: "non-commercial" | "commercial" | "cpf" | "cnpj" | "general";
    condition: string;
    scope: "basic-vehicle";
    termYears: number;
    mileage: WarrantyMileage;
    sourceIds: string[];
  }>;
}

export interface FactoryWarrantyRecord {
  recordId: string;
  status: "approved" | "pending" | "revoked" | "ineligible";
  reviewedAt: string;
  /** Canonical reviewed identity/coverage/source snapshot, never a brand default. */
  approvedFingerprint: string;
  vehicle: WarrantyVehicleIdentity;
  optionalId: number;
  optionalConfirmed: boolean;
  conditionsConfirmed: boolean;
  scope: "basic-vehicle" | "battery" | "powertrain" | "extension" | "unknown";
  termYears: number;
  /** Actual use stays unknown when a documented commonPolicy is sufficient. */
  usage: "private" | "commercial" | "unknown";
  commonPolicy?: WarrantyCommonPolicy;
  reviewedMileageKm: number;
  mileage: WarrantyMileage;
  /** Needed in the estimated final year; this is not inferred from FAB. */
  confirmedExpiryDate?: string;
  sources: WarrantySource[];
}

export interface FactoryWarrantyMatrix {
  schemaVersion: 2;
  enabled: boolean;
  records: FactoryWarrantyRecord[];
}

export interface WarrantyCatalogVehicle {
  id: string;
  marca?: string;
  modelo?: string;
  name?: string;
  anoFabricacao?: number;
  year: number;
  km: number;
  price: number;
  diferenciais?: Array<{ tag: string; descricao: string }>;
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;

const nonempty = (value: unknown): value is string =>
  typeof value === "string" && !!value.trim();
const unresolvedText = (value: string) =>
  /\b(PENDENTE|PENDING|UNKNOWN|TBD|A CONFIRMAR|NAO VERIFICAD[AO])\b/.test(
    normalize(value),
  );
const knownMileage = (rule: WarrantyMileage | undefined) =>
  rule?.kind === "unlimited" ||
  (rule?.kind === "limited" &&
    Number.isFinite(rule.limitKm) &&
    rule.limitKm > 0);

/** Coverage can be common without asserting either actual usage or ownership. */
function validCommonPolicy(record: FactoryWarrantyRecord): boolean {
  const policy = record.commonPolicy;
  if (
    !policy ||
    !nonempty(policy.reviewId) ||
    !nonempty(policy.basis) ||
    !Array.isArray(policy.branches)
  )
    return false;
  const branches = policy.branches;
  const sourceIds = new Set(record.sources.map((source) => source.sourceId));
  if (
    !branches.length ||
    branches.some(
      (branch) =>
        !branch ||
        branch.scope !== "basic-vehicle" ||
        !nonempty(branch.condition) ||
        branch.termYears !== record.termYears ||
        !knownMileage(branch.mileage) ||
        !Array.isArray(branch.sourceIds) ||
        !branch.sourceIds.length ||
        branch.sourceIds.some(
          (sourceId) =>
            !sourceIds.has(sourceId) ||
            record.sources.find((source) => source.sourceId === sourceId)
              ?.verification.reviewId !== policy.reviewId,
        ),
    )
  )
    return false;
  const categories = branches.map((branch) => branch.category).sort().join(",");
  if (policy.kind === "documented-regime-intersection") {
    if (
      branches.length !== 2 ||
      !["commercial,non-commercial", "cnpj,cpf"].includes(categories)
    )
      return false;
  } else if (policy.kind === "documented-general-rule") {
    if (branches.length !== 1 || categories !== "general") return false;
  } else return false;
  const commonLimit = Math.min(
    ...branches.map((branch) =>
      branch.mileage.kind === "limited" ? branch.mileage.limitKm : Infinity,
    ),
  );
  // Do not pick a longer term, weaker cap, or a guessed branch to make it pass.
  return commonLimit === Infinity
    ? record.mileage.kind === "unlimited"
    : record.mileage.kind === "limited" &&
        record.mileage.limitKm === commonLimit;
}

/** Deliberately readable, deterministic snapshot; not a signature or inferred approval. */
export function factoryWarrantyReviewFingerprint(
  record: FactoryWarrantyRecord,
): string {
  return JSON.stringify({
    recordId: record.recordId,
    reviewedAt: record.reviewedAt,
    vehicle: {
      vehicleId: record.vehicle.vehicleId,
      manufactureYear: record.vehicle.manufactureYear,
      modelYear: record.vehicle.modelYear,
      brand: normalize(record.vehicle.brand),
      modelVersion: normalize(record.vehicle.modelVersion),
    },
    optionalId: record.optionalId,
    optionalConfirmed: record.optionalConfirmed,
    conditionsConfirmed: record.conditionsConfirmed,
    scope: record.scope,
    termYears: record.termYears,
    usage: record.usage,
    commonPolicy: record.commonPolicy || null,
    reviewedMileageKm: record.reviewedMileageKm,
    mileage: record.mileage,
    confirmedExpiryDate: record.confirmedExpiryDate || null,
    sources: record.sources,
  });
}

/** No match, stale/incompatible data or uncertainty always means no warranty stamp. */
export function resolveFactoryWarranty(
  vehicle: WarrantyCatalogVehicle,
  matrix: FactoryWarrantyMatrix,
  today = new Date().toISOString().slice(0, 10),
) {
  if (
    !matrix ||
    matrix.schemaVersion !== 2 ||
    matrix.enabled !== true ||
    !Array.isArray(matrix.records) ||
    !validDate(today)
  )
    return undefined;
  if (!Number.isFinite(vehicle.price) || vehicle.price <= 0) return undefined;
  if (
    !Array.isArray(vehicle.diferenciais) ||
    !vehicle.diferenciais.some((item) => item?.tag === "garantia_fabrica")
  )
    return undefined;
  // Inspect all records first: a revocation must not leave an old approval active.
  const candidates = matrix.records.filter(
    (entry) => entry?.vehicle?.vehicleId === vehicle.id,
  );
  if (candidates.length !== 1) return undefined;
  const record = candidates[0];
  if (
    record.status !== "approved" ||
    !record.recordId ||
    !validDate(record.reviewedAt) ||
    record.reviewedAt > today
  )
    return undefined;
  if (
    record.optionalId !== 108 ||
    record.optionalConfirmed !== true ||
    record.conditionsConfirmed !== true
  )
    return undefined;
  if (
    record.scope !== "basic-vehicle" ||
    !["private", "commercial", "unknown"].includes(record.usage)
  )
    return undefined;
  if (
    !Array.isArray(record.sources) ||
    !record.sources.length ||
    record.sources.some(
      (source) =>
        !source ||
        !nonempty(source.sourceId) ||
        typeof source.url !== "string" ||
        !/^https:\/\/[^/\s]+\/\S+$/i.test(source.url) ||
        !nonempty(source.locator) ||
        !nonempty(source.revision) ||
        unresolvedText(source.locator) ||
        unresolvedText(source.revision) ||
        source.verification?.status !== "verified" ||
        !nonempty(source.verification.documentCode) ||
        !/^[A-Z0-9][A-Z0-9._/-]{2,80}$/i.test(source.verification.documentCode) ||
        !normalize(source.revision).includes(
          normalize(source.verification.documentCode),
        ) ||
        source.verification.modelYear !== record.vehicle.modelYear ||
        !nonempty(source.verification.reviewId) ||
        !validDate(source.verification.reviewedAt) ||
        source.verification.reviewedAt > record.reviewedAt,
    )
  )
    return undefined;
  if (
    new Set(record.sources.map((source) => source.sourceId)).size !==
    record.sources.length
  )
    return undefined;
  if (
    typeof record.vehicle.brand !== "string" ||
    typeof record.vehicle.modelVersion !== "string" ||
    !normalize(record.vehicle.brand) ||
    !normalize(record.vehicle.modelVersion) ||
    !record.mileage ||
    !["unlimited", "limited"].includes(record.mileage.kind)
  )
    return undefined;
  if (record.commonPolicy) {
    if (record.usage !== "unknown" || !validCommonPolicy(record))
      return undefined;
  } else if (record.usage === "unknown") return undefined;
  if (record.approvedFingerprint !== factoryWarrantyReviewFingerprint(record))
    return undefined;
  const identity = record.vehicle;
  if (
    typeof vehicle.marca !== "string" ||
    !vehicle.marca ||
    typeof (vehicle.modelo || vehicle.name) !== "string" ||
    !(vehicle.modelo || vehicle.name) ||
    !Number.isInteger(vehicle.anoFabricacao) ||
    !Number.isInteger(vehicle.year)
  )
    return undefined;
  if (
    normalize(vehicle.marca) !== normalize(identity.brand) ||
    normalize(vehicle.modelo || vehicle.name || "") !==
      normalize(identity.modelVersion) ||
    vehicle.anoFabricacao !== identity.manufactureYear ||
    vehicle.year !== identity.modelYear
  )
    return undefined;
  if (
    !Number.isInteger(record.termYears) ||
    record.termYears <= 0 ||
    identity.manufactureYear < 1900 ||
    identity.manufactureYear > Number(today.slice(0, 4)) + 1
  )
    return undefined;
  if (
    !Number.isFinite(vehicle.km) ||
    vehicle.km < 0 ||
    !Number.isFinite(record.reviewedMileageKm) ||
    record.reviewedMileageKm < 0 ||
    vehicle.km < record.reviewedMileageKm
  )
    return undefined;
  if (record.mileage.kind === "unknown") return undefined;
  if (
    record.mileage.kind === "limited" &&
    (!Number.isFinite(record.mileage.limitKm) ||
      record.mileage.limitKm <= 0 ||
      vehicle.km >= record.mileage.limitKm)
  )
    return undefined;
  const estimatedEndYear = identity.manufactureYear + record.termYears;
  const currentYear = Number(today.slice(0, 4));
  if (estimatedEndYear < currentYear) return undefined;
  if (
    record.confirmedExpiryDate &&
    (!validDate(record.confirmedExpiryDate) ||
      record.confirmedExpiryDate < today)
  )
    return undefined;
  // FAB+years cannot identify which month the warranty expires in its final year.
  if (estimatedEndYear === currentYear && !record.confirmedExpiryDate)
    return undefined;
  return {
    estimatedEndYear,
    manufacturer: identity.brand,
    mode: "verified" as const,
    design: "round" as const,
  };
}
