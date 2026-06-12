import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Calendar, Clock } from "lucide-react";
import { useDefaultMetaTags } from "@/hooks/useDefaultMetaTags";
import { blogPosts } from "@/data/seo";
import { LazyLocalizacao } from "@/design-system/components/layout/LazyLocalizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";

export function BlogPage() {
  useDefaultMetaTags(
    "Blog de Seminovos",
    "Dicas de compra, financiamento e guias para quem busca seminovo em Esteio e região metropolitana de Porto Alegre."
  );

  const sortedPosts = [...blogPosts].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return (
    <main className="flex-1 pt-8 pb-16 overflow-x-hidden max-w-full">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <h1 className="text-3xl md:text-4xl font-bold text-fg mb-2">Blog Netcar</h1>
          <p className="text-gray-500 max-w-2xl">
            Conteúdo próprio sobre seminovos, financiamento e compra inteligente na Grande Porto Alegre.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedPosts.map((post, index) => (
            <motion.div
              key={post.slug}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
            >
              <Link
                to="/blog/$slug"
                params={{ slug: post.slug }}
                className="group block bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden h-full"
              >
                <div className="p-6 flex flex-col h-full">
                  <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(`${post.publishedAt}T12:00:00`).toLocaleDateString("pt-BR")}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {post.readMinutes} min
                    </span>
                  </div>

                  <h2 className="text-fg font-semibold text-base leading-snug mb-3 group-hover:text-primary transition-colors line-clamp-3">
                    {post.title}
                  </h2>

                  <p className="text-gray-500 text-sm leading-relaxed line-clamp-3 mb-4 flex-1">
                    {post.description}
                  </p>

                  <span className="text-primary text-sm font-medium group-hover:underline">
                    Ler artigo
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="w-full font-sans antialiased text-muted-foreground bg-muted py-12 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 space-y-8 mt-10">
        <div className="container-main space-y-8">
          <LazyLocalizacao />
          <IanBot />
        </div>
      </div>
    </main>
  );
}
