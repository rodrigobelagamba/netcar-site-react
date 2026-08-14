import { useEffect } from "react";
import type { CitySeoPage } from "@/data/seo/types";

const SITE = "https://www.netcarmultimarcas.com.br";

type RegionalPageVariant = "buy" | "sell";

/**
 * Explica a intenção de cada landing sem fingir uma loja física na cidade-alvo.
 * O estabelecimento continua sendo a mesma organização, localizada em Esteio.
 */
export function useRegionalPageSchema(
  city: CitySeoPage | undefined,
  variant: RegionalPageVariant,
) {
  useEffect(() => {
    if (!city) return;

    const isBuy = variant === "buy";
    const page = isBuy ? city : city.sell;
    const canonical = `${SITE}/${isBuy ? "seminovos" : "vender-carro"}-${city.slug}`;
    const pageId = `${canonical}#webpage`;
    const serviceId = `${canonical}#service`;
    const breadcrumbId = `${canonical}#breadcrumb`;

    const schema = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": isBuy ? "CollectionPage" : "WebPage",
          "@id": pageId,
          url: canonical,
          name: page.h1,
          description: page.description,
          inLanguage: "pt-BR",
          isPartOf: {
            "@type": "CollectionPage",
            "@id": `${SITE}/regioes-atendidas#webpage`,
            url: `${SITE}/regioes-atendidas`,
            name: "Regiões atendidas pela Netcar",
          },
          breadcrumb: { "@id": breadcrumbId },
          mainEntity: { "@id": serviceId },
        },
        {
          "@type": "Service",
          "@id": serviceId,
          name: isBuy
            ? `Atendimento para compra de seminovos para ${city.name}`
            : `Pré-avaliação de carro para clientes de ${city.name}`,
          serviceType: isBuy
            ? "Pesquisa online e atendimento para compra presencial de carro seminovo"
            : "Pré-avaliação remota e compra presencial de veículo usado",
          areaServed: { "@type": "City", name: city.name },
          provider: { "@id": `${SITE}/#organization` },
          availableChannel: {
            "@type": "ServiceChannel",
            serviceUrl: canonical,
            availableLanguage: "pt-BR",
          },
        },
        {
          "@type": "FAQPage",
          "@id": `${canonical}#faq`,
          mainEntity: page.faq.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        },
        {
          "@type": "BreadcrumbList",
          "@id": breadcrumbId,
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: `${SITE}/`,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Regiões atendidas",
              item: `${SITE}/regioes-atendidas`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: isBuy
                ? `Seminovos perto de ${city.name}`
                : `Vender carro em ${city.name}`,
              item: canonical,
            },
          ],
        },
      ],
    };

    document.querySelector('script[data-schema="regional-page"]')?.remove();
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-schema", "regional-page");
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      document.querySelector('script[data-schema="regional-page"]')?.remove();
    };
  }, [city, variant]);
}
