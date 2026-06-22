/**
 * Cliente HTTP do catálogo Netcar (veículos, site, stock).
 *
 * Exemplo: import { useVehiclesQuery } from '@/catalog';
 */

// Vehicles
export * from "./endpoints/vehicles";
export * from "./queries/useVehicleQuery";
export * from "./queries/useVehiclesQuery";

// Stock
export * from "./endpoints/stock";
export * from "./queries/useStockQuery";

// Depoimentos
export * from "./endpoints/depoimentos";
export * from "./queries/useDepoimentosQuery";

// Site
export * from "./endpoints/site";
export * from "./queries/useSiteQuery";

// Info
export * from "./endpoints/info";
export * from "./queries/useInfoQuery";

// Categorias
export * from "./endpoints/categorias";
export * from "./queries/useCategoriasQuery";

// Anúncios
export * from "./endpoints/anuncios";
export * from "./queries/useAnuncioQuery";

export { axiosInstance } from "./axios-instance";
export { config } from "./config";
