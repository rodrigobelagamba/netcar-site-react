import { useEffect } from "react";
import citiesJson from "@/data/seo/cities.json";
import type { CitySeoPage } from "@/data/seo/types";
import { CANONICAL_ORIGIN } from "@/lib/seo";

const cityPages = citiesJson as CitySeoPage[];

const openingHours = [
  {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    opens: "09:00",
    closes: "18:00",
  },
  {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: "Saturday",
    opens: "09:00",
    closes: "16:30",
  },
];

/**
 * Publica uma entidade institucional e uma entidade LocalBusiness por loja.
 * Endereços distintos no mesmo AutoDealer confundem qual ficha local representa
 * cada unidade; por isso cada endereço tem @id, NAP e coordenadas próprios.
 */
export function SchemaOrg() {
  useEffect(() => {
    const baseUrl = CANONICAL_ORIGIN;
    const logoId = `${baseUrl}/#logo`;
    const organizationId = `${baseUrl}/#organization`;
    const loja1Id = `${baseUrl}/#loja-1`;
    const loja2Id = `${baseUrl}/#loja-2`;
    const areaServed = [
      { "@type": "City", name: "Esteio" },
      ...cityPages.map((city) => ({ "@type": "City", name: city.name })),
      {
        "@type": "AdministrativeArea",
        name: "Região Metropolitana de Porto Alegre",
      },
    ];

    const schema = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": organizationId,
          name: "Netcar Multimarcas",
          // Nomes que o público e perfis antigos usam; ajuda o Google a
          // juntar "Netcar RC" (Facebook, domínio antigo) a esta entidade.
          alternateName: ["Netcar Esteio", "Netcar RC", "Netcar Veículos"],
          legalName: "R&C Veículos Ltda",
          taxID: "02.237.969/0001-06",
          foundingDate: "1997",
          description:
            "Loja de seminovos em Esteio/RS. Duas lojas integradas na Av. Presidente Vargas, estoque online, financiamento, troca e compra de usados.",
          url: baseUrl,
          logo: {
            "@type": "ImageObject",
            "@id": logoId,
            url: `${baseUrl}/images/Logotipo7_1768863597989.png`,
            width: 300,
            height: 100,
          },
          brand: {
            "@type": "Brand",
            "@id": `${baseUrl}/#brand`,
            name: "Netcar Multimarcas",
            logo: { "@id": logoId },
          },
          image: [`${baseUrl}/images/loja1.jpg`, `${baseUrl}/images/loja2.jpg`],
          email: "contato@netcarmultimarcas.com.br",
          areaServed,
          subOrganization: [{ "@id": loja1Id }, { "@id": loja2Id }],
          sameAs: [
            "https://www.instagram.com/netcar_rc",
            "https://www.facebook.com/NetcarRC",
            "https://www.linkedin.com/company/netcar-multimarcas",
            "https://maps.google.com/maps?cid=9144067949621682127",
            "https://maps.google.com/maps?cid=10839197980729051544",
            "https://napista.com.br/busca/carro/vendedor-netcar_multimarcas_02230106",
          ],
        },
        {
          "@type": "AutoDealer",
          "@id": loja1Id,
          name: "Netcar Multimarcas - Loja 1",
          branchCode: "Loja1",
          url: `${baseUrl}/contato#loja-1`,
          image: `${baseUrl}/images/loja1.jpg`,
          logo: { "@id": logoId },
          telephone: "+55-51-3473-7900",
          email: "contato@netcarmultimarcas.com.br",
          parentOrganization: { "@id": organizationId },
          address: {
            "@type": "PostalAddress",
            streetAddress: "Av. Presidente Vargas, 740",
            addressLocality: "Esteio",
            addressRegion: "RS",
            postalCode: "93260-490",
            addressCountry: "BR",
          },
          geo: {
            "@type": "GeoCoordinates",
            latitude: -29.8380385,
            longitude: -51.1702399,
          },
          hasMap: "https://maps.google.com/maps?cid=9144067949621682127",
          openingHoursSpecification: openingHours,
          priceRange: "R$ 40.000 - R$ 300.000",
        },
        {
          "@type": "AutoDealer",
          "@id": loja2Id,
          name: "Netcar Multimarcas - Loja 2",
          branchCode: "Loja2",
          url: `${baseUrl}/contato#loja-2`,
          image: `${baseUrl}/images/loja2.jpg`,
          logo: { "@id": logoId },
          telephone: "+55-51-3033-3900",
          email: "contato@netcarmultimarcas.com.br",
          parentOrganization: { "@id": organizationId },
          address: {
            "@type": "PostalAddress",
            streetAddress: "Av. Presidente Vargas, 1106",
            addressLocality: "Esteio",
            addressRegion: "RS",
            postalCode: "93260-048",
            addressCountry: "BR",
          },
          geo: {
            "@type": "GeoCoordinates",
            latitude: -29.8411446,
            longitude: -51.1721442,
          },
          hasMap: "https://maps.google.com/maps?cid=10839197980729051544",
          openingHoursSpecification: openingHours,
          priceRange: "R$ 40.000 - R$ 300.000",
        },
      ],
    };

    document
      .querySelector(
        'script[type="application/ld+json"][data-schema="organization"]',
      )
      ?.remove();

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-schema", "organization");
    script.textContent = JSON.stringify(schema, null, 2);
    document.head.appendChild(script);

    return () => {
      document
        .querySelector(
          'script[type="application/ld+json"][data-schema="organization"]',
        )
        ?.remove();
    };
  }, []);

  return null;
}
