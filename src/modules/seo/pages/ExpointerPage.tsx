import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  ExternalLink,
  MapPin,
  MessageCircle,
} from "lucide-react";
import { useEffect } from "react";
import page from "@/data/seo/expointer.json";
import { useMetaTags } from "@/hooks/useMetaTags";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import {
  buildWhatsAppUrl,
  DEFAULT_SALES_WHATSAPP,
  siteWhatsAppMessage,
} from "@/lib/whatsappMessages";
import { canonicalUrl } from "@/lib/seo";
import { emptySeminovosSearch } from "@/lib/seminovos-search";
import { RegionalStockPreview } from "@/modules/seo/components/RegionalStockPreview";

const canonical = canonicalUrl(`/${page.slug}`);
const stockButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#00283C] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#00435a]";
const contactButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#087A37] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#075E54]";

export function ExpointerPage() {
  const { data: whatsapp } = useWhatsAppQuery();
  const phone = whatsapp?.numero || DEFAULT_SALES_WHATSAPP;
  const tradeHref = buildWhatsAppUrl(
    phone,
    siteWhatsAppMessage(page.tradeMessage),
  );
  const visitHref = buildWhatsAppUrl(
    phone,
    siteWhatsAppMessage(page.visitMessage),
  );

  useMetaTags({
    title: page.title,
    description: page.description,
    url: canonical,
  });

  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.schema = "expointer";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": `${canonical}#webpage`,
          url: canonical,
          name: page.title,
          description: page.description,
          inLanguage: "pt-BR",
          about: { "@id": canonicalUrl("/#organization") },
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Início",
              item: canonicalUrl("/"),
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Expointer em Esteio",
              item: canonical,
            },
          ],
        },
      ],
    });
    document.head.appendChild(script);
    return () => script.remove();
  }, []);

  return (
    <main className="flex-1 overflow-x-hidden bg-white pt-24 sm:pt-0">
      <nav
        aria-label="Navegação estrutural"
        className="container-main px-4 pt-5 text-sm text-slate-600 sm:px-6 lg:px-8"
      >
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link to="/" className="hover:underline">
              Início
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-4 w-4" />
          </li>
          <li aria-current="page">Expointer em Esteio</li>
        </ol>
      </nav>

      <section className="bg-gradient-to-b from-white to-[#f0f8f7] py-9 sm:py-14">
        <div className="container-main grid items-center gap-8 px-4 sm:px-6 lg:grid-cols-[1.4fr_1fr] lg:gap-12 lg:px-8">
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-[#007983]">
              Expointer em Esteio · Netcar Multimarcas
            </p>
            <h1 className="max-w-3xl text-3xl font-bold leading-tight tracking-tight text-[#00283C] sm:text-4xl lg:text-5xl">
              {page.h1}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
              {page.intro}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                to="/seminovos"
                search={emptySeminovosSearch}
                data-regional-action="expointer_view_stock"
                className={stockButton}
              >
                {page.stockLabel}
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </Link>
              <a
                href={tradeHref}
                target="_blank"
                rel="noopener noreferrer"
                data-wa-source="expointer_trade"
                data-wa-intent="trade_in"
                className={contactButton}
              >
                <MessageCircle
                  className="h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                {page.tradeLabel}
              </a>
            </div>
          </div>
          <aside
            aria-label="Calendário da Expointer"
            className="rounded-2xl border border-[#007983]/15 bg-white p-6 shadow-sm sm:p-7"
          >
            <CalendarDays
              className="mb-4 h-7 w-7 text-[#007983]"
              aria-hidden="true"
            />
            <h2 className="text-xl font-bold text-[#00283C]">
              {page.event.edition}
            </h2>
            <p className="mt-2 text-lg font-semibold text-[#00283C]">
              {page.event.dates}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {page.event.venue}
              <br />
              {page.event.hours}
            </p>
            <a
              href={page.event.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#007983] underline underline-offset-4"
            >
              Datas e programação no site oficial
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
            </a>
            <p className="mt-4 border-t border-slate-100 pt-4 text-sm leading-relaxed text-slate-600">
              {page.hoursNote}
            </p>
          </aside>
        </div>
      </section>

      <div className="pt-10 sm:pt-14">
        <RegionalStockPreview
          title={page.stockHeading}
          limit={8}
          moreLabel={page.stockLabel}
        />
      </div>

      <section className="pb-12 sm:pb-16">
        <div className="container-main px-4 sm:px-6 lg:px-8">
          <h2 className="mb-6 text-2xl font-bold text-[#00283C]">
            O que você encontra na Netcar
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {page.benefits.map((benefit) => (
              <article
                key={benefit.title}
                className="rounded-2xl border border-slate-200 p-5 sm:p-6"
              >
                <h3 className="text-lg font-bold text-[#00283C]">
                  {benefit.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  {benefit.text}
                </p>
              </article>
            ))}
          </div>
          <Link
            to="/como-selecionamos-nossos-carros"
            className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#007983] underline underline-offset-4"
          >
            Como selecionamos nossos carros
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section id="visita" className="scroll-mt-24 bg-slate-50 py-10 sm:py-14">
        <div className="container-main px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-[#00283C]">
            {page.visitHeading}
          </h2>
          <p className="mt-4 max-w-3xl leading-relaxed text-slate-600">
            {page.visitIntro}
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {page.stores.map((store) => (
              <article
                key={store.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
              >
                <MapPin
                  className="mb-3 h-6 w-6 text-[#007983]"
                  aria-hidden="true"
                />
                <h3 className="text-lg font-bold text-[#00283C]">
                  {store.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {store.address}
                </p>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(page.origin)}&destination=${encodeURIComponent(store.address)}&travelmode=driving`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-regional-action={`expointer_route_${store.id}`}
                  className={`${stockButton} mt-5 w-full`}
                >
                  Rota do parque à {store.name}
                  <ExternalLink
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                </a>
              </article>
            ))}
          </div>
          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-slate-600">
            {page.locationNote}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <a
              href={visitHref}
              target="_blank"
              rel="noopener noreferrer"
              data-wa-source="expointer_visit"
              data-wa-intent="schedule_visit"
              className={contactButton}
            >
              <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              Combinar minha visita
            </a>
            <Link
              to="/contato"
              className="inline-flex min-h-11 items-center justify-center px-4 text-sm font-bold text-[#00283C] underline underline-offset-4"
            >
              Consultar atendimento das lojas
            </Link>
          </div>
          <a
            href={page.event.accessUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm text-slate-600 underline underline-offset-4"
          >
            Acessos à Expointer 2026: orientação oficial
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="mb-6 text-2xl font-bold text-[#00283C]">
            Para organizar sua visita
          </h2>
          <div className="divide-y divide-slate-200">
            {page.faq.map((item) => (
              <div key={item.q} className="py-5 first:pt-0">
                <h3 className="font-bold text-[#00283C]">{item.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
