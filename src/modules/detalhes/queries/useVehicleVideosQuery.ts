import { useQuery } from "@tanstack/react-query";
import { socialConfig } from "@/social/config";
import { parseVehicleVideosResponse } from "../lib/vehicleVideosResponse";

export function useVehicleVideosQuery(enabled: boolean) {
  return useQuery({
    queryKey: ["social", "vehicle-videos"],
    enabled,
    queryFn: async ({ signal }) => {
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
      const timeout = setTimeout(abort, 8000);
      try {
        const response = await fetch(`${socialConfig.baseUrl}/vehicle-videos.php`, {
          signal: controller.signal,
          credentials: "omit",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error("Vídeos temporariamente indisponíveis");
        return parseVehicleVideosResponse(await response.json());
      } finally {
        clearTimeout(timeout);
        signal.removeEventListener("abort", abort);
      }
    },
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
