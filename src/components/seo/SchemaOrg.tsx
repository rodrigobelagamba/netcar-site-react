import { useEffect } from "react";
import { useAddressQuery, usePhoneQuery } from "@/api/queries/useSiteQuery";

/**
 * Componente que adiciona Schema.org AutoDealer no head do documento
 * Busca dados da API quando disponível, usa valores padrão como fallback
 */
export function SchemaOrg() {
  const { data: addressLoja1 } = useAddressQuery("Loja1");
  const { data: addressLoja2 } = useAddressQuery("Loja2");
  const { data: phoneLoja1 } = usePhoneQuery("Loja1");

  useEffect(() => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://www.netcarmultimarcas.com.br";
    
    // Valores padrão do documento
    const defaultAddress1 = {
      streetAddress: "Av. Presidente Vargas, 740",
      addressLocality: "Esteio",
      addressRegion: "RS",
      postalCode: "93265-000",
    };
    
    const defaultAddress2 = {
      streetAddress: "Av. Presidente Vargas, 1106",
      addressLocality: "Esteio",
      addressRegion: "RS",
      postalCode: "93265-000",
    };

    // Usa dados da API se disponível, senão usa valores padrão
    const address1 = addressLoja1?.endereco 
      ? {
          streetAddress: addressLoja1.endereco,
          addressLocality: addressLoja1.cidade || "Esteio",
          addressRegion: addressLoja1.estado || "RS",
          postalCode: addressLoja1.cep || "93265-000",
        }
      : defaultAddress1;

    const address2 = addressLoja2?.endereco
      ? {
          streetAddress: addressLoja2.endereco,
          addressLocality: addressLoja2.cidade || "Esteio",
          addressRegion: addressLoja2.estado || "RS",
          postalCode: addressLoja2.cep || "93265-000",
        }
      : defaultAddress2;

    const phone = phoneLoja1?.telefone || "(51) 3473-7900";
    // Remove caracteres não numéricos e formata para E.164
    const phoneFormatted = phone.replace(/\D/g, "");
    const phoneE164 = phoneFormatted.length >= 10 
      ? `+55-${phoneFormatted.slice(0, 2)}-${phoneFormatted.slice(2)}`
      : "+55-51-3473-7900";

    const schema = {
      "@context": "https://schema.org",
      "@type": "AutoDealer",
      "@id": `${baseUrl}/#organization`,
      "name": "Netcar Multimarcas",
      "legalName": "Netcar Veículos Ltda",
      "description": "Loja de seminovos em Esteio/RS com mais de 15 anos de mercado. Carros com garantia, vistoriados e financiamento facilitado.",
      "url": baseUrl,
      "logo": {
        "@type": "ImageObject",
        "url": `${baseUrl}/images/Logotipo7_1768863597989.png`,
        "width": 300,
        "height": 100
      },
      "image": [
        `${baseUrl}/images/loja1.jpg`,
        `${baseUrl}/images/loja2.jpg`
      ],
      "telephone": phoneE164,
      "email": "contato@netcarmultimarcas.com.br",
      "address": [
        {
          "@type": "PostalAddress",
          "name": "Loja 1",
          "streetAddress": address1.streetAddress,
          "addressLocality": address1.addressLocality,
          "addressRegion": address1.addressRegion,
          "postalCode": address1.postalCode,
          "addressCountry": "BR"
        },
        {
          "@type": "PostalAddress",
          "name": "Loja 2",
          "streetAddress": address2.streetAddress,
          "addressLocality": address2.addressLocality,
          "addressRegion": address2.addressRegion,
          "postalCode": address2.postalCode,
          "addressCountry": "BR"
        }
      ],
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": "-29.837920",
        "longitude": "-51.170236"
      },
      "openingHoursSpecification": [
        {
          "@type": "OpeningHoursSpecification",
          "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          "opens": "09:00",
          "closes": "18:00"
        },
        {
          "@type": "OpeningHoursSpecification",
          "dayOfWeek": "Saturday",
          "opens": "09:00",
          "closes": "16:30"
        }
      ],
      "priceRange": "R$ 40.000 - R$ 300.000",
      "sameAs": [
        "https://www.instagram.com/netcar_rc",
        "https://www.facebook.com/NetcarRC"
      ]
    };

    // Remove script existente se houver
    const existingScript = document.querySelector('script[type="application/ld+json"][data-schema="organization"]');
    if (existingScript) {
      existingScript.remove();
    }

    // Cria novo script
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-schema", "organization");
    script.textContent = JSON.stringify(schema, null, 2);
    document.head.appendChild(script);

    return () => {
      const scriptToRemove = document.querySelector('script[type="application/ld+json"][data-schema="organization"]');
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [addressLoja1, addressLoja2, phoneLoja1]);

  return null;
}
