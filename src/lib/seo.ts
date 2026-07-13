/** Origin canônico do site — nunca usar window.location.origin pra SEO. */
export const CANONICAL_ORIGIN = "https://www.netcarmultimarcas.com.br";

export function canonicalUrl(path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/") return `${CANONICAL_ORIGIN}/`;
  return `${CANONICAL_ORIGIN}${normalized.replace(/\/$/, "")}`;
}
