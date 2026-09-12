import { defaultParseSearch } from "@tanstack/react-router";

interface BlogVehicleTarget {
  slug: string;
  search: Record<string, unknown>;
  hash: string;
}

/** Só fichas públicas da Netcar viram navegação SPA; os demais hrefs ficam nativos. */
export function getBlogVehicleTarget(href: string): BlogVehicleTarget | null {
  const value = href.trim();
  if (!value.startsWith("/") && !/^https?:\/\//i.test(value)) return null;

  try {
    const url = new URL(value, "https://www.netcarmultimarcas.com.br");
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !["netcarmultimarcas.com.br", "www.netcarmultimarcas.com.br"].includes(
        url.hostname,
      ) ||
      url.port ||
      url.username ||
      url.password
    ) {
      return null;
    }

    // Slug completo com ID final ou ID legado; nunca inferir o ID de outro trecho.
    const slug = url.pathname.match(
      /^\/veiculo\/((?:[a-z0-9]+-)*[1-9]\d*)\/?$/i,
    )?.[1];
    if (!slug) return null;

    return {
      slug,
      search: defaultParseSearch(url.search),
      hash: url.hash.slice(1),
    };
  } catch {
    return null;
  }
}
