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
      className="container-main px-4 py-3 sm:px-6 sm:py-4 lg:px-8 xl:px-12 2xl:px-16"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#5CD29D]/15 text-[#00616A] sm:flex">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2
              id="home-regions-title"
              className="text-sm font-black leading-tight text-[#00283C] sm:text-base"
            >
              Atendimento regional
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-gray-600">
              2 lojas em Esteio, próximas à BR-116.
            </p>
          </div>
        </div>
        <Link
          to="/regioes-atendidas"
          data-regional-action="home_city_hub"
          className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap px-1 text-xs font-semibold text-primary underline-offset-2 hover:underline"
        >
          Todas as cidades
        </Link>
      </div>
      <nav
        aria-label="Cidades atendidas"
        className="mt-2 flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
      >
        {cities.map((city) => (
          <Link
            key={city.slug}
            to="/seminovos-{$citySlug}"
            params={{ citySlug: city.slug }}
            data-regional-action={`home_city_${city.slug}`}
            className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border border-[#00283C]/15 bg-[#F3F5F6] px-2.5 py-1 text-xs font-bold text-[#00283C] transition-colors hover:bg-white hover:text-primary sm:min-h-8"
          >
            {city.name}
            <span className="ml-1 font-normal text-gray-500">
              {city.distanceKm} km
            </span>
          </Link>
        ))}
      </nav>
    </section>
  );
}
