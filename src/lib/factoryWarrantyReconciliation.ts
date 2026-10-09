import {
  factoryWarrantyReviewFingerprint,
  factoryWarrantyToday,
  resolveFactoryWarranty,
  resolveFactoryPowertrainWarranty,
  resolveFactoryTractionBatteryWarranty,
  type FactoryWarrantyAutomationRule,
  type FactoryWarrantyMatrix,
  type FactoryWarrantyRecord,
  type WarrantyCatalogVehicle,
} from "./factoryWarranty";

const normalize = (value: unknown) =>
  typeof value === "string"
    ? value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .replace(/\s+/g, " ")
        .toUpperCase()
    : "";
const text = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const validUnitKey = (value: unknown): value is string =>
  typeof value === "string" &&
  /^(?:vin|plate)-sha256:[a-f0-9]{64}$/.test(value);

/** Canonical review snapshot, not a cryptographic signature or technical approval. */
export function factoryWarrantyRuleFingerprint(
  rule: FactoryWarrantyAutomationRule,
  matrix: FactoryWarrantyMatrix,
): string {
  const templates = (
    Array.isArray(matrix.records) ? matrix.records : []
  ).filter((record) => record?.recordId === rule.templateRecordId);
  return JSON.stringify({
    schemaVersion: 1,
    ruleId: rule.ruleId,
    version: rule.version,
    status: rule.status,
    templateRecordId: rule.templateRecordId,
    match: rule.match,
    allowNewUnits: rule.allowNewUnits,
    // Bind the complete existing approval, including manual revocation and any
    // supplemental coverage that makes a template non-transferable.
    templates,
  });
}

export interface FactoryWarrantyReconciliation {
  matrix: FactoryWarrantyMatrix;
  status: "eligible" | "pending" | "blocked";
  reason: string;
  ruleId?: string;
  ruleVersion?: string;
  ruleFingerprint: string;
  inputFingerprint: string;
}

/** Includes every eligibility input; excludes fetch time to keep repeat runs idempotent. */
export function factoryWarrantyInputFingerprint(
  vehicle: WarrantyCatalogVehicle,
): string {
  return JSON.stringify({
    id: vehicle.id,
    unitKey: vehicle.unitKey ?? null,
    brand: normalize(vehicle.marca),
    modelVersion: normalize(vehicle.modelo || vehicle.name),
    engine: normalize(vehicle.motor),
    transmission: normalize(vehicle.cambio),
    manufactureYear: vehicle.anoFabricacao ?? null,
    modelYear: vehicle.year,
    mileageKm: vehicle.km,
    available: Number.isFinite(vehicle.price) && vehicle.price > 0,
    warrantyFlag: Array.isArray(vehicle.diferenciais)
      ? vehicle.diferenciais.some((entry) => entry?.tag === "garantia_fabrica")
      : null,
  });
}

function matches(
  rule: FactoryWarrantyAutomationRule,
  vehicle: WarrantyCatalogVehicle,
) {
  const match = rule?.match;
  return (
    !!match &&
    normalize(match.brand) === normalize(vehicle.marca) &&
    normalize(match.modelVersion) ===
      normalize(vehicle.modelo || vehicle.name) &&
    normalize(match.engine) === normalize(vehicle.motor) &&
    normalize(match.transmission) === normalize(vehicle.cambio) &&
    match.manufactureYear === vehicle.anoFabricacao &&
    match.modelYear === vehicle.year
  );
}

function eligible(
  vehicle: WarrantyCatalogVehicle,
  matrix: FactoryWarrantyMatrix,
  today: string,
) {
  return !!(
    resolveFactoryWarranty(vehicle, matrix, today) ||
    resolveFactoryPowertrainWarranty(vehicle, matrix, today) ||
    resolveFactoryTractionBatteryWarranty(vehicle, matrix, today)
  );
}

function existingReason(
  vehicle: WarrantyCatalogVehicle,
  record: FactoryWarrantyRecord,
  today: string,
) {
  if (record.status !== "approved") return `manual-${record.status}`;
  if (!Array.isArray(record.sources) || !record.sources.length)
    return "document-missing";
  if (
    record.sources.some((source) => source?.verification?.status !== "verified")
  )
    return "document-review-required";
  if (
    record.unitBinding?.unitKey !== undefined &&
    record.unitBinding.unitKey !== vehicle.unitKey
  )
    return "unit-identity-changed";
  if (
    record.unitBinding &&
    (normalize(record.unitBinding.engine) !== normalize(vehicle.motor) ||
      normalize(record.unitBinding.transmission) !== normalize(vehicle.cambio))
  )
    return "mechanical-specification-changed";
  if (
    normalize(record.vehicle.brand) !== normalize(vehicle.marca) ||
    normalize(record.vehicle.modelVersion) !==
      normalize(vehicle.modelo || vehicle.name) ||
    record.vehicle.manufactureYear !== vehicle.anoFabricacao ||
    record.vehicle.modelYear !== vehicle.year
  )
    return "vehicle-identity-changed";
  if (!Number.isFinite(vehicle.km) || vehicle.km < record.reviewedMileageKm)
    return "mileage-invalid-or-regressed";
  if (record.mileage.kind === "limited" && vehicle.km >= record.mileage.limitKm)
    return "mileage-limit-reached";
  if (record.confirmedExpiryMonth !== undefined) {
    if (
      record.confirmedExpiryDate !== undefined ||
      typeof record.confirmedExpiryMonth !== "string" ||
      record.confirmedExpiryMonth.length !== 7 ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(record.confirmedExpiryMonth)
    )
      return "confirmed-expiry-invalid";
    if (record.confirmedExpiryMonth < today.slice(0, 7))
      return "coverage-expired";
    if (record.confirmedExpiryMonth === today.slice(0, 7))
      return "confirmed-expiry-day-required";
  }
  if (record.confirmedExpiryDate && record.confirmedExpiryDate < today)
    return "coverage-expired";
  const endYear = record.vehicle.manufactureYear + record.termYears;
  if (endYear < Number(today.slice(0, 4))) return "coverage-expired";
  if (
    endYear === Number(today.slice(0, 4)) &&
    !record.confirmedExpiryDate &&
    record.confirmedExpiryMonth === undefined
  )
    return "confirmed-expiry-required";
  return "approval-evidence-incompatible";
}

/**
 * Reuses the sole warranty matrix. New records are derived in memory only from
 * exact, explicitly approved documentary rules; manual decisions always win.
 * Every call revalidates current inputs and the original resolver's gates.
 */
function reconcileFactoryWarrantyVehicleUnchecked(
  vehicle: WarrantyCatalogVehicle,
  matrix: FactoryWarrantyMatrix,
  today: string,
): FactoryWarrantyReconciliation {
  const inputFingerprint = factoryWarrantyInputFingerprint(vehicle);
  const principals = (
    Array.isArray(matrix?.records) ? matrix.records : []
  ).filter((record) => record?.vehicle?.vehicleId === vehicle.id);
  const result = (
    status: FactoryWarrantyReconciliation["status"],
    reason: string,
    patch: Partial<FactoryWarrantyReconciliation> = {},
  ): FactoryWarrantyReconciliation => ({
    matrix,
    status,
    reason,
    inputFingerprint,
    ruleFingerprint: JSON.stringify({
      schemaVersion: matrix?.schemaVersion,
      enabled: matrix?.enabled,
      requireUnitBinding: matrix?.requireUnitBinding === true,
      principals,
    }),
    ...(principals.length === 1
      ? {
          ruleId: `unit:${principals[0].recordId}`,
          ruleVersion: principals[0].reviewedAt,
        }
      : {}),
    ...patch,
  });
  if (
    matrix?.schemaVersion !== 2 ||
    matrix.enabled !== true ||
    !Array.isArray(matrix.records)
  )
    return result("blocked", "registry-unavailable");
  if (!Number.isFinite(vehicle.price) || vehicle.price <= 0)
    return result("blocked", "vehicle-unavailable");
  if (!Array.isArray(vehicle.diferenciais))
    return result("pending", "warranty-flag-unknown");
  if (!vehicle.diferenciais.some((entry) => entry?.tag === "garantia_fabrica"))
    return result("blocked", "warranty-flag-removed");
  // A changed catalog ID must not bypass an existing decision for this unit.
  if (
    validUnitKey(vehicle.unitKey) &&
    matrix.records.some(
      (record) =>
        record?.unitBinding?.unitKey === vehicle.unitKey &&
        record?.vehicle?.vehicleId !== vehicle.id,
    )
  )
    return result("blocked", "unit-id-changed");
  if (principals.length > 1)
    return result("blocked", "conflicting-unit-records");
  if (principals.length === 1) {
    const record = principals[0];
    if (eligible(vehicle, matrix, today))
      return result("eligible", "reviewed-unit-compatible");
    if (matrix.requireUnitBinding === true && !record.unitBinding)
      return result("blocked", "unit-binding-required");
    return result(
      record.status === "pending" ? "pending" : "blocked",
      existingReason(vehicle, record, today),
    );
  }
  if (
    !validUnitKey(vehicle.unitKey) ||
    !text(vehicle.marca) ||
    !text(vehicle.modelo || vehicle.name) ||
    !text(vehicle.motor) ||
    !text(vehicle.cambio) ||
    !Number.isInteger(vehicle.anoFabricacao) ||
    !Number.isInteger(vehicle.year) ||
    !Number.isFinite(vehicle.km) ||
    vehicle.km < 0
  )
    return result("pending", "unit-data-incomplete");
  const automation = matrix.automation;
  if (automation?.schemaVersion !== 1 || !Array.isArray(automation.rules))
    return result("pending", "no-approved-compatible-rule");
  const candidates = automation.rules.filter((rule) => matches(rule, vehicle));
  if (candidates.length !== 1)
    return result(
      "pending",
      candidates.length
        ? "conflicting-compatible-rules"
        : "no-approved-compatible-rule",
    );
  const rule = candidates[0];
  const ruleFingerprint = factoryWarrantyRuleFingerprint(rule, matrix);
  const provenance = {
    ruleId: rule.ruleId,
    ruleVersion: rule.version,
    ruleFingerprint,
  };
  if (
    !text(rule.ruleId) ||
    !text(rule.version) ||
    rule.status !== "approved" ||
    rule.allowNewUnits !== true ||
    rule.approvedFingerprint !== ruleFingerprint ||
    automation.rules.filter((entry) => entry.ruleId === rule.ruleId).length !==
      1
  )
    return result("pending", "rule-approval-required", provenance);
  const templates = matrix.records.filter(
    (record) => record?.recordId === rule.templateRecordId,
  );
  if (templates.length !== 1)
    return result("pending", "rule-template-conflict", provenance);
  const template = templates[0];
  if (
    template.status !== "approved" ||
    template.scope !== "basic-vehicle" ||
    template.usage !== "unknown" ||
    !template.commonPolicy ||
    template.supplementalCoverages !== undefined ||
    template.powertrainReview !== undefined ||
    template.confirmedExpiryDate !== undefined ||
    template.confirmedExpiryMonth !== undefined ||
    template.approvedFingerprint !== factoryWarrantyReviewFingerprint(template)
  )
    return result("pending", "rule-template-not-reusable", provenance);
  // The approved match must describe this exact template, including its engine.
  // An edited rule cannot reclassify an unrelated manual/model as compatible.
  if (
    !template.unitBinding ||
    !matches(rule, {
      id: template.vehicle.vehicleId,
      marca: template.vehicle.brand,
      modelo: template.vehicle.modelVersion,
      motor: template.unitBinding.engine,
      cambio: template.unitBinding.transmission,
      anoFabricacao: template.vehicle.manufactureYear,
      year: template.vehicle.modelYear,
      km: template.reviewedMileageKm,
      price: vehicle.price,
    })
  )
    return result("pending", "rule-template-identity-conflict", provenance);
  const derived: FactoryWarrantyRecord = {
    ...template,
    recordId: `rule:${rule.ruleId}:${rule.version}:${vehicle.id}:${vehicle.unitKey}`,
    vehicle: { ...template.vehicle, vehicleId: vehicle.id },
    unitBinding: {
      unitKey: vehicle.unitKey,
      engine: vehicle.motor!,
      transmission: vehicle.cambio!,
    },
    reviewedMileageKm: vehicle.km,
    approvedFingerprint: "",
  };
  derived.approvedFingerprint = factoryWarrantyReviewFingerprint(derived);
  const effective = { ...matrix, records: [...matrix.records, derived] };
  if (!resolveFactoryWarranty(vehicle, effective, today))
    return result(
      "blocked",
      existingReason(vehicle, derived, today),
      provenance,
    );
  return result("eligible", "approved-exact-rule-applied", {
    ...provenance,
    matrix: effective,
  });
}

/** Remote registries are untrusted input; malformed data can only hide stamps. */
export function reconcileFactoryWarrantyVehicle(
  vehicle: WarrantyCatalogVehicle,
  matrix: FactoryWarrantyMatrix,
  today = factoryWarrantyToday(),
): FactoryWarrantyReconciliation {
  try {
    return reconcileFactoryWarrantyVehicleUnchecked(vehicle, matrix, today);
  } catch {
    return {
      matrix: {
        schemaVersion: 2,
        enabled: false,
        requireUnitBinding: true,
        records: [],
      },
      status: "blocked",
      reason: "registry-invalid",
      inputFingerprint: "invalid-input",
      ruleFingerprint: "invalid-registry",
    };
  }
}
