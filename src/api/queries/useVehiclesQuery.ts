import { useQuery } from "@tanstack/react-query";
import { fetchVehicles, fetchOpcionais, type VehiclesQuery } from "../endpoints/vehicles";

export function useVehiclesQuery(query?: VehiclesQuery) {
  return useQuery({
    queryKey: ["vehicles", query],
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
