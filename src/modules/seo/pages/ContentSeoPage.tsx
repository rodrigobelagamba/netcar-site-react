import { useEffect } from "react";
import type { ContentSeoPage as ContentSeoPageData } from "@/data/seo/types";
import { useMetaTags } from "@/hooks/useMetaTags";
import { Localizacao } from "@/design-system/components/layout/Localizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";
import { RegionalActionCtas } from "@/modules/seo/components/RegionalActionCtas";
import { RegionalStockPreview } from "@/modules/seo/components/RegionalStockPreview";
import { RegionalTrustSignals } from "@/modules/seo/components/RegionalTrustSignals";
import { RegionalSeoHero } from "@/modules/seo/components/RegionalSeoHero";

export function ContentSeoPage({ page }: { page: ContentSeoPageData }) {
  useMetaTags({
    title: page.title,
    description: page.description,
    url: `https://www.netcarmultimarcas.com.br/${page.slug}`,
  });

  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: page.faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    };
    document.querySelector('script[data-schema="content-faq"]')?.remove();
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-schema", "content-faq");
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
    return () => {
      document.querySelector('script[data-schema="content-faq"]')?.remove();
    };
  }, [page]);

  const primary =
    page.secondHref === "/compra" || page.secondHref === "/compramos-seu-usado"
      ? "sell"
      : "whatsapp";

  return (
    <main className="flex-1 overflow-x-hidden max-w-full bg-white">
      <RegionalSeoHero title={page.h1} intro={page.intro}>
        <RegionalActionCtas
          className="mt-8"
          waText={page.waText}
          primary={primary}
          sellTo={
            page.secondHref === "/compramos-seu-usado"
              ? "/compramos-seu-usado"
              : "/compra"
          }
        />
      </RegionalSeoHero>

      <RegionalTrustSignals />

      <section className="pb-14">
        <div className="container-main max-w-3xl px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
            {page.sections.map((section, idx) => {
              if (section.type === "h2") {
                return (
                  <h2 key={idx} className="text-xl md:text-2xl font-bold text-fg mt-8 mb-3">
                    {section.text}
                  </h2>
                );
              }
              if (section.type === "p") {
                return (
                  <p key={idx} className="text-gray-600 leading-relaxed mb-4">
                    {section.text}
                  </p>
                );
              }
              if (section.type === "ul" && section.items) {
                return (
                  <ul key={idx} className="list-disc pl-5 space-y-2 text-gray-600 mb-4">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                );
              }
              if (section.type === "ol" && section.items) {
                return (
                  <ol key={idx} className="list-decimal pl-5 space-y-2 text-gray-600 mb-4">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                );
              }
              return null;
            })}

          {page.faq.length > 0 && (
            <>
              <h2 className="mt-10 mb-4 text-xl font-bold text-fg md:text-2xl">
                Perguntas frequentes
              </h2>
              <div className="space-y-4">
                {page.faq.map((item) => (
                  <div
                    key={item.q}
                    className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
                  >
                    <h3 className="mb-2 font-semibold text-fg">{item.q}</h3>
                    <p className="text-sm leading-relaxed text-gray-600">{item.a}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <RegionalStockPreview limit={8} />

      <div className="w-full font-sans antialiased text-muted-foreground bg-muted py-12 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 space-y-8">
        <div className="container-main space-y-8">
          <Localizacao />
          <IanBot />
        </div>
      </div>
    </main>
  );
}
