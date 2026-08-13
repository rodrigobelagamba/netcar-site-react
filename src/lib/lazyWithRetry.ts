import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const CHUNK_RELOAD_KEY = "netcar-chunk-reload";
const CHUNK_RELOAD_QUERY = "__netcar_refresh";

function readReloadFlag(): string | null {
  try {
    return window.sessionStorage.getItem(CHUNK_RELOAD_KEY);
  } catch {
    return null;
  }
}

function writeReloadFlag(): void {
  try {
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
  } catch {
    // Safari pode bloquear o storage. O parâmetro na URL continua limitando o retry.
  }
}

function removeReloadFlag(): void {
  try {
    window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    // Sem ação: o parâmetro na URL também registra e limita a recuperação.
  }
}

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /importing a module script failed|failed to fetch dynamically imported module|error loading dynamically imported module|module script load failed|loading (?:css )?chunk|unable to preload css|load failed/i.test(
    message,
  );
}

/**
 * Força uma única leitura do HTML atual quando uma aba ainda aponta para os
 * arquivos de um deploy anterior. O query param também protege o Safari quando
 * sessionStorage estiver indisponível.
 */
export function recoverFromChunkLoadError(): boolean {
  if (typeof window === "undefined") return false;

  const url = new URL(window.location.href);
  if (readReloadFlag() || url.searchParams.has(CHUNK_RELOAD_QUERY)) {
    return false;
  }

  writeReloadFlag();
  url.searchParams.set(CHUNK_RELOAD_QUERY, String(Date.now()));
  window.location.replace(url.toString());
  return true;
}

/**
 * lazy() com retry: após deploy, abas antigas podem referenciar chunks removidos.
 * Recarrega a página uma vez para pegar o index.html novo.
 */
export function lazyWithRetry<T extends ComponentType<object>>(
  factory: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const module = await factory();
      clearChunkReloadFlag();
      return module;
    } catch (error) {
      if (isChunkLoadError(error) && recoverFromChunkLoadError()) {
        return new Promise(() => {});
      }

      throw error;
    }
  });
}

export function clearChunkReloadFlag(): void {
  if (typeof window === "undefined") return;

  removeReloadFlag();

  const url = new URL(window.location.href);
  if (!url.searchParams.has(CHUNK_RELOAD_QUERY)) return;

  url.searchParams.delete(CHUNK_RELOAD_QUERY);
  const cleanUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", cleanUrl);
}
