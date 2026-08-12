import { useEffect } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { fetchVehicleBySlug, type Vehicle } from "../endpoints/vehicles";
import { extractVehicleIdFromSlug } from "@/lib/slug";
import { getBootstrapVehicle } from "@/lib/stockBootstrap";

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

/** Carro que saiu do estoque: a API responde 404 e insistir não muda nada. */
function isVehicleGone(error: unknown): boolean {
  if (isAxiosError(error)) {
    return error.response?.status === 404;
  }
  return error instanceof Error && error.message === "Vehicle not found";
}

export function useVehicleQuery(slug: string) {
  const queryClient = useQueryClient();
  const bootstrapVehicle = getBootstrapVehicle(slug);

  const result = useQuery({
    queryKey: ["vehicle", slug],
    queryFn: () => fetchVehicleBySlug(slug),
    enabled: !!slug,
    initialData: bootstrapVehicle,
    initialDataUpdatedAt: bootstrapVehicle ? Date.now() : undefined,
    refetchOnMount: bootstrapVehicle ? false : undefined,
    placeholderData: () => findVehicleInListCache(queryClient, slug),
    // Sem isso, o link antigo de um carro vendido deixava o visitante uns 7s
    // olhando skeleton enquanto o react-query repetia o 404 três vezes.
    retry: (failureCount, error) => !isVehicleGone(error) && failureCount < 2,
  });

  useEffect(() => {
    if (!slug || !bootstrapVehicle) return;
    const timer = window.setTimeout(() => {
      void result.refetch();
    }, 12_000);
    return () => window.clearTimeout(timer);
  }, [bootstrapVehicle, result.refetch, slug]);

  return result;
}
