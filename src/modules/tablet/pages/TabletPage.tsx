import { memo, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CarFront,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { Vehicle } from "@/catalog/endpoints/vehicles";
import { useVehiclesQuery } from "@/catalog/queries/useVehiclesQuery";
import { useDefaultMetaTags } from "@/hooks/useDefaultMetaTags";
import { formatKm, formatPrice } from "@/lib/formatters";
import { optimizeStockImage, stockImageSrcSet } from "@/lib/images";
import logoNetcar from "@/assets/images/logo-netcar.png";
import TabletVehiclePreview from "../components/TabletVehiclePreview";
import {
  DEFAULT_TABLET_FILTERS,
  filterTabletVehicles,
  getTabletFilterErrors,
  type TabletFilters,
} from "../lib/tabletStock";
import "./tablet.css";

const STORAGE_KEY = "netcar.tablet.filters.v1";
const PLACEHOLDER = "/images/semcapa.webp";
const SORTS: Array<{ value: TabletFilters["sort"]; label: string }> = [
  { value: "price-asc", label: "Menor preço" },
  { value: "price-desc", label: "Maior preço" },
  { value: "year-desc", label: "Mais novos" },
  { value: "km-asc", label: "Menor quilometragem" },
  { value: "name", label: "Modelo A–Z" },
];

function readFilters(): TabletFilters {
  const filters = { ...DEFAULT_TABLET_FILTERS };
  try {
    const saved: unknown = JSON.parse(
      sessionStorage.getItem(STORAGE_KEY) || "null",
    );
    if (!saved || typeof saved !== "object") return filters;
    for (const key of Object.keys(filters) as Array<keyof TabletFilters>) {
      const value = (saved as Record<string, unknown>)[key];
      if (typeof value !== "string") continue;
      if (key === "sort") {
        if (SORTS.some((option) => option.value === value))
          filters.sort = value as TabletFilters["sort"];
      } else filters[key] = value.slice(0, 100);
    }
  } catch {
    /* Navegação privada pode bloquear o armazenamento. */
  }
  return filters;
}

function optionsFor(vehicles: Vehicle[], field: "marca" | "cambio") {
  return [
    ...new Set(
      vehicles
        .map((vehicle) => vehicle[field]?.trim())
        .filter((value): value is string => !!value),
    ),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function coverFor(vehicle: Vehicle): string {
  if (vehicle.imagens_site?.tem_fotos === 0) return PLACEHOLDER;
  return (
    vehicle.imagens_site?.capa ||
    vehicle.imagens_site?.capa_thumb ||
    vehicle.images[0] ||
    PLACEHOLDER
  );
}

const TabletCard = memo(function TabletCard({
  vehicle,
  index,
  onSelect,
}: {
  vehicle: Vehicle;
  index: number;
  onSelect: (id: string) => void;
}) {
  const cover = coverFor(vehicle);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [cover]);
  const source = failed ? PLACEHOLDER : cover;
  const mileage =
    typeof vehicle.km === "number" &&
    Number.isFinite(vehicle.km) &&
    vehicle.km >= 0
      ? formatKm(vehicle.km)
      : "Km a confirmar";
  const transmission = /autom/i.test(vehicle.cambio || "")
    ? "Automático"
    : vehicle.cambio || "Câmbio a confirmar";
  return (
    <article className="tablet-card">
      <button
        className="tablet-card-open"
        onClick={() => onSelect(vehicle.id)}
        aria-label={`Ver ${vehicle.name}, ${vehicle.year}, ${formatPrice(vehicle.price)}`}
      >
        <div className="tablet-card-photo">
          <img
            src={
              source === PLACEHOLDER ? source : optimizeStockImage(source, 640)
            }
            srcSet={
              source === PLACEHOLDER
                ? undefined
                : stockImageSrcSet(source, [320, 480, 640, 960])
            }
            sizes="(min-width: 1400px) 280px, (min-width: 1024px) 25vw, (min-width: 600px) 45vw, 90vw"
            width={640}
            height={480}
            alt={`${vehicle.marca || ""} ${vehicle.modelo || vehicle.name}`.trim()}
            loading={index < 4 ? "eager" : "lazy"}
            decoding="async"
            onError={() => setFailed(true)}
          />
          {source === PLACEHOLDER && (
            <span className="tablet-photo-pending">Fotos em preparação</span>
          )}
          <span className="tablet-card-year">
            {vehicle.year > 0 ? vehicle.year : "Modelo a confirmar"}
          </span>
        </div>
        <div className="tablet-card-body">
          <p className="tablet-eyebrow">{vehicle.marca || "Netcar"}</p>
          <h3>{vehicle.modelo || vehicle.name}</h3>
          <p className="tablet-card-specs">
            {mileage}
            <span aria-hidden="true"> · </span>
            {transmission}
          </p>
          <div className="tablet-card-bottom">
            <strong>{formatPrice(vehicle.price)}</strong>
            <span className="tablet-card-arrow" aria-hidden="true">
              <ArrowUpRight size={19} />
            </span>
          </div>
          <span className="tablet-card-hint">Ver fotos e detalhes</span>
        </div>
      </button>
    </article>
  );
});

type RangeKey = "preco" | "ano" | "km";
function RangeFilter({
  title,
  group,
  values,
  error,
  onChange,
}: {
  title: string;
  group: RangeKey;
  values: TabletFilters;
  error?: string;
  onChange: (key: keyof TabletFilters, value: string) => void;
}) {
  const minKey = `${group}Min` as "precoMin" | "anoMin" | "kmMin";
  const maxKey = `${group}Max` as "precoMax" | "anoMax" | "kmMax";
  return (
    <fieldset className="tablet-range">
      <legend>{title}</legend>
      <div className="tablet-range-inputs">
        {([minKey, maxKey] as const).map((key, index) => (
          <label key={key}>
            <span>{index === 0 ? "De" : "Até"}</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step={group === "ano" ? 1 : 1000}
              value={values[key]}
              placeholder={index === 0 ? "Mínimo" : "Máximo"}
              aria-label={`${title} ${index === 0 ? "mínimo" : "máximo"}`}
              aria-invalid={!!error}
              aria-describedby={error ? `tablet-error-${group}` : undefined}
              onChange={(event) => onChange(key, event.target.value)}
            />
          </label>
        ))}
      </div>
      {error && (
        <p
          className="tablet-filter-error"
          id={`tablet-error-${group}`}
          role="alert"
        >
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function TabletPage() {
  useDefaultMetaTags(
    "Catálogo para atendimento",
    "Explore o estoque da Netcar por modelo, preço, ano e quilometragem.",
    { canonicalPath: "/tablet/", robots: "noindex, follow" },
  );
  const stock = useVehiclesQuery(
    { fetchAll: true },
    { refreshImmediately: true },
  );
  const [filters, setFilters] = useState<TabletFilters>(readFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const vehicles = useMemo(
    () => filterTabletVehicles(stock.data || [], { ...DEFAULT_TABLET_FILTERS }),
    [stock.data],
  );
  const results = useMemo(
    () => filterTabletVehicles(vehicles, filters),
    [vehicles, filters],
  );
  const errors = getTabletFilterErrors(filters);
  const hasErrors = Object.keys(errors).length > 0;
  const activeCount = Object.entries(filters).filter(
    ([key, value]) => key !== "sort" && value !== "",
  ).length;
  const selected = vehicles.find((vehicle) => vehicle.id === selectedId);
  const brands = useMemo(() => optionsFor(vehicles, "marca"), [vehicles]);
  const transmissions = useMemo(
    () => optionsFor(vehicles, "cambio"),
    [vehicles],
  );

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch {
      /* Filtrar não depende do cache. */
    }
  }, [filters]);
  useEffect(() => {
    const timer = window.setInterval(
      () => {
        if (document.visibilityState === "visible" && navigator.onLine)
          void stock.refetch({ cancelRefetch: false });
      },
      5 * 60 * 1000,
    );
    return () => window.clearInterval(timer);
  }, [stock.refetch]);

  const updateFilter = (key: keyof TabletFilters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const resetFilters = () => setFilters({ ...DEFAULT_TABLET_FILTERS });

  return (
    <div className="tablet-catalog">
      <header className="tablet-header">
        <a
          href="/tablet/"
          className="tablet-brand"
          aria-label="Netcar — catálogo do tablet"
        >
          <img src={logoNetcar} alt="Netcar" width={112} height={38} />
          <span>CATÁLOGO DA LOJA</span>
        </a>
        <div className="tablet-header-actions">
          <span
            className={`tablet-sync ${stock.isError ? "tablet-sync-warning" : ""}`}
            role="status"
          >
            <i aria-hidden="true" />
            {stock.isFetching
              ? "Atualizando estoque…"
              : stock.isError
                ? "Não foi possível atualizar"
                : "Estoque disponível"}
          </span>
          <button
            className="tablet-icon-button"
            disabled={stock.isFetching}
            onClick={() => void stock.refetch({ cancelRefetch: false })}
            aria-label="Atualizar estoque"
            title="Atualizar estoque"
          >
            <RefreshCw
              size={19}
              className={stock.isFetching ? "tablet-refreshing" : ""}
            />
          </button>
        </div>
      </header>

      <main className="tablet-main">
        <div className="tablet-heading">
          <div>
            <p className="tablet-eyebrow">SEMINOVOS NETCAR</p>
            <h1>Encontre o carro certo.</h1>
            <p>Compare as opções. Explore cada detalhe.</p>
          </div>
          <span className="tablet-stock-total">
            <CarFront size={21} />
            <strong>{vehicles.length}</strong> no estoque
          </span>
        </div>

        <div className="tablet-search-row">
          <label className="tablet-search">
            <Search size={21} aria-hidden="true" />
            <input
              type="search"
              aria-label="Buscar marca ou modelo"
              placeholder="Qual carro você procura? Ex.: Renegade, Onix…"
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              autoComplete="off"
            />
            {filters.search && (
              <button
                type="button"
                className="tablet-search-clear"
                aria-label="Limpar busca"
                onClick={() => updateFilter("search", "")}
              >
                <X size={18} />
              </button>
            )}
          </label>
          <button
            className="tablet-filter-toggle"
            aria-expanded={filtersOpen}
            aria-controls="tablet-filters"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <SlidersHorizontal size={19} />
            Filtros{activeCount > 0 && <span>{activeCount}</span>}
          </button>
        </div>

        <div className="tablet-layout">
          <aside
            className={`tablet-filters ${filtersOpen ? "is-open" : ""}`}
            id="tablet-filters"
            aria-label="Filtros do estoque"
          >
            <div className="tablet-filters-title">
              <h2>
                <SlidersHorizontal size={18} />
                Refine sua busca
              </h2>
              <button onClick={resetFilters} disabled={!activeCount}>
                Limpar
              </button>
            </div>
            <p className="tablet-filter-note">O resultado muda na hora.</p>
            <label className="tablet-select-label">
              Marca
              <select
                value={filters.marca}
                onChange={(event) => updateFilter("marca", event.target.value)}
              >
                <option value="">Todas as marcas</option>
                {brands.map((brand) => (
                  <option key={brand}>{brand}</option>
                ))}
              </select>
            </label>
            <RangeFilter
              title="Preço (R$)"
              group="preco"
              values={filters}
              error={errors.preco}
              onChange={updateFilter}
            />
            <RangeFilter
              title="Ano-modelo"
              group="ano"
              values={filters}
              error={errors.ano}
              onChange={updateFilter}
            />
            <RangeFilter
              title="Quilometragem (km)"
              group="km"
              values={filters}
              error={errors.km}
              onChange={updateFilter}
            />
            <label className="tablet-select-label">
              Câmbio
              <select
                value={filters.cambio}
                onChange={(event) => updateFilter("cambio", event.target.value)}
              >
                <option value="">Todos os câmbios</option>
                {transmissions.map((transmission) => (
                  <option key={transmission}>{transmission}</option>
                ))}
              </select>
            </label>
            <button
              className="tablet-show-results"
              onClick={() => setFiltersOpen(false)}
            >
              Ver {results.length} {results.length === 1 ? "carro" : "carros"}
            </button>
          </aside>

          <section className="tablet-results" aria-label="Carros encontrados">
            <div className="tablet-quick-filters" aria-label="Atalhos de preço">
              <span>ATÉ QUANTO?</span>
              {[60000, 80000, 100000].map((price) => (
                <button
                  key={price}
                  aria-pressed={
                    filters.precoMax === String(price) && !filters.precoMin
                  }
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      precoMin: "",
                      precoMax:
                        current.precoMax === String(price) && !current.precoMin
                          ? ""
                          : String(price),
                    }))
                  }
                >
                  R$ {price / 1000} mil
                </button>
              ))}
            </div>
            <div className="tablet-results-toolbar">
              <p aria-live="polite" aria-atomic="true">
                <strong>{results.length}</strong>{" "}
                {results.length === 1
                  ? "carro encontrado"
                  : "carros encontrados"}
                {activeCount > 0 && (
                  <button onClick={resetFilters}>
                    Limpar filtros <X size={13} />
                  </button>
                )}
              </p>
              <label>
                <span className="tablet-sort-label">Ordenar</span>
                <select
                  aria-label="Ordenar carros"
                  value={filters.sort}
                  onChange={(event) => updateFilter("sort", event.target.value)}
                >
                  {SORTS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {stock.isError && (
              <div className="tablet-notice" role="status">
                {stock.data
                  ? "A conexão falhou. Você ainda pode consultar a última lista carregada; confirme a disponibilidade com a equipe."
                  : "Não foi possível carregar o estoque. Verifique a conexão e tente novamente."}
                <button
                  onClick={() => void stock.refetch({ cancelRefetch: false })}
                >
                  Tentar novamente
                </button>
              </div>
            )}
            {stock.isLoading && !stock.data ? (
              <div
                className="tablet-grid"
                aria-label="Carregando carros"
                aria-busy="true"
              >
                {[0, 1, 2, 3, 4, 5].map((key) => (
                  <div key={key} className="tablet-skeleton">
                    <div />
                    <span />
                    <span />
                  </div>
                ))}
              </div>
            ) : results.length ? (
              <div className="tablet-grid">
                {results.map((vehicle, index) => (
                  <TabletCard
                    key={vehicle.id}
                    vehicle={vehicle}
                    index={index}
                    onSelect={setSelectedId}
                  />
                ))}
              </div>
            ) : (
              !stock.isError && (
                <div className="tablet-empty">
                  <CarFront size={38} />
                  <h2>
                    {hasErrors
                      ? "Revise os valores dos filtros"
                      : "Nenhum carro nesta seleção"}
                  </h2>
                  <p>
                    {hasErrors
                      ? "O valor mínimo deve ser menor ou igual ao máximo."
                      : "Tente ampliar a faixa de preço, ano ou quilometragem."}
                  </p>
                  <button onClick={resetFilters}>Ver todo o estoque</button>
                </div>
              )
            )}
            <p className="tablet-results-footnote">
              Valores anunciados e dados do cadastro. Confirme as condições com
              a equipe Netcar.
            </p>
          </section>
        </div>
      </main>
      {selected && (
        <TabletVehiclePreview
          key={selected.id}
          vehicle={selected}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
