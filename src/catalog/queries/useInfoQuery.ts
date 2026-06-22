import { useQuery } from "@tanstack/react-query";
import {
  fetchInfo,
  fetchInfoByType,
  fetchInfoByTitle,
  fetchInfoByLocal,
  fetchInfoCombined,
  type InfoQuery,
} from "../endpoints/info";

/**
 * Hook para buscar informações da tabela info
 */
export function useInfoQuery(query?: InfoQuery) {
  return useQuery({
    queryKey: ["info", query],
    queryFn: () => fetchInfo(query),
    staleTime: 1000 * 60 * 30, // 30 minutos
  });
}

/**
 * Hook para buscar informações por tipo
 */
export function useInfoByTypeQuery(tipo: InfoQuery["tipo"]) {
  return useQuery({
    queryKey: ["info", "type", tipo],
    queryFn: () => fetchInfoByType(tipo),
    enabled: !!tipo,
    staleTime: 1000 * 60 * 30, // 30 minutos
  });
}

/**
 * Hook para buscar informações por título
 */
export function useInfoByTitleQuery(titulo: string) {
  return useQuery({
    queryKey: ["info", "title", titulo],
    queryFn: () => fetchInfoByTitle(titulo),
    enabled: !!titulo,
    staleTime: 1000 * 60 * 30, // 30 minutos
  });
}

/**
 * Hook para buscar informações por local
 */
export function useInfoByLocalQuery(local: InfoQuery["local"]) {
  return useQuery({
    queryKey: ["info", "local", local],
    queryFn: () => fetchInfoByLocal(local),
    enabled: !!local,
    staleTime: 1000 * 60 * 30, // 30 minutos
  });
}

/**
 * Hook para buscar informações com filtros combinados
 */
export function useInfoCombinedQuery(query: InfoQuery) {
  return useQuery({
    queryKey: ["info", "combined", query],
    queryFn: () => fetchInfoCombined(query),
    staleTime: 1000 * 60 * 30, // 30 minutos
  });
}

