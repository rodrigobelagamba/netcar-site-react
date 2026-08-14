import { useEffect } from "react";
import { CANONICAL_ORIGIN, canonicalUrl } from "@/lib/seo";

interface MetaTagsProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  robots?: string;
  // Propriedades específicas para produtos (veículos)
  imageWidth?: number;
  imageHeight?: number;
  productBrand?: string;
  productAvailability?: string;
  productCondition?: string;
  productPriceAmount?: number;
  productPriceCurrency?: string;
  productRetailerItemId?: string;
  // Título específico para Open Graph (se diferente do title)
  ogTitle?: string;
}

/**
 * Hook para gerenciar metatags dinamicamente (Open Graph, Twitter Cards, SEO)
 */
export function useMetaTags({
  title,
  description,
  image,
  url,
  type = "website",
  imageWidth,
  imageHeight,
  productBrand,
  productAvailability,
  productCondition,
  productPriceAmount,
  productPriceCurrency,
  productRetailerItemId,
  ogTitle,
  robots,
}: MetaTagsProps) {
  useEffect(() => {
    const baseUrl = CANONICAL_ORIGIN;
    // Canonical/og:url sempre no host www — nunca window.location.origin
    const currentUrl =
      url ||
      (typeof window !== "undefined"
        ? canonicalUrl(window.location.pathname)
        : CANONICAL_ORIGIN);
    const defaultTitle = "Netcar Multimarcas";
    const defaultDescription =
      "Netcar Multimarcas - Seminovos com procedência e qualidade. Desde 1997 oferecendo os melhores veículos em Esteio/RS.";
    const defaultImage = `${baseUrl}/images/loja1.jpg`;

    // Título no formato "Netcar - [Nome da Página]" (ou apenas o título se já incluir Netcar)
    const finalTitle = title
      ? title.toLowerCase().includes("netcar")
        ? title
        : `Netcar - ${title}`
      : defaultTitle;
    document.title = finalTitle;

    // Função auxiliar para atualizar ou criar meta tag
    const updateMetaTag = (
      property: string,
      content: string,
      isProperty = true,
    ) => {
      const attribute = isProperty ? "property" : "name";
      let element = document.querySelector(
        `meta[${attribute}="${property}"]`,
      ) as HTMLMetaElement;

      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, property);
        document.head.appendChild(element);
      }

      element.setAttribute("content", content);
    };

    const removeMetaTag = (property: string, isProperty = true) => {
      const attribute = isProperty ? "property" : "name";
      document.querySelector(`meta[${attribute}="${property}"]`)?.remove();
    };

    // Meta tags básicas
    updateMetaTag("description", description || defaultDescription, false);

    // Open Graph tags
    updateMetaTag("og:site_name", "Netcar Multimarcas");
    // Usa ogTitle se fornecido, senão usa title
    updateMetaTag("og:title", ogTitle || title || defaultTitle);
    updateMetaTag("og:description", description || defaultDescription);
    updateMetaTag("og:image", image || defaultImage);
    updateMetaTag("og:url", currentUrl);
    updateMetaTag("og:type", type);
    updateMetaTag("og:locale", "pt_BR");

    // Dimensões da imagem (se fornecidas)
    if (imageWidth) {
      updateMetaTag("og:image:width", String(imageWidth));
    } else {
      removeMetaTag("og:image:width");
    }
    if (imageHeight) {
      updateMetaTag("og:image:height", String(imageHeight));
    } else {
      removeMetaTag("og:image:height");
    }

    // Product tags (para veículos)
    if (productBrand) {
      updateMetaTag("product:brand", productBrand);
    } else {
      removeMetaTag("product:brand");
    }
    if (productAvailability) {
      updateMetaTag("product:availability", productAvailability);
    } else {
      removeMetaTag("product:availability");
    }
    if (productCondition) {
      updateMetaTag("product:condition", productCondition);
    } else {
      removeMetaTag("product:condition");
    }
    if (productPriceAmount !== undefined) {
      updateMetaTag("product:price:amount", String(productPriceAmount));
    } else {
      removeMetaTag("product:price:amount");
    }
    if (productPriceCurrency) {
      updateMetaTag("product:price:currency", productPriceCurrency);
    } else {
      removeMetaTag("product:price:currency");
    }
    if (productRetailerItemId) {
      updateMetaTag("product:retailer_item_id", productRetailerItemId);
    } else {
      removeMetaTag("product:retailer_item_id");
    }

    // Twitter Card tags
    updateMetaTag("twitter:card", "summary_large_image", false);
    updateMetaTag("twitter:title", title || defaultTitle, false);
    updateMetaTag(
      "twitter:description",
      description || defaultDescription,
      false,
    );
    updateMetaTag("twitter:image", image || defaultImage, false);

    const defaultRobots = "index, follow, max-image-preview:large";
    // Sempre sobrescreve a rota anterior. Sem isso, navegar de uma página
    // noindex para uma landing regional podia deixar o noindex preso no SPA.
    updateMetaTag("robots", robots || defaultRobots, false);

    // Canonical URL
    let canonicalLink = document.querySelector(
      'link[rel="canonical"]',
    ) as HTMLLinkElement;
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute("href", currentUrl);

    // Limpeza ao desmontar (opcional, mas mantém as tags padrão)
    return () => {
      document.title = defaultTitle;
      updateMetaTag("robots", defaultRobots, false);
      for (const property of [
        "og:image:width",
        "og:image:height",
        "product:brand",
        "product:availability",
        "product:condition",
        "product:price:amount",
        "product:price:currency",
        "product:retailer_item_id",
      ]) {
        removeMetaTag(property);
      }
    };
  }, [
    title,
    description,
    image,
    url,
    type,
    imageWidth,
    imageHeight,
    productBrand,
    productAvailability,
    productCondition,
    productPriceAmount,
    productPriceCurrency,
    productRetailerItemId,
    ogTitle,
    robots,
  ]);
}
