import blogPostsJson from "./blog-posts.json";
import blogAutoJson from "./blog-auto.json";
import citiesJson from "./cities.json";
import landingsJson from "./landings.json";
import contentPagesJson from "./content-pages.json";
import type {
  BlogPost,
  CitySeoPage,
  LandingSeoPage,
  LandingSeoFilters,
  ContentSeoPage,
} from "./types";
import { resolvedVehicleCategory } from "@/lib/vehicleCategory";

// Blog = posts manuais + posts auto-publicados (gerados do estoque real).
// Manuais têm prioridade: se houver slug repetido, o manual vence.
const manualPosts = blogPostsJson as BlogPost[];
const autoPosts = (blogAutoJson as BlogPost[]).filter(
  (auto) => !manualPosts.some((m) => m.slug === auto.slug),
);
export const blogPosts: BlogPost[] = [...manualPosts, ...autoPosts];
export const cityPages = citiesJson as CitySeoPage[];
export const landingPages = landingsJson as LandingSeoPage[];
export const priorityLandingPages = landingPages.filter(
  (landing) => landing.indexable && landing.footerPriority,
);
export const contentPages = contentPagesJson as ContentSeoPage[];

export const priorityCityPages = cityPages.filter(
  (city) => city.priorityMarket,
);

const regionalInventorySlugs = [
  "suv",
  "hatch",
  "automaticos-ate-100-mil",
  "carros-ate-100-mil",
  "jeep-compass",
  "honda-hr-v",
] as const;

/** Seleções úteis nas páginas locais; só entram quando há estoque indexável. */
export const regionalInventoryPages = regionalInventorySlugs
  .map((slug) => landingPages.find((landing) => landing.slug === slug))
  .filter((landing): landing is LandingSeoPage =>
    Boolean(landing?.indexable && landing.count > 0),
  );

/** Mercados prioritários mais próximos das lojas, sem criar malha all-to-all. */
export const nearbyPriorityCityPages = [...priorityCityPages]
  .sort((left, right) => left.distanceKm - right.distanceKm)
  .slice(0, 4);

export function getContentPage(slug: string): ContentSeoPage | undefined {
  return contentPages.find((p) => p.slug === slug);
}

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}

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
