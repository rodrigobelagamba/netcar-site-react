import {
  EMBEDSOCIAL_REVIEWS_PATH,
  EMBEDSOCIAL_REVIEWS_WIDGET_ID,
} from "../constants/embedSocial";
import type {
  GoogleReview,
  GoogleReviewsPagination,
  GoogleReviewsResponse,
} from "../types/social";
import { REVIEWS_PAGINATION } from "@/lib/socialMedia";
import {
  extractWindowJson,
  fetchEmbedSocialHtml,
  unescapeEmbedSocialUrl,
} from "./embedSocialParser";

interface EmbedSocialReviewItem {
  id: number | string;
  authorName?: string;
  profilePhotoUrl?: string;
  caption?: string;
  formattedCaption?: string;
  rating?: number;
  formattedDate?: string;
  mediaCreatedOn?: string;
  originalCreatedOn?: string;
  type?: string;
  image?: { source?: string } | [];
  largeImage?: { source?: string } | [];
  carousel?: Array<{ source?: string }>;
  mediaLink?: string;
  sourceLink?: string;
  pinStatus?: string | null;
}

interface EmbedSocialWidget {
  id?: number | string;
  sources?: Array<{
    sourceType?: string;
    numOfPosts?: number;
    leaveAReviewLink?: string;
    sourceLink?: string;
  }>;
}

interface EmbedSocialWidgetItemsResponse {
  media?: EmbedSocialReviewItem[];
  totalNumMedias?: number;
}

function mapReviewVariant(item: EmbedSocialReviewItem): GoogleReview["variant"] {
  const mediaType = item.type;

  if (mediaType === "image" || mediaType === "carousel") {
    const imageSource =
      getImageSource(item.largeImage) ||
      getImageSource(item.image) ||
      item.carousel?.[0]?.source;

    if (imageSource && !imageSource.includes("/a/ACg8")) {
      return "photo";
    }
  }

  if (item.pinStatus) {
    return "dark";
  }

  return "text";
}

function getImageSource(
  image?: { source?: string } | []
): string | undefined {
  if (!image || Array.isArray(image)) return undefined;
  return image.source;
}

export function mapEmbedSocialReviewItem(item: EmbedSocialReviewItem): GoogleReview {
  const variant = mapReviewVariant(item);
  const imageSource = unescapeEmbedSocialUrl(getImageSource(item.image));
  const largeImageSource = unescapeEmbedSocialUrl(
    getImageSource(item.largeImage) ||
      getImageSource(item.image) ||
      item.carousel?.[0]?.source
  );

  return {
    id: String(item.id),
    authorName: item.authorName || "Cliente",
    authorPhotoUrl: unescapeEmbedSocialUrl(item.profilePhotoUrl),
    rating: item.rating ?? 5,
    text: (item.caption || item.formattedCaption || "").trim(),
    relativeTime: item.formattedDate || item.mediaCreatedOn || "",
    publishedAt: item.originalCreatedOn,
    photoUrl: variant === "photo" ? imageSource : undefined,
    largePhotoUrl: variant === "photo" ? largeImageSource : undefined,
    reviewUrl: unescapeEmbedSocialUrl(item.mediaLink || item.sourceLink),
    variant,
    pinned: Boolean(item.pinStatus),
  };
}

function buildSummary(
  widget: EmbedSocialWidget | null,
  media: EmbedSocialReviewItem[],
  totalCount?: number
): GoogleReviewsResponse["summary"] {
  const googleSources =
    widget?.sources?.filter((source) => source.sourceType === "google") ?? [];
  const primaryGoogleSource = googleSources[0] ?? widget?.sources?.[0];

  const sourceTotal =
    googleSources.reduce((sum, source) => sum + (source.numOfPosts ?? 0), 0) ||
    widget?.sources?.reduce((sum, source) => sum + (source.numOfPosts ?? 0), 0) ||
    0;

  const resolvedTotal = totalCount || sourceTotal || media.length;

  const ratings = media.map((item) => item.rating ?? 5);
  const avgRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : 4.9;

  return {
    rating: avgRating >= 4.95 ? 4.9 : avgRating,
    totalCount: resolvedTotal,
    placeUrl:
      unescapeEmbedSocialUrl(primaryGoogleSource?.sourceLink) ||
      "https://www.google.com/maps/place/Netcar+Multimarcas",
    writeReviewUrl:
      unescapeEmbedSocialUrl(primaryGoogleSource?.leaveAReviewLink) ||
      "https://g.page/NetcarRC/review?rc",
  };
}

function buildPagination(
  page: number,
  loadedCount: number,
  totalCount: number,
  widgetId?: string | number
): GoogleReviewsPagination {
  return {
    page,
    pageSize: REVIEWS_PAGINATION.pageSize,
    totalCount,
    hasMore: loadedCount < totalCount,
    widgetId: String(widgetId ?? EMBEDSOCIAL_REVIEWS_WIDGET_ID),
  };
}

async function parseJsonResponse<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("json")) {
    try {
      return (await response.json()) as T;
    } catch {
      return null;
    }
  }

  const text = await response.text();
  const trimmed = text.trim();

  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  }
}

async function fetchWidgetItemsPage(
  widgetId: string | number,
  page: number
): Promise<EmbedSocialWidgetItemsResponse | null> {
  const path = `widget_items/${widgetId}/?page=${page}`;
  const candidates = import.meta.env.DEV
    ? [`/api/embedsocial-proxy/${path}`]
    : [`/embedsocial-bridge.php?type=reviews&page=${page}`];

  for (const url of candidates) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await parseJsonResponse<
        EmbedSocialWidgetItemsResponse | GoogleReviewsResponse | EmbedSocialReviewItem[]
      >(response);

      if (!data) continue;

      if ("reviews" in data && Array.isArray(data.reviews)) {
        return {
          media: data.reviews.map((review) => ({
            id: review.id,
            authorName: review.authorName,
            profilePhotoUrl: review.authorPhotoUrl,
            caption: review.text,
            formattedCaption: review.text,
            rating: review.rating,
            formattedDate: review.relativeTime,
            originalCreatedOn: review.publishedAt,
            type: review.variant === "photo" ? "image" : "text",
            image: review.photoUrl ? { source: review.photoUrl } : [],
            largeImage: review.largePhotoUrl
              ? { source: review.largePhotoUrl }
              : review.photoUrl
                ? { source: review.photoUrl }
                : [],
            mediaLink: review.reviewUrl,
            sourceLink: review.reviewUrl,
            pinStatus: review.pinned ? "pinned" : null,
          })),
          totalNumMedias: data.pagination?.totalCount ?? data.summary?.totalCount,
        };
      }

      if (Array.isArray(data)) {
        return { media: data as EmbedSocialReviewItem[] };
      }

      if ("media" in data && Array.isArray(data.media)) {
        return data as EmbedSocialWidgetItemsResponse;
      }
    } catch {
      // tenta próximo
    }
  }

  return null;
}

export async function fetchEmbedSocialReviewsPage(
  page: number,
  widgetId?: string
): Promise<GoogleReviewsResponse | null> {
  if (page < 1) return null;

  const resolvedWidgetId = widgetId || EMBEDSOCIAL_REVIEWS_WIDGET_ID;

  try {
    const bridge = await fetch(
      `/embedsocial-bridge.php?type=reviews&page=${page}`
    );
    if (bridge.ok) {
      const data = await parseJsonResponse<GoogleReviewsResponse>(bridge);
      if (data?.success && data.reviews?.length) {
        return {
          ...data,
          pagination: {
            page: data.pagination?.page ?? page,
            pageSize: data.pagination?.pageSize ?? REVIEWS_PAGINATION.pageSize,
            totalCount:
              data.pagination?.totalCount ?? data.summary?.totalCount ?? data.reviews.length,
            hasMore:
              data.pagination?.hasMore ??
              data.reviews.length <
                (data.pagination?.totalCount ?? data.summary?.totalCount ?? data.reviews.length),
            widgetId: data.pagination?.widgetId ?? resolvedWidgetId,
          },
        };
      }
    }
  } catch {
    // bridge indisponível
  }

  const payload = await fetchWidgetItemsPage(resolvedWidgetId, page);
  if (!payload?.media?.length) return null;

  const html = page === 1 ? await fetchEmbedSocialHtml(EMBEDSOCIAL_REVIEWS_PATH) : null;
  const widget = html ? extractWindowJson<EmbedSocialWidget>(html, "widget") : null;

  const totalCount = payload.totalNumMedias ?? payload.media.length;
  const loadedCount = page * REVIEWS_PAGINATION.pageSize;

  return {
    success: true,
    stale: false,
    syncedAt: new Date().toISOString(),
    summary: buildSummary(widget, payload.media, totalCount),
    reviews: payload.media.map(mapEmbedSocialReviewItem),
    pagination: buildPagination(
      page,
      Math.min(loadedCount, totalCount),
      totalCount,
      resolvedWidgetId
    ),
  };
}

export async function fetchEmbedSocialReviews(): Promise<GoogleReviewsResponse | null> {
  return fetchEmbedSocialReviewsPage(1);
}
