import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { MessageCircle, Car } from "lucide-react";
import { useEffect } from "react";
import type { ContentSeoPage as ContentSeoPageData } from "@/data/seo/types";
import { useMetaTags } from "@/hooks/useMetaTags";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import { buildWhatsAppUrl, siteWhatsAppMessage } from "@/lib/whatsappMessages";
import { Localizacao } from "@/design-system/components/layout/Localizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";
import { emptySeminovosSearch } from "@/lib/seminovos-search";

export function ContentSeoPage({ page }: { page: ContentSeoPageData }) {
  const { data: whatsapp } = useWhatsAppQuery();

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

  const waLink = (() => {
    if (!whatsapp?.numero) return "#";
    return buildWhatsAppUrl(whatsapp.numero, siteWhatsAppMessage(page.waText));
  })();

  return (
    <main className="flex-1 overflow-x-hidden max-w-full bg-gradient-to-b from-white via-gray-50/30 to-white">
      <section className="py-14 md:py-20">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-3xl md:text-4xl font-bold text-fg mb-4">{page.h1}</h1>
            <p className="text-lg text-gray-600 mb-6">{page.intro}</p>

            <div className="flex flex-wrap gap-3 mb-10">
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 text-white font-semibold hover:opacity-90"
              >
                <MessageCircle className="w-4 h-4" />
                {page.ctaLabel}
              </a>
              <Link
                to={page.secondHref}
                search={page.secondHref === "/seminovos" ? emptySeminovosSearch : undefined}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-white font-semibold hover:bg-primary/90"
              >
                <Car className="w-4 h-4" />
                {page.secondLabel}
              </Link>
            </div>

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
                <h2 className="text-xl md:text-2xl font-bold text-fg mt-10 mb-4">Perguntas frequentes</h2>
                <div className="space-y-4">
                  {page.faq.map((item) => (
                    <div key={item.q} className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
                      <h3 className="font-semibold text-fg mb-2">{item.q}</h3>
                      <p className="text-gray-600 text-sm leading-relaxed">{item.a}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
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
