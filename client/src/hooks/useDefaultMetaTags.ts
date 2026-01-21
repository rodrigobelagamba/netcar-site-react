import { useEffect } from "react";
import { useBannersLoja1Query } from "@/api/queries/useSiteQuery";

/**
 * Hook para configurar metatags padrão usando foto da loja
 * Usado em páginas que não são de veículos específicos
 */
export function useDefaultMetaTags(title?: string, description?: string) {
  const { data: bannersLoja1 } = useBannersLoja1Query();

  useEffect(() => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const currentUrl = typeof window !== "undefined" ? window.location.href : "";
    
    // Busca imagem da fachada ou primeira imagem da loja
    const getStoreImage = () => {
      if (!bannersLoja1 || bannersLoja1.length === 0) {
        return `${baseUrl}/images/loja1.jpg`;
      }
      
      const fachada = bannersLoja1.find(
        (banner) => banner.titulo?.toLowerCase() === "fachada"
      );
      
      return fachada?.imagem || bannersLoja1[0]?.imagem || `${baseUrl}/images/loja1.jpg`;
    };

    const storeImage = getStoreImage();
    const absoluteImageUrl = storeImage.startsWith("http") 
      ? storeImage 
      : storeImage.startsWith("/") 
        ? `${baseUrl}${storeImage}` 
        : `${baseUrl}/${storeImage}`;

    const defaultTitle = "Netcar";
    const defaultDescription =
      "Netcar - Seminovos com procedência e qualidade. Desde 1997 oferecendo os melhores veículos em Esteio/RS.";

    // Título no formato "Netcar - [Nome da Página]"
    document.title = title ? `Netcar - ${title}` : defaultTitle;

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
    updateMetaTag("og:title", title ? `Netcar - ${title}` : defaultTitle);
    updateMetaTag("og:description", description || defaultDescription);
    updateMetaTag("og:image", absoluteImageUrl);
    updateMetaTag("og:url", currentUrl);
    updateMetaTag("og:type", "website");
    updateMetaTag("og:site_name", "Netcar");
    updateMetaTag("og:locale", "pt_BR");

    // Twitter Card tags
    updateMetaTag("twitter:card", "summary_large_image", false);
    updateMetaTag("twitter:title", title ? `Netcar - ${title}` : defaultTitle, false);
    updateMetaTag("twitter:description", description || defaultDescription, false);
    updateMetaTag("twitter:image", absoluteImageUrl, false);
  }, [title, description, bannersLoja1]);
}


