import type { GoogleReview } from "@/social/types";
import { ReviewCard } from "./ReviewCard";

export const REVIEW_CARD_SIZE = "h-[280px]";

interface ReviewsMasonryGridProps {
  reviews: GoogleReview[];
  googlePlaceUrl?: string;
}

export function ReviewsMasonryGrid({ reviews, googlePlaceUrl }: ReviewsMasonryGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-[15px]">
      {reviews.map((review) => (
        <div key={review.id} className={REVIEW_CARD_SIZE}>
          <ReviewCard review={review} googlePlaceUrl={googlePlaceUrl} />
        </div>
      ))}
    </div>
  );
}
