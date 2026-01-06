import { useQuery } from "@tanstack/react-query";
import { fetchVehicles, type VehiclesQuery } from "../endpoints/vehicles";

export function useVehiclesQuery(query?: VehiclesQuery) {
  return useQuery({
    queryKey: ["vehicles", query],
    queryFn: () => fetchVehicles(query),
  });
}
