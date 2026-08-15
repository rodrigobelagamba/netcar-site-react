import type { Vehicle } from "@/catalog/endpoints/vehicles";

export type ShowroomSortOption = "az" | "za" | "preco-asc" | "preco-desc";

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

/**
 * Na ordem alfabética, ativos e vendidos ficam misturados como antes.
 * Nos modos por preço, vendidos permanecem ao final porque o zero é apenas
 * um marcador técnico de indisponibilidade, não um preço comparável.
 */
export function sortShowroomVehicles(
  vehicles: Vehicle[],
  sortBy: ShowroomSortOption,
): Vehicle[] {
  return [...vehicles].sort((left, right) => {
    switch (sortBy) {
      case "za":
        return compareModel(right, left);
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
