import { useEffect, useState } from "react";
import type { GoogleReview } from "@/social/types";
import { useGoogleReviewsQuery } from "@/social/queries/useGoogleReviewsQuery";
import { REVIEW_CARD_SIZE, ReviewsMasonryGrid } from "./ReviewsMasonryGrid";
import { ReviewsSummaryHeader } from "./ReviewsSummaryHeader";

/** Busca geral "Netcar Multimarcas" no Maps — cobre Loja 1 e Loja 2 */
const NETCAR_GOOGLE_PLACE_URL =
  "https://www.google.com/maps/search/Netcar+Multimarcas+Esteio+RS";

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

export function NetcarGoogleReviewsSection() {
  const { data, isLoading, isError } = useGoogleReviewsQuery();
  const [reviews, setReviews] = useState<GoogleReview[]>([]);

  useEffect(() => {
    if (!data?.reviews?.length) return;
    setReviews(data.reviews);
  }, [data]);

  const totalCount = data?.pagination?.totalCount ?? data?.summary.totalCount ?? reviews.length;
  const hasMore = reviews.length < totalCount;

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
        <div className="flex flex-col items-center mt-8">
          <a
            href={data.summary.placeUrl || NETCAR_GOOGLE_PLACE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[5px] px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#0033ff" }}
          >
            Carregar mais
          </a>
        </div>
      )}
    </div>
  );
}
