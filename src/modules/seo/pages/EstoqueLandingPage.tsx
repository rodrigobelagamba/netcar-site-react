import { Link, useParams } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo } from "react";
import { getLandingPage } from "@/data/seo";
import { useMetaTags } from "@/hooks/useMetaTags";
import { useVehiclesQuery } from "@/catalog/queries/useVehiclesQuery";
import { VehicleCard } from "@/design-system/components/patterns/VehicleCard";
import { Localizacao } from "@/design-system/components/layout/Localizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";
import { NotFoundRedirect } from "@/components/NotFoundRedirect";
import { emptySeminovosSearch } from "@/lib/seminovos-search";
import { isAvailableHomeStockVehicle } from "@/lib/homeStock";
import { RegionalActionCtas } from "@/modules/seo/components/RegionalActionCtas";
import { RegionalTrustSignals } from "@/modules/seo/components/RegionalTrustSignals";
import { RegionalSeoHero } from "@/modules/seo/components/RegionalSeoHero";

export function EstoqueLandingPage() {
  const { landingSlug } = useParams({ from: "/comprar-{$landingSlug}" });
  const landing = getLandingPage(landingSlug);

  const vehiclesQuery = landing
    ? { ...emptySeminovosSearch, [landing.filterKey]: landing.filterValue }
    : undefined;
  const { data: vehicles, isLoading } = useVehiclesQuery(vehiclesQuery, {
    enabled: !!landing,
  });
  const availableVehicles = useMemo(
    () => (vehicles ?? []).filter(isAvailableHomeStockVehicle),
    [vehicles],
  );

  useMetaTags({
    title: landing?.title,
    description: landing?.description,
    url: landing
      ? `https://www.netcarmultimarcas.com.br/comprar-${landing.slug}`
      : undefined,
  });

  useEffect(() => {
    if (!landing) return;

    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: landing.faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    };

    document.querySelector('script[data-schema="landing-faq"]')?.remove();
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-schema", "landing-faq");
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      document.querySelector('script[data-schema="landing-faq"]')?.remove();
    };
  }, [landing]);

  if (!landing) {
    return <NotFoundRedirect />;
  }

  const showroomSearch = {
    ...emptySeminovosSearch,
    [landing.filterKey]: landing.filterValue,
  } as typeof emptySeminovosSearch;

  return (
    <main className="flex-1 overflow-x-hidden max-w-full bg-white">
      <RegionalSeoHero
        eyebrow="Seminovos em Esteio/RS"
        title={landing.h1}
        intro={landing.intro}
      >
        <div className="mt-6 space-y-4">
          {landing.paragraphs.map((paragraph) => (
            <p key={paragraph} className="leading-relaxed text-gray-600">
              {paragraph}
            </p>
          ))}
        </div>
        <RegionalActionCtas
          className="mt-8"
          waText={`estou procurando um ${landing.name} seminovo em Esteio.`}
          stockSearch={showroomSearch}
          stockLabel={`Ver ${landing.name} nos seminovos`}
          primary="stock"
        />
      </RegionalSeoHero>

      <RegionalTrustSignals />

      <section className="pb-12">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <h2 className="text-2xl font-bold text-fg mb-6">
            {landing.name} disponíveis agora
          </h2>

          {isLoading ? (
            <p className="text-gray-500">Carregando estoque...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {availableVehicles.map((vehicle, index) => (
                <VehicleCard
                  key={vehicle.id}
                  id={vehicle.id}
                  name={vehicle.modelo || vehicle.name}
                  price={vehicle.price || 0}
                  valor_formatado={vehicle.valor_formatado}
                  year={vehicle.year || new Date().getFullYear()}
                  km={vehicle.km || 0}
                  images={vehicle.images || vehicle.fotos || []}
                  imagens_site={vehicle.imagens_site}
                  marca={vehicle.marca}
                  modelo={vehicle.modelo}
                  placa={vehicle.placa}
                  showWhatsAppInterest
                  whatsAppSource="estoque_landing"
                  delay={index}
                />
              ))}
            </div>
          )}

          {!isLoading && availableVehicles.length === 0 && (
            <p className="text-gray-500">
              Nenhum {landing.name} disponível no momento.
            </p>
          )}

          {!isLoading && (
            <div className="mt-10 flex justify-center">
              <Link
                to="/seminovos"
                search={showroomSearch}
                data-regional-action="view_stock_more"
                className="inline-flex w-full max-w-md items-center justify-center gap-2.5 rounded-full bg-[#00283C] px-8 py-4 text-base font-black uppercase tracking-wider text-white shadow-[0_12px_32px_rgba(0,40,60,0.28)] transition-all hover:bg-[#00435a] hover:shadow-[0_16px_40px_rgba(0,40,60,0.34)] active:scale-[0.98] sm:w-auto"
              >
                <span className="button-text-shimmer-on-dark">
                  Ver mais {landing.name}
                </span>
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="pb-16">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 max-w-3xl">
          <h2 className="text-2xl font-bold text-fg mb-6">Perguntas frequentes</h2>
          <div className="space-y-4">
            {landing.faq.map((item) => (
              <div key={item.q} className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-fg mb-2">{item.q}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="w-full font-sans antialiased text-muted-foreground bg-muted py-12 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 space-y-8">
        <div className="container-main space-y-8">
          <Localizacao />
          <IanBot />
        </div>
      </div>
    </main>
  );
}
