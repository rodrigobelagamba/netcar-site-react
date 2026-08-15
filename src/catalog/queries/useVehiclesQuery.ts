import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import {
  fetchVehicles,
  fetchOpcionais,
  type VehiclesQuery,
} from "../endpoints/vehicles";
import { getBootstrapVehicles } from "@/lib/stockBootstrap";

export function useVehiclesQuery(
  query?: VehiclesQuery,
  options?: { enabled?: boolean; refreshImmediately?: boolean },
) {
  // Cria uma chave de query estável baseada nos valores do objeto
  // Isso garante que mudanças em qualquer campo (incluindo categoria) sejam detectadas
  const queryKey = useMemo(() => {
    if (!query) return ["vehicles"];

    const key: (string | number | undefined)[] = ["vehicles"];

    const brand = query.montadora || query.marca;
    const minPrice = query.valor_min ?? query.precoMin;
    const maxPrice = query.valor_max ?? query.precoMax;
    const minYear = query.ano_min ?? query.anoMin;
    const maxYear = query.ano_max ?? query.anoMax;

    if (brand) key.push("marca", brand);
    if (query.modelo) key.push("modelo", query.modelo);
    if (minPrice !== undefined) key.push("precoMin", minPrice);
    if (maxPrice !== undefined) key.push("precoMax", maxPrice);
    if (minYear !== undefined) key.push("anoMin", minYear);
    if (maxYear !== undefined) key.push("anoMax", maxYear);
    if (query.cambio) key.push("cambio", query.cambio);
    if (query.combustivel) key.push("combustivel", query.combustivel);
    if (query.motor) key.push("motor", query.motor);
    if (query.cor) key.push("cor", query.cor);
    if (query.categoria) key.push("categoria", query.categoria);
    if (query.opcional) key.push("opcional", query.opcional);
    if (query.opcionais) key.push("opcionais", query.opcionais);
    if (query.limit !== undefined) key.push("limit", query.limit);
    if (query.offset !== undefined) key.push("offset", query.offset);
    if (query.fetchAll) key.push("fetchAll", 1);

    return key;
  }, [
    query?.montadora,
    query?.marca,
    query?.modelo,
    query?.valor_min,
    query?.valor_max,
    query?.precoMin,
    query?.precoMax,
    query?.ano_min,
    query?.ano_max,
    query?.anoMin,
    query?.anoMax,
    query?.cambio,
    query?.combustivel,
    query?.motor,
    query?.cor,
    query?.categoria,
    query?.opcional,
    query?.opcionais,
    query?.limit,
    query?.offset,
    query?.fetchAll,
  ]);

  const bootstrapVehicles = useMemo(
    () => getBootstrapVehicles(query),
    [queryKey],
  );
  const result = useQuery({
    queryKey,
    queryFn: () => fetchVehicles(query),
    staleTime: 1000 * 60 * 5, // 5 minutos
    initialData: bootstrapVehicles,
    initialDataUpdatedAt: bootstrapVehicles ? Date.now() : undefined,
    refetchOnMount: bootstrapVehicles
      ? options?.refreshImmediately
        ? "always"
        : false
      : undefined,
    enabled: options?.enabled ?? true,
  });

  useEffect(() => {
    if (
      !bootstrapVehicles ||
      options?.enabled === false ||
      options?.refreshImmediately
    )
      return;
    const timer = window.setTimeout(() => {
      void result.refetch();
    }, 15_000);
    return () => window.clearTimeout(timer);
  }, [
    bootstrapVehicles,
    options?.enabled,
    options?.refreshImmediately,
    result.refetch,
  ]);

  return result;
}

/**
 * Hook para buscar opcionais disponíveis
 */
export function useOpcionaisQuery() {
  return useQuery({
    queryKey: ["vehicles", "opcionais"],
    queryFn: () => fetchOpcionais(),
    staleTime: 1000 * 60 * 60, // 1 hora (opcionais não mudam frequentemente)
  });
}
