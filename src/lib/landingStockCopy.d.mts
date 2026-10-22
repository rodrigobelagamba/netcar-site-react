import type { CityFaq, LandingSeoPage } from "../data/seo/types";

type StockValue = {
  price?: number;
  valor?: number | string;
  year?: number;
  ano?: number | string;
};

export const LANDING_PROFILE_TOKENS: Record<string, string>;
export function resolveLandingParagraphs(
  landing: Pick<LandingSeoPage, "paragraphs" | "paragraphTemplates">,
  vehicles: StockValue[] | null,
): string[];
export function resolveLandingFaq(
  landing: Pick<LandingSeoPage, "faq" | "type">,
  vehicles: StockValue[] | null,
): CityFaq[];
