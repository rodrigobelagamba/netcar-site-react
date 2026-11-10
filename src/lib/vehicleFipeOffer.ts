import reviewedOffers from "@/data/vehicle-fipe-offers.json";
import { factoryWarrantyToday, type WarrantyCatalogVehicle } from "./factoryWarranty";
import { warrantySnapshotIsFresh } from "./useFactoryWarrantyStamps";

export type FipeOfferVehicle = WarrantyCatalogVehicle & {
  combustivel?: string;
  factoryWarrantyVehicle?: WarrantyCatalogVehicle | null;
};

export interface ReviewedFipeOffer {
  vehicleId: string;
  status: string;
  identity: {
    unitKey: string;
    brand: string;
    modelVersion: string;
    manufactureYear: number;
    modelYear: number;
    engine: string;
    transmission: string;
    fuel: string;
  };
  expectedPrice: number;
  approvedSavings: number;
  claim: { kind: string; amount: number; approvedOn: string; basis: string } | null;
  reference: {
    code: string;
    model: string;
    modelYear: number;
    month: string;
    value: number;
    consultedAt: string;
    sourceUrl: string;
    evidence: string;
  };
}

export interface VehicleFipeOffer {
  vehicleId: string;
  label: string;
  compactLabel: string;
  qualifier: string;
  headline: string;
  savingsLabel: string;
  referenceLabel: string;
  sourceUrl: string;
}

const normalize = (value: unknown) => typeof value === "string"
  ? value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toUpperCase()
  : "";
const money = (value: number) => `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** A reviewed comparison, never a discount applied to the catalog price. */
export function resolveVehicleFipeOffer(
  vehicle?: FipeOfferVehicle | null,
  records: readonly ReviewedFipeOffer[] = reviewedOffers.offers,
  now = Date.now(),
): VehicleFipeOffer | undefined {
  if (!vehicle || !Number.isFinite(now)) return undefined;
  // Only the preserved original catalog observation can establish freshness.
  // Presentation defaults and React Query cache timestamps are not evidence.
  const original = vehicle.factoryWarrantyVehicle;
  if (!original || original.id !== vehicle.id || (vehicle.unitKey !== undefined && vehicle.unitKey !== original.unitKey) || !warrantySnapshotIsFresh(original.observedAt, now)) return undefined;
  const record = records.find((entry) => entry.vehicleId === vehicle.id);
  if (!record || record.status !== "approved" || !record.claim) return undefined;
  const { identity, reference, claim } = record;
  if (!/^(?:vin|plate)-sha256:[a-f0-9]{64}$/.test(identity.unitKey) || original.unitKey !== identity.unitKey) return undefined;
  const exactNumbers = [
    [vehicle.price, original.price, record.expectedPrice],
    [vehicle.year, original.year, identity.modelYear],
    [vehicle.anoFabricacao, original.anoFabricacao, identity.manufactureYear],
  ];
  if (exactNumbers.some(([outer, source, expected]) => !Number.isFinite(outer) || outer !== source || source !== expected || !expected || expected <= 0)) return undefined;
  const exactText = [
    [vehicle.marca, original.marca, identity.brand],
    [vehicle.modelo, original.modelo, identity.modelVersion],
    [vehicle.motor, original.motor, identity.engine],
    [vehicle.cambio, original.cambio, identity.transmission],
  ];
  if (exactText.some(([outer, source, expected]) => !normalize(expected) || normalize(outer) !== normalize(source) || normalize(source) !== normalize(expected))) return undefined;
  if (!normalize(identity.fuel) || normalize(vehicle.combustivel) !== normalize(identity.fuel)) return undefined;
  const today = factoryWarrantyToday(new Date(now));
  const consultedAt = Date.parse(reference.consultedAt);
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(reference.month) || reference.month !== today.slice(0, 7) ||
    !Number.isFinite(consultedAt) || consultedAt > now || factoryWarrantyToday(new Date(consultedAt)).slice(0, 7) !== reference.month ||
    !/^\d{4}-\d{2}-\d{2}$/.test(claim.approvedOn) || claim.approvedOn > today ||
    reference.modelYear !== identity.modelYear || !/^\d{6}-\d$/.test(reference.code) || !reference.model || !reference.evidence || !claim.basis) return undefined;
  let sourceUrl: URL;
  try { sourceUrl = new URL(reference.sourceUrl); } catch { return undefined; }
  if (sourceUrl.origin !== "https://veiculos.fipe.org.br" || sourceUrl.username || sourceUrl.password) return undefined;
  const savings = reference.value - vehicle.price;
  if (!Number.isSafeInteger(reference.value) || !Number.isSafeInteger(record.expectedPrice) ||
    !Number.isSafeInteger(record.approvedSavings) || savings <= 0 || savings !== record.approvedSavings ||
    claim.kind !== "approximately" || claim.amount !== 10000 || record.approvedSavings !== 9452) return undefined;
  // This exact wording/rounding was individually approved; price changes hide
  // the whole comparison instead of silently changing the approved offer.
  return {
    vehicleId: vehicle.id,
    label: "Aproximadamente R$ 10 mil abaixo da FIPE",
    compactLabel: "Aprox. R$ 10 mil abaixo da FIPE",
    qualifier: "Aproximadamente",
    headline: "R$ 10 mil abaixo da FIPE",
    savingsLabel: money(savings),
    referenceLabel: `FIPE ${months[Number(reference.month.slice(5)) - 1]}/${reference.month.slice(0, 4)}: ${money(reference.value)}`,
    sourceUrl: sourceUrl.href,
  };
}
