import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
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

  const entries = queryClient.getQueriesData<Vehicle[]>({
    queryKey: ["vehicles"],
  });
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

const vehicleQueryKey = (slug: string) => ["vehicle", slug] as const;

/** Antecipação por intenção (hover/toque) sem bloquear a navegação. */
export function prefetchVehicleDetails(queryClient: QueryClient, slug: string) {
  if (!slug) return Promise.resolve();
  return queryClient.prefetchQuery({
    queryKey: vehicleQueryKey(slug),
    queryFn: () => fetchVehicleBySlug(slug),
    staleTime: 60_000,
  });
}

export function useVehicleQuery(slug: string) {
  const queryClient = useQueryClient();
  const bootstrapVehicle = getBootstrapVehicle(slug);
  const exactCachedVehicle = queryClient.getQueryData<Vehicle>(
    vehicleQueryKey(slug),
  );
  const listCachedVehicle = findVehicleInListCache(queryClient, slug);
  const richListVehicle = listCachedVehicle?.imagens_site?.galeria?.length
    ? listCachedVehicle
    : undefined;
  const initialVehicle =
    exactCachedVehicle ??
    richListVehicle ??
    bootstrapVehicle ??
    listCachedVehicle;
  const hasCompleteInitialVehicle = Boolean(
    initialVehicle?.imagens_site?.galeria?.length ||
    initialVehicle?.fullImages?.length,
  );

  return useQuery({
    queryKey: vehicleQueryKey(slug),
    queryFn: () => fetchVehicleBySlug(slug),
    enabled: !!slug,
    initialData: initialVehicle,
    initialDataUpdatedAt: initialVehicle
      ? hasCompleteInitialVehicle
        ? Date.now()
        : 0
      : undefined,
    // A capa resumida abre instantaneamente; a galeria completa chega em background.
    refetchOnMount: hasCompleteInitialVehicle ? false : "always",
    staleTime: 60_000,
    placeholderData: () => findVehicleInListCache(queryClient, slug),
    // Sem isso, o link antigo de um carro vendido deixava o visitante uns 7s
    // olhando skeleton enquanto o react-query repetia o 404 três vezes.
    retry: (failureCount, error) => !isVehicleGone(error) && failureCount < 2,
  });
}
