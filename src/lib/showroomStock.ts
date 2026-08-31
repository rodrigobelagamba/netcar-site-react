import type { Vehicle } from "@/catalog/endpoints/vehicles";

export type ShowroomSortOption =
  | "recomendados"
  | "ano-desc"
  | "az"
  | "preco-asc"
  | "preco-desc";

function vehicleModel(vehicle: Vehicle): string {
  return (vehicle.modelo || vehicle.name || "").toLocaleLowerCase("pt-BR");
}

function compareModel(left: Vehicle, right: Vehicle): number {
  return vehicleModel(left).localeCompare(vehicleModel(right), "pt-BR");
}

function isSold(vehicle: Vehicle): boolean {
  const price = Number(vehicle.price);
  return !Number.isFinite(price) || price <= 0;
}

function recommendationScore(vehicle: Vehicle): number {
  return Number(vehicle.destaque === 1) * 2 + Number(vehicle.promocao === 1);
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
