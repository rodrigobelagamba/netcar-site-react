import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchVehicles, fetchOpcionais, type VehiclesQuery } from "../endpoints/vehicles";

export function useVehiclesQuery(query?: VehiclesQuery) {
  // Cria uma chave de query estável baseada nos valores do objeto
  // Isso garante que mudanças em qualquer campo (incluindo categoria) sejam detectadas
  const queryKey = useMemo(() => {
    if (!query) return ["vehicles"];
    
    // Cria uma chave baseada nos valores, não na referência do objeto
    const key: (string | number | undefined)[] = ["vehicles"];
    
    // Adiciona todos os campos na mesma ordem sempre para garantir consistência
    if (query.marca) key.push("marca", query.marca);
    if (query.modelo) key.push("modelo", query.modelo);
    if (query.precoMin) key.push("precoMin", query.precoMin);
    if (query.precoMax) key.push("precoMax", query.precoMax);
    if (query.anoMin) key.push("anoMin", query.anoMin);
    if (query.anoMax) key.push("anoMax", query.anoMax);
    if (query.cambio) key.push("cambio", query.cambio);
    if (query.cor) key.push("cor", query.cor);
    if (query.categoria) key.push("categoria", query.categoria);
    if (query.opcional) key.push("opcional", query.opcional);
    if (query.opcionais) key.push("opcionais", query.opcionais);
    
    return key;
  }, [
    query?.marca,
    query?.modelo,
    query?.precoMin,
    query?.precoMax,
    query?.anoMin,
    query?.anoMax,
    query?.cambio,
    query?.cor,
    query?.categoria,
    query?.opcional,
    query?.opcionais,
  ]);

  return useQuery({
    queryKey,
    queryFn: () => fetchVehicles(query),
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
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
