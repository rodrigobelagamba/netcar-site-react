import {
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  Fragment,
} from "react";
import { Link, useSearch, useNavigate } from "@tanstack/react-router";
import { useVehiclesQuery } from "@/catalog/queries/useVehiclesQuery";
import { useAllStockDataQuery } from "@/catalog/queries/useStockQuery";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import { VehicleCardStatic } from "@/design-system/components/patterns/VehicleCard";
import { AutocompleteSelect } from "@/design-system/components/ui/AutocompleteSelect";
import { ChevronDown, Filter, MessageCircle, ShieldCheck } from "lucide-react";
import { useDefaultMetaTags } from "@/hooks/useDefaultMetaTags";
import { useSearchContext } from "@/contexts/SearchContext";
import { LazyLocalizacao } from "@/design-system/components/layout/LazyLocalizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";
import {
  buildWhatsAppUrl,
  DEFAULT_SALES_WHATSAPP,
  homeWhatsAppMessages,
  siteWhatsAppMessage,
} from "@/lib/whatsappMessages";
import { trackStockFilterApply } from "@/lib/analytics";
import { resolvedVehicleCategory } from "@/lib/vehicleCategory";
import { landingPages } from "@/data/seo";
import {
  sortShowroomVehicles,
  type ShowroomSortOption,
} from "@/lib/showroomStock";
import { SeminovosWhatsAppHelpPanel } from "../components/SeminovosWhatsAppHelpPanel";

type StockLayout = {
  compact: boolean;
  columns: number;
};

const stockCategoryLabels: Record<string, string> = {
  suv: "SUVs",
  hatch: "Hatches",
  sedan: "Sedãs",
};

const vehicleCategoryLabels: Record<string, string> = {
  SUV: "SUV",
  HATCH: "Hatch",
  SEDAN: "Sedã",
  PICKUP: "Picape",
  PICAPE: "Picape",
  UTILITARIO: "Utilitário",
  MINIVAN: "Minivan",
  COUPE: "Cupê",
};

function toSelectOptions(values: Array<string | null | undefined>) {
  return [
    ...new Set(
      values.map((value) => String(value || "").trim()).filter(Boolean),
    ),
  ]
    .sort((left, right) => left.localeCompare(right, "pt-BR"))
    .map((value) => ({ value, label: value }));
}

type StockFilterValues = Record<
  | "marca"
  | "modelo"
  | "precoMin"
  | "precoMax"
  | "anoMin"
  | "anoMax"
  | "cambio"
  | "combustivel"
  | "cor"
  | "categoria",
  string | undefined
>;

function stockFilterSignature(filters: StockFilterValues): string {
  return [
    filters.marca,
    filters.modelo,
    filters.precoMin,
    filters.precoMax,
    filters.anoMin,
    filters.anoMax,
    filters.cambio,
    filters.combustivel,
    filters.cor,
    filters.categoria,
  ]
    .map((value) => value || "")
    .join("\u001f");
}

/** Espelha os breakpoints Tailwind do showroom sem alterar o grid após a pintura inicial. */
function getStockLayout(): StockLayout {
  if (typeof window === "undefined") return { compact: false, columns: 4 };

  const width = window.innerWidth;
  if (width >= 1536) return { compact: false, columns: 5 };
  if (width >= 1280) return { compact: false, columns: 4 };
  if (width >= 1024) return { compact: false, columns: 3 };
  if (width >= 768) return { compact: false, columns: 2 };
  return { compact: true, columns: 2 };
}

function useStockLayout(): StockLayout {
  const [layout, setLayout] = useState<StockLayout>(getStockLayout);

  useEffect(() => {
    const update = () => {
      const next = getStockLayout();
      setLayout((current) =>
        current.compact === next.compact && current.columns === next.columns
          ? current
          : next,
      );
    };
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return layout;
}

export function SeminovosPage() {
  const search = useSearch({ from: "/seminovos" });
  const navigate = useNavigate();
  const stockLayout = useStockLayout();

  // Mapeia os parâmetros de busca para o formato esperado pela API
  const vehiclesQuery = useMemo(() => {
    const query: {
      marca?: string;
      modelo?: string;
      precoMin?: string;
      precoMax?: string;
      anoMin?: string;
      anoMax?: string;
      cambio?: string;
      combustivel?: string;
      cor?: string;
      categoria?: string;
      fetchAll: boolean;
      includeSold: boolean;
    } = { fetchAll: true, includeSold: true };

    // Só adiciona campos que têm valores definidos
    if (search.marca) query.marca = search.marca;
    if (search.modelo) query.modelo = search.modelo;
    if (search.precoMin) query.precoMin = search.precoMin;
    if (search.precoMax) query.precoMax = search.precoMax;
    if (search.anoMin) query.anoMin = search.anoMin;
    if (search.anoMax) query.anoMax = search.anoMax;
    if (search.cambio) query.cambio = search.cambio;
    if (search.combustivel) query.combustivel = search.combustivel;
    if (search.cor) query.cor = search.cor;
    // Categoria é aplicada localmente após baixar o XML completo. A fonte traz
    // alguns SUVs/sedãs classificados como hatch; filtrar na API os perderia.

    // Retorna o objeto mesmo se vazio (para buscar todos os veículos)
    return query;
  }, [
    search.marca,
    search.modelo,
    search.precoMin,
    search.precoMax,
    search.anoMin,
    search.anoMax,
    search.cambio,
    search.combustivel,
    search.cor,
    search.categoria,
  ]);

  const {
    data: vehicles,
    isLoading,
    isFetching: isRefreshingVehicles,
  } = useVehiclesQuery(vehiclesQuery, {
    refreshImmediately: true,
  });
  const { data: stockData } = useAllStockDataQuery();
  const { data: whatsapp } = useWhatsAppQuery();
  const whatsAppNumber = whatsapp?.numero || DEFAULT_SALES_WHATSAPP;
  const { searchTerm } = useSearchContext();

  const hasFilterParams = useMemo(() => {
    if (typeof window !== "undefined" && window.location.search.length > 1) {
      return true;
    }
    return Boolean(
      search.marca ||
      search.modelo ||
      search.precoMin ||
      search.precoMax ||
      search.anoMin ||
      search.anoMax ||
      search.cambio ||
      search.combustivel ||
      search.cor ||
      search.categoria,
    );
  }, [
    search.marca,
    search.modelo,
    search.precoMin,
    search.precoMax,
    search.anoMin,
    search.anoMax,
    search.cambio,
    search.combustivel,
    search.cor,
    search.categoria,
  ]);

  useDefaultMetaTags(
    "Carros Seminovos e Usados em Esteio/RS",
    "Veja carros seminovos e usados à venda na Netcar em Esteio/RS. Consulte fotos, preço e ano dos veículos disponíveis.",
    {
      canonicalPath: "/seminovos",
      robots: hasFilterParams ? "noindex, follow" : undefined,
    },
  );

  type ShowroomReturnState = {
    vehicleId?: string;
    scrollY: number;
    cardViewportTop?: number;
    savedAt?: number;
  };

  const showroomReturnRef = useRef<ShowroomReturnState | null | undefined>(
    undefined,
  );
  const scrollRestoreComplete = useRef(false);

  // Restaura pelo card, não só por pixels. O efeito pode rodar com o cache
  // inicial e novamente após o XML completo, sem trabalho algum numa visita nova.
  useLayoutEffect(() => {
    if (scrollRestoreComplete.current || isLoading || !vehicles) return;

    if (showroomReturnRef.current === undefined) {
      try {
        const raw = sessionStorage.getItem("showroom-return");
        const legacy = sessionStorage.getItem("showroom-scroll");

        if (raw) {
          const parsed = JSON.parse(raw) as ShowroomReturnState;
          const expired =
            parsed.savedAt && Date.now() - parsed.savedAt > 30 * 60 * 1000;
          showroomReturnRef.current = expired ? null : parsed;
        } else if (legacy && Number.isFinite(Number(legacy))) {
          showroomReturnRef.current = { scrollY: Number(legacy) };
        } else {
          showroomReturnRef.current = null;
        }
      } catch {
        showroomReturnRef.current = null;
      }
    }

    const saved = showroomReturnRef.current;
    if (!saved) {
      scrollRestoreComplete.current = true;
      return;
    }

    const restore = () => {
      let top = saved.scrollY;
      if (saved.vehicleId) {
        const selector = `[data-showroom-vehicle-id="${CSS.escape(saved.vehicleId)}"]`;
        const card = document.querySelector<HTMLElement>(selector);
        if (card) {
          top =
            window.scrollY +
            card.getBoundingClientRect().top -
            (saved.cardViewportTop ?? 0);
        }
      }
      window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
    };

    // O frame ocorre depois do scrollTo(0) global da troca de rota.
    let followUpFrame = 0;
    const frame = requestAnimationFrame(() => {
      restore();
      followUpFrame = requestAnimationFrame(restore);
    });

    // Enquanto a API atualiza o bootstrap, mantém o estado para uma segunda
    // restauração. Só consome a chave quando o XML terminou de chegar.
    if (!isRefreshingVehicles) {
      const finalTimer = window.setTimeout(() => {
        restore();
        scrollRestoreComplete.current = true;
        try {
          sessionStorage.removeItem("showroom-return");
          sessionStorage.removeItem("showroom-scroll");
        } catch {
          // A posição já foi aplicada; storage indisponível não afeta a tela.
        }
      }, 120);

      return () => {
        cancelAnimationFrame(frame);
        cancelAnimationFrame(followUpFrame);
        clearTimeout(finalTimer);
      };
    }

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(followUpFrame);
    };
  }, [isLoading, isRefreshingVehicles, vehicles, vehicles?.length]);

  // Extrai dados do stockData (agora são arrays simples)
  const brands = stockData?.enterprises || [];
  const models = stockData?.cars || [];
  const years = stockData?.years || [];
  const colors = stockData?.colors || [];
  const fuels = stockData?.fuels || [];
  const transmissions = stockData?.transmissions || [];
  const priceRanges = stockData?.prices || [];

  // Estados dos filtros
  const [marca, setMarca] = useState(search.marca || "");
  const [modelo, setModelo] = useState(search.modelo || "");
  const [anoMin, setAnoMin] = useState(search.anoMin || "");
  const [anoMax, setAnoMax] = useState(search.anoMax || "");
  const [precoMin, setPrecoMin] = useState(search.precoMin || "");
  const [precoMax, setPrecoMax] = useState(search.precoMax || "");
  const [categoria, setCategoria] = useState(search.categoria || "");
  const [cambio, setCambio] = useState(search.cambio || "");
  const [combustivel, setCombustivel] = useState(search.combustivel || "");
  const [cor, setCor] = useState(search.cor || "");
  const [sortBy, setSortBy] = useState<ShowroomSortOption>("recomendados");
  const [areFiltersVisible, setAreFiltersVisible] = useState(false);
  const pendingFilterTrackingRef = useRef<string | null>(null);

  // Sincroniza estados locais com parâmetros da URL quando mudam
  useEffect(() => {
    setMarca(search.marca || "");
    setModelo(search.modelo || "");
    setAnoMin(search.anoMin || "");
    setAnoMax(search.anoMax || "");
    setPrecoMin(search.precoMin || "");
    setPrecoMax(search.precoMax || "");
    setCategoria(search.categoria || "");
    setCambio(search.cambio || "");
    setCombustivel(search.combustivel || "");
    setCor(search.cor || "");
  }, [
    search.marca,
    search.modelo,
    search.anoMin,
    search.anoMax,
    search.precoMin,
    search.precoMax,
    search.categoria,
    search.cambio,
    search.combustivel,
    search.cor,
  ]);

  // Aplica filtros
  const handleFilter = () => {
    const nextFilters: StockFilterValues = {
      marca: marca || undefined,
      modelo: modelo || undefined,
      precoMin: precoMin || undefined,
      precoMax: precoMax || undefined,
      anoMin: anoMin || undefined,
      anoMax: anoMax || undefined,
      cambio: cambio || undefined,
      combustivel: combustivel || undefined,
      cor: cor || undefined,
      categoria: categoria || undefined,
    };
    pendingFilterTrackingRef.current = stockFilterSignature(nextFilters);
    navigate({
      to: "/seminovos",
      search: nextFilters,
    });
    setAreFiltersVisible(false);
  };

  // Limpa todos os filtros
  const handleClearFilters = () => {
    setMarca("");
    setModelo("");
    setAnoMin("");
    setAnoMax("");
    setPrecoMin("");
    setPrecoMax("");
    setCategoria("");
    setCambio("");
    setCombustivel("");
    setCor("");
    navigate({
      to: "/seminovos",
      search: {
        marca: undefined,
        modelo: undefined,
        precoMin: undefined,
        precoMax: undefined,
        anoMin: undefined,
        anoMax: undefined,
        cambio: undefined,
        combustivel: undefined,
        cor: undefined,
        categoria: undefined,
      },
    });
    setAreFiltersVisible(false);
  };

  // Mantém separado o que está sendo editado do que já foi aplicado na URL.
  const draftFiltersCount = useMemo(() => {
    let count = 0;
    if (marca) count++;
    if (modelo) count++;
    if (anoMin) count++;
    if (anoMax) count++;
    if (precoMin) count++;
    if (precoMax) count++;
    if (categoria) count++;
    if (cambio) count++;
    if (combustivel) count++;
    if (cor) count++;
    return count;
  }, [
    marca,
    modelo,
    anoMin,
    anoMax,
    precoMin,
    precoMax,
    categoria,
    cambio,
    combustivel,
    cor,
  ]);

  const appliedFiltersCount = useMemo(() => {
    return [
      search.marca,
      search.modelo,
      search.anoMin,
      search.anoMax,
      search.precoMin,
      search.precoMax,
      search.categoria,
      search.cambio,
      search.combustivel,
      search.cor,
    ].filter(Boolean).length;
  }, [
    search.marca,
    search.modelo,
    search.anoMin,
    search.anoMax,
    search.precoMin,
    search.precoMax,
    search.categoria,
    search.cambio,
    search.combustivel,
    search.cor,
  ]);

  const visibleFiltersCount = areFiltersVisible
    ? draftFiltersCount
    : appliedFiltersCount;

  const activeFilterLabels = useMemo(() => {
    const labels: string[] = [];
    if (search.marca) labels.push(search.marca);
    if (search.modelo) labels.push(search.modelo);
    if (search.categoria) {
      labels.push(
        vehicleCategoryLabels[search.categoria.toUpperCase()] ||
          search.categoria,
      );
    }
    if (search.cambio) labels.push(search.cambio);
    if (search.combustivel) labels.push(search.combustivel);
    if (search.cor) labels.push(search.cor);
    if (search.anoMin || search.anoMax) {
      labels.push(`Ano ${search.anoMin || "…"}–${search.anoMax || "…"}`);
    }
    if (search.precoMin || search.precoMax) {
      labels.push(`R$ ${search.precoMin || "…"}–${search.precoMax || "…"}`);
    }
    return labels;
  }, [
    search.marca,
    search.modelo,
    search.categoria,
    search.cambio,
    search.combustivel,
    search.cor,
    search.anoMin,
    search.anoMax,
    search.precoMin,
    search.precoMax,
  ]);

  // Filtra e ordena veículos
  const filteredAndSortedVehicles = useMemo(() => {
    if (!vehicles) return [];

    let filtered = [...vehicles];

    // Filtro por categoria (fallback caso a API não filtre corretamente)
    if (search.categoria) {
      const categoriaUpper = search.categoria.toUpperCase();
      filtered = filtered.filter((vehicle) => {
        const vehicleCategoria = resolvedVehicleCategory(vehicle);
        return vehicleCategoria === categoriaUpper;
      });
    }

    if (search.combustivel) {
      const combustivel = search.combustivel
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();
      filtered = filtered.filter(
        (vehicle) =>
          String(vehicle.combustivel || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase() === combustivel,
      );
    }

    // Filtro de busca local (por conteúdo dos cards)
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((vehicle) => {
        const searchFields = [
          vehicle.marca,
          vehicle.modelo,
          vehicle.name,
          vehicle.cor,
          vehicle.combustivel,
          vehicle.cambio,
          vehicle.motor,
          vehicle.placa,
          vehicle.year?.toString(),
          vehicle.price?.toString(),
          vehicle.valor_formatado,
        ].filter(Boolean);

        return searchFields.some((field) =>
          String(field).toLowerCase().includes(searchLower),
        );
      });
    }

    return sortShowroomVehicles(filtered, sortBy);
  }, [vehicles, sortBy, searchTerm, search.categoria, search.combustivel]);

  // Registra a quantidade somente quando a URL e a consulta já refletem os
  // filtros recém-aplicados, evitando enviar a contagem do resultado anterior.
  useEffect(() => {
    const appliedFilters: StockFilterValues = {
      marca: search.marca,
      modelo: search.modelo,
      precoMin: search.precoMin,
      precoMax: search.precoMax,
      anoMin: search.anoMin,
      anoMax: search.anoMax,
      cambio: search.cambio,
      combustivel: search.combustivel,
      cor: search.cor,
      categoria: search.categoria,
    };
    const signature = stockFilterSignature(appliedFilters);

    if (
      pendingFilterTrackingRef.current !== signature ||
      isLoading ||
      isRefreshingVehicles
    ) {
      return;
    }

    pendingFilterTrackingRef.current = null;
    trackStockFilterApply({
      filters: appliedFilters,
      resultCount: filteredAndSortedVehicles.length,
    });
  }, [
    filteredAndSortedVehicles.length,
    isLoading,
    isRefreshingVehicles,
    search.marca,
    search.modelo,
    search.precoMin,
    search.precoMax,
    search.anoMin,
    search.anoMax,
    search.cambio,
    search.combustivel,
    search.cor,
    search.categoria,
  ]);

  const visibleVehicles = filteredAndSortedVehicles;

  // Insere a ajuda depois de duas linhas completas, sem abrir lacunas no grid.
  const midGridBreak = stockLayout.compact
    ? 6
    : stockLayout.columns * 2;
  const showMidGridBanner =
    visibleVehicles.length > midGridBreak + stockLayout.columns;

  // Anos para o dropdown (do mais recente para o mais antigo)
  const sortedYears = useMemo(() => {
    if (!years || years.length === 0) return [];
    // Converte todos para números e ordena do mais recente para o mais antigo
    return [...years]
      .map((y) => (typeof y === "string" ? parseInt(y, 10) : y))
      .filter((y) => !isNaN(y))
      .sort((a, b) => b - a);
  }, [years]);

  // Prepara opções para os componentes AutocompleteSelect
  const brandOptions = useMemo(() => {
    return toSelectOptions(brands);
  }, [brands]);

  const modelOptions = useMemo(() => toSelectOptions(models), [models]);
  const colorOptions = useMemo(() => toSelectOptions(colors), [colors]);
  const fuelOptions = useMemo(() => toSelectOptions(fuels), [fuels]);
  const transmissionOptions = useMemo(
    () => toSelectOptions(transmissions),
    [transmissions],
  );
  const categoryOptions = useMemo(() => {
    const categories = (vehicles || []).map((vehicle) =>
      resolvedVehicleCategory(vehicle),
    );
    return [...new Set(categories.filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, "pt-BR"))
      .map((value) => ({
        value,
        label: vehicleCategoryLabels[value] || value,
      }));
  }, [vehicles]);

  const yearOptions = useMemo(() => {
    return sortedYears.map((year) => ({
      value: String(year),
      label: String(year),
    }));
  }, [sortedYears]);

  // Valores mínimos e máximos para os inputs de preço
  const minPrice = useMemo(() => {
    if (!priceRanges || priceRanges.length === 0) return 0;
    return Math.min(...priceRanges);
  }, [priceRanges]);

  const maxPrice = useMemo(() => {
    if (!priceRanges || priceRanges.length === 0) return 0;
    return Math.max(...priceRanges);
  }, [priceRanges]);

  // Monta mensagem WhatsApp com filtros ativos
  const seminovosWhatsAppHref = useMemo(() => {
    const parts: string[] = [];
    if (search.marca) parts.push(`marca ${search.marca}`);
    if (search.modelo) parts.push(`modelo ${search.modelo}`);
    if (search.categoria) parts.push(`categoria ${search.categoria}`);
    if (search.cambio) parts.push(`câmbio ${search.cambio}`);
    if (search.combustivel) parts.push(`combustível ${search.combustivel}`);
    if (search.cor) parts.push(`cor ${search.cor}`);
    if (search.precoMin || search.precoMax) {
      const min = search.precoMin ? `R$ ${search.precoMin}` : "—";
      const max = search.precoMax ? `R$ ${search.precoMax}` : "—";
      parts.push(`preço entre ${min} e ${max}`);
    }
    if (search.anoMin || search.anoMax) {
      const min = search.anoMin || "—";
      const max = search.anoMax || "—";
      parts.push(`ano entre ${min} e ${max}`);
    }
    if (!parts.length) {
      return buildWhatsAppUrl(
        whatsAppNumber,
        homeWhatsAppMessages().vehicleInterest,
      );
    }
    return buildWhatsAppUrl(
      whatsAppNumber,
      siteWhatsAppMessage(
        `quero ajuda para encontrar um seminovo com estes filtros: ${parts.join(", ")}.`,
      ),
    );
  }, [
    whatsAppNumber,
    search.marca,
    search.modelo,
    search.categoria,
    search.cambio,
    search.combustivel,
    search.cor,
    search.precoMin,
    search.precoMax,
    search.anoMin,
    search.anoMax,
  ]);

  return (
    <main className="flex-1 pt-10 overflow-x-hidden max-w-full pb-6">
      <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6">
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[#00283C]/10 bg-white p-2 shadow-sm">
          <button
            type="button"
            onClick={() => setAreFiltersVisible((visible) => !visible)}
            aria-expanded={areFiltersVisible}
            aria-controls="stock-filters"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#00283C] px-4 text-sm font-bold text-white"
          >
            <Filter className="h-4 w-4" />
            Filtros
            {visibleFiltersCount > 0 && (
              <span className="rounded-full bg-white px-1.5 py-0.5 text-xs text-[#00283C]">
                {visibleFiltersCount}
              </span>
            )}
          </button>
          <label className="flex min-w-0 items-center gap-2">
            <span className="hidden text-xs font-bold uppercase text-muted-foreground sm:inline">
              Ordenar por
            </span>
            <span className="sr-only">Ordenar veículos</span>
            <div className="relative min-w-0">
              <select
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value as ShowroomSortOption)
                }
                className="min-h-11 max-w-[190px] appearance-none rounded-lg bg-surface px-3 pr-8 text-sm font-semibold text-fg focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="recomendados">Recomendados</option>
                <option value="ano-desc">Mais novos (ano)</option>
                <option value="preco-asc">Menor preço</option>
                <option value="preco-desc">Maior preço</option>
                <option value="az">Marca / modelo A–Z</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </label>
        </div>

        {activeFilterLabels.length > 0 ? (
          <div
            className="mb-4 flex flex-wrap items-center gap-2"
            aria-label="Filtros ativos"
          >
            {activeFilterLabels.map((label, index) => (
              <span
                key={`${label}-${index}`}
                className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-bold text-fg"
              >
                {label}
              </span>
            ))}
            <button
              type="button"
              onClick={handleClearFilters}
              className="min-h-9 px-2 text-xs font-black text-primary underline underline-offset-4"
            >
              Limpar todos
            </button>
          </div>
        ) : null}

        {/* Filtros em Card Minimalista - Desktop */}
        <div
          id="stock-filters"
          className={`${areFiltersVisible ? "block" : "hidden"} bg-bg rounded-2xl border border-[#00283C]/10 shadow-sm p-5 mb-6`}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-fg">Filtros</h2>
            <button
              onClick={handleClearFilters}
              disabled={draftFiltersCount === 0}
              className={`text-xs font-medium uppercase tracking-wider transition-colors ${
                draftFiltersCount > 0
                  ? "text-primary hover:text-primary/80 cursor-pointer"
                  : "text-muted-foreground cursor-not-allowed opacity-50"
              }`}
            >
              Limpar filtros
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-6">
            {/* Marca */}
            <div className="flex-1 min-w-[140px]">
              <label className="mb-2 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Marca
              </label>
              <AutocompleteSelect
                options={brandOptions}
                value={marca}
                onChange={setMarca}
                placeholder="Selecione"
                label=""
              />
            </div>

            <div className="flex-1 min-w-[170px]">
              <label className="mb-2 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Modelo
              </label>
              <AutocompleteSelect
                options={modelOptions}
                value={modelo}
                onChange={setModelo}
                placeholder="Selecione"
              />
            </div>

            <div className="flex-1 min-w-[140px]">
              <label className="mb-2 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Carroceria
              </label>
              <AutocompleteSelect
                options={categoryOptions}
                value={categoria}
                onChange={setCategoria}
                placeholder="Selecione"
              />
            </div>

            <div className="flex-1 min-w-[140px]">
              <label className="mb-2 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Câmbio
              </label>
              <AutocompleteSelect
                options={transmissionOptions}
                value={cambio}
                onChange={setCambio}
                placeholder="Selecione"
              />
            </div>

            <div className="flex-1 min-w-[140px]">
              <label className="mb-2 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Combustível
              </label>
              <AutocompleteSelect
                options={fuelOptions}
                value={combustivel}
                onChange={setCombustivel}
                placeholder="Selecione"
              />
            </div>

            <div className="flex-1 min-w-[140px]">
              <label className="mb-2 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Cor
              </label>
              <AutocompleteSelect
                options={colorOptions}
                value={cor}
                onChange={setCor}
                placeholder="Selecione"
              />
            </div>

            {/* Ano mínimo */}
            <div className="flex-1 min-w-[120px]">
              <label className="mb-2 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Ano de
              </label>
              <AutocompleteSelect
                options={yearOptions}
                value={anoMin}
                onChange={setAnoMin}
                placeholder="Selecione"
                label=""
              />
            </div>

            {/* Ano máximo */}
            <div className="flex-1 min-w-[120px]">
              <label className="mb-2 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Ano até
              </label>
              <AutocompleteSelect
                options={yearOptions}
                value={anoMax}
                onChange={setAnoMax}
                placeholder="Selecione"
                label=""
              />
            </div>

            {/* Valor de */}
            <div className="flex-1 min-w-[120px]">
              <label className="mb-2 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Valor de
              </label>
              <input
                type="text"
                value={precoMin}
                onChange={(e) => setPrecoMin(e.target.value)}
                placeholder={
                  minPrice > 0
                    ? `R$ ${minPrice.toLocaleString("pt-BR")}`
                    : "R$ 0"
                }
                className="w-full border-0 border-b border-border rounded-none bg-transparent px-0 py-2 text-sm text-fg placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>

            {/* Valor até */}
            <div className="flex-1 min-w-[120px]">
              <label className="mb-2 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Valor até
              </label>
              <input
                type="text"
                value={precoMax}
                onChange={(e) => setPrecoMax(e.target.value)}
                placeholder={
                  maxPrice > 0
                    ? `R$ ${maxPrice.toLocaleString("pt-BR")}`
                    : "R$ 500.000"
                }
                className="w-full border-0 border-b border-border rounded-none bg-transparent px-0 py-2 text-sm text-fg placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>

            {/* Botão Filtrar */}
            <button
              onClick={handleFilter}
              className="px-6 py-2.5 rounded-lg bg-fg text-white text-sm font-semibold uppercase hover:bg-fg/90 transition-all duration-200 hover:shadow-md"
            >
              Filtrar
            </button>
          </div>
        </div>

        {/* Header com Título e Ordenação */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-3">
          <div>
            <h1 className="text-2xl font-bold text-fg">
              Carros seminovos e usados
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredAndSortedVehicles.length} veículo
              {filteredAndSortedVehicles.length !== 1 ? "s" : ""} encontrado
              {filteredAndSortedVehicles.length !== 1 ? "s" : ""}
            </p>
            <div className="mt-2 flex max-w-3xl flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] font-semibold leading-relaxed text-muted-foreground sm:text-xs">
              <ShieldCheck
                className="h-4 w-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              <span className="font-black text-fg">Seleção Netcar:</span>
              <span>
                origem RS, sem locadora, leilão, sinistro, furto ou roubo.
              </span>
              <Link
                to="/como-selecionamos-nossos-carros"
                className="font-black text-primary underline decoration-primary/25 underline-offset-4 hover:text-fg"
              >
                Entenda
              </Link>
            </div>
          </div>
        </div>

        {!hasFilterParams && (
          <div className="mb-5 space-y-3">
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Estoque disponível nas duas lojas da Netcar, na Av. Presidente
              Vargas, em Esteio. Veja fotos, preço e ano antes de escolher.
            </p>
            <nav
              aria-label="Atalhos do estoque"
              className="flex flex-wrap gap-2"
            >
              {landingPages
                .filter((landing) => landing.type === "categoria")
                .map((landing) => (
                  <Link
                    key={landing.slug}
                    to="/comprar-{$landingSlug}"
                    params={{ landingSlug: landing.slug }}
                    className="rounded-full border border-[#00283C]/15 bg-white px-3.5 py-2 text-xs font-bold text-[#00283C] transition-colors hover:border-[#008C95]/40 hover:text-[#007A83]"
                  >
                    {stockCategoryLabels[landing.slug] || landing.name}
                  </Link>
                ))}
              <Link
                to="/seminovos-automaticos"
                className="rounded-full border border-[#00283C]/15 bg-white px-3.5 py-2 text-xs font-bold text-[#00283C] transition-colors hover:border-[#008C95]/40 hover:text-[#007A83]"
              >
                Automáticos
              </Link>
            </nav>
          </div>
        )}

        {/* Grid de Veículos */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        ) : filteredAndSortedVehicles.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <div>
              <p className="text-fg text-lg font-semibold mb-2">
                Nenhum veículo encontrado
              </p>
              <p className="text-muted-foreground">
                Tente ajustar os filtros — ou peça opções no WhatsApp.
              </p>
            </div>
            <a
              href={seminovosWhatsAppHref}
              target="_blank"
              rel="noopener noreferrer"
              data-wa-source="seminovos_empty"
              data-wa-intent="stock_help"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#087A37] px-5 py-3 text-sm font-black text-white shadow-[0_6px_18px_rgba(8,122,55,0.30)]"
            >
              <MessageCircle className="h-4 w-4" />
              Pedir opções no WhatsApp
            </a>
          </div>
        ) : (
          <>
            <div
              className="grid grid-cols-2 items-stretch gap-2 md:gap-6 lg:grid-cols-3 lg:gap-8 xl:grid-cols-4 xl:gap-10 2xl:grid-cols-5"
              style={{ overflow: "visible" }}
            >
              {visibleVehicles.map((vehicle, index) => (
                <Fragment key={vehicle.id}>
                  <VehicleCardStatic
                    id={vehicle.id}
                    name={vehicle.modelo || vehicle.name}
                    price={vehicle.price || 0}
                    valor_formatado={vehicle.valor_formatado}
                    preco_com_troca={vehicle.preco_com_troca}
                    preco_com_troca_formatado={
                      vehicle.preco_com_troca_formatado
                    }
                    year={vehicle.year || new Date().getFullYear()}
                    km={vehicle.km || 0}
                    images={vehicle.images || vehicle.fotos || []}
                    imagens_site={vehicle.imagens_site}
                    marca={vehicle.marca}
                    modelo={vehicle.modelo}
                    combustivel={vehicle.combustivel}
                    cambio={vehicle.cambio}
                    delay={index}
                    fastAnimation={index >= midGridBreak}
                    showWhatsAppInterest
                    whatsAppSource="seminovos_grid"
                    whatsAppNumber={whatsAppNumber}
                    compact={stockLayout.compact}
                    preserveShowroomPosition
                  />
                  {showMidGridBanner && index + 1 === midGridBreak && (
                    <div className="col-span-full my-2 md:my-0">
                      <SeminovosWhatsAppHelpPanel
                        stockHelpHref={seminovosWhatsAppHref}
                        hasFilters={hasFilterParams}
                        variant="inline"
                      />
                    </div>
                  )}
                </Fragment>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="w-full font-sans antialiased text-muted-foreground bg-muted py-12 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 space-y-8">
        <div className="container-main space-y-8">
          <LazyLocalizacao />
          <IanBot />
        </div>
      </div>
    </main>
  );
}
