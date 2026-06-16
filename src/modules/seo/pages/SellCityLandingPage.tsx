import { Link, useParams } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { MapPin, Clock, Banknote } from "lucide-react";
import { useEffect } from "react";
import { getCityPage } from "@/data/seo";
import { useMetaTags } from "@/hooks/useMetaTags";
import { useWhatsAppQuery } from "@/api/queries/useSiteQuery";
import { formatWhatsAppNumber } from "@/lib/formatters";
import { Localizacao } from "@/design-system/components/layout/Localizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";
import { NotFoundRedirect } from "@/components/NotFoundRedirect";
import { QuickSellForm } from "@/components/QuickSellForm";

export function SellCityLandingPage() {
  const { citySlug } = useParams({ from: "/vender-carro-{$citySlug}" });
  const city = getCityPage(citySlug);
  const sell = city?.sell;
  const { data: whatsapp } = useWhatsAppQuery();

  useMetaTags({
    title: sell?.title,
    description: sell?.description,
    url: city ? `https://www.netcarmultimarcas.com.br/vender-carro-${city.slug}` : undefined,
  });

  useEffect(() => {
    if (!sell) return;

    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: sell.faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    };

    document.querySelector('script[data-schema="sell-city-faq"]')?.remove();
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-schema", "sell-city-faq");
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      document.querySelector('script[data-schema="sell-city-faq"]')?.remove();
    };
  }, [sell]);

  const waLink = (() => {
    if (!whatsapp?.numero || !city) return "#";
    const number = formatWhatsAppNumber(whatsapp.numero);
    const text = `Oi! Moro em ${city.name} e quero vender meu carro para a Netcar.`;
    return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
  })();

  if (!city || !sell) {
    return <NotFoundRedirect />;
  }

  return (
    <main className="flex-1 overflow-x-hidden max-w-full bg-gradient-to-b from-white via-gray-50/30 to-white">
      <section className="py-14 md:py-20">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl"
          >
            <span className="text-secondary text-xs font-semibold tracking-widest uppercase mb-4 block">
              Netcar compra
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-fg mb-4">{sell.h1}</h1>
            <p className="text-lg text-gray-600 mb-6">{sell.intro}</p>

            <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-8">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm">
                <MapPin className="w-4 h-4 text-secondary" />
                Avaliação em Esteio — ~{city.distanceKm} km de {city.name}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm">
                <Clock className="w-4 h-4 text-secondary" />
                {city.travelTime} de carro
              </span>
            </div>

            {sell.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-gray-600 leading-relaxed mb-4">
                {paragraph}
              </p>
            ))}

            <div className="flex flex-wrap gap-3 mt-8">
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-secondary px-5 py-3 text-white font-semibold hover:opacity-90"
              >
                <Banknote className="w-4 h-4" />
                Avaliar meu carro
              </a>
              <Link
                to="/compra"
                className="inline-flex items-center justify-center rounded-xl border border-secondary/20 px-5 py-3 text-secondary font-semibold hover:bg-secondary/5"
              >
                Como funciona
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="pb-12">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 max-w-3xl">
          <QuickSellForm cityName={city.name} />
        </div>
      </section>

      <section className="pb-16">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 max-w-3xl">
          <h2 className="text-2xl font-bold text-fg mb-6">Dúvidas de quem quer vender</h2>
          <div className="space-y-4">
            {sell.faq.map((item) => (
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
