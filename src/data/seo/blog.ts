import blogPostsJson from "./blog-posts.json";
import blogAutoJson from "./blog-auto.json";
import type { BlogPost } from "./types";

// Blog = posts manuais + posts auto-publicados (gerados do estoque real).
// Manuais têm prioridade: se houver slug repetido, o manual vence.
function collectBlogPosts(): BlogPost[] {
  const manualPosts = blogPostsJson as BlogPost[];
  const autoPosts = (blogAutoJson as BlogPost[]).filter(
    (auto) => !manualPosts.some((manual) => manual.slug === auto.slug),
  );
  return [...manualPosts, ...autoPosts];
}

// A combinação não tem efeitos externos. A anotação deixa o Rollup manter
// este módulo só nos chunks do blog, mesmo com o re-export em index.ts.
export const blogPosts = /* @__PURE__ */ collectBlogPosts();

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}
