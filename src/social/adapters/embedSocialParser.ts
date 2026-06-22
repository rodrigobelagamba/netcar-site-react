export function unescapeEmbedSocialUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  return url.replace(/\\\//g, "/").trim();
}

export function extractWindowJson<T>(html: string, variableName: string): T | null {
  const pattern = new RegExp(
    `window\\.${variableName}\\s*=\\s*'((?:\\\\'|[^'])*)'`,
    "s"
  );
  const match = html.match(pattern);

  if (!match?.[1]) return null;

  try {
    const decoded = match[1]
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      )
      .replace(/\\\//g, "/");

    return JSON.parse(decoded) as T;
  } catch (error) {
    console.warn(`Falha ao parsear window.${variableName}:`, error);
    return null;
  }
}

export function extractStoriesArray(html: string): unknown[] | null {
  const match = html.match(/stories:\s*(\[[\s\S]*?\])\s*,?\s*\n/);
  if (!match?.[1]) return null;

  try {
    return JSON.parse(match[1]) as unknown[];
  } catch (error) {
    console.warn("Falha ao parsear stories do EmbedSocial:", error);
    return null;
  }
}

export async function fetchEmbedSocialHtml(apiPath: string): Promise<string | null> {
  const normalizedPath = apiPath.replace(/^\/+/, "");

  const candidates = import.meta.env.DEV
    ? [`/api/embedsocial-proxy/${normalizedPath}`]
    : [
        `/embedsocial-bridge.php?path=${encodeURIComponent(normalizedPath)}`,
        `/embedsocial-bridge.php?path=${encodeURIComponent(normalizedPath)}&format=html`,
      ];

  for (const url of candidates) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const text = await response.text();
      if (text.length > 1000) return text;
    } catch {
      // tenta próximo
    }
  }

  return null;
}
