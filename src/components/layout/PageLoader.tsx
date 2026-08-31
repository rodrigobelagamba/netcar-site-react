import { getBootstrapVehicle, getBootstrapVehicles } from "@/lib/stockBootstrap";
import { optimizeStockImage, stockImageSrcSet } from "@/lib/images";

type CriticalImage = {
  alt: string;
  image: string;
  sizes: string;
  widths: number[];
  fallbackWidth: number;
  compact?: boolean;
};

function routeCriticalImage(): CriticalImage | null {
  if (typeof window === "undefined") return null;
  const pathname = window.location.pathname;
  if (pathname === "/") {
    const hero = (window as typeof window & {
      __NETCAR_HOME_HERO__?: { image?: string; marca?: string; modelo?: string; name?: string };
    }).__NETCAR_HOME_HERO__;
    if (!hero?.image) return null;
    return {
      image: hero.image,
      alt: `${hero.marca || ""} ${hero.modelo || hero.name || "seminovo em destaque"}`.trim(),
      sizes: "100vw",
      widths: [480, 768, 960, 1280, 1600],
      fallbackWidth: 1280,
    };
  }

  if (pathname === "/seminovos") {
    const vehicle = [...(getBootstrapVehicles() || [])].sort((left, right) =>
      String(left.modelo || left.name || "").localeCompare(
        String(right.modelo || right.name || ""),
        "pt-BR",
        { numeric: true },
      ),
    )[0];
    const image = vehicle?.imagens_site?.capa_thumb || vehicle?.imagens_site?.capa || vehicle?.images?.[0];
    if (!vehicle || !image) return null;
    return {
      image,
      alt: `${vehicle.marca || ""} ${vehicle.modelo || vehicle.name || "seminovo"}`.trim(),
      sizes: "100vw",
      widths: [320, 480, 640, 768, 960],
      fallbackWidth: 640,
      compact: true,
    };
  }

  if (pathname.startsWith("/veiculo/")) {
    const vehicle = getBootstrapVehicle(pathname.slice("/veiculo/".length));
    const image = vehicle?.imagens_site?.capa || vehicle?.imagens_site?.capa_thumb || vehicle?.images?.[0];
    if (!vehicle || !image) return null;
    return {
      image,
      alt: `${vehicle.marca || ""} ${vehicle.modelo || vehicle.name || "seminovo"}`.trim(),
      sizes: "100vw",
      widths: [480, 640, 768, 960, 1280],
      fallbackWidth: 960,
    };
  }
  return null;
}

export function PageLoader() {
  const critical = routeCriticalImage();
  if (!critical) {
    return <div className="min-h-[calc(100dvh-5rem)]" aria-hidden="true" />;
  }

  return (
    <div
      className="flex min-h-[calc(100dvh-5rem)] items-start justify-center overflow-hidden bg-gray-50"
      aria-hidden="true"
    >
      <img
        src={optimizeStockImage(critical.image, critical.fallbackWidth)}
        srcSet={stockImageSrcSet(critical.image, critical.widths)}
        sizes={critical.sizes}
        alt={critical.alt}
        width={1600}
        height={900}
        loading="eager"
        decoding="async"
        fetchPriority="high"
        className={`h-auto max-h-[55vh] object-contain ${critical.compact ? "w-1/2 md:w-1/4" : "w-full"}`}
      />
    </div>
  );
}
