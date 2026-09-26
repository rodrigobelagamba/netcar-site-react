import type { Vehicle } from "@/catalog/endpoints/vehicles";
import { comparisonVehicleLabel } from "@/lib/comparisonContact";
import {
  optimizeStockImage,
  stockGalleryPreviewSource,
  stockImageSrcSet,
} from "@/lib/images";

type ComparisonVehicleImageProps = {
  vehicle: Vehicle;
  className?: string;
  sizes?: string;
  priority?: boolean;
};

const FALLBACK_IMAGE = optimizeStockImage("/images/semcapa.webp", 640);

export function ComparisonVehicleImage({
  vehicle,
  className = "",
  sizes = "(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw",
  priority = false,
}: ComparisonVehicleImageProps) {
  const source = stockGalleryPreviewSource(
    vehicle.imagens_site?.capa ||
      vehicle.imagens_site?.capa_thumb ||
      vehicle.fullImages?.[0] ||
      vehicle.images?.[0] ||
      "/images/semcapa.webp",
  );

  return (
    <img
      src={optimizeStockImage(source, 640)}
      srcSet={stockImageSrcSet(source, [240, 320, 480, 640, 960])}
      sizes={sizes}
      alt={`${comparisonVehicleLabel(vehicle)} — foto do veículo`}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      width={640}
      height={480}
      className={`!h-full w-full object-contain ${className}`.trim()}
      onError={(event) => {
        const image = event.currentTarget;
        image.removeAttribute("srcset");
        // React can dispatch another error if the fallback itself is unavailable.
        if (image.src !== FALLBACK_IMAGE) image.src = FALLBACK_IMAGE;
      }}
    />
  );
}
