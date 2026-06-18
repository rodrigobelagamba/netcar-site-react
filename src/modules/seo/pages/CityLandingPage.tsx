import { Link, useParams } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { MapPin, Clock, Car, MessageCircle } from "lucide-react";
import { useEffect } from "react";
import { getCityPage } from "@/data/seo";
import { useMetaTags } from "@/hooks/useMetaTags";
import { useWhatsAppQuery } from "@/api/queries/useSiteQuery";
import { formatWhatsAppNumber } from "@/lib/formatters";
import { Localizacao } from "@/design-system/components/layout/Localizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";
import { NotFoundRedirect } from "@/components/NotFoundRedirect";
import { emptySeminovosSearch } from "@/lib/seminovos-search";

export function CityLandingPage() {
  const { citySlug } = useParams({ from: "/seminovos-{$citySlug}" });
  const city = getCityPage(citySlug);
  const { data: whatsapp } = useWhatsAppQuery();

  useMetaTags({
    title: city?.title,
    description: city?.description,
    url: city ? `https://www.netcarmultimarcas.com.br/seminovos-${city.slug}` : undefined,
  });

  useEffect(() => {
    if (!city) return;

    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: city.faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a,
        },
      })),
    };

    const existing = document.querySelector('script[data-schema="city-faq"]');
    existing?.remove();

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-schema", "city-faq");
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      document.querySelector('script[data-schema="city-faq"]')?.remove();
    };
  }, [city]);

  if (!city) {
    return <NotFoundRedirect />;
  }

  const waLink = (() => {
    if (!whatsapp?.numero) return "#";
    const number = formatWhatsAppNumber(whatsapp.numero);
    const text = `Oi iAN! Moro em ${city.name} e estou procurando um seminovo.`;
    return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
  })();

  return (
    <main className="flex-1 overflow-x-hidden max-w-full bg-gradient-to-b from-white via-gray-50/30 to-white">
      <section className="py-14 md:py-20">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            <span className="text-primary text-xs font-semibold tracking-widest uppercase mb-4 block">
              Região metropolitana
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-fg mb-4">{city.h1}</h1>
            <p className="text-lg text-gray-600 mb-6">{city.intro}</p>

            <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-8">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm">
                <MapPin className="w-4 h-4 text-primary" />
                ~{city.distanceKm} km de {city.name}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm">
                <Clock className="w-4 h-4 text-primary" />
                {city.travelTime} de carro
              </span>
            </div>

            {city.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-gray-600 leading-relaxed mb-4">
                {paragraph}
              </p>
            ))}

            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                to="/seminovos"
                search={emptySeminovosSearch}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-white font-semibold hover:bg-primary/90"
              >
                <Car className="w-4 h-4" />
                Ver estoque
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
              <Link
                to="/vender-carro-{$citySlug}"
                params={{ citySlug: city.slug }}
                className="inline-flex items-center justify-center rounded-xl border border-secondary/30 px-5 py-3 text-secondary font-semibold hover:bg-secondary/5"
              >
                Quer vender seu carro?
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="pb-16">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 max-w-3xl">
          <h2 className="text-2xl font-bold text-fg mb-6">Perguntas frequentes</h2>
          <div className="space-y-4">
            {city.faq.map((item) => (
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
