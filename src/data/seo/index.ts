import blogPostsJson from "./blog-posts.json";
import blogAutoJson from "./blog-auto.json";
import citiesJson from "./cities.json";
import landingsJson from "./landings.json";
import type { BlogPost, CitySeoPage, LandingSeoPage } from "./types";

// Blog = posts manuais + posts auto-publicados (gerados do estoque real).
// Manuais têm prioridade: se houver slug repetido, o manual vence.
const manualPosts = blogPostsJson as BlogPost[];
const autoPosts = (blogAutoJson as BlogPost[]).filter(
  (auto) => !manualPosts.some((m) => m.slug === auto.slug)
);
export const blogPosts: BlogPost[] = [...manualPosts, ...autoPosts];
export const cityPages = citiesJson as CitySeoPage[];
export const landingPages = landingsJson as LandingSeoPage[];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}

export function getCityPage(slug: string): CitySeoPage | undefined {
  return cityPages.find((city) => city.slug === slug);
}

export function getLandingPage(slug: string): LandingSeoPage | undefined {
  return landingPages.find((l) => l.slug === slug);
}
