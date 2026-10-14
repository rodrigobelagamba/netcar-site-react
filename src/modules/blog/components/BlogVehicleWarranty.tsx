import { useVehicleQuery, isVehicleGone } from "@/catalog/queries/useVehicleQuery";
import { VehicleWarrantySummary } from "@/design-system/components/patterns/VehicleWarrantySummary";
import { getBlogVehicleTarget } from "@/lib/blogNavigation";
import { extractVehicleIdFromSlug } from "@/lib/slug";

/** Editorial snapshots cannot attest warranty; use the current catalog unit. */
export function BlogVehicleWarranty({ href }: { href: string }) {
  const target = getBlogVehicleTarget(href);
  const { data: vehicle, error, isPlaceholderData } = useVehicleQuery(
    target?.slug ?? "",
  );
  const matchesCurrentVehicle = target && vehicle &&
    String(vehicle.id) === extractVehicleIdFromSlug(target.slug) &&
    vehicle.price > 0 && !isPlaceholderData && !isVehicleGone(error);

  return (
    <VehicleWarrantySummary
      vehicle={matchesCurrentVehicle ? vehicle : undefined}
      className="px-5 pb-5"
    />
  );
}
