import { Link, useParams } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { getBlogPost } from "@/data/seo";
import { BlogArticleBody } from "@/modules/blog/components/BlogArticleBody";
import { useMetaTags } from "@/hooks/useMetaTags";
import { Localizacao } from "@/design-system/components/layout/Localizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";
import { NotFoundRedirect } from "@/components/NotFoundRedirect";

export function BlogPostPage() {
  const { slug } = useParams({ from: "/blog/$slug" });
  const post = getBlogPost(slug);

  useMetaTags({
    title: post?.title,
    description: post?.description,
    url: post ? `https://www.netcarmultimarcas.com.br/blog/${post.slug}` : undefined,
    type: "article",
  });

  useEffect(() => {
    if (!post) return;

    const schema = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.description,
      datePublished: post.publishedAt,
      author: {
        "@type": "Organization",
        name: "Netcar Multimarcas",
      },
      publisher: {
        "@type": "Organization",
        name: "Netcar Multimarcas",
        logo: {
          "@type": "ImageObject",
          url: "https://www.netcarmultimarcas.com.br/images/loja1.jpg",
        },
      },
      mainEntityOfPage: `https://www.netcarmultimarcas.com.br/blog/${post.slug}`,
    };

    const existing = document.querySelector('script[data-schema="blog-post"]');
    existing?.remove();

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-schema", "blog-post");
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      document.querySelector('script[data-schema="blog-post"]')?.remove();
    };
  }, [post]);

  if (!post) {
    return <NotFoundRedirect />;
  }

  return (
    <main className="flex-1 pt-8 pb-16 overflow-x-hidden max-w-full">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-primary font-medium mb-6 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao blog
          </Link>
          <BlogArticleBody post={post} />
        </motion.div>
      </div>

      <div className="w-full font-sans antialiased text-muted-foreground bg-muted py-12 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 space-y-8 mt-10">
        <div className="container-main space-y-8">
          <Localizacao />
          <IanBot />
        </div>
      </div>
    </main>
  );
}
