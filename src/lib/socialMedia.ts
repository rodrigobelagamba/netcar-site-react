/** Intervalos de atualização dos widgets sociais (ms) */
export const SOCIAL_REFRESH = {
  /** Stories Instagram — verifica a cada 5 min; dados frescos por 2 min */
  stories: {
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  },
  /** Google Reviews — verifica a cada 30 min; dados frescos por 15 min */
  reviews: {
    staleTime: 15 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
  },
} as const;

/** Paginação do grid de reviews (igual EmbedSocial postsPerPage) */
export const REVIEWS_PAGINATION = {
  pageSize: 21,
} as const;

/**
 * Prioriza URL de maior resolução do EmbedSocial.
 * smallMediaUrl = thumb borrada; mediaUrl / largeMediaUrl = nítida.
 */
export function pickStoryImageUrl(
  urls: {
    largeMediaUrl?: string | null;
    mediaUrl?: string | null;
    thumbnailUrl?: string | null;
    smallMediaUrl?: string | null;
  },
  prefer: "cover" | "full" = "cover"
): string {
  const large = urls.largeMediaUrl || "";
  const media = urls.mediaUrl || "";
  const thumb = urls.thumbnailUrl || "";
  const small = urls.smallMediaUrl || "";

  if (prefer === "full") {
    return large || media || thumb || small;
  }

  // Card preview: mediaUrl nativo (1500px) — nítido no card ~260px
  return media || large || thumb || small;
}

export function pickReviewPhotoUrl(
  photoUrl?: string,
  largePhotoUrl?: string
): string | undefined {
  return sanitizeGoogleMediaUrl(largePhotoUrl || photoUrl);
}

export function sanitizeGoogleMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;

  const trimmed = url.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return undefined;
  }

  return trimmed;
}

export function photoReviewHeadline(text: string): string {
  const line = text.split(/[.!?\n]/)[0]?.trim() ?? "";
  if (!line) return "";
  if (line.length <= 48) return line.toUpperCase();
  return `${line.slice(0, 48).trim()}…`.toUpperCase();
}
