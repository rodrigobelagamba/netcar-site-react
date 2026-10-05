import type { VehicleImagesSite } from "@/catalog/endpoints/vehicles";

export const VEHICLE_COVER_PLACEHOLDER = "/images/semcapa.webp";

interface VehicleCoverSource {
  images: readonly string[];
  imagens_site?: VehicleImagesSite;
}

/** Selects the catalog cover after the shared image quarantine has run. */
export function resolveVehicleCoverImage(
  { images, imagens_site }: VehicleCoverSource,
  compact = false,
): string {
  // Compact cards keep their thumbnail; larger cards use the full cover.
  if (compact && imagens_site?.capa_thumb) return imagens_site.capa_thumb;
  if (imagens_site?.capa) return imagens_site.capa;
  if (imagens_site?.capa_thumb) return imagens_site.capa_thumb;

  // Preserve the catalog's legacy PNG-only fallback and its excluded source.
  const pngImages = images.filter(
    (img) =>
      img && (img.toLowerCase().endsWith(".png") || img.includes(".png")),
  );
  const firstPngImage = pngImages.length > 0 ? pngImages[0] : null;
  const shouldUsePlaceholder =
    firstPngImage &&
    (firstPngImage.includes("271_131072IMG_8213.png") ||
      firstPngImage.includes("271_131072IMG_8213.PNG"));

  return pngImages.length > 0 && !shouldUsePlaceholder
    ? firstPngImage || VEHICLE_COVER_PLACEHOLDER
    : VEHICLE_COVER_PLACEHOLDER;
}
