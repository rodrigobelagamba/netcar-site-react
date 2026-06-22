/**
 * Configuração do cliente HTTP do catálogo (API /api/v1).
 *
 * Documentação: docs/catalog/README.md
 */

const DEFAULT_API_BASE_URL = "https://www.netcarmultimarcas.com.br/api/v1";
const DEFAULT_API_TIMEOUT = 30000;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
const API_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT) || DEFAULT_API_TIMEOUT;

if (!import.meta.env.VITE_API_BASE_URL) {
  console.warn(
    "⚠️ VITE_API_BASE_URL não definida. Usando valor padrão:",
    DEFAULT_API_BASE_URL
  );
}

export const config = {
  apiBaseUrl: API_BASE_URL,
  apiTimeout: API_TIMEOUT,
} as const;
