import proof from "@/data/seo/regional-customer-proof.json";

type RegionalCustomerStoryBase = {
  id: string;
  citySlug: string;
  displayName: string;
  /** Original public text; an album photo may have no testimonial text. */
  text: string;
  /** Google publication timestamp or original album record date, kept as supplied. */
  publishedAt: string;
  sourceUrl: string;
  sourceLabel: string;
  photoUrl?: string;
};

export type RegionalCustomerStory = RegionalCustomerStoryBase & (
  | { sourceType?: "google_review"; rating: number }
  // Legacy source name covers published delivery photos as well as testimonials.
  | { sourceType: "delivery_testimonial"; rating?: number }
);

/** Published stories only. Buyer matching evidence stays outside the site repository. */
export function getRegionalCustomerStories(
  citySlug: string,
): RegionalCustomerStory[] {
  return (proof.stories as RegionalCustomerStory[])
    .filter((story) => story.citySlug === citySlug)
    .slice(0, 3);
}
