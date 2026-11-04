import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { BlogCar, BlogPost, BlogSection } from "@/data/seo/types";
import { blogPosts } from "@/data/seo/blog";
import { relatedReading } from "@/lib/blogRelated.mjs";
import { emptySeminovosSearch } from "@/lib/seminovos-search";
import { trackBlogDiscoveryClick } from "@/lib/analytics";
import { getBlogVehicleTarget } from "@/lib/blogNavigation";
import { BlogVehicleWarranty } from "./BlogVehicleWarranty";
import { useVehiclesQuery } from "@/catalog/queries/useVehiclesQuery";
import { resolveBlogStockCars } from "@/lib/blogStock";

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
    className: "flex flex-1 flex-col",
    onClick: () =>
      trackBlogDiscoveryClick({
        articleSlug,
        placement: "vehicle_card",
        targetHref: car.url,
        vehicleName: car.modelo,
      }),
  };

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl">
      {target ? (
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
      )}
      {target ? <BlogVehicleWarranty href={car.url} /> : null}
    </div>
  );
}

function renderSection(
  section: BlogSection,
  index: number,
  articleSlug: string,
  stock: ReturnType<typeof useVehiclesQuery>,
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
    if (stock.isError) {
      return (
        <div key={index} role="status" className="my-8 text-gray-600">
          <p>
            Não foi possível atualizar os veículos desta seleção. Tente
            novamente ou confirme a disponibilidade com a equipe.
          </p>
          <button
            type="button"
            disabled={stock.isFetching}
            onClick={() => void stock.refetch()}
            className="mt-3 min-h-11 font-semibold text-primary underline disabled:opacity-50"
          >
            {stock.isFetching ? "Atualizando estoque..." : "Tentar novamente"}
          </button>
        </div>
      );
    }
    if (!Array.isArray(stock.data)) {
      return (
        <p key={index} role="status" className="my-8 text-gray-600">
          Carregando veículos desta seleção...
        </p>
      );
    }
    const availableCars = resolveBlogStockCars(section.cars, stock.data);
    if (availableCars.length === 0) {
      return (
        <p key={index} className="my-8 text-gray-600">
          Nenhum dos veículos desta seleção está anunciado no momento. Consulte
          o estoque atualizado ou fale com a equipe.
        </p>
      );
    }
    return (
      <div key={index} className="not-prose my-8 grid gap-5 sm:grid-cols-2">
        {availableCars.map((car) => (
          <BlogVehicleLink key={car.url} car={car} articleSlug={articleSlug}>
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
  const reading = relatedReading(post, blogPosts);
  const stock = useVehiclesQuery(
    { fetchAll: true },
    {
      enabled: post.sections.some(
        (section) => section.type === "cars" && !!section.cars?.length,
      ),
      refreshImmediately: true,
    },
  );
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
          renderSection(section, index, post.slug, stock),
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
      {reading.length > 0 && (
        <nav aria-label="Leia também" className="mt-10">
          <h2 className="text-xl font-bold text-fg mb-3">Leia também</h2>
          <ul className="space-y-2">
            {reading.map((item) => (
              <li key={item.href}>
                {item.href === "/compra" ? (
                  <Link
                    to="/compra"
                    className="text-primary underline hover:no-underline"
                  >
                    {item.title}
                  </Link>
                ) : (
                  <Link
                    to="/blog/$slug"
                    params={{ slug: item.href.slice("/blog/".length) }}
                    className="text-primary underline hover:no-underline"
                  >
                    {item.title}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      )}
    </article>
  );
}
