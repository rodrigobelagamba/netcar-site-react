import { useQuery } from "@tanstack/react-query";
import type { Vehicle } from "@/catalog/endpoints/vehicles";
import { loadIcheckMetadata } from "@/lib/icheckMetadata";

type IcheckVehicle = Pick<
  Vehicle,
  "id" | "placa" | "pdf" | "pdf_url" | "icheckAttachmentInvalid"
>;

/** Share the validated result between the vehicle badge and consultation card. */
export function useIcheckMetadata(vehicle?: IcheckVehicle) {
  return useQuery({
    queryKey: [
      "icheck-metadata",
      vehicle?.id,
      vehicle?.placa,
      vehicle?.pdf,
      vehicle?.pdf_url,
      vehicle?.icheckAttachmentInvalid,
    ],
    enabled: Boolean(vehicle),
    queryFn: ({ signal }) => loadIcheckMetadata(vehicle!, signal),
    staleTime: 60_000,
    // A previous vehicle's approval must never appear while this one loads.
    placeholderData: undefined,
  });
}
