import { useCallback, useEffect, useRef, useState } from "react";
import { fetchGoogleReviewsPage } from "@/social/endpoints/googleReviews";
import type { GoogleReview } from "@/social/types";
import { useGoogleReviewsQuery } from "@/social/queries/useGoogleReviewsQuery";
import { REVIEW_CARD_SIZE, ReviewsMasonryGrid } from "./ReviewsMasonryGrid";
import { ReviewsSummaryHeader } from "./ReviewsSummaryHeader";

function ReviewsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-[15px]">
      {Array.from({ length: 12 }).map((_, index) => (
        <div
          key={index}
          className={`${REVIEW_CARD_SIZE} rounded-xl bg-gray-100 animate-pulse border border-[#E5E7EB]`}
        />
      ))}
    </div>
  );
}

function mergeReviews(current: GoogleReview[], incoming: GoogleReview[]): GoogleReview[] {
  const seen = new Set(current.map((review) => review.id));
  const unique = incoming.filter((review) => !seen.has(review.id));
  return unique.length ? [...current, ...unique] : current;
}

export function NetcarGoogleReviewsSection() {
  const { data, isLoading, isError } = useGoogleReviewsQuery();
  const [reviews, setReviews] = useState<GoogleReview[]>([]);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const hasExpandedRef = useRef(false);

  useEffect(() => {
    if (!data?.reviews?.length || hasExpandedRef.current) return;
    setReviews(data.reviews);
    setPage(data.pagination?.page ?? 1);
    setLoadError(false);
  }, [data]);

  const totalCount = data?.pagination?.totalCount ?? data?.summary.totalCount ?? reviews.length;
  const hasMore = reviews.length < totalCount;

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !data) return;

    setLoadingMore(true);
    setLoadError(false);
    try {
      const nextPage = page + 1;
      const nextBatch = await fetchGoogleReviewsPage(nextPage);

      if (nextBatch?.reviews.length) {
        hasExpandedRef.current = true;
        setReviews((current) => mergeReviews(current, nextBatch.reviews));
        setPage(nextPage);
      } else {
        setLoadError(true);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [data, hasMore, loadingMore, page]);

  if (isLoading) {
    return (
      <div>
        <div className="h-24 rounded-xl bg-gray-100 animate-pulse mb-8" />
        <ReviewsSkeleton />
      </div>
    );
  }

  if (isError || !data?.success) {
    return (
      <div className="text-center py-8">
        <p className="text-[#6B7280] mb-4">Avaliações indisponíveis no momento.</p>
        <a
          href="https://www.google.com/maps/place/Netcar+Multimarcas"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium hover:underline"
          style={{ color: "#6cc4ca" }}
        >
          Ver no Google Maps
        </a>
      </div>
    );
  }

  return (
    <div>
      <ReviewsSummaryHeader summary={data.summary} />
      <ReviewsMasonryGrid reviews={reviews} googlePlaceUrl={data.summary.placeUrl} />
      {hasMore && (
        <div className="flex flex-col items-center mt-8 gap-2">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="rounded-[5px] px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: "#0033ff" }}
          >
            {loadingMore ? "Carregando..." : "Carregar mais"}
          </button>
          {loadError && (
            <p className="text-sm text-[#6B7280]">
              Não foi possível carregar mais avaliações. Tente novamente.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
