import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { BlogCar, BlogPost, BlogSection } from "@/data/seo/types";
import { emptySeminovosSearch } from "@/lib/seminovos-search";
import { trackBlogDiscoveryClick } from "@/lib/analytics";
import { getBlogVehicleTarget } from "@/lib/blogNavigation";

function BlogVehicleLink({
  car,
  articleSlug,
  children,
}: {
  car: BlogCar;
  articleSlug: string;
  children: ReactNode;
}) {
  const target = getBlogVehicleTarget(car.url);
  const props = {
    className:
      "group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl",
    onClick: () =>
      trackBlogDiscoveryClick({
        articleSlug,
        placement: "vehicle_card",
        targetHref: car.url,
        vehicleName: car.modelo,
      }),
  };

  return target ? (
    <Link
      to="/veiculo/$slug"
      params={{ slug: target.slug }}
      search={target.search}
      hash={target.hash}
      {...props}
    >
      {children}
    </Link>
  ) : (
    <a href={car.url} {...props}>
      {children}
    </a>
  );
}

function renderSection(
  section: BlogSection,
  index: number,
  articleSlug: string,
) {
  if (section.type === "h2" && section.text) {
    return (
      <h2
        key={index}
        className="text-xl md:text-2xl font-bold text-fg mt-8 mb-3"
      >
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
      <ol
        key={index}
        className="list-decimal pl-5 space-y-2 mb-4 text-gray-600"
      >
        {section.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    );
  }

  if (section.type === "cars" && section.cars && section.cars.length > 0) {
    return (
      <div key={index} className="not-prose my-8 grid gap-5 sm:grid-cols-2">
        {section.cars.map((car) => (
          <BlogVehicleLink
            key={car.url}
            car={car}
            articleSlug={articleSlug}
          >
            {car.img ? (
              <div className="relative aspect-[16/10] overflow-hidden bg-gray-100">
                <img
                  src={car.img}
                  alt={car.modelo}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent" />
                {car.destaque ? (
                  <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-primary shadow-sm">
                    {car.destaque}
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="flex flex-1 flex-col p-5">
              <p className="text-base font-bold leading-snug text-fg">
                {car.modelo}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {[car.ano, car.km, car.cambio, car.combustivel]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="mt-auto pt-4">
                {car.preco ? (
                  <p className="text-xl font-extrabold text-fg">{car.preco}</p>
                ) : null}
                <span className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors group-hover:bg-primary/90">
                  Ver detalhes do carro
                </span>
              </div>
            </div>
          </BlogVehicleLink>
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
          Por{" "}
          <Link
            to="/politica-editorial"
            className="underline hover:text-primary"
          >
            Equipe editorial Netcar
          </Link>{" "}
          ·{" "}
          {new Date(`${post.publishedAt}T12:00:00`).toLocaleDateString("pt-BR")}
          {post.updatedAt && post.updatedAt !== post.publishedAt && (
            <>
              {" "}
              · Atualizado em{" "}
              {new Date(`${post.updatedAt}T12:00:00`).toLocaleDateString(
                "pt-BR",
              )}
            </>
          )}{" "}
          · {post.readMinutes} min de leitura
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-fg mb-4">
          {post.title}
        </h1>
        <p className="text-lg text-gray-500">{post.description}</p>
      </header>

      <div className="prose-netcar">
        {post.sections.map((section, index) =>
          renderSection(section, index, post.slug),
        )}
      </div>

      <div className="mt-10 p-6 rounded-2xl bg-primary/5 border border-primary/10">
        <p className="text-fg font-semibold mb-3">Veja também na Netcar</p>
        <Link
          to={post.ctaHref === "/seminovos" ? "/seminovos" : post.ctaHref}
          search={
            post.ctaHref === "/seminovos" ? emptySeminovosSearch : undefined
          }
          onClick={() =>
            trackBlogDiscoveryClick({
              articleSlug: post.slug,
              placement: "article_cta",
              targetHref: post.ctaHref,
            })
          }
          className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-white font-semibold hover:bg-primary/90 transition-colors"
        >
          {post.ctaLabel}
        </Link>
      </div>
    </article>
  );
}
