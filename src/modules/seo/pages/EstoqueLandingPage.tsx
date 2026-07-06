import { Link, useParams } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Car, MessageCircle } from "lucide-react";
import { useEffect } from "react";
import { getLandingPage } from "@/data/seo";
import { useMetaTags } from "@/hooks/useMetaTags";
import { useVehiclesQuery } from "@/catalog/queries/useVehiclesQuery";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import { buildWhatsAppUrl, siteWhatsAppMessage } from "@/lib/whatsappMessages";
import { VehicleCard } from "@/design-system/components/patterns/VehicleCard";
import { Localizacao } from "@/design-system/components/layout/Localizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";
import { NotFoundRedirect } from "@/components/NotFoundRedirect";
import { emptySeminovosSearch } from "@/lib/seminovos-search";

export function EstoqueLandingPage() {
  const { landingSlug } = useParams({ from: "/comprar-{$landingSlug}" });
  const landing = getLandingPage(landingSlug);
  const { data: whatsapp } = useWhatsAppQuery();

  const vehiclesQuery = landing
    ? { ...emptySeminovosSearch, [landing.filterKey]: landing.filterValue }
    : undefined;
  const { data: vehicles, isLoading } = useVehiclesQuery(vehiclesQuery, {
    enabled: !!landing,
  });

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

  const waLink = (() => {
    if (!whatsapp?.numero) return "#";
    const text = siteWhatsAppMessage(
      `estou procurando um ${landing.name} seminovo em Esteio.`,
    );
    return buildWhatsAppUrl(whatsapp.numero, text);
  })();

  // Filtro pré-aplicado no showroom ao clicar em "Ver todos"
  const showroomSearch = {
    ...emptySeminovosSearch,
    [landing.filterKey]: landing.filterValue,
  };

  return (
    <main className="flex-1 overflow-x-hidden max-w-full bg-gradient-to-b from-white via-gray-50/30 to-white">
      <section className="py-12 md:py-16">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            <span className="text-primary text-xs font-semibold tracking-widest uppercase mb-4 block">
              Seminovos em Esteio/RS
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-fg mb-4">{landing.h1}</h1>
            <p className="text-lg text-gray-600 mb-6">{landing.intro}</p>

            {landing.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-gray-600 leading-relaxed mb-4">
                {paragraph}
              </p>
            ))}

            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                to="/seminovos"
                search={showroomSearch}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-white font-semibold hover:bg-primary/90"
              >
                <Car className="w-4 h-4" />
                Ver todos no showroom
              </Link>
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/20 px-5 py-3 text-primary font-semibold hover:bg-primary/5"
              >
                <MessageCircle className="w-4 h-4" />
                Falar com consultor · 24/7
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="pb-12">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <h2 className="text-2xl font-bold text-fg mb-6">
            {landing.name} disponíveis agora
          </h2>

          {isLoading ? (
            <p className="text-gray-500">Carregando estoque...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {(vehicles || []).map((vehicle, index) => (
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
                  delay={index}
                />
              ))}
            </div>
          )}

          {!isLoading && (!vehicles || vehicles.length === 0) && (
            <p className="text-gray-500">
              Nenhum {landing.name} disponível no momento.{" "}
              <Link to="/seminovos" search={emptySeminovosSearch} className="text-primary font-semibold hover:underline">
                Confira o estoque completo
              </Link>
              .
            </p>
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
