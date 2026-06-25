import { Link } from "@tanstack/react-router";
import type { BlogPost, BlogSection } from "@/data/seo/types";
import { emptySeminovosSearch } from "@/lib/seminovos-search";

function renderSection(section: BlogSection, index: number) {
  if (section.type === "h2" && section.text) {
    return (
      <h2 key={index} className="text-xl md:text-2xl font-bold text-fg mt-8 mb-3">
        {section.text}
      </h2>
    );
  }

  if (section.type === "p" && section.text) {
    return (
      <p key={index} className="text-gray-600 leading-relaxed mb-4">
        {section.text}
      </p>
    );
  }

  if (section.type === "ul" && section.items) {
    return (
      <ul key={index} className="list-disc pl-5 space-y-2 mb-4 text-gray-600">
        {section.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }

  if (section.type === "ol" && section.items) {
    return (
      <ol key={index} className="list-decimal pl-5 space-y-2 mb-4 text-gray-600">
        {section.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    );
  }

  if (section.type === "cars" && section.cars && section.cars.length > 0) {
    return (
      <div key={index} className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6 not-prose">
        {section.cars.map((car) => (
          <a
            key={car.url}
            href={car.url}
            className="group block rounded-2xl border border-gray-200 overflow-hidden bg-white hover:shadow-lg hover:border-primary/30 transition-all"
          >
            {car.img ? (
              <div className="relative aspect-[16/10] overflow-hidden bg-gray-100">
                <img
                  src={car.img}
                  alt={car.modelo}
                  loading="lazy"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {car.destaque ? (
                  <span className="absolute top-2 left-2 rounded-full bg-primary/90 px-2.5 py-1 text-[11px] font-semibold text-white">
                    {car.destaque}
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="p-4">
              <p className="font-bold text-fg leading-snug">{car.modelo}</p>
              <p className="mt-1 text-sm text-gray-500">
                {[car.ano, car.km, car.cambio].filter(Boolean).join(" · ")}
              </p>
              {car.preco ? (
                <p className="mt-2 text-lg font-bold text-primary">{car.preco}</p>
              ) : null}
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary group-hover:underline">
                Ver detalhes →
              </span>
            </div>
          </a>
        ))}
      </div>
    );
  }

  return null;
}

interface BlogArticleBodyProps {
  post: BlogPost;
}

export function BlogArticleBody({ post }: BlogArticleBodyProps) {
  return (
    <article className="max-w-3xl">
      <header className="mb-8">
        <p className="text-sm text-gray-400 mb-3">
          {new Date(`${post.publishedAt}T12:00:00`).toLocaleDateString("pt-BR")} · {post.readMinutes} min de leitura
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-fg mb-4">{post.title}</h1>
        <p className="text-lg text-gray-500">{post.description}</p>
      </header>

      <div className="prose-netcar">
        {post.sections.map((section, index) => renderSection(section, index))}
      </div>

      <div className="mt-10 p-6 rounded-2xl bg-primary/5 border border-primary/10">
        <p className="text-fg font-semibold mb-3">Próximo passo</p>
        <Link
          to={post.ctaHref === "/seminovos" ? "/seminovos" : post.ctaHref}
          search={post.ctaHref === "/seminovos" ? emptySeminovosSearch : undefined}
          className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-white font-semibold hover:bg-primary/90 transition-colors"
        >
          {post.ctaLabel}
        </Link>
      </div>
    </article>
  );
}
