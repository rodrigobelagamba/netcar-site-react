const DEFAULT_SOCIAL_API_BASE_URL =
  "https://www.netcarmultimarcas.com.br/social/v1";

const SOCIAL_API_BASE_URL =
  import.meta.env.VITE_SOCIAL_API_BASE_URL || DEFAULT_SOCIAL_API_BASE_URL;

/** Origem do site (sem sufixo /social/v1) — para URLs relativas de mídia */
export function siteOriginFromApiBase(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/social\/v1\/?$/, "");
}

export const socialConfig = {
  baseUrl: SOCIAL_API_BASE_URL,
} as const;
