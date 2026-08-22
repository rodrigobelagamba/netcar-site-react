import { Link } from "@tanstack/react-router";
import { nearbyPriorityCityPages, regionalInventoryPages } from "@/data/seo";

export function RegionalInventoryNav({ cityName }: { cityName: string }) {
  if (regionalInventoryPages.length === 0) return null;

  return (
    <section className="pb-16">
      <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        <h2 className="text-2xl font-bold text-fg">
          Escolha o tipo de carro antes de sair de {cityName}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
          Estas seleções usam o estoque real da Netcar. Compare categoria, faixa
          de preço ou modelo e confirme a disponibilidade antes da visita às
          lojas de Esteio.
        </p>
        <nav
          aria-label={`Seleções de seminovos para ${cityName}`}
          className="mt-5 flex flex-wrap gap-3"
        >
          {regionalInventoryPages.map((landing) => (
            <Link
              key={landing.slug}
              to="/comprar-{$landingSlug}"
              params={{ landingSlug: landing.slug }}
              data-regional-action={`city_inventory_${landing.slug}`}
              className="rounded-full border border-[#00283C]/15 bg-[#F3F5F6] px-5 py-3 text-sm font-bold text-[#00283C] transition-colors hover:bg-white hover:text-primary"
            >
              {landing.name}
              <span className="ml-2 font-normal text-gray-500">
                {landing.count} no estoque
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}

export function NearbyMarketsNav({ selectionName }: { selectionName: string }) {
  if (nearbyPriorityCityPages.length === 0) return null;

  return (
    <section className="pb-16">
      <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        <h2 className="text-2xl font-bold text-fg">
          Planeje a visita para ver {selectionName}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
          O estoque e as duas lojas ficam em Esteio. Consulte distância, rota e
          atendimento para os mercados mais próximos antes de se deslocar.
        </p>
        <nav
          aria-label={`Atendimento regional para ${selectionName}`}
          className="mt-5 flex flex-wrap gap-x-5 gap-y-3"
        >
          {nearbyPriorityCityPages.map((city) => (
            <Link
              key={city.slug}
              to="/seminovos-{$citySlug}"
              params={{ citySlug: city.slug }}
              data-regional-action={`inventory_city_${city.slug}`}
              className="text-sm font-semibold text-primary hover:underline"
            >
              Rota e atendimento para {city.name}
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
