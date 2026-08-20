import { Link, useParams } from "@tanstack/react-router";
import { CalendarCheck, Car, Clock, MapPin, Search } from "lucide-react";
import { useEffect, useRef } from "react";
import { getCityPage } from "@/data/seo";
import { useMetaTags } from "@/hooks/useMetaTags";
import { LazyLocalizacao } from "@/design-system/components/layout/LazyLocalizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";
import { NotFoundRedirect } from "@/components/NotFoundRedirect";
import { trackTrustSectionView } from "@/lib/analytics";
import { RelatedCitiesNav } from "@/modules/seo/components/RelatedCitiesNav";
import { RegionalActionCtas } from "@/modules/seo/components/RegionalActionCtas";
import { RegionalStockPreview } from "@/modules/seo/components/RegionalStockPreview";
import { RegionalTrustSignals } from "@/modules/seo/components/RegionalTrustSignals";
import { RegionalSeoHero } from "@/modules/seo/components/RegionalSeoHero";
import { RegionalBreadcrumbs } from "@/modules/seo/components/RegionalBreadcrumbs";
import { useRegionalPageSchema } from "@/modules/seo/useRegionalPageSchema";

export function CityLandingPage() {
  const { citySlug } = useParams({ from: "/seminovos-{$citySlug}" });
  const city = getCityPage(citySlug);
  const trustSectionRef = useRef<HTMLElement>(null);

  useMetaTags({
    title: city?.title,
    description: city?.description,
    url: city
      ? `https://www.netcarmultimarcas.com.br/seminovos-${city.slug}`
      : undefined,
    robots: city ? undefined : "noindex, nofollow",
  });
  useRegionalPageSchema(city, "buy");

  useEffect(() => {
    const section = trustSectionRef.current;
    if (!city || !section || typeof IntersectionObserver === "undefined")
      return;

    let tracked = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || tracked) return;
        tracked = true;
        trackTrustSectionView("regional_remote_process");
        observer.disconnect();
      },
      { threshold: 0.4 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [city]);

  if (!city) {
    return <NotFoundRedirect />;
  }

  return (
    <main className="flex-1 overflow-x-hidden max-w-full bg-white">
      <RegionalBreadcrumbs cityName={city.name} variant="buy" />
      <RegionalSeoHero
        eyebrow={city.regionName ?? "Atendimento regional"}
        title={city.h1}
        intro={city.intro}
        badges={
          <>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm text-gray-600 shadow-sm ring-1 ring-black/5">
              <MapPin className="h-4 w-4 text-primary" />~{city.distanceKm} km
              de {city.name}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm text-gray-600 shadow-sm ring-1 ring-black/5">
              <Clock className="h-4 w-4 text-primary" />
              {city.travelTime} de carro
            </span>
          </>
        }
      >
        <div className="mt-6 space-y-4">
          <h2 className="text-xl font-bold text-fg">
            {city.contentHeading ??
              `Como comparar seminovos saindo de ${city.name}`}
          </h2>
          {city.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-gray-600 leading-relaxed">
              {paragraph}
            </p>
          ))}
          {city.contentHeading && (
            <nav
              aria-label={`Atalhos para pesquisar seminovos em ${city.name}`}
              className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
            >
              <h3 className="font-semibold text-fg">
                Compare antes de organizar a visita
              </h3>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold">
                <li>
                  <Link
                    to="/seminovos"
                    className="text-primary hover:underline"
                  >
                    Estoque atual
                  </Link>
                </li>
                <li>
                  <Link to="/comparar" className="text-primary hover:underline">
                    Comparar carros
                  </Link>
                </li>
                <li>
                  <Link
                    to="/financiamento"
                    className="text-primary hover:underline"
                  >
                    Entender o financiamento
                  </Link>
                </li>
                <li>
                  <Link to="/compra" className="text-secondary hover:underline">
                    Avaliar meu usado
                  </Link>
                </li>
              </ul>
            </nav>
          )}
          {city.routeNote && (
            <p className="rounded-xl border border-primary/10 bg-primary/5 p-4 text-sm leading-relaxed text-gray-600">
              <strong className="text-fg">Referência de trajeto:</strong>{" "}
              {city.routeNote}
            </p>
          )}
        </div>
        <RegionalActionCtas
          className="mt-8"
          waText={`moro em ${city.name} e estou procurando um seminovo.`}
          sellCitySlug={city.slug}
          primary="whatsapp"
        />
      </RegionalSeoHero>

      <RegionalTrustSignals />

      <RegionalStockPreview
        title={`Seminovos para quem vem de ${city.name}`}
        limit={8}
      />

      <section ref={trustSectionRef} className="pb-16">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <h2 className="mb-6 text-2xl font-bold text-fg">
            Da pesquisa à visita em Esteio
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-gray-100 bg-gradient-to-b from-white to-gray-50/80 p-5 shadow-sm">
              <Search className="mb-3 h-5 w-5 text-primary" />
              <h3 className="mb-2 font-semibold text-fg">
                1. Pesquise no site
              </h3>
              <p className="text-sm leading-relaxed text-gray-600">
                Compare estoque, fotos, preços e versões. Site é ponto de
                partida antes de conversar com equipe.
              </p>
            </article>
            <article className="rounded-2xl border border-gray-100 bg-gradient-to-b from-white to-gray-50/80 p-5 shadow-sm">
              <Car className="mb-3 h-5 w-5 text-primary" />
              <h3 className="mb-2 font-semibold text-fg">
                2. Adiante negociação
              </h3>
              <p className="text-sm leading-relaxed text-gray-600">
                Troca do usado, simulação de parcelamento e dúvidas no WhatsApp
                podem começar remotamente. Condições finais na loja.
              </p>
            </article>
            <article className="rounded-2xl border border-gray-100 bg-gradient-to-b from-white to-gray-50/80 p-5 shadow-sm">
              <CalendarCheck className="mb-3 h-5 w-5 text-primary" />
              <h3 className="mb-2 font-semibold text-fg">3. Confirme visita</h3>
              <p className="text-sm leading-relaxed text-gray-600">
                {city.visitPlanning ??
                  "Confirme disponibilidade e visite as lojas da Av. Presidente Vargas, em Esteio, para test drive, despachante e fechamento."}
              </p>
            </article>
          </div>
          <p className="mt-5 text-sm text-gray-500">
            Netcar possui lojas físicas somente em Esteio.{" "}
            <Link
              to="/regioes-atendidas"
              className="font-semibold text-primary hover:underline"
            >
              Veja todas as regiões atendidas
            </Link>
            .
          </p>
        </div>
      </section>

      <RelatedCitiesNav currentSlug={city.slug} variant="buy" />

      <section className="pb-16">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 max-w-3xl">
          <h2 className="text-2xl font-bold text-fg mb-6">
            Perguntas frequentes
          </h2>
          <div className="space-y-4">
            {city.faq.map((item) => (
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
