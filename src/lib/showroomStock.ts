import type { Vehicle } from "@/catalog/endpoints/vehicles";
import { getVehicleMerchandisingPriority } from "@/lib/vehicleMerchandising";

export type ShowroomSortOption =
  | "recomendados"
  | "ano-desc"
  | "az"
  | "preco-asc"
  | "preco-desc";

function vehicleModel(vehicle: Vehicle): string {
  const brand = String(vehicle.marca || "").trim();
  const explicitModel = String(vehicle.modelo || "").trim();
  const fallbackName = String(vehicle.name || "").trim();
  const model =
    explicitModel ||
    (brand &&
    fallbackName
      .toLocaleLowerCase("pt-BR")
      .startsWith(brand.toLocaleLowerCase("pt-BR"))
      ? fallbackName.slice(brand.length).trim()
      : fallbackName);
  return model.toLocaleLowerCase("pt-BR");
}

function compareModel(left: Vehicle, right: Vehicle): number {
  const modelDiff = vehicleModel(left).localeCompare(
    vehicleModel(right),
    "pt-BR",
    { numeric: true },
  );
  if (modelDiff) return modelDiff;
  return String(left.marca || "").localeCompare(
    String(right.marca || ""),
    "pt-BR",
  );
}

function isSold(vehicle: Vehicle): boolean {
  const price = Number(vehicle.price);
  return !Number.isFinite(price) || price <= 0;
}

function recommendationScore(vehicle: Vehicle): number {
  return (
    Number(vehicle.destaque === 1) * 20_000 +
    Number(vehicle.promocao === 1) * 10_000 +
    getVehicleMerchandisingPriority(vehicle)
  );
}

function compareNumericIdDesc(left: Vehicle, right: Vehicle): number {
  const leftId = Number(left.id);
  const rightId = Number(right.id);
  if (!Number.isFinite(leftId) || !Number.isFinite(rightId)) return 0;
  return rightId - leftId;
}

/**
 * Em "recomendados", destaques e promoções vêm primeiro; na ausência dessas
 * marcações, o ID mais alto funciona como desempate de novidade. Vendidos vão
 * ao final nos modos comerciais porque o zero é um marcador técnico de
 * indisponibilidade, não um preço comparável.
 */
export function sortShowroomVehicles(
  vehicles: Vehicle[],
  sortBy: ShowroomSortOption,
): Vehicle[] {
  return [...vehicles].sort((left, right) => {
    switch (sortBy) {
      case "recomendados": {
        if (isSold(left) !== isSold(right)) return isSold(left) ? 1 : -1;
        const scoreDiff =
          recommendationScore(right) - recommendationScore(left);
        return (
          scoreDiff ||
          compareNumericIdDesc(left, right) ||
          compareModel(left, right)
        );
      }
      case "ano-desc": {
        if (isSold(left) !== isSold(right)) return isSold(left) ? 1 : -1;
        const yearDiff = Number(right.year || 0) - Number(left.year || 0);
        return (
          yearDiff ||
          compareNumericIdDesc(left, right) ||
          compareModel(left, right)
        );
      }
      case "preco-asc": {
        if (isSold(left) !== isSold(right)) return isSold(left) ? 1 : -1;
        const priceDiff = Number(left.price || 0) - Number(right.price || 0);
        return priceDiff || compareModel(left, right);
      }
      case "preco-desc": {
        if (isSold(left) !== isSold(right)) return isSold(left) ? 1 : -1;
        const priceDiff = Number(right.price || 0) - Number(left.price || 0);
        return priceDiff || compareModel(left, right);
      }
      case "az":
      default:
        return compareModel(left, right);
    }
  });
}
