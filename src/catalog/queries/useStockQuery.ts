import { useQuery } from "@tanstack/react-query";
import {
  fetchBrands,
  fetchModels,
  fetchModelsByBrand,
  fetchYears,
  fetchColors,
  fetchMotors,
  fetchFuels,
  fetchTransmissions,
  fetchPriceRanges,
  fetchAllStockData,
} from "../endpoints/stock";

/**
 * Hook para buscar todas as marcas
 */
export function useBrandsQuery() {
  return useQuery({
    queryKey: ["stock", "brands"],
    queryFn: () => fetchBrands(),
    staleTime: 1000 * 60 * 60, // 1 hora
  });
}

/**
 * Hook para buscar todos os modelos
 */
export function useModelsQuery() {
  return useQuery({
    queryKey: ["stock", "models"],
    queryFn: () => fetchModels(),
    staleTime: 1000 * 60 * 60, // 1 hora
  });
}

/**
 * Hook para buscar modelos por marca
 */
export function useModelsByBrandQuery(brand: string) {
  return useQuery({
    queryKey: ["stock", "models", brand],
    queryFn: () => fetchModelsByBrand(brand),
    enabled: !!brand,
    staleTime: 1000 * 60 * 60, // 1 hora
  });
}

/**
 * Hook para buscar todos os anos
 */
export function useYearsQuery() {
  return useQuery({
    queryKey: ["stock", "years"],
    queryFn: () => fetchYears(),
    staleTime: 1000 * 60 * 60, // 1 hora
  });
}

/**
 * Hook para buscar todas as cores
 */
export function useColorsQuery() {
  return useQuery({
    queryKey: ["stock", "colors"],
    queryFn: () => fetchColors(),
    staleTime: 1000 * 60 * 60, // 1 hora
  });
}

/**
 * Hook para buscar todas as motorizações
 */
export function useMotorsQuery() {
  return useQuery({
    queryKey: ["stock", "motors"],
    queryFn: () => fetchMotors(),
    staleTime: 1000 * 60 * 60, // 1 hora
  });
}

/**
 * Hook para buscar todos os tipos de combustível
 */
export function useFuelsQuery() {
  return useQuery({
    queryKey: ["stock", "fuels"],
    queryFn: () => fetchFuels(),
    staleTime: 1000 * 60 * 60, // 1 hora
  });
}

/**
 * Hook para buscar todos os tipos de transmissão
 */
export function useTransmissionsQuery() {
  return useQuery({
    queryKey: ["stock", "transmissions"],
    queryFn: () => fetchTransmissions(),
    staleTime: 1000 * 60 * 60, // 1 hora
  });
}

/**
 * Hook para buscar todas as faixas de preço
 */
export function usePriceRangesQuery() {
  return useQuery({
    queryKey: ["stock", "priceRanges"],
    queryFn: () => fetchPriceRanges(),
    staleTime: 1000 * 60 * 60, // 1 hora
  });
}

/**
 * Hook para buscar todos os dados de estoque de uma vez
 */
export function useAllStockDataQuery() {
  return useQuery({
    queryKey: ["stock", "all"],
    queryFn: () => fetchAllStockData(),
    staleTime: 1000 * 60 * 60, // 1 hora
  });
}

