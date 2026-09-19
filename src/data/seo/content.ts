import contentPagesJson from "./content-pages.json";
import type { ContentSeoPage } from "./types";

export const contentPages = contentPagesJson as ContentSeoPage[];

export function getContentPage(slug: string): ContentSeoPage | undefined {
  return contentPages.find((page) => page.slug === slug);
}
