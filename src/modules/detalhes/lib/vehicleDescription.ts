import type { ParsedGptContent } from "../../../lib/parseGptContent";
import {
  resolveVehicleEquipment,
  type EquipmentVehicle,
} from "../../../lib/vehicleEquipment";

type DescriptionVehicle = EquipmentVehicle & { combustivel?: string };

const text = (value: unknown): string =>
  typeof value === "string" || typeof value === "number"
    ? String(value).trim().replace(/\s+/g, " ")
    : "";

/**
 * Every claim comes from the current inventory or the shared reviewed resolver.
 * Free-form announcement text is deliberately not an input: filtering individual
 * phrases cannot establish that the rest describes this particular vehicle.
 */
export function buildVehicleDescription(
  vehicle: DescriptionVehicle | null | undefined,
): ParsedGptContent | null {
  if (!vehicle) return null;
  const model = text(vehicle.modelo) || text(vehicle.name);
  if (!model) return null;

  const brand = text(vehicle.marca);
  const name =
    brand &&
    !model
      .toLocaleLowerCase("pt-BR")
      .startsWith(brand.toLocaleLowerCase("pt-BR"))
      ? `${brand} ${model}`
      : model;
  const year = text(vehicle.year);
  const manufactureYear = text(vehicle.anoFabricacao);
  const years = year
    ? manufactureYear
      ? `, ano/modelo ${manufactureYear}/${year}`
      : `, ano-modelo ${year}`
    : "";

  const specifications = [
    { label: "Motor:", texto: text(vehicle.motor) },
    { label: "Combustível:", texto: text(vehicle.combustivel) },
    { label: "Câmbio:", texto: text(vehicle.cambio) },
  ].filter((item) => item.texto);
  const categories = new Map<string, Array<{ texto: string }>>();
  for (const item of resolveVehicleEquipment(vehicle).items) {
    const category = categories.get(item.category) || [];
    category.push({ texto: item.description });
    categories.set(item.category, category);
  }

  return {
    apresentacao: `${name}${years}.`,
    accordions: [
      ...(specifications.length
        ? [{ title: "Dados do veículo", content: { itens: specifications } }]
        : []),
      ...Array.from(categories, ([title, itens]) => ({
        title,
        content: { itens },
      })),
    ],
  };
}
