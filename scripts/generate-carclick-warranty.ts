import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  factoryWarrantyToday,
  resolveFactoryWarranty,
  resolveFactoryPowertrainWarranty,
  resolveFactoryTractionBatteryWarranty,
  type FactoryWarrantyMatrix,
  type FactoryWarrantyRecord,
  type FactoryWarrantyTractionBatteryCoverage,
} from "../src/lib/factoryWarranty";
import { reconcileFactoryWarrantyVehicle } from "../src/lib/factoryWarrantyReconciliation";
import { factoryWarrantyCatalogFromApi } from "../src/lib/factoryWarrantyCatalog.js";

type Alias = { vehicleId: string; canonicalModel: string; rawModel: string; unitKey: string };
const normalized = (value: unknown) => typeof value === "string"
  ? value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toUpperCase() : "";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

/** Expiry guard only: never an advertised expiry date or a new warranty term. */
function coverageWindow(record: FactoryWarrantyRecord, coverage: FactoryWarrantyRecord | FactoryWarrantyTractionBatteryCoverage) {
  const endYear = record.vehicle.manufactureYear + coverage.termYears;
  const boundaries = [`${endYear + 1}-01-01`];
  if (coverage.confirmedExpiryDate) {
    const nextDay = new Date(`${coverage.confirmedExpiryDate}T12:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    boundaries.push(nextDay.toISOString().slice(0, 10));
  } else if (coverage.confirmedExpiryMonth) {
    boundaries.push(`${coverage.confirmedExpiryMonth}-01`);
  } else boundaries.push(`${endYear}-01-01`);
  return {
    scope: coverage.scope,
    validBefore: boundaries.sort()[0],
    ...(coverage.confirmedExpiryDate || coverage.confirmedExpiryMonth
      ? { advertisedExpiryMonth: coverage.confirmedExpiryDate?.slice(0, 7) || coverage.confirmedExpiryMonth }
      : {}),
    minimumMileageKm: coverage.reviewedMileageKm,
    mileage: coverage.mileage,
    ...(coverage.scope === "powertrain" && record.currentCoverageConfirmation
      ? { exactMileageKm: record.currentCoverageConfirmation.mileageKm } : {}),
  };
}

/** A projection of the canonical resolver, not another source of approvals. */
export function buildCarclickWarrantyManifest(
  matrixBytes: string,
  vehicles: unknown[],
  aliases: Alias[],
  today = factoryWarrantyToday(),
) {
  const matrix = JSON.parse(matrixBytes) as FactoryWarrantyMatrix;
  const claims = [];
  const counts = new Map<string, number>();
  for (const row of vehicles) {
    const id = (row as { id?: unknown })?.id;
    if (typeof id === "string") counts.set(id, (counts.get(id) || 0) + 1);
  }
  for (const row of vehicles) {
    const vehicle = factoryWarrantyCatalogFromApi(row);
    if (!vehicle || counts.get(vehicle.id) !== 1 || !vehicle.unitKey) continue;
    const reconciliation = reconcileFactoryWarrantyVehicle(vehicle, matrix, today);
    if (reconciliation.status !== "eligible") continue;
    const effective = reconciliation.matrix;
    const record = effective.records.find((entry) => entry.vehicle.vehicleId === vehicle.id);
    if (!record) continue;
    const applicableAliases = aliases.filter((entry) => entry.vehicleId === vehicle.id
      && entry.unitKey === vehicle.unitKey && normalized(entry.canonicalModel) === normalized(vehicle.modelo));
    // Known XML/API naming differences are unit-bound and explicitly reviewed.
    // A new exact match needs no alias; no suffix or family guessing is allowed.
    if (applicableAliases.length > 1) continue;
    const rawModel = applicableAliases[0]?.rawModel || vehicle.modelo;
    if (!normalized(rawModel)) continue;
    const coverages = [];
    if (resolveFactoryWarranty(vehicle, effective, today)) coverages.push(coverageWindow(record, record));
    if (resolveFactoryPowertrainWarranty(vehicle, effective, today)) coverages.push(coverageWindow(record, record));
    if (resolveFactoryTractionBatteryWarranty(vehicle, effective, today)) {
      const battery = record.supplementalCoverages?.filter((entry) => entry.scope === "traction-battery");
      if (battery?.length === 1) coverages.push(coverageWindow(record, battery[0]));
    }
    if (!coverages.length) continue;
    claims.push({
      id: vehicle.id,
      brand: normalized(vehicle.marca),
      canonicalModel: normalized(vehicle.modelo),
      rawModel: normalized(rawModel),
      manufactureYear: vehicle.anoFabricacao,
      modelYear: vehicle.year,
      engine: normalized(vehicle.motor),
      transmission: normalized(vehicle.cambio),
      unitKey: vehicle.unitKey,
      requiresWarrantyFlag: record.catalogConfirmation === undefined,
      coverages,
    });
  }
  return { schemaVersion: 1, authoritySha256: hash(matrixBytes), generatedForDay: today, claims };
}

function main() {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const matrixBytes = readFileSync(resolve(root, "public/seo/factory-warranty-registry.json"), "utf8");
  const aliases = JSON.parse(readFileSync(resolve(root, "src/data/carclick-warranty-model-aliases.json"), "utf8")) as Alias[];
  let vehicles: unknown[] = [];
  // Reuse the complete source frozen by the existing build. Never collect stock.
  try {
    const snapshot = JSON.parse(readFileSync(resolve(root, ".devops/seo-build-stock.json"), "utf8"));
    const age = Date.now() - Date.parse(snapshot.createdAt);
    if (age >= 0 && age <= 30 * 60_000 && Number.isFinite(snapshot.sourceAgeMs)
      && snapshot.sourceAgeMs >= 0 && snapshot.sourceAgeMs <= 30 * 60_000
      && Array.isArray(snapshot.vehicles)) vehicles = snapshot.vehicles;
  } catch { /* Missing/stale source produces no claims, not guessed warranty. */ }
  const manifest = buildCarclickWarrantyManifest(matrixBytes, vehicles, aliases);
  writeFileSync(resolve(root, "public/feeds/carclick-warranty.json"), `${JSON.stringify(manifest)}\n`);
  console.log(`Carclick: ${manifest.claims.length} garantias derivadas do registro canônico; sem datas estimadas ou km no texto.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
