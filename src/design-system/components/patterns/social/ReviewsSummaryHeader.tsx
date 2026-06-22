import type { GoogleReviewsSummary } from "@/social/types";
import { GoogleGIcon } from "./GoogleGIcon";
import { StarRating } from "./StarRating";

interface ReviewsSummaryHeaderProps {
  summary: GoogleReviewsSummary;
}

export function ReviewsSummaryHeader({ summary }: ReviewsSummaryHeaderProps) {
  const ratingLabel = summary.rating.toFixed(1).replace(".", ",");

  return (
    <div className="text-center mb-8">
      <h2
        className="text-lg sm:text-2xl md:text-[32px] font-bold leading-snug sm:leading-tight mb-5 sm:mb-6 px-1 sm:px-2 text-[#00283C]"
      >
        Depoimentos de quem já viveu a experiência Netcar
      </h2>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 lg:gap-8">
        <div className="flex items-center gap-2 sm:gap-3">
          <GoogleGIcon className="w-8 h-8 sm:w-9 sm:h-9" />
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-lg sm:text-xl font-bold text-[#00283C]">{ratingLabel}</span>
            <StarRating rating={Math.round(summary.rating)} size="md" />
            <span className="text-xs sm:text-sm text-[#6B7280]">
              {summary.totalCount.toLocaleString("pt-BR")} comentários
            </span>
          </div>
        </div>

        <a
          href={summary.writeReviewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-white transition-opacity hover:opacity-90 w-full sm:w-auto justify-center"
          style={{ backgroundColor: "#0033ff" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
          Queremos te ouvir
        </a>
      </div>
    </div>
  );
}
