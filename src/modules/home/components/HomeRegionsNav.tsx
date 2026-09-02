import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { priorityCityPages } from "@/data/seo";

/**
 * Links da home para as páginas-cidade prioritárias. A home é a página com
 * mais autoridade do site e não linkava nenhuma cidade; o footer só aparece
 * depois de muito scroll no mobile.
 */
export function HomeRegionsNav() {
  const cities = [...priorityCityPages].sort(
    (left, right) => left.distanceKm - right.distanceKm,
  );
  if (cities.length === 0) return null;

  return (
    <section
      aria-labelledby="home-regions-title"
      className="container-main px-4 py-8 sm:px-6 md:py-12 lg:px-8 xl:px-12 2xl:px-16"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#5CD29D]/15 text-[#00616A]">
          <MapPin className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2
            id="home-regions-title"
            className="text-xl font-black leading-tight text-[#00283C] md:text-2xl"
          >
            Seminovos para toda a região metropolitana
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Lojas em Esteio, na BR-116. Veja rota, tempo de viagem e estoque
            para a sua cidade.
          </p>
        </div>
      </div>
      <nav
        aria-label="Cidades atendidas"
        className="mt-4 flex flex-wrap gap-2"
      >
        {cities.map((city) => (
          <Link
            key={city.slug}
            to="/seminovos-{$citySlug}"
            params={{ citySlug: city.slug }}
            data-regional-action={`home_city_${city.slug}`}
            className="rounded-full border border-[#00283C]/15 bg-[#F3F5F6] px-4 py-2 text-sm font-bold text-[#00283C] transition-colors hover:bg-white hover:text-primary"
          >
            {city.name}
            <span className="ml-1.5 font-normal text-gray-500">
              {city.distanceKm} km
            </span>
          </Link>
        ))}
        <Link
          to="/regioes-atendidas"
          data-regional-action="home_city_hub"
          className="rounded-full px-4 py-2 text-sm font-semibold text-primary underline-offset-2 hover:underline"
        >
          Todas as cidades
        </Link>
      </nav>
    </section>
  );
}
