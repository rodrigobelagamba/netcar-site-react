import blogPostsJson from "./blog-posts.json";
import citiesJson from "./cities.json";
import landingsJson from "./landings.json";
import type { BlogPost, CitySeoPage, LandingSeoPage } from "./types";

export const blogPosts = blogPostsJson as BlogPost[];
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
