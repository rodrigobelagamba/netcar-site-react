import { useQuery } from "@tanstack/react-query";
import { fetchAnuncioByVehicleId } from "../endpoints/anuncios";

/**
 * Hook React Query para buscar o anúncio (campo GPT) de um veículo
 * @param vehicleId - ID do veículo
 */
export function useAnuncioQuery(vehicleId: string | number | undefined) {
  return useQuery({
    queryKey: ["anuncio", vehicleId],
    queryFn: () => fetchAnuncioByVehicleId(vehicleId!),
    enabled: !!vehicleId,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}
