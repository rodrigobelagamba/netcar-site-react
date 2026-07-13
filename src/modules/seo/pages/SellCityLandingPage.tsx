import { Link, useParams } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Banknote,
  Camera,
  Car,
  ClipboardCheck,
  Clock,
  MapPin,
  Store,
} from "lucide-react";
import { useEffect } from "react";
import { getCityPage } from "@/data/seo";
import { useMetaTags } from "@/hooks/useMetaTags";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import { buildWhatsAppUrl, siteWhatsAppMessage } from "@/lib/whatsappMessages";
import { Localizacao } from "@/design-system/components/layout/Localizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";
import { NotFoundRedirect } from "@/components/NotFoundRedirect";
import { QuickSellForm } from "@/components/QuickSellForm";
import { RelatedCitiesNav } from "@/modules/seo/components/RelatedCitiesNav";

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
    const text = siteWhatsAppMessage(
      `moro em ${city.name} e quero vender meu carro para a Netcar.`,
    );
    return buildWhatsAppUrl(whatsapp.numero, text);
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
                href="#pre-avaliacao"
                className="inline-flex items-center gap-2 rounded-xl bg-secondary px-5 py-3 text-white font-semibold hover:opacity-90"
              >
                <ClipboardCheck className="w-4 h-4" />
                Iniciar pré-avaliação
              </a>
              <Link
                to="/seminovos"
                search={{
                  marca: undefined,
                  modelo: undefined,
                  precoMin: undefined,
                  precoMax: undefined,
                  anoMin: undefined,
                  anoMax: undefined,
                  cambio: undefined,
                  cor: undefined,
                  categoria: undefined,
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-secondary/20 px-5 py-3 text-secondary font-semibold hover:bg-secondary/5"
              >
                <Car className="w-4 h-4" />
                Ver estoque para troca
              </Link>
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                data-regional-action="sell_whatsapp"
                className="inline-flex items-center gap-2 px-3 py-3 text-sm font-semibold text-gray-500 hover:text-secondary"
              >
                <Banknote className="w-4 h-4" />
                Tirar dúvida no WhatsApp
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="pb-12">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <h2 className="mb-6 text-2xl font-bold text-fg">
            Pré-avaliação remota, vistoria em Esteio
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <Camera className="mb-3 h-5 w-5 text-secondary" />
              <h3 className="mb-2 font-semibold text-fg">1. Envie dados reais</h3>
              <p className="text-sm leading-relaxed text-gray-600">
                Modelo, versão, ano, km, fotos, avarias e saldo de financiamento
                ajudam no primeiro filtro.
              </p>
            </article>
            <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <ClipboardCheck className="mb-3 h-5 w-5 text-secondary" />
              <h3 className="mb-2 font-semibold text-fg">2. Receba orientação</h3>
              <p className="text-sm leading-relaxed text-gray-600">
                Pré-avaliação indica se vale avançar. Não é proposta final nem
                garantia de compra.
              </p>
            </article>
            <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <Store className="mb-3 h-5 w-5 text-secondary" />
              <h3 className="mb-2 font-semibold text-fg">3. Agende vistoria</h3>
              <p className="text-sm leading-relaxed text-gray-600">
                Conferência do carro, documentos e proposta final acontecem nas
                lojas da Av. Presidente Vargas, somente em Esteio.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="pb-12">
        <div
          id="pre-avaliacao"
          className="container-main scroll-mt-28 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 max-w-3xl"
        >
          <QuickSellForm cityName={city.name} />
          <p className="mt-4 text-center text-sm text-gray-500">
            Sem unidade ou ponto de coleta em {city.name}.{" "}
            <Link to="/regioes-atendidas" className="font-semibold text-secondary hover:underline">
              Consulte regiões atendidas
            </Link>
            .
          </p>
        </div>
      </section>

      <RelatedCitiesNav currentSlug={city.slug} variant="sell" />

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
