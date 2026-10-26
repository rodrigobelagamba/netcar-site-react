import type { EquipmentVehicle } from "../../../lib/vehicleEquipment";

export interface VehicleEditorialSummaryInput extends EquipmentVehicle {
  /** The catalog supplies power in cv unless it includes an explicit unit. */
  potencia?: string | number;
  km?: string | number;
  diferenciais?: ReadonlyArray<{ tag?: string | null }> | null;
}

const cleanText = (value: unknown): string =>
  typeof value === "string" || typeof value === "number"
    ? String(value).trim().replace(/\s+/g, " ")
    : "";

function powerLabel(value: unknown): string {
  const match = cleanText(value).match(
    /^(\d{1,4}(?:[.,]\d{1,2})?)\s*(cv|hp)?$/i,
  );
  if (!match || Number(match[1].replace(",", ".")) <= 0) return "";
  return `${match[1]} ${match[2]?.toLowerCase() || "cv"}`;
}

function mileageLabel(value: unknown): string {
  const raw = cleanText(value);
  // Zero often represents a missing value in the feed; it is not a 0 km claim.
  if (!/^\d+$/.test(raw)) return "";
  const mileage = Number(raw);
  return Number.isSafeInteger(mileage) && mileage > 0
    ? `${mileage.toLocaleString("pt-BR")} km`
    : "";
}

/**
 * One short context line, using supplied unit fields only. Equipment is left to
 * the cards; a model name never supplies engine type, power, history or mileage.
 */
export function buildVehicleEditorialSummary(
  vehicle: VehicleEditorialSummaryInput | null | undefined,
): string {
  if (!vehicle) return "";
  const engine = cleanText(vehicle.motor);
  const power = powerLabel(vehicle.potencia);
  const mileage = mileageLabel(vehicle.km);
  const singleOwner =
    vehicle.diferenciais?.some((item) => item.tag === "unico_dono") || false;
  const unit = singleOwner ? "unidade de único dono" : "unidade";
  const engineContext = engine
    ? `Motor ${engine}${power ? ` de ${power}` : ""}`
    : power
      ? `Potência de ${power}`
      : "";

  if (engineContext && mileage) {
    return `${engineContext} nesta ${unit} com ${mileage}.`;
  }
  if (engineContext) return `${engineContext} nesta ${unit}.`;
  if (mileage)
    return `Esta unidade ${singleOwner ? "é de único dono e " : ""}tem ${mileage}.`;
  if (singleOwner) return "Unidade de único dono.";

  const year = cleanText(vehicle.year);
  return /^\d{4}$/.test(year)
    ? `Conheça os diferenciais desta unidade ano-modelo ${year}.`
    : "";
}
