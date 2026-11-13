import type { GoogleReviewsSummary } from "@/social/types";
import { GoogleGIcon } from "./GoogleGIcon";
import { StarRating } from "./StarRating";
import { GOOGLE_PRIMARY_PROFILE } from "@/social/googlePlaces";

interface ReviewsSummaryHeaderProps {
  summary: GoogleReviewsSummary;
}

export function ReviewsSummaryHeader({ summary }: ReviewsSummaryHeaderProps) {
  const ratingLabel = summary.rating.toFixed(1).replace(".", ",");
  const isCombined = summary.scope === "all_locations";

  return (
    <div className="text-center mb-8">
      <h2 className="text-lg sm:text-2xl md:text-[32px] font-bold leading-snug sm:leading-tight mb-5 sm:mb-6 px-1 sm:px-2 text-[#00283C]">
        O que os clientes publicaram no Google
      </h2>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 lg:gap-8">
        <div className="flex items-center gap-2 sm:gap-3">
          <GoogleGIcon className="w-8 h-8 sm:w-9 sm:h-9" />
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-lg sm:text-xl font-bold text-[#00283C]">
              {ratingLabel}
            </span>
            <StarRating rating={Math.round(summary.rating)} size="md" />
            <span className="text-xs sm:text-sm text-[#6B7280]">
              {summary.totalCount.toLocaleString("pt-BR")} avaliações
              {isCombined && " das duas unidades"}
            </span>
          </div>
        </div>

        <div className="w-full sm:w-auto">
          <a
            href={GOOGLE_PRIMARY_PROFILE.writeReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg bg-[#0033ff] px-4 py-2.5 text-center text-sm font-semibold text-white hover:opacity-90"
          >
            Avaliar a Netcar no Google
          </a>
          <p className="mt-1 text-center text-xs text-[#6B7280]">
            {GOOGLE_PRIMARY_PROFILE.address}
          </p>
        </div>
      </div>
    </div>
  );
}
