import { Link } from "@tanstack/react-router";
import { ArrowRight, Car, Clock, MapPin, Search, Store } from "lucide-react";
import { useEffect } from "react";
import { cityPages } from "@/data/seo";
import { useMetaTags } from "@/hooks/useMetaTags";
import { emptySeminovosSearch } from "@/lib/seminovos-search";

const regionalGroups = cityPages.reduce<Record<string, typeof cityPages>>(
  (groups, city) => {
    const region = city.regionName ?? "Grande Porto Alegre e Vale dos Sinos";
    groups[region] = [...(groups[region] ?? []), city];
    return groups;
  },
  {},
);

export function RegionsHubPage() {
  useMetaTags({
    title: "Regiões atendidas | Netcar Multimarcas Esteio",
    description:
      "Consulte seminovos e pré-avaliação para cidades da Grande Porto Alegre, Vale do Paranhana e Serra Gaúcha. Lojas Netcar somente em Esteio.",
    url: "https://www.netcarmultimarcas.com.br/regioes-atendidas",
  });

  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Regiões atendidas pela Netcar Multimarcas",
      url: "https://www.netcarmultimarcas.com.br/regioes-atendidas",
      about: {
        "@type": "AutoDealer",
        name: "Netcar Multimarcas",
        address: {
          "@type": "PostalAddress",
          streetAddress: "Av. Presidente Vargas",
          addressLocality: "Esteio",
          addressRegion: "RS",
          addressCountry: "BR",
        },
      },
      hasPart: cityPages.map((city) => ({
        "@type": "WebPage",
        name: city.h1,
        url: `https://www.netcarmultimarcas.com.br/seminovos-${city.slug}`,
      })),
    };

    document.querySelector('script[data-schema="regions-hub"]')?.remove();
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-schema", "regions-hub");
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      document.querySelector('script[data-schema="regions-hub"]')?.remove();
    };
  }, []);

  return (
    <main className="flex-1 bg-gradient-to-b from-white via-gray-50/50 to-white">
      <section className="py-14 md:py-20">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <div className="max-w-4xl">
            <span className="mb-4 block text-xs font-semibold uppercase tracking-widest text-primary">
              Atendimento regional, loja em Esteio
            </span>
            <h1 className="mb-5 text-3xl font-bold text-fg md:text-5xl">
              Seminovos para Grande Porto Alegre, Vales e Serra Gaúcha
            </h1>
            <p className="max-w-3xl text-lg leading-relaxed text-gray-600">
              Pesquise estoque, preços e condições antes de viajar. Atendimento
              remoto ajuda a selecionar carros, simular financiamento e
              pré-avaliar troca. Test drive, vistoria e fechamento acontecem nas
              lojas da Av. Presidente Vargas, em Esteio.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/seminovos"
                search={emptySeminovosSearch}
                data-regional-action="view_stock"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-white hover:bg-primary/90"
              >
                <Car className="h-4 w-4" />
                Ver estoque atual
              </Link>
              <Link
                to="/compra"
                data-regional-action="sell_evaluation"
                className="inline-flex items-center gap-2 rounded-xl border border-primary/20 px-5 py-3 font-semibold text-primary hover:bg-primary/5"
              >
                Pré-avaliar meu carro
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-16">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <h2 className="mb-6 text-2xl font-bold text-fg">
            Como planejar atendimento fora de Esteio
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Search,
                title: "1. Consulte site e estoque",
                text: "Filtre modelos, confira fotos, quilometragem e preço. Separe opções antes do contato.",
              },
              {
                icon: Clock,
                title: "2. Adiante negociação",
                text: "Simule financiamento e envie dados e fotos do usado. Valores finais dependem das análises.",
              },
              {
                icon: Store,
                title: "3. Confirme visita",
                text: "Cheque disponibilidade e agenda. Loja, test drive e vistoria ficam somente em Esteio.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <article
                key={title}
                className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
              >
                <Icon className="mb-4 h-6 w-6 text-primary" />
                <h3 className="mb-2 font-bold text-fg">{title}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-20">
        <div className="container-main space-y-10 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          {Object.entries(regionalGroups).map(([region, cities]) => (
            <div key={region}>
              <h2 className="mb-4 text-2xl font-bold text-fg">{region}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cities.map((city) => (
                  <article
                    key={city.slug}
                    className="flex flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
                  >
                    <h3 className="text-lg font-bold text-fg">{city.name}</h3>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        cerca de {city.distanceKm} km
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {city.travelTime}
                      </span>
                    </div>
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-gray-600">
                      {city.visitPlanning ??
                        `Consulte estoque e organize sua visita às lojas da Av. Presidente Vargas, em Esteio.`}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold">
                      <Link
                        to="/seminovos-{$citySlug}"
                        params={{ citySlug: city.slug }}
                        data-regional-action={`city_buy_${city.slug}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        Comprar <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                      <Link
                        to="/vender-carro-{$citySlug}"
                        params={{ citySlug: city.slug }}
                        data-regional-action={`city_sell_${city.slug}`}
                        className="text-secondary hover:underline"
                      >
                        Vender carro
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
