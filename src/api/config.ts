/**
 * Configuração centralizada da API
 * 
 * As variáveis de ambiente são carregadas automaticamente pelo Vite.
 * No Vite, variáveis de ambiente devem começar com VITE_
 * 
 * Arquivos de ambiente:
 * - .env.development (usado em npm run dev)
 * - .env.production (usado em npm run build)
 * 
 * VALORES PADRÃO (fallback) - Usados quando não há arquivos .env:
 * - API_BASE_URL: "https://www.netcarmultimarcas.com.br/api/v1"
 * - API_TIMEOUT: 30000 (30 segundos)
 * 
 * Documentação:
 * - docs/ENV_SETUP.md - Configuração de variáveis de ambiente
 * - docs/api/FALLBACK_VALUES.md - Valores padrão (fallback)
 * - docs/api/README.md - Documentação completa da API
 */

// Valores padrão (fallback)
const DEFAULT_API_BASE_URL = "https://www.netcarmultimarcas.com.br/api/v1";
const DEFAULT_API_TIMEOUT = 30000; // 30 segundos

// Lê variáveis de ambiente ou usa valores padrão
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
const API_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT) || DEFAULT_API_TIMEOUT;

// Aviso se não houver variável de ambiente definida
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

