import { Link } from "@tanstack/react-router";
import { ArrowRight, Clock, MapPin, Search, Store } from "lucide-react";
import { useEffect } from "react";
import { cityPages } from "@/data/seo";
import { useMetaTags } from "@/hooks/useMetaTags";
import { RegionalActionCtas } from "@/modules/seo/components/RegionalActionCtas";
import { RegionalStockPreview } from "@/modules/seo/components/RegionalStockPreview";
import { RegionalTrustSignals } from "@/modules/seo/components/RegionalTrustSignals";
import { RegionalSeoHero } from "@/modules/seo/components/RegionalSeoHero";
import { LazyLocalizacao } from "@/design-system/components/layout/LazyLocalizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";

const regionalGroups = cityPages.reduce<Record<string, typeof cityPages>>(
  (groups, city) => {
    const region = city.regionName;
    groups[region] = [...(groups[region] ?? []), city];
    return groups;
  },
  {},
);

export function RegionsHubPage() {
  useMetaTags({
    title: "Seminovos na região de Porto Alegre e Serra | Netcar",
    description:
      "Consulte seminovos e pré-avaliação para cidades da Grande Porto Alegre, Vale dos Sinos, Paranhana e Serra Gaúcha. Lojas Netcar somente em Esteio.",
    url: "https://www.netcarmultimarcas.com.br/regioes-atendidas",
  });

  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Regiões atendidas pela Netcar Multimarcas",
      url: "https://www.netcarmultimarcas.com.br/regioes-atendidas",
      about: { "@id": "https://www.netcarmultimarcas.com.br/#organization" },
      hasPart: cityPages.flatMap((city) => [
        {
          "@type": "CollectionPage",
          name: city.h1,
          url: `https://www.netcarmultimarcas.com.br/seminovos-${city.slug}`,
        },
        {
          "@type": "WebPage",
          name: city.sell.h1,
          url: `https://www.netcarmultimarcas.com.br/vender-carro-${city.slug}`,
        },
      ]),
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
    <main className="flex-1 bg-white">
      <RegionalSeoHero
        eyebrow="Atendimento regional · loja em Esteio"
        title="Seminovos para Grande Porto Alegre, Vales e Serra Gaúcha"
        intro="Veja o estoque antes de sair da sua cidade, confirme os carros pelo WhatsApp e envie os dados do usado ou da simulação. Test-drive, vistoria e fechamento acontecem nas lojas da Av. Presidente Vargas, em Esteio."
      >
        <RegionalActionCtas
          className="mt-8"
          waText="vim pela página de regiões atendidas e quero ajuda com seminovos ou venda do meu carro."
          primary="whatsapp"
        />
      </RegionalSeoHero>

      <RegionalTrustSignals />

      <RegionalStockPreview
        title="Carros da loja disponíveis agora"
        limit={8}
      />

      <section className="pb-16">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <h2 className="mb-6 text-2xl font-bold text-fg">
            Antes de sair da sua cidade
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Search,
                title: "1. Veja o estoque",
                text: "Filtre modelos, confira fotos, km e preço. Separe os carros que quer conhecer.",
              },
              {
                icon: Clock,
                title: "2. Fale no WhatsApp",
                text: "Confirme os carros, tire dúvidas e envie os dados do usado, se houver troca.",
              },
              {
                icon: Store,
                title: "3. Confirme visita",
                text: "Combine o horário. Test-drive, avaliação e fechamento acontecem em Esteio.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <article
                key={title}
                className="rounded-2xl border border-gray-100 bg-gradient-to-b from-white to-gray-50/80 p-6 shadow-sm"
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
                    className="flex flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
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
                        Seminovos perto de {city.name}{" "}
                        <ArrowRight className="h-3.5 w-3.5" />
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

      <div className="w-full bg-muted py-12 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        <div className="container-main space-y-8">
          <LazyLocalizacao />
          <IanBot />
        </div>
      </div>
    </main>
  );
}
