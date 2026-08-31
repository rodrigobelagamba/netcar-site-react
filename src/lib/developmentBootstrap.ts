import type { Vehicle } from "@/catalog/endpoints/vehicles";
import type { HomeHeroVehicle } from "@/design-system/components/patterns/HomeHero";

type StockManifest = {
  generatedAt?: string;
  vehicles?: Vehicle[];
  showroomVehicles?: Vehicle[];
};

type DevelopmentWindow = Window & {
  __NETCAR_STOCK__?: {
    generatedAt?: string;
    scope: "available" | "showroom";
    vehicles: Vehicle[];
  };
  __NETCAR_HOME_HERO__?: HomeHeroVehicle;
  __NETCAR_HOME_LCP_ID__?: string;
  __NETCAR_HOME_HAS_ACTIVE_BANNER__?: boolean;
};

async function readLocalJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/**
 * O Vite não executa public/index.php, que injeta o estoque e o hero no HTML
 * de produção. Reaproveita os mesmos artefatos gerados pelo build para a
 * prévia local não esperar a API completa antes do primeiro paint.
 */
export async function installDevelopmentBootstrap(): Promise<void> {
  const target = window as DevelopmentWindow;
  const isShowroom = window.location.pathname === "/seminovos";
  const needsHomeHero = window.location.pathname === "/";

  const [manifest, hero] = await Promise.all([
    target.__NETCAR_STOCK__
      ? Promise.resolve(null)
      : readLocalJson<StockManifest>("/seo/stock-bootstrap.json"),
    needsHomeHero && !target.__NETCAR_HOME_HERO__
      ? readLocalJson<HomeHeroVehicle>("/seo/home-lcp.json")
      : Promise.resolve(null),
  ]);

  if (manifest) {
    const scopedVehicles = isShowroom
      ? manifest.showroomVehicles
      : manifest.vehicles;
    if (Array.isArray(scopedVehicles) && scopedVehicles.length > 0) {
      target.__NETCAR_STOCK__ = {
        generatedAt: manifest.generatedAt,
        scope: isShowroom ? "showroom" : "available",
        vehicles: scopedVehicles,
      };
    }
  }

  if (needsHomeHero && hero?.id && hero.image) {
    target.__NETCAR_HOME_HERO__ = hero;
    target.__NETCAR_HOME_LCP_ID__ = String(hero.id);
    target.__NETCAR_HOME_HAS_ACTIVE_BANNER__ ??= false;
  }
}
