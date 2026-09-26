import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUp,
  ArrowLeftRight,
  Car,
  Check,
  ChevronRight,
  Plus,
  Search,
} from "lucide-react";
import { useMetaTags } from "@/hooks/useMetaTags";
import { useVehiclesQuery } from "@/catalog/queries/useVehiclesQuery";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import type { Vehicle } from "@/catalog/endpoints/vehicles";
import { LazyLocalizacao } from "@/design-system/components/layout/LazyLocalizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";
import { emptySeminovosSearch } from "@/lib/seminovos-search";
import { RegionalTrustSignals } from "@/modules/seo/components/RegionalTrustSignals";
import {
  resetComparisonTracking,
  trackCompareInteraction,
} from "@/lib/analytics";
import { comparisonVehicleLabel } from "@/lib/comparisonContact";
import { generateVehicleSlug } from "@/lib/slug";
import {
  comparisonDefinitions,
  matchesComparisonSearch,
} from "@/lib/vehicleComparisons";
import { ComparisonVehicleImage } from "../components/ComparisonVehicleImage";
import {
  VehicleComparisonTable,
  comparisonPrice,
} from "../components/VehicleComparisonTable";
import { ComparisonGuide } from "../components/ComparisonGuide";
import comparison from "@/data/seo/comparison.json";
import "./comparador.css";

const MAX_COMPARE = 4;

export function ComparadorPage() {
  const { data: vehicles, isLoading } = useVehiclesQuery({ limit: 500 });
  const { data: whatsapp } = useWhatsAppQuery();
  const { veiculo: initialVehicleId } = useSearch({ from: "/comparar" });
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [selectionInView, setSelectionInView] = useState(false);
  const comparisonRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<HTMLElement>(null);
  const trackedPreselectionRef = useRef<string | null>(null);

  useEffect(() => {
    resetComparisonTracking();
  }, []);
  useEffect(() => {
    const element = selectionRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setSelectionInView(entry.isIntersecting),
      { rootMargin: "-80px 0px 0px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useMetaTags({
    title: comparison.title,
    description: comparison.description,
    url: "https://www.netcarmultimarcas.com.br/comparar",
  });

  const list = useMemo(
    () => (vehicles ?? []).filter((vehicle) => Number(vehicle.price || 0) > 0),
    [vehicles],
  );
  const filtered = useMemo(
    () => list.filter((vehicle) => matchesComparisonSearch(vehicle, query)),
    [list, query],
  );

  useEffect(() => {
    const vehicleId = String(initialVehicleId || "").trim();
    if (!vehicleId || list.length === 0) return;
    const vehicle = list.find((item) => String(item.id) === vehicleId);
    if (!vehicle) return;
    setSelected((current) =>
      current.includes(vehicleId)
        ? current
        : [vehicleId, ...current].slice(0, MAX_COMPARE),
    );
    if (trackedPreselectionRef.current !== vehicleId) {
      trackedPreselectionRef.current = vehicleId;
      trackCompareInteraction({
        action: "preselect",
        vehicleIds: [vehicleId],
        vehicleNames: [
          `${vehicle.marca || ""} ${vehicle.modelo || vehicle.name}`.trim(),
        ],
      });
    }
  }, [initialVehicleId, list]);

  const chosen = selected
    .map((id) => list.find((vehicle) => vehicle.id === id))
    .filter((vehicle): vehicle is Vehicle => Boolean(vehicle));

  function scrollTo(element: HTMLElement | null) {
    element?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  }

  function toggle(id: string) {
    const isRemoving = selected.includes(id);
    const next = isRemoving
      ? selected.filter((item) => item !== id)
      : selected.length >= MAX_COMPARE
        ? selected
        : [...selected, id];
    if (next === selected) return;
    setSelected(next);
    const nextVehicles = next
      .map((vehicleId) => list.find((vehicle) => vehicle.id === vehicleId))
      .filter((vehicle): vehicle is Vehicle => Boolean(vehicle));
    trackCompareInteraction({
      action: isRemoving ? "remove" : "select",
      vehicleIds: next,
      vehicleNames: nextVehicles.map((vehicle) =>
        `${vehicle.marca || ""} ${vehicle.modelo || vehicle.name}`.trim(),
      ),
    });
  }

  return (
    <main className="comparison-page flex-1 min-w-0 max-w-full">
      <section className="comparison-hero">
        <div className="comparison-shell">
          <nav
            className="comparison-breadcrumbs"
            aria-label="Navegação estrutural"
          >
            <Link to="/">Início</Link>
            <ChevronRight size={12} aria-hidden="true" />
            <Link to="/seminovos" search={emptySeminovosSearch}>
              Seminovos
            </Link>
            <ChevronRight size={12} aria-hidden="true" />
            <span aria-current="page">Comparar carros</span>
          </nav>
          <div className="comparison-hero__content">
            <div>
              <p className="comparison-eyebrow">Comparador Netcar</p>
              <h1>{comparison.h1}</h1>
              <p className="comparison-hero__intro">{comparison.intro}</p>
            </div>
            <ol className="comparison-steps" aria-label="Como comparar">
              <li>
                <span>01</span>Escolha
              </li>
              <li>
                <span>02</span>Compare
              </li>
              <li>
                <span>03</span>Veja a ficha
              </li>
            </ol>
          </div>
        </div>
      </section>
      <div className="comparison-shell comparison-content">
        {comparisonDefinitions.length > 0 && (
          <section
            className="comparison-presets"
            aria-labelledby="comparison-presets-title"
          >
            <div className="comparison-section-heading">
              <h2 id="comparison-presets-title">Comparações prontas</h2>
              <span className="comparison-selection-count">
                Ou escolha os seus abaixo
              </span>
            </div>
            <div className="comparison-presets__grid">
              {comparisonDefinitions.map((preset) => (
                <Link
                  to="/comparar/$comparisonSlug"
                  params={{ comparisonSlug: preset.slug }}
                  className="comparison-preset"
                  key={preset.slug}
                >
                  <span className="comparison-preset__icon">
                    <ArrowLeftRight size={17} aria-hidden="true" />
                  </span>
                  <span>{preset.label}</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {chosen.length > 0 && (
          <div ref={comparisonRef} className="scroll-mt-24">
            <VehicleComparisonTable
              vehicles={chosen}
              onRemove={toggle}
              onAdd={() => scrollTo(selectionRef.current)}
              whatsAppNumber={whatsapp?.numero?.trim()}
            />
          </div>
        )}

        <section
          ref={selectionRef}
          className="comparison-selection"
          aria-labelledby="comparison-stock-title"
        >
          <div className="comparison-selection__toolbar">
            <div>
              <h2 id="comparison-stock-title">
                {chosen.length
                  ? "Complete sua comparação"
                  : "Quais carros você quer comparar?"}
              </h2>
              <p>Escolha de 2 a {MAX_COMPARE} carros do estoque da Netcar.</p>
            </div>
            <div className="comparison-search">
              <label htmlFor="comparison-search" className="sr-only">
                Buscar carros por marca ou modelo
              </label>
              <Search size={18} aria-hidden="true" />
              <input
                id="comparison-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar marca ou modelo"
              />
            </div>
          </div>
          <p className="comparison-selection-status" role="status">
            {selected.length === MAX_COMPARE
              ? "4 carros selecionados. Remova um para escolher outro."
              : selected.length
                ? `${selected.length} de ${MAX_COMPARE} carros selecionados${selected.length === 1 ? " — escolha mais um para comparar." : "."}`
                : isLoading
                  ? "Carregando estoque…"
                  : `${filtered.length} carros disponíveis para comparar`}
          </p>
          {isLoading ? (
            <div
              className="comparison-stock"
              aria-busy="true"
              aria-label="Carregando estoque"
            >
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="h-72 animate-pulse rounded-2xl bg-[#E4ECE7]"
                />
              ))}
            </div>
          ) : (
            <div className="comparison-stock">
              {filtered.map((vehicle) => {
                const isSelected = selected.includes(vehicle.id);
                const full = selected.length >= MAX_COMPARE && !isSelected;
                return (
                  <article
                    className="comparison-stock-card"
                    key={vehicle.id}
                    data-selected={isSelected}
                  >
                    <button
                      type="button"
                      className="comparison-stock-card__select"
                      onClick={() => toggle(vehicle.id)}
                      disabled={full}
                      aria-pressed={isSelected}
                      aria-label={`${isSelected ? "Remover" : "Comparar"} ${comparisonVehicleLabel(vehicle)}, código ${vehicle.id}`}
                    >
                      <span className="comparison-stock-card__photo">
                        <ComparisonVehicleImage
                          vehicle={vehicle}
                          sizes="(max-width: 639px) 45vw, (max-width: 1023px) 30vw, 260px"
                        />
                        <span className="comparison-stock-card__check">
                          {isSelected ? (
                            <Check size={16} aria-hidden="true" />
                          ) : (
                            <Plus size={16} aria-hidden="true" />
                          )}
                        </span>
                      </span>
                      <span className="comparison-stock-card__brand">
                        {vehicle.marca}
                      </span>
                      <span className="comparison-stock-card__name">
                        {vehicle.modelo || vehicle.name}
                      </span>
                      <span className="comparison-stock-card__year">
                        {vehicle.year || "Ano não informado"}
                      </span>
                      <span className="comparison-stock-card__price">
                        {comparisonPrice(vehicle)}
                      </span>
                      <span className="comparison-stock-card__action">
                        {isSelected
                          ? "✓ Selecionado · toque para remover"
                          : full
                            ? "Limite de 4 selecionados"
                            : "+ Adicionar à comparação"}
                      </span>
                    </button>
                    <Link
                      to="/veiculo/$slug"
                      params={{ slug: generateVehicleSlug(vehicle) }}
                      aria-label={`Ver ficha de ${comparisonVehicleLabel(vehicle)}, código ${vehicle.id}`}
                      className="comparison-stock-card__details"
                      onClick={() =>
                        trackCompareInteraction({
                          action: "view_details",
                          vehicleIds: [vehicle.id],
                          vehicleNames: [comparisonVehicleLabel(vehicle)],
                        })
                      }
                    >
                      Ver ficha <ArrowRight size={12} aria-hidden="true" />
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="rounded-xl border border-[#DFE8E3] bg-white p-6 text-sm">
              <p>Nenhum carro encontrado para “{query}”.</p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-3 min-h-11 font-bold text-[#146857] underline"
              >
                Limpar busca e ver todos
              </button>
            </div>
          )}
          <Link
            to="/seminovos"
            search={emptySeminovosSearch}
            className="comparison-return"
          >
            <Car size={17} aria-hidden="true" /> Ver estoque completo{" "}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </section>
        <ComparisonGuide />
        {chosen.length > 0 && selectionInView && (
          <div className="comparison-tray">
            <div>
              <p>
                {chosen.length} de {MAX_COMPARE} selecionados
              </p>
              <small>
                {chosen.length === 1
                  ? "Adicione mais um carro"
                  : "Sua seleção está pronta"}
              </small>
            </div>
            <button
              type="button"
              onClick={() => scrollTo(comparisonRef.current)}
            >
              Ver comparação <ArrowUp size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      <RegionalTrustSignals />
      <div className="w-full bg-muted py-12 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        <div className="container-main space-y-8">
          <LazyLocalizacao />
          <IanBot />
        </div>
      </div>
    </main>
  );
}
