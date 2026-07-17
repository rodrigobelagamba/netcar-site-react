import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { fetchVehicleBySlug, type Vehicle } from "../endpoints/vehicles";
import { extractVehicleIdFromSlug } from "@/lib/slug";

/** Reusa carro já carregado no estoque — evita tela "Carregando detalhes". */
function findVehicleInListCache(
  queryClient: QueryClient,
  slug: string,
): Vehicle | undefined {
  const id = extractVehicleIdFromSlug(slug);
  if (!id) return undefined;

  const entries = queryClient.getQueriesData<Vehicle[]>({ queryKey: ["vehicles"] });
  for (const [, list] of entries) {
    if (!Array.isArray(list)) continue;
    const found = list.find((vehicle) => String(vehicle.id) === String(id));
    if (found) return found;
  }
  return undefined;
}

export function useVehicleQuery(slug: string) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["vehicle", slug],
    queryFn: () => fetchVehicleBySlug(slug),
    enabled: !!slug,
    placeholderData: () => findVehicleInListCache(queryClient, slug),
  });
}
