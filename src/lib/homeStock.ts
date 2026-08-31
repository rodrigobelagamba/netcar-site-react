import type { Vehicle } from "@/catalog/endpoints/vehicles";
import { getVehicleMerchandisingPriority } from "@/lib/vehicleMerchandising";

/** Veículo disponível no estoque com foto para exibir na Home. */
export function isAvailableHomeStockVehicle(vehicle: Vehicle): boolean {
  const price =
    typeof vehicle.price === "number" ? vehicle.price : Number(vehicle.price);
  if (!price || Number.isNaN(price) || price <= 0) return false;

  const temFotos = vehicle.imagens_site?.tem_fotos;
  if (temFotos === 0 || temFotos === undefined || temFotos === null)
    return false;

  return true;
}

function byNewestId(a: Vehicle, b: Vehicle): number {
  return (parseInt(b.id, 10) || 0) - (parseInt(a.id, 10) || 0);
}

function byMerchandisingPriority(a: Vehicle, b: Vehicle): number {
  return (
    getVehicleMerchandisingPriority(b) - getVehicleMerchandisingPriority(a)
  );
}

/**
 * Ordem da Home:
 * 1) `destaque=1` na API (cadastro interno)
 * 2) carros com curadoria comercial vigente
 * 3) demais veículos, do mais recente (ID maior) para o mais antigo
 */
export function sortHomeStockVehicles(vehicles: Vehicle[]): Vehicle[] {
  const available = vehicles.filter(isAvailableHomeStockVehicle);
  const highlighted = available
    .filter((v) => v.destaque === 1)
    .sort(
      (left, right) =>
        byMerchandisingPriority(left, right) || byNewestId(left, right),
    );
  const regular = available
    .filter((v) => v.destaque !== 1)
    .sort(
      (left, right) =>
        byMerchandisingPriority(left, right) || byNewestId(left, right),
    );
  return [...highlighted, ...regular];
}

/**
 * Card grande do painel em ordem estável.
 *
 * Não sortear aqui: uma escolha aleatória impede o servidor de antecipar a
 * imagem do LCP e ainda muda o conteúdo principal entre visitas/crawlers.
 */
export function pickFeaturedHomeVehicle(
  vehicles: Vehicle[],
): Vehicle | undefined {
  const pool = sortHomeStockVehicles(vehicles);
  return pool[0];
}

/** Grid "Destaques do estoque" — pode excluir o carro já exibido no painel. */
export function pickHomeHighlightVehicles(
  vehicles: Vehicle[],
  limit: number,
  excludeIds: string[] = [],
): Vehicle[] {
  const exclude = new Set(excludeIds);
  return sortHomeStockVehicles(vehicles)
    .filter((vehicle) => !exclude.has(vehicle.id))
    .slice(0, limit);
}
