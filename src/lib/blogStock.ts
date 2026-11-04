import type { Vehicle } from "@/catalog/endpoints/vehicles";
import type { BlogCar } from "@/data/seo/types";
import { getBlogVehicleTarget } from "@/lib/blogNavigation";
import { generateVehicleSlug } from "@/lib/slug";

const SITE = "https://www.netcarmultimarcas.com.br";

function currentImage(vehicle: Vehicle): string | undefined {
  if (!vehicle.imagens_site?.tem_fotos) return undefined;
  const source =
    vehicle.imagens_site.capa_thumb ||
    vehicle.imagens_site.capa ||
    vehicle.images?.[0];
  if (!source) return undefined;
  try {
    // The request-time bootstrap may retain a relative API image path. Resolve
    // it from the site root, never the article's /blog/ directory.
    const url = new URL(source, `${SITE}/`);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Articles select specific units, not a model inferred from editorial copy.
 * Keep that selection, but every advertised fact comes from the current stock.
 * A historical `available: false` is not evidence against a returning unit.
 */
export function resolveBlogStockCars(
  cards: BlogCar[],
  vehicles: Vehicle[],
): BlogCar[] {
  const current = new Map(
    vehicles.map((vehicle) => [String(vehicle.id), vehicle]),
  );
  const seen = new Set<string>();
  return cards.flatMap((card) => {
    const target = getBlogVehicleTarget(card.url);
    const id = target?.slug.match(/(?:^|-)([1-9]\d*)$/)?.[1];
    const vehicle = id ? current.get(id) : undefined;
    if (
      !id ||
      seen.has(id) ||
      !vehicle ||
      !Number.isFinite(vehicle.price) ||
      vehicle.price <= 0
    )
      return [];
    seen.add(id);
    const model = vehicle.modelo?.trim() || vehicle.name;
    const brand = vehicle.marca?.trim();
    const name =
      brand &&
      !model
        .toLocaleUpperCase("pt-BR")
        .startsWith(brand.toLocaleUpperCase("pt-BR"))
        ? `${brand} ${model}`
        : model;
    return [
      {
        modelo: name,
        ano:
          Number.isFinite(vehicle.year) && vehicle.year > 0
            ? String(vehicle.year)
            : "",
        km:
          Number.isFinite(vehicle.km) && vehicle.km >= 0
            ? `${vehicle.km.toLocaleString("pt-BR")} km`
            : "",
        preco: `R$ ${vehicle.price.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
        cambio: vehicle.cambio,
        combustivel: vehicle.combustivel,
        url: `${SITE}/veiculo/${generateVehicleSlug(vehicle)}`,
        img: currentImage(vehicle),
      },
    ];
  });
}
