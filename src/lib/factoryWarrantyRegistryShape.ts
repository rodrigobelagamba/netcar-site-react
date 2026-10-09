import { z } from "zod";
import type { FactoryWarrantyMatrix } from "./factoryWarranty";

// Transport validation only. Documentary/identity/expiry approval remains in
// the canonical resolver; a malformed download is a failed read, not a revocation.
const mileage = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("unknown") }),
  z.object({ kind: z.literal("unlimited") }),
  z.object({ kind: z.literal("limited"), limitKm: z.number().finite() }),
]);
const source = z.object({
  sourceId: z.string(), url: z.string(), locator: z.string(), revision: z.string(),
  verification: z.object({ status: z.enum(["verified", "pending"]), documentCode: z.string(),
    modelYear: z.number().finite(), reviewId: z.string(), reviewedAt: z.string() }).passthrough(),
}).passthrough();
const coverage = z.object({
  recordId: z.string(), status: z.enum(["approved", "pending", "revoked", "ineligible"]),
  reviewedAt: z.string(), approvedFingerprint: z.string(), conditionsConfirmed: z.boolean(),
  scope: z.enum(["basic-vehicle", "battery", "traction-battery", "powertrain", "extension", "unknown"]),
  termYears: z.number().finite(), usage: z.enum(["private", "commercial", "unknown"]),
  reviewedMileageKm: z.number().finite(), mileage, sources: z.array(source).max(100),
  confirmedExpiryDate: z.string().optional(),
}).passthrough();
const identity = z.object({ brand: z.string(), modelVersion: z.string(), manufactureYear: z.number().finite(), modelYear: z.number().finite() });
const record = coverage.extend({
  vehicle: identity.extend({ vehicleId: z.string() }).passthrough(),
  optionalId: z.number().finite(), optionalConfirmed: z.boolean(),
  unitBinding: z.object({ unitKey: z.string(), engine: z.string(), transmission: z.string() }).optional(),
  supplementalCoverages: z.array(coverage).max(10).optional(),
  powertrainReview: z.object({ coverageSubtype: z.string(), usageAttestationId: z.string(), displayLabel: z.string() }).optional(),
  commonPolicy: z.object({
    kind: z.enum(["documented-regime-intersection", "documented-general-rule"]), reviewId: z.string(), basis: z.string(),
    branches: z.array(z.object({ category: z.string(), condition: z.string(), scope: z.string(), termYears: z.number().finite(), mileage, sourceIds: z.array(z.string()) })).max(10),
  }).optional(),
});
const schema = z.object({
  schemaVersion: z.literal(2), enabled: z.boolean(), requireUnitBinding: z.literal(true),
  records: z.array(record).max(1000),
  automation: z.object({ schemaVersion: z.literal(1), rules: z.array(z.object({
    ruleId: z.string(), version: z.string(), status: z.enum(["approved", "pending", "revoked"]),
    templateRecordId: z.string(), allowNewUnits: z.boolean(), approvedFingerprint: z.string(),
    match: identity.extend({ engine: z.string(), transmission: z.string() }),
  })).max(1000) }).optional(),
}).passthrough();

export function parsePublishedWarrantyRegistry(value: unknown): FactoryWarrantyMatrix {
  if (!schema.safeParse(value).success) throw new Error("Registro de garantias incompatível");
  // Preserve the original authority bytes/fields used by reviewed fingerprints.
  return value as FactoryWarrantyMatrix;
}
