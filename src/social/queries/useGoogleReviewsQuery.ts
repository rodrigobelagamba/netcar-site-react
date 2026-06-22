import { useQuery } from "@tanstack/react-query";
import { fetchGoogleReviews } from "../endpoints/googleReviews";
import { SOCIAL_REFRESH } from "@/lib/socialMedia";

export function useGoogleReviewsQuery() {
  return useQuery({
    queryKey: ["social", "google-reviews"],
    queryFn: fetchGoogleReviews,
    staleTime: SOCIAL_REFRESH.reviews.staleTime,
    refetchInterval: SOCIAL_REFRESH.reviews.refetchInterval,
    refetchOnWindowFocus: true,
  });
}
