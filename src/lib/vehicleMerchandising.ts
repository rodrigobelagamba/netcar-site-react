import type { Vehicle } from "@/catalog/endpoints/vehicles";
import merchandisingConfig from "@/data/vehicle-merchandising.json";

type MerchandisingTemplate = string | null;

type MerchandisingProfile = {
  id: string;
  priority: number;
  cardTemplate: MerchandisingTemplate;
  heroTemplate: MerchandisingTemplate;
  detailTemplate: MerchandisingTemplate;
};

export type VehicleMerchandising = {
  priority: number;
  cardLabel?: string;
  heroLabel?: string;
  detailLabel?: string;
};

export const LOW_MILEAGE_CARD_THRESHOLD_KM = 25_000;

const profiles = new Map(
  (merchandisingConfig.profiles as MerchandisingProfile[]).map((profile) => [
    String(profile.id),
    profile,
  ]),
);
const minimumManualPriority = Math.min(
  ...(merchandisingConfig.profiles as MerchandisingProfile[])
    .map((profile) => Number(profile.priority))
    .filter((priority) => Number.isFinite(priority) && priority > 0),
);

function automaticLowMileagePriority(km: number): number {
  const rawPriority =
    25 + Math.round((LOW_MILEAGE_CARD_THRESHOLD_KM - km) / 1_000);
  const manualCeiling = Number.isFinite(minimumManualPriority)
    ? Math.max(1, minimumManualPriority - 1)
    : rawPriority;
  return Math.min(rawPriority, manualCeiling);
}

function formatInteger(value: unknown): string {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "";
  }
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? Math.round(number).toLocaleString("pt-BR")
    : "";
}

function resolveTemplate(
  template: MerchandisingTemplate,
  vehicle: Pick<Vehicle, "km" | "year" | "potencia">,
): string | undefined {
  if (!template) return undefined;

  const values = {
    km: formatInteger(vehicle.km),
    year:
      vehicle.year !== null &&
      vehicle.year !== undefined &&
      String(vehicle.year).trim() !== "" &&
      Number.isFinite(Number(vehicle.year)) &&
      Number(vehicle.year) > 0
        ? String(Math.round(Number(vehicle.year)))
        : "",
    power: formatInteger(vehicle.potencia),
  };
  const requiredValues = Array.from(
    template.matchAll(/\{(km|year|power)\}/g),
    (match) => values[match[1] as keyof typeof values],
  );
  if (requiredValues.some((value) => !value)) return undefined;

  const resolved = template.replace(
    /\{(km|year|power)\}/g,
    (_, key: keyof typeof values) => values[key],
  );

  return /\{[^}]+\}/.test(resolved)
    ? undefined
    : resolved.replace(/\s+/g, " ").trim() || undefined;
}

export function getVehicleMerchandising(
  vehicle: Pick<Vehicle, "id" | "km" | "year" | "potencia">,
): VehicleMerchandising | undefined {
  const profile = profiles.get(String(vehicle.id));
  if (!profile) return undefined;

  return {
    priority: profile.priority,
    cardLabel: resolveTemplate(profile.cardTemplate, vehicle),
    heroLabel: resolveTemplate(profile.heroTemplate, vehicle),
    detailLabel: resolveTemplate(profile.detailTemplate, vehicle),
  };
}

export function getVehicleMerchandisingPriority(
  vehicle: Pick<Vehicle, "id" | "km" | "year" | "potencia">,
): number {
  const configuredPriority = getVehicleMerchandising(vehicle)?.priority || 0;
  if (configuredPriority > 0) return configuredPriority;

  const km = Number(vehicle.km);
  if (!Number.isFinite(km) || km <= 0 || km >= LOW_MILEAGE_CARD_THRESHOLD_KM) {
    return 0;
  }

  // Mantém os carros com baixa quilometragem acima dos destaques genéricos,
  // sem ultrapassar os veículos escolhidos manualmente como protagonistas.
  return automaticLowMileagePriority(km);
}

export function getVehicleLowMileageCardLabel(
  vehicle: Pick<Vehicle, "km">,
): string | undefined {
  const km = Number(vehicle.km);
  if (!Number.isFinite(km) || km <= 0 || km >= LOW_MILEAGE_CARD_THRESHOLD_KM) {
    return undefined;
  }

  return `APENAS ${Math.round(km).toLocaleString("pt-BR")} KM`;
}

/**
 * Média brasileira de uso fica em ~12–15 mil km/ano. Abaixo de 10 mil/ano a
 * afirmação "bem abaixo da média" é verdadeira sem precisar mostrar a km.
 */
export const LOW_ANNUAL_MILEAGE_THRESHOLD_KM = 10_000;
export const LOW_ANNUAL_MILEAGE_CARD_LABEL = "< 10 mil km/ano";
export const LOW_ANNUAL_MILEAGE_DETAIL_LABEL = "Menos de 10 mil km por ano";

/**
 * Km por ano de uso, contado pelo ano de fabricação (não pelo ano-modelo).
 * Sem ano de fabricação cai no ano-modelo, que é igual ou maior — resultado
 * fica conservador. Carro com menos de um ano completo não entra.
 */
export function getVehicleAnnualMileage(
  vehicle: Pick<Vehicle, "km" | "anoFabricacao" | "year">,
  referenceYear = new Date().getFullYear(),
): number | undefined {
  const km = Number(vehicle.km);
  const manufactureYear = Number(vehicle.anoFabricacao || vehicle.year);
  if (!Number.isFinite(km) || km <= 0) return undefined;
  if (!Number.isFinite(manufactureYear) || manufactureYear <= 0) return undefined;
  const yearsInUse = referenceYear - manufactureYear;
  if (yearsInUse < 1) return undefined;
  return km / yearsInUse;
}

export function hasVehicleLowAnnualMileage(
  vehicle: Pick<Vehicle, "km" | "anoFabricacao" | "year">,
): boolean {
  const perYear = getVehicleAnnualMileage(vehicle);
  return perYear !== undefined && perYear < LOW_ANNUAL_MILEAGE_THRESHOLD_KM;
}

export function hasVehicleFactoryWarranty(
  vehicle: Pick<Vehicle, "diferenciais">,
): boolean {
  return Boolean(
    vehicle.diferenciais?.some(
      (differential) => differential.tag === "garantia_fabrica",
    ),
  );
}

export function hasVehicleIcheck(
  vehicle: Pick<Vehicle, "pdf" | "pdf_url">,
): boolean {
  return Boolean(vehicle.pdf || vehicle.pdf_url);
}
