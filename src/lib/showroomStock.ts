import type { Vehicle } from "@/catalog/endpoints/vehicles";

export type ShowroomSortOption = "az" | "za" | "preco-asc" | "preco-desc";

export function isSoldShowroomVehicle(vehicle: Vehicle): boolean {
  const price = Number(vehicle.price);
  return !Number.isFinite(price) || price <= 0;
}

function vehicleModel(vehicle: Vehicle): string {
  return (vehicle.modelo || vehicle.name || "").toLocaleLowerCase("pt-BR");
}

function compareModel(left: Vehicle, right: Vehicle): number {
  return vehicleModel(left).localeCompare(vehicleModel(right), "pt-BR");
}

/**
 * Ordena o showroom sem misturar indisponíveis no estoque à venda.
 *
 * A opção escolhida vale dentro de cada grupo; vendidos permanecem sempre no
 * fim, inclusive em "menor preço", embora tenham valor técnico igual a zero.
 */
export function sortShowroomVehicles(
  vehicles: Vehicle[],
  sortBy: ShowroomSortOption,
): Vehicle[] {
  return [...vehicles].sort((left, right) => {
    const leftSold = isSoldShowroomVehicle(left);
    const rightSold = isSoldShowroomVehicle(right);
    if (leftSold !== rightSold) return leftSold ? 1 : -1;

    switch (sortBy) {
      case "za":
        return compareModel(right, left);
      case "preco-asc": {
        const priceDiff = Number(left.price || 0) - Number(right.price || 0);
        return priceDiff || compareModel(left, right);
      }
      case "preco-desc": {
        const priceDiff = Number(right.price || 0) - Number(left.price || 0);
        return priceDiff || compareModel(left, right);
      }
      case "az":
      default:
        return compareModel(left, right);
    }
  });
}
