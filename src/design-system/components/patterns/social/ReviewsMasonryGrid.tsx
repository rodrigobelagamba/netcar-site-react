import type { GoogleReview } from "@/social/types";
import { ReviewCard } from "./ReviewCard";

export const REVIEW_CARD_SIZE = "h-[280px]";

/**
 * Mobile: só 4 cards (2 linhas). 20 cards empilhados davam 3,5 telas de
 * rolagem antes do rodapé. Desktop segue com a lista completa.
 */
export const REVIEWS_GRID_CLASS =
  "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-[15px] [&>*:nth-child(n+5)]:hidden md:[&>*:nth-child(n+5)]:block";

interface ReviewsMasonryGridProps {
  reviews: GoogleReview[];
  googlePlaceUrl?: string;
}

export function ReviewsMasonryGrid({ reviews, googlePlaceUrl }: ReviewsMasonryGridProps) {
  return (
    <div className={REVIEWS_GRID_CLASS}>
      {reviews.map((review) => (
        <div key={review.id} className={REVIEW_CARD_SIZE}>
          <ReviewCard review={review} googlePlaceUrl={googlePlaceUrl} />
        </div>
      ))}
    </div>
  );
}
