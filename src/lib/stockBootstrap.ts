import type { Vehicle, VehiclesQuery } from "@/catalog/endpoints/vehicles";
import { extractVehicleIdFromSlug } from "@/lib/slug";

type StockBootstrap = {
  generatedAt?: string;
  scope?: "available" | "showroom";
  vehicles?: Vehicle[];
};

declare global {
  interface Window {
    __NETCAR_STOCK__?: StockBootstrap;
  }
}

function allBootstrapVehicles(): Vehicle[] | undefined {
  if (typeof window === "undefined") return undefined;
  const vehicles = window.__NETCAR_STOCK__?.vehicles;
  return Array.isArray(vehicles) ? vehicles : undefined;
}

function normalized(value: unknown): string {
  return String(value || "")
    .trim()
    .toLocaleUpperCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function compact(value: unknown): string {
  return normalized(value).replace(/\s+/g, "");
}

function numericFilter(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const digits = String(value).replace(/[^0-9]/g, "");
  const number = Number(digits);
  return Number.isFinite(number) ? number : undefined;
}

export function getBootstrapVehicles(
  query?: VehiclesQuery,
): Vehicle[] | undefined {
  const bootstrap =
    typeof window === "undefined" ? undefined : window.__NETCAR_STOCK__;
  const vehicles = allBootstrapVehicles();
  if (!vehicles) return undefined;
  // Em navegação SPA, o bootstrap permanece sendo o da primeira rota. Nunca
  // trate a coleção active-only da Home/ficha como showroom completo: isso
  // causaria um primeiro paint parcial seguido do salto para todos os carros.
  if (query?.includeSold && bootstrap?.scope !== "showroom") return undefined;
  // O PHP injeta o showroom completo apenas em /seminovos. Ainda assim, hooks
  // compartilhados nessa rota (Header/SearchBar) precisam continuar vendo só
  // disponíveis, salvo quando includeSold é solicitado explicitamente.
  const scopedVehicles = query?.includeSold
    ? vehicles
    : vehicles.filter((vehicle) => Number(vehicle.price) > 0);
  if (!query) return scopedVehicles;

  const brand = normalized(query.montadora || query.marca);
  const model = normalized(query.modelo);
  const category = normalized(query.categoria);
  const transmission = normalized(query.cambio);
  const color = normalized(query.cor);
  const fuel = normalized(query.combustivel);
  const engine = normalized(query.motor);
  const minPrice = numericFilter(query.valor_min ?? query.precoMin);
  const maxPrice = numericFilter(query.valor_max ?? query.precoMax);
  const minYear = numericFilter(query.ano_min ?? query.anoMin);
  const maxYear = numericFilter(query.ano_max ?? query.anoMax);

  return scopedVehicles.filter((vehicle) => {
    const price = Number(vehicle.price || 0);
    const year = Number(vehicle.year || 0);
    if (brand && normalized(vehicle.marca) !== brand) return false;
    if (
      model &&
      !compact(vehicle.modelo || vehicle.name).includes(compact(model))
    )
      return false;
    if (category && normalized(vehicle.categoria) !== category) return false;
    if (transmission && normalized(vehicle.cambio) !== transmission)
      return false;
    if (color && normalized(vehicle.cor) !== color) return false;
    if (fuel && normalized(vehicle.combustivel) !== fuel) return false;
    if (engine && normalized(vehicle.motor) !== engine) return false;
    if (minPrice !== undefined && price < minPrice) return false;
    if (maxPrice !== undefined && price > maxPrice) return false;
    if (minYear !== undefined && year < minYear) return false;
    if (maxYear !== undefined && year > maxYear) return false;
    return true;
  });
}

export function getBootstrapVehicle(slug: string): Vehicle | undefined {
  const id = extractVehicleIdFromSlug(slug);
  if (!id) return undefined;
  return allBootstrapVehicles()?.find(
    (vehicle) => String(vehicle.id) === String(id),
  );
}
