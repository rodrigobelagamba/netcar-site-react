import { useEffect, useState } from "react";
import type { GoogleReview } from "@/social/types";
import { useGoogleReviewsQuery } from "@/social/queries/useGoogleReviewsQuery";
import { REVIEWS_PAGINATION } from "@/lib/socialMedia";
import {
  REVIEW_CARD_SIZE,
  REVIEWS_GRID_CLASS,
  ReviewsMasonryGrid,
} from "./ReviewsMasonryGrid";
import { ReviewsSummaryHeader } from "./ReviewsSummaryHeader";
import { GOOGLE_PRIMARY_PROFILE } from "@/social/googlePlaces";

function ReviewsSkeleton() {
  return (
    <div className={REVIEWS_GRID_CLASS}>
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
    setReviews(data.reviews.slice(0, REVIEWS_PAGINATION.pageSize));
  }, [data]);

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
          href={GOOGLE_PRIMARY_PROFILE.url}
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
      <ReviewsMasonryGrid reviews={reviews} />

      <div className="mt-8 flex flex-col items-center gap-3">
        <p className="text-sm text-[#6B7280]">Conheça o perfil da Netcar no Google</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href={GOOGLE_PRIMARY_PROFILE.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[5px] px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#6cc4ca" }}
          >
            Perfil e avaliações — Netcar Multimarcas, nº 740
          </a>

        </div>
      </div>
    </div>
  );
}
