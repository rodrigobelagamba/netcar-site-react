import { useQuery } from "@tanstack/react-query";
import { fetchStories } from "../endpoints/stories";
import { SOCIAL_REFRESH } from "@/lib/socialMedia";

export function useStoriesQuery() {
  return useQuery({
    queryKey: ["social", "stories"],
    queryFn: fetchStories,
    staleTime: SOCIAL_REFRESH.stories.staleTime,
    refetchInterval: SOCIAL_REFRESH.stories.refetchInterval,
    refetchOnWindowFocus: true,
  });
}
