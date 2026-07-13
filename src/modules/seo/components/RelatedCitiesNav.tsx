import { Link } from "@tanstack/react-router";
import { cityPages } from "@/data/seo";

type RelatedCitiesNavProps = {
  currentSlug: string;
  variant: "buy" | "sell";
};

export function RelatedCitiesNav({ currentSlug, variant }: RelatedCitiesNavProps) {
  const others = cityPages.filter((c) => c.slug !== currentSlug);
  if (others.length === 0) return null;

  const heading =
    variant === "buy" ? "Seminovos em outras cidades" : "Vender carro em outras cidades";

  return (
    <section className="pb-12">
      <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 max-w-3xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-fg">{heading}</h2>
          <Link
            to="/regioes-atendidas"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Ver todas as regiões
          </Link>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-2">
          {others.map((city) => (
            <li key={`${variant}-${city.slug}`}>
              {variant === "buy" ? (
                <Link
                  to="/seminovos-{$citySlug}"
                  params={{ citySlug: city.slug }}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Seminovos perto de {city.name}
                </Link>
              ) : (
                <Link
                  to="/vender-carro-{$citySlug}"
                  params={{ citySlug: city.slug }}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Vender carro em {city.name}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
