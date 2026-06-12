import blogPostsJson from "./blog-posts.json";
import citiesJson from "./cities.json";
import type { BlogPost, CitySeoPage } from "./types";

export const blogPosts = blogPostsJson as BlogPost[];
export const cityPages = citiesJson as CitySeoPage[];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}

export function getCityPage(slug: string): CitySeoPage | undefined {
  return cityPages.find((city) => city.slug === slug);
}
