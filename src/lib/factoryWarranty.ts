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
  scope:
    | "basic-vehicle"
    | "battery"
    | "traction-battery"
    | "powertrain"
    | "extension"
    | "unknown";
  /** Required only for reviewed engine/transmission claims, never inferred. */
  powertrainReview?: {
    coverageSubtype: "engine-and-transmission";
    usageAttestationId: string;
    displayLabel: "Motor e câmbio";
  };
  termYears: number;
  /** Actual use stays unknown when a documented commonPolicy is sufficient. */
  usage: "private" | "commercial" | "unknown";
  commonPolicy?: WarrantyCommonPolicy;
  reviewedMileageKm: number;
  mileage: WarrantyMileage;
  /** Needed in the estimated final year; this is not inferred from FAB. */
  confirmedExpiryDate?: string;
  sources: WarrantySource[];
  /** Separately reviewed coverage; never participates in the general stamp. */
  supplementalCoverages?: FactoryWarrantyTractionBatteryCoverage[];
}

export interface FactoryWarrantyTractionBatteryCoverage {
  recordId: string;
  status: "approved" | "pending" | "revoked" | "ineligible";
  reviewedAt: string;
  /** Binds this coverage to the approved primary unit and its own evidence. */
  approvedFingerprint: string;
  scope: "traction-battery";
  conditionsConfirmed: boolean;
  termYears: number;
  /** This first implementation supports only individually confirmed private use. */
  usage: "private";
  reviewedMileageKm: number;
  mileage: WarrantyMileage;
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
    ...(record.scope === "powertrain"
      ? { powertrainReview: record.powertrainReview || null }
      : {}),
    termYears: record.termYears,
    usage: record.usage,
    commonPolicy: record.commonPolicy || null,
    reviewedMileageKm: record.reviewedMileageKm,
    mileage: record.mileage,
    confirmedExpiryDate: record.confirmedExpiryDate || null,
    sources: record.sources,
  });
}

function tractionBatteryAsRecord(
  primary: FactoryWarrantyRecord,
  coverage: FactoryWarrantyTractionBatteryCoverage,
): FactoryWarrantyRecord {
  return {
    recordId: coverage.recordId,
    status: coverage.status,
    reviewedAt: coverage.reviewedAt,
    approvedFingerprint: coverage.approvedFingerprint,
    vehicle: primary.vehicle,
    optionalId: primary.optionalId,
    optionalConfirmed: primary.optionalConfirmed,
    conditionsConfirmed: coverage.conditionsConfirmed,
    scope: coverage.scope,
    termYears: coverage.termYears,
    usage: coverage.usage,
    reviewedMileageKm: coverage.reviewedMileageKm,
    mileage: coverage.mileage,
    confirmedExpiryDate: coverage.confirmedExpiryDate,
    sources: coverage.sources,
  };
}

export function factoryTractionBatteryReviewFingerprint(
  primary: FactoryWarrantyRecord,
  coverage: FactoryWarrantyTractionBatteryCoverage,
): string {
  return JSON.stringify({
    primaryApprovedFingerprint: primary.approvedFingerprint,
    coverage: JSON.parse(
      factoryWarrantyReviewFingerprint(tractionBatteryAsRecord(primary, coverage)),
    ),
  });
}

/** Internal scope gate; callers cannot turn restricted coverage into a general stamp. */
function resolveFactoryWarrantyCoverage(
  vehicle: WarrantyCatalogVehicle,
  matrix: FactoryWarrantyMatrix,
  today: string,
  expectedScope: "basic-vehicle" | "traction-battery" | "powertrain",
  checkCoverageWindow = true,
  expectedReviewFingerprint?: string,
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
    record.scope !== expectedScope ||
    !["private", "commercial", "unknown"].includes(record.usage)
  )
    return undefined;
  if (
    expectedScope !== "basic-vehicle" &&
    (record.usage !== "private" || record.commonPolicy !== undefined)
  )
    return undefined;
  if (
    expectedScope === "powertrain" &&
    (record.powertrainReview?.coverageSubtype !== "engine-and-transmission" ||
      record.powertrainReview?.displayLabel !== "Motor e câmbio" ||
      !nonempty(record.powertrainReview?.usageAttestationId) ||
      unresolvedText(record.powertrainReview.usageAttestationId))
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
  if (
    record.approvedFingerprint !==
    (expectedReviewFingerprint ?? factoryWarrantyReviewFingerprint(record))
  )
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
      (checkCoverageWindow && vehicle.km >= record.mileage.limitKm))
  )
    return undefined;
  const estimatedEndYear = identity.manufactureYear + record.termYears;
  const currentYear = Number(today.slice(0, 4));
  if (checkCoverageWindow && estimatedEndYear < currentYear) return undefined;
  if (
    record.confirmedExpiryDate &&
    (!validDate(record.confirmedExpiryDate) ||
      (checkCoverageWindow && record.confirmedExpiryDate < today))
  )
    return undefined;
  // FAB+years cannot identify which month the warranty expires in its final year.
  if (
    checkCoverageWindow &&
    estimatedEndYear === currentYear &&
    !record.confirmedExpiryDate
  )
    return undefined;
  return {
    estimatedEndYear,
    manufacturer: identity.brand,
    mode: "verified" as const,
    design: "round" as const,
  };
}

/** No match, stale/incompatible data or uncertainty always means no general stamp. */
export function resolveFactoryWarranty(
  vehicle: WarrantyCatalogVehicle,
  matrix: FactoryWarrantyMatrix,
  today = new Date().toISOString().slice(0, 10),
) {
  return resolveFactoryWarrantyCoverage(vehicle, matrix, today, "basic-vehicle");
}

/** Reviewed engine/transmission coverage only; never a whole-vehicle claim. */
export function resolveFactoryPowertrainWarranty(
  vehicle: WarrantyCatalogVehicle,
  matrix: FactoryWarrantyMatrix,
  today = new Date().toISOString().slice(0, 10),
) {
  const stamp = resolveFactoryWarrantyCoverage(vehicle, matrix, today, "powertrain");
  if (!stamp) return undefined;
  const record = matrix.records.find(
    (entry) => entry?.vehicle?.vehicleId === vehicle.id,
  )!;
  const source = record.sources[0];
  return {
    ...stamp,
    scope: "powertrain" as const,
    termYears: record.termYears,
    sourceUrl: source.url,
    sourceLabel: `Manual ${source.verification.documentCode}`,
    sourceDescription: `${source.revision} ${source.locator}`,
  };
}

/** Traction battery only; the primary unit remains the shared approval boundary. */
export function resolveFactoryTractionBatteryWarranty(
  vehicle: WarrantyCatalogVehicle,
  matrix: FactoryWarrantyMatrix,
  today = new Date().toISOString().slice(0, 10),
) {
  // Validate all primary identity, source, attestation and fingerprint gates.
  // Its elapsed duration or km cap does not shorten independent battery coverage.
  if (
    !resolveFactoryWarrantyCoverage(vehicle, matrix, today, "basic-vehicle", false)
  )
    return undefined;
  const primary = matrix.records.find(
    (entry) => entry?.vehicle?.vehicleId === vehicle.id,
  )!;
  if (primary.usage !== "private" || !Array.isArray(primary.supplementalCoverages))
    return undefined;
  // Do not filter by approved status first: a revocation/duplicate must block.
  const coverages = primary.supplementalCoverages;
  if (coverages.length !== 1) return undefined;
  const coverage = coverages[0];
  if (
    !coverage ||
    coverage.scope !== "traction-battery" ||
    coverage.usage !== "private" ||
    coverage.reviewedAt < primary.reviewedAt ||
    coverage.approvedFingerprint !==
      factoryTractionBatteryReviewFingerprint(primary, coverage)
  )
    return undefined;
  const scopedRecord = tractionBatteryAsRecord(primary, coverage);
  const stamp = resolveFactoryWarrantyCoverage(
    vehicle,
    { ...matrix, records: [scopedRecord] },
    today,
    "traction-battery",
    true,
    factoryTractionBatteryReviewFingerprint(primary, coverage),
  );
  return stamp ? { ...stamp, scope: "traction-battery" as const } : undefined;
}
