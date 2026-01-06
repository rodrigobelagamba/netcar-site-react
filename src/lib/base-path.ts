/**
 * Retorna o base path da aplicação
 * Pode ser configurado via variável de ambiente VITE_BASE_PATH
 * Por padrão, usa "/" (raiz)
 */
export function getBasePath(): string {
  // Permite configurar via variável de ambiente
  const envBasePath = import.meta.env.VITE_BASE_PATH;
  if (envBasePath) {
    return envBasePath.endsWith("/") ? envBasePath : envBasePath + "/";
  }
  
  // Por padrão, usa raiz
  return "/";
}

