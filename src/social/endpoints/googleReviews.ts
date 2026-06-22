import { axiosInstance } from "@/catalog/axios-instance";
import { EMBEDSOCIAL_REVIEWS_WIDGET_ID } from "../constants/embedSocial";
import { socialConfig, siteOriginFromApiBase } from "../config";
import { REVIEWS_PAGINATION, sanitizeGoogleMediaUrl } from "@/lib/socialMedia";
import type { GoogleReview, GoogleReviewsResponse } from "../types";

function normalizeMediaUrl(url?: string): string | undefined {
  if (!url) return undefined;

  let normalized = url.replace(/^\.\\?\/+/, "").replace(/\\/g, "/").trim();

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }

  const baseDomain = siteOriginFromApiBase(socialConfig.baseUrl);

  if (normalized.startsWith("/")) {
    return `${baseDomain}${normalized}`;
  }

  return `${baseDomain}/${normalized}`;
}

function normalizeReview(review: GoogleReview): GoogleReview {
  const photoUrl = sanitizeGoogleMediaUrl(normalizeMediaUrl(review.photoUrl));
  const largePhotoUrl = sanitizeGoogleMediaUrl(
    normalizeMediaUrl(review.largePhotoUrl ?? review.photoUrl)
  );
  const authorPhotoUrl = sanitizeGoogleMediaUrl(normalizeMediaUrl(review.authorPhotoUrl));
  const hasPhoto = Boolean(photoUrl || largePhotoUrl);
  const variant =
    review.variant === "photo" && !hasPhoto
      ? "text"
      : review.variant === "photo" && hasPhoto
        ? "photo"
        : review.variant;

  return {
    ...review,
    authorPhotoUrl,
    photoUrl,
    largePhotoUrl,
    variant,
  };
}

function normalizeResponse(data: GoogleReviewsResponse): GoogleReviewsResponse {
  return {
    ...data,
    reviews: (data.reviews ?? []).map(normalizeReview),
    pagination: data.pagination ?? {
      page: 1,
      pageSize: REVIEWS_PAGINATION.pageSize,
      totalCount: data.summary?.totalCount ?? data.reviews.length,
      hasMore: data.reviews.length < (data.summary?.totalCount ?? data.reviews.length),
      widgetId: EMBEDSOCIAL_REVIEWS_WIDGET_ID,
    },
  };
}

async function fetchSeedFallback(page = 1): Promise<GoogleReviewsResponse | null> {
  try {
    const response = await fetch("/data/google-reviews.seed.json");
    if (!response.ok) return null;
    const data = (await response.json()) as GoogleReviewsResponse;
    const limit = REVIEWS_PAGINATION.pageSize;
    const offset = (page - 1) * limit;
    const allReviews = (data.reviews ?? []).map(normalizeReview);
    const totalCount = data.summary?.totalCount ?? allReviews.length;

    return {
      ...data,
      stale: true,
      reviews: allReviews.slice(offset, offset + limit),
      pagination: {
        page,
        pageSize: limit,
        totalCount,
        hasMore: offset + limit < allReviews.length || allReviews.length < totalCount,
      },
    };
  } catch {
    return null;
  }
}

async function fetchFromPhpApi(page = 1): Promise<GoogleReviewsResponse | null> {
  try {
    const response = await axiosInstance.get<GoogleReviewsResponse>(
      `${socialConfig.baseUrl}/google-reviews.php`,
      {
        params: {
          page,
          limit: REVIEWS_PAGINATION.pageSize,
        },
        validateStatus: (status) => status < 500,
      }
    );

    if (response.status === 200 && response.data.success) {
      return normalizeResponse(response.data);
    }
  } catch (error) {
    console.warn("google-reviews.php indisponível:", error);
  }

  return null;
}

export async function fetchGoogleReviews(): Promise<GoogleReviewsResponse | null> {
  const live = await fetchFromPhpApi(1);
  if (live?.success) return live;
  return fetchSeedFallback(1);
}

export async function fetchGoogleReviewsPage(
  page: number
): Promise<GoogleReviewsResponse | null> {
  if (page < 1) return null;

  const live = await fetchFromPhpApi(page);
  if (live?.success) return live;
  return fetchSeedFallback(page);
}
