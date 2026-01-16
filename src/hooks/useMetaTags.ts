import { useEffect } from "react";

interface MetaTagsProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  // Propriedades específicas para produtos (veículos)
  imageWidth?: number;
  imageHeight?: number;
  productBrand?: string;
  productAvailability?: string;
  productCondition?: string;
  productPriceAmount?: number;
  productPriceCurrency?: string;
  productRetailerItemId?: string;
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
}: MetaTagsProps) {
  useEffect(() => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const currentUrl = url || (typeof window !== "undefined" ? window.location.href : "");
    const defaultTitle = "Netcar";
    const defaultDescription =
      "Netcar - Seminovos com procedência e qualidade. Desde 1997 oferecendo os melhores veículos em Esteio/RS.";
    const defaultImage = `${baseUrl}/images/loja1.jpg`;

    // Título no formato "Netcar - [Nome da Página]" (ou apenas o título se já incluir Netcar)
    const finalTitle = title 
      ? (title.toLowerCase().includes("netcar") ? title : `Netcar - ${title}`)
      : defaultTitle;
    document.title = finalTitle;

    // Função auxiliar para atualizar ou criar meta tag
    const updateMetaTag = (property: string, content: string, isProperty = true) => {
      const attribute = isProperty ? "property" : "name";
      let element = document.querySelector(`meta[${attribute}="${property}"]`) as HTMLMetaElement;
      
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, property);
        document.head.appendChild(element);
      }
      
      element.setAttribute("content", content);
    };

    // Meta tags básicas
    updateMetaTag("description", description || defaultDescription, false);
    
    // Open Graph tags
    updateMetaTag("og:site_name", "Netcar");
    updateMetaTag("og:title", title || defaultTitle);
    updateMetaTag("og:description", description || defaultDescription);
    updateMetaTag("og:image", image || defaultImage);
    updateMetaTag("og:url", currentUrl);
    updateMetaTag("og:type", type);
    updateMetaTag("og:locale", "pt_BR");

    // Dimensões da imagem (se fornecidas)
    if (imageWidth) {
      updateMetaTag("og:image:width", String(imageWidth));
    }
    if (imageHeight) {
      updateMetaTag("og:image:height", String(imageHeight));
    }

    // Product tags (para veículos)
    if (productBrand) {
      updateMetaTag("product:brand", productBrand);
    }
    if (productAvailability) {
      updateMetaTag("product:availability", productAvailability);
    }
    if (productCondition) {
      updateMetaTag("product:condition", productCondition);
    }
    if (productPriceAmount !== undefined) {
      updateMetaTag("product:price:amount", String(productPriceAmount));
    }
    if (productPriceCurrency) {
      updateMetaTag("product:price:currency", productPriceCurrency);
    }
    if (productRetailerItemId) {
      updateMetaTag("product:retailer_item_id", productRetailerItemId);
    }

    // Twitter Card tags
    updateMetaTag("twitter:card", "summary_large_image", false);
    updateMetaTag("twitter:title", title || defaultTitle, false);
    updateMetaTag("twitter:description", description || defaultDescription, false);
    updateMetaTag("twitter:image", image || defaultImage, false);

    // Limpeza ao desmontar (opcional, mas mantém as tags padrão)
    return () => {
      // Restaura valores padrão se necessário
      document.title = defaultTitle;
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
  ]);
}


