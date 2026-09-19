import citiesJson from "./cities.json";
import regionalFocusJson from "./regional-focus.json";
import landingsJson from "./landings.json";
import type {
  CitySeoPage,
  LandingSeoPage,
  LandingSeoFilters,
} from "./types";
import { resolvedVehicleCategory } from "@/lib/vehicleCategory";

// Módulos separados permitem ao build carregar artigos e páginas editoriais
// somente nas rotas que os usam, preservando a API pública deste arquivo.
export { blogPosts, getBlogPost } from "./blog";
export { contentPages, getContentPage } from "./content";

export const cityPages = citiesJson as CitySeoPage[];
export const landingPages = landingsJson as LandingSeoPage[];
export const priorityLandingPages = landingPages.filter(
  (landing) => landing.indexable && landing.footerPriority,
);
export const priorityCityPages = cityPages.filter(
  (city) => city.priorityMarket,
);

const regionalInventorySlugs = regionalFocusJson.inventorySlugs;

/** Seleções úteis nas páginas locais; só entram quando há estoque indexável. */
export const regionalInventoryPages = regionalInventorySlugs
  .map((slug) => landingPages.find((landing) => landing.slug === slug))
  .filter((landing): landing is LandingSeoPage =>
    Boolean(landing?.indexable && landing.count > 0),
  );

/** Foco de aquisição regional compartilhado com o HTML dos hubs de estoque. */
export const nearbyPriorityCityPages = regionalFocusJson.citySlugs
  .map((slug) => cityPages.find((city) => city.slug === slug))
  .filter((city): city is CitySeoPage => Boolean(city));

export function getCityPage(slug: string): CitySeoPage | undefined {
  return cityPages.find((city) => city.slug === slug);
}

export function getRelatedCityPages(slug: string): CitySeoPage[] {
  const city = getCityPage(slug);
  if (!city) return [];

  const bySlug = new Map(cityPages.map((item) => [item.slug, item]));
  return city.relatedSlugs
    .map((relatedSlug) => bySlug.get(relatedSlug))
    .filter((related): related is CitySeoPage => Boolean(related));
}

export function getLandingPage(slug: string): LandingSeoPage | undefined {
  return landingPages.find((l) => l.slug === slug);
}

function normalized(value: unknown): string {
  return String(value || "")
    .trim()
    .toLocaleUpperCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function compact(value: unknown): string {
  return normalized(value).replace(/\s+/g, "");
}

/** Predicado único usado pela landing React e pelos links de veículos. */
export function matchesLandingFilters(
  vehicle: {
    marca?: string;
    modelo?: string;
    name?: string;
    categoria?: string;
    cambio?: string;
    combustivel?: string;
    price?: number;
  },
  filters: LandingSeoFilters,
): boolean {
  const price = Number(vehicle.price || 0);
  if (
    filters.marca &&
    normalized(vehicle.marca) !== normalized(filters.marca)
  ) {
    return false;
  }
  if (
    filters.modelo &&
    !compact(vehicle.modelo || vehicle.name).includes(compact(filters.modelo))
  ) {
    return false;
  }
  if (
    filters.categoria &&
    resolvedVehicleCategory(vehicle) !== normalized(filters.categoria)
  ) {
    return false;
  }
  if (
    filters.cambio &&
    normalized(vehicle.cambio) !== normalized(filters.cambio)
  ) {
    return false;
  }
  if (
    filters.combustivel &&
    normalized(vehicle.combustivel) !== normalized(filters.combustivel)
  ) {
    return false;
  }
  if (filters.precoMin !== undefined && price < filters.precoMin) return false;
  if (filters.precoMax !== undefined && price > filters.precoMax) return false;
  return true;
}

export function getRelatedLandingPages(slug: string): LandingSeoPage[] {
  const landing = getLandingPage(slug);
  if (!landing) return [];
  const bySlug = new Map(landingPages.map((item) => [item.slug, item]));
  return landing.relatedSlugs
    .map((relatedSlug) => bySlug.get(relatedSlug))
    .filter((item): item is LandingSeoPage => Boolean(item));
}
