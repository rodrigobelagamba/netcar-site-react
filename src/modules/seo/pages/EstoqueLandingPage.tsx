import { Link, useParams } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo } from "react";
import {
  getLandingPage,
  getRelatedLandingPages,
  matchesLandingFilters,
} from "@/data/seo";
import { useMetaTags } from "@/hooks/useMetaTags";
import { useVehiclesQuery } from "@/catalog/queries/useVehiclesQuery";
import { VehicleCard } from "@/design-system/components/patterns/VehicleCard";
import { LazyLocalizacao } from "@/design-system/components/layout/LazyLocalizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";
import { NotFoundRedirect } from "@/components/NotFoundRedirect";
import { emptySeminovosSearch } from "@/lib/seminovos-search";
import { RegionalActionCtas } from "@/modules/seo/components/RegionalActionCtas";
import { RegionalTrustSignals } from "@/modules/seo/components/RegionalTrustSignals";
import { RegionalSeoHero } from "@/modules/seo/components/RegionalSeoHero";
import { NearbyMarketsNav } from "@/modules/seo/components/RegionalCrossLinks";
import { generateVehicleSlug } from "@/lib/slug";

export function EstoqueLandingPage() {
  const { landingSlug } = useParams({ from: "/comprar-{$landingSlug}" });
  const landing = getLandingPage(landingSlug);

  const { data: vehicles, isLoading } = useVehiclesQuery(
    { fetchAll: true },
    {
      enabled: !!landing,
    },
  );
  const availableVehicles = useMemo(
    () =>
      landing
        ? (vehicles ?? []).filter(
            (vehicle) =>
              Number(vehicle.price || 0) > 0 &&
              matchesLandingFilters(vehicle, landing.filters),
          )
        : [],
    [landing, vehicles],
  );
  const visibleVehicles = useMemo(
    () => availableVehicles.slice(0, 12),
    [availableVehicles],
  );
  const relatedLandings = useMemo(
    () => (landing ? getRelatedLandingPages(landing.slug) : []),
    [landing],
  );

  useMetaTags({
    title: landing?.title,
    description: landing?.description,
    url: landing
      ? `https://www.netcarmultimarcas.com.br/comprar-${landing.slug}`
      : undefined,
    robots: landing?.indexable ? undefined : "noindex, follow",
  });

  useEffect(() => {
    if (!landing) return;

    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: landing.faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    };

    const pageSchema = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": `https://www.netcarmultimarcas.com.br/comprar-${landing.slug}#webpage`,
      url: `https://www.netcarmultimarcas.com.br/comprar-${landing.slug}`,
      name: landing.h1,
      description: landing.description,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: availableVehicles.length,
        itemListElement: visibleVehicles.map((vehicle, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `https://www.netcarmultimarcas.com.br/veiculo/${generateVehicleSlug(vehicle)}`,
          name: `${vehicle.marca || ""} ${vehicle.modelo || vehicle.name}`.trim(),
        })),
      },
    };

    for (const [key, schema] of [
      ["landing-page", pageSchema],
      ["landing-faq", faqSchema],
    ] as const) {
      document.querySelector(`script[data-schema="${key}"]`)?.remove();
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute("data-schema", key);
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    }

    return () => {
      document.querySelector('script[data-schema="landing-faq"]')?.remove();
      document.querySelector('script[data-schema="landing-page"]')?.remove();
    };
  }, [availableVehicles, landing, visibleVehicles]);

  if (!landing) {
    return <NotFoundRedirect />;
  }

  const showroomSearch = {
    ...emptySeminovosSearch,
    marca: landing.filters.marca,
    modelo: landing.filters.modelo,
    precoMin:
      landing.filters.precoMin !== undefined
        ? String(landing.filters.precoMin)
        : undefined,
    precoMax:
      landing.filters.precoMax !== undefined
        ? String(landing.filters.precoMax)
        : undefined,
    cambio: landing.filters.cambio,
    combustivel: landing.filters.combustivel,
    categoria: landing.filters.categoria,
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
          waText={`estou procurando ${landing.name.toLowerCase()} em Esteio.`}
          stockSearch={showroomSearch}
          stockLabel={`Ver ${landing.name} nos seminovos`}
          primary="whatsapp"
        />
      </RegionalSeoHero>

      <RegionalTrustSignals />

      <section className="pb-12">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <h2 className="text-2xl font-bold text-fg mb-6">
            {landing.name}: {availableVehicles.length} disponíveis agora
          </h2>

          {isLoading ? (
            <p className="text-gray-500">Carregando estoque...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {visibleVehicles.map((vehicle, index) => (
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
                  potencia={vehicle.potencia}
                  pdf={vehicle.pdf}
                  pdf_url={vehicle.pdf_url}
                  diferenciais={vehicle.diferenciais}
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

          {!isLoading && availableVehicles.length > 0 && (
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

      {relatedLandings.length > 0 && (
        <section className="pb-16">
          <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
            <h2 className="mb-5 text-2xl font-bold text-fg">
              Compare outras opções do estoque
            </h2>
            <nav
              aria-label="Outras seleções de seminovos"
              className="flex flex-wrap gap-3"
            >
              {relatedLandings.map((related) => (
                <Link
                  key={related.slug}
                  to="/comprar-{$landingSlug}"
                  params={{ landingSlug: related.slug }}
                  className="rounded-full border border-[#00283C]/15 bg-[#F3F5F6] px-5 py-3 text-sm font-bold text-[#00283C] transition-colors hover:bg-white hover:text-primary"
                >
                  {related.name}
                </Link>
              ))}
              <Link
                to="/comparar"
                className="rounded-full bg-[#00283C] px-5 py-3 text-sm font-bold text-white hover:bg-[#00435a]"
              >
                Comparar carros lado a lado
              </Link>
            </nav>
          </div>
        </section>
      )}

      <NearbyMarketsNav selectionName={landing.name} />

      <section className="pb-16">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 max-w-3xl">
          <h2 className="text-2xl font-bold text-fg mb-6">
            Perguntas frequentes
          </h2>
          <div className="space-y-4">
            {landing.faq.map((item) => (
              <div
                key={item.q}
                className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100"
              >
                <h3 className="font-semibold text-fg mb-2">{item.q}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="w-full font-sans antialiased text-muted-foreground bg-muted py-12 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 space-y-8">
        <div className="container-main space-y-8">
          <LazyLocalizacao />
          <IanBot />
        </div>
      </div>
    </main>
  );
}
