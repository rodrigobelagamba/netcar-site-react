import { useEffect } from "react";

interface MetaTagsProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
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
}: MetaTagsProps) {
  useEffect(() => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const currentUrl = url || (typeof window !== "undefined" ? window.location.href : "");
    const defaultTitle = "Netcar";
    const defaultDescription =
      "Netcar - Seminovos com procedência e qualidade. Desde 1997 oferecendo os melhores veículos em Esteio/RS.";
    const defaultImage = `${baseUrl}/images/loja1.jpg`;

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
    updateMetaTag("og:image", image || defaultImage);
    updateMetaTag("og:url", currentUrl);
    updateMetaTag("og:type", type);
    updateMetaTag("og:site_name", "Netcar");
    updateMetaTag("og:locale", "pt_BR");

    // Twitter Card tags
    updateMetaTag("twitter:card", "summary_large_image", false);
    updateMetaTag("twitter:title", title ? `Netcar - ${title}` : defaultTitle, false);
    updateMetaTag("twitter:description", description || defaultDescription, false);
    updateMetaTag("twitter:image", image || defaultImage, false);

    // Limpeza ao desmontar (opcional, mas mantém as tags padrão)
    return () => {
      // Restaura valores padrão se necessário
      document.title = defaultTitle;
    };
  }, [title, description, image, url, type]);
}


