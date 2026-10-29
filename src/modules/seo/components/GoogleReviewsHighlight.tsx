import { ExternalLink, Star } from "lucide-react";
import { GoogleGIcon } from "@/design-system/components/patterns/social/GoogleGIcon";
import { ReviewCard } from "@/design-system/components/patterns/social/ReviewCard";
import { cn } from "@/lib/cn";
import { GOOGLE_REVIEW_STORES } from "@/social/googlePlaces";
import { useGoogleReviewsQuery } from "@/social/queries/useGoogleReviewsQuery";
import type { GoogleReview, GoogleReviewsResponse } from "@/social/types";

type GoogleReviewsHighlightProps = {
  className?: string;
  variant?: "compact" | "reviews";
};

function ReviewStoreLinks() {
  return (
    <nav
      aria-label="Avaliações de cada loja no Google"
      className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1"
    >
      {GOOGLE_REVIEW_STORES.map((store, index) => (
        <a
          key={store.id}
          href={store.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Ver avaliações da ${store.name} no Google (nova aba)`}
          className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-[#007A83] underline decoration-[#007A83]/30 underline-offset-4 hover:decoration-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007A83]"
        >
          Loja {index + 1} no Google
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      ))}
    </nav>
  );
}

/** The sync service supplies a count-weighted rating across the two stores. */
function hasCurrentSummary(data: GoogleReviewsResponse | null | undefined) {
  const summary = data?.summary;
  return Boolean(
    data?.success &&
    data.stale !== true &&
    summary &&
    Number.isFinite(summary.rating) &&
    summary.rating >= 1 &&
    summary.rating <= 5 &&
    Number.isInteger(summary.totalCount) &&
    summary.totalCount > 0,
  );
}

function SummaryStrip({
  data,
}: {
  data: GoogleReviewsResponse | null | undefined;
}) {
  const summary = hasCurrentSummary(data) ? data?.summary : undefined;

  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-[#00283C]/10 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <GoogleGIcon className="h-7 w-7" />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-[#00283C]">
            {summary ? (
              <>
                <strong className="text-lg font-black tabular-nums">
                  {summary.rating.toFixed(1).replace(".", ",")}
                  <span className="ml-0.5 text-xs font-medium text-[#526974]">
                    /5
                  </span>
                </strong>
                <Star
                  className="h-4 w-4 fill-[#FBBC04] text-[#FBBC04]"
                  aria-hidden="true"
                />
                <span className="font-semibold">
                  {summary.totalCount.toLocaleString("pt-BR")} avaliações no
                  Google
                </span>
              </>
            ) : (
              <strong className="font-semibold">
                Avaliações da Netcar no Google
              </strong>
            )}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-[#526974]">
            {summary
              ? "Nota e total das duas lojas."
              : "Consulte os comentários de cada loja."}
          </p>
        </div>
      </div>
      <ReviewStoreLinks />
    </div>
  );
}

/** Recent text reviews only; rating is never used to select the comments. */
function recentTextReviews(reviews: readonly GoogleReview[]): GoogleReview[] {
  return reviews
    .filter(
      (review) =>
        Boolean(review.text?.trim()) && Boolean(review.authorName?.trim()),
    )
    .slice()
    .sort((a, b) => {
      const aDate = Date.parse(a.publishedAt || "") || 0;
      const bDate = Date.parse(b.publishedAt || "") || 0;
      return bDate - aDate;
    })
    .slice(0, 3)
    .map((review) => ({
      ...review,
      // Keep the original words and author, using the Home card's initials fallback.
      authorPhotoUrl: undefined,
      photoUrl: undefined,
      largePhotoUrl: undefined,
      variant: "text" as const,
    }));
}

/** Reuses the Home's query and cards without a third-party widget or extra fetch. */
export function GoogleReviewsHighlight({
  className,
  variant = "compact",
}: GoogleReviewsHighlightProps) {
  const { data } = useGoogleReviewsQuery();
  const reviews = data?.success ? recentTextReviews(data.reviews || []) : [];

  if (variant === "compact") {
    return (
      <section
        className={className}
        aria-label="Avaliações da Netcar no Google"
        data-google-reviews-highlight="compact"
      >
        <SummaryStrip data={data} />
      </section>
    );
  }

  return (
    <section
      className={cn("space-y-5", className)}
      aria-label="Comentários publicados no Google"
      data-google-reviews-highlight="reviews"
    >
      <h2 className="text-2xl font-bold leading-tight text-[#00283C]">
        O que os clientes publicaram no Google
      </h2>
      <SummaryStrip data={data} />
      {reviews.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {reviews.map((review) => (
            <div key={review.id} className="h-[280px] min-w-0">
              <ReviewCard
                review={review}
                googlePlaceUrl={review.reviewUrl || data?.summary?.placeUrl}
              />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
