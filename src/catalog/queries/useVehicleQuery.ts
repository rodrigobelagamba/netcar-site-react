import { useQuery } from "@tanstack/react-query";
import { fetchVehicleBySlug } from "../endpoints/vehicles";

export function useVehicleQuery(slug: string) {
  return useQuery({
    queryKey: ["vehicle", slug],
    queryFn: () => fetchVehicleBySlug(slug),
    enabled: !!slug,
  });
}
