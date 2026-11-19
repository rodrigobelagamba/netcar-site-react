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
import { ChevronDown, Filter, MessageCircle, ShieldCheck, X } from "lucide-react";
import { useMetaTags } from "@/hooks/useMetaTags";
import { matchesVehicleSearch, parseVehicleSearch } from "@/lib/vehicleSearch";
import { matchesVehicleBrand } from "@/lib/vehicleBrand";
import { emptySeminovosSearch } from "@/lib/seminovos-search";
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
import { StockSearchField } from "../components/StockSearchField";
import { StockFilterNotice } from "../components/StockFilterNotice";
import { BlackFridayStockIntro } from "@/features/black-friday/CampaignSurfaces";
import { useBlackFridayCampaign } from "@/features/black-friday/CampaignProvider";
import "@/features/black-friday/stock-theme.css";

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

function normalizeComparableText(value: string | null | undefined): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function parseNumericPriceInput(value: string | undefined): number | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatCompactPriceLabel(value: string | undefined): string {
  const num = parseNumericPriceInput(value);
  if (!num) return value || "…";
  if (num >= 1000 && num % 1000 === 0) return `R$ ${num / 1000} mil`;
  return `R$ ${num.toLocaleString("pt-BR")}`;
}

function isAvailableVehicle(vehicle: { price?: number | null }): boolean {
  const price = Number(vehicle.price);
  return Number.isFinite(price) && price > 0;
}

/**
 * Garante a 1ª linha da vitrine 100% com carros disponíveis sem quebrar a ordem
 * alfabética no restante do estoque: vendidos que cairiam na 1ª dobra são
 * deslocados para logo após os primeiros `leadAvailable` disponíveis.
 */
function keepFirstRowAvailable<T extends { price?: number | null }>(
  sortedVehicles: T[],
  leadAvailable = 5,
): T[] {
  const firstRow: T[] = [];
  const deferredSold: T[] = [];
  let splitIndex = 0;

  while (splitIndex < sortedVehicles.length && firstRow.length < leadAvailable) {
    const vehicle = sortedVehicles[splitIndex++];
    if (isAvailableVehicle(vehicle)) {
      firstRow.push(vehicle);
    } else {
      deferredSold.push(vehicle);
    }
  }

  if (deferredSold.length === 0) return sortedVehicles;
  return [...firstRow, ...deferredSold, ...sortedVehicles.slice(splitIndex)];
}

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

function stockFilterSignature(filters: Partial<StockFilterValues>): string {
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
  const { active: isBlackFriday } = useBlackFridayCampaign();
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

  // Busca livre fica na URL, sem restringir a consulta da API ao campo modelo.
  // Digitar só filtra os carros já carregados e não cria uma entrada no histórico.
  const handleStockSearch = (value: string) => {
    void navigate({
      to: "/seminovos",
      search: (previous) => ({ ...previous, busca: value || undefined }),
      replace: true,
      resetScroll: false,
    });
  };

  const hasFilterParams = useMemo(() => {
    if (typeof window !== "undefined" && window.location.search.length > 1) {
      return true;
    }
    return Boolean(
      search.busca ||
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
    search.busca,
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

  useMetaTags({
    title: "Carros Seminovos e Usados em Esteio/RS | Netcar Multimarcas",
    description:
      "Carros seminovos e usados em Esteio, com fotos e preços. Avaliamos seu usado na troca por qualquer carro do estoque, com possibilidade de troco.",
    url: "https://www.netcarmultimarcas.com.br/seminovos",
    robots: hasFilterParams ? "noindex, follow" : undefined,
  });

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
  const [sortBy, setSortBy] = useState<ShowroomSortOption>("az");
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

  const applySearchPatch = (patch: Partial<StockFilterValues>) => {
    const nextFilters: StockFilterValues = {
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
      ...patch,
    };
    pendingFilterTrackingRef.current = stockFilterSignature(nextFilters);
    void navigate({
      to: "/seminovos",
      search: {
        ...nextFilters,
        busca: search.busca,
      },
      resetScroll: false,
    });
  };

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
      search: {
        ...nextFilters,
        busca: search.busca,
      },
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
      search: emptySeminovosSearch,
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

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; patch: Partial<StockFilterValues> }> = [];
    if (search.marca) {
      chips.push({ key: "marca", label: search.marca, patch: { marca: undefined, modelo: undefined } });
    }
    if (search.modelo) {
      chips.push({ key: "modelo", label: search.modelo, patch: { modelo: undefined } });
    }
    if (search.categoria) {
      chips.push({
        key: "categoria",
        label: vehicleCategoryLabels[search.categoria.toUpperCase()] || search.categoria,
        patch: { categoria: undefined },
      });
    }
    if (search.cambio) {
      const cambioLabel = /autom/i.test(search.cambio) ? "Automático" : search.cambio;
      chips.push({ key: "cambio", label: cambioLabel, patch: { cambio: undefined } });
    }
    if (search.combustivel) {
      chips.push({ key: "combustivel", label: search.combustivel, patch: { combustivel: undefined } });
    }
    if (search.cor) {
      chips.push({ key: "cor", label: search.cor, patch: { cor: undefined } });
    }
    if (search.anoMin || search.anoMax) {
      const anoLabel =
        search.anoMin && !search.anoMax
          ? `A partir de ${search.anoMin}`
          : !search.anoMin && search.anoMax
            ? `Até ${search.anoMax}`
            : `Ano ${search.anoMin}–${search.anoMax}`;
      chips.push({ key: "ano", label: anoLabel, patch: { anoMin: undefined, anoMax: undefined } });
    }
    if (search.precoMin || search.precoMax) {
      const precoLabel =
        !search.precoMin && search.precoMax
          ? `Até ${formatCompactPriceLabel(search.precoMax)}`
          : search.precoMin && !search.precoMax
            ? `A partir de ${formatCompactPriceLabel(search.precoMin)}`
            : `${formatCompactPriceLabel(search.precoMin)}–${formatCompactPriceLabel(search.precoMax)}`;
      chips.push({ key: "preco", label: precoLabel, patch: { precoMin: undefined, precoMax: undefined } });
    }
    return chips;
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

  const filterSummaryText = useMemo(() => {
    const bits: string[] = [];
    if (search.busca?.trim()) bits.push(`"${search.busca.trim()}"`);
    for (const chip of activeFilterChips) bits.push(chip.label);
    return bits.join(", ");
  }, [search.busca, activeFilterChips]);

  const parsedStockSearch = useMemo(
    () => parseVehicleSearch(search.busca || ""),
    [search.busca],
  );

  // Suggestions must respect applied filters, without filtering out incomplete
  // free-text fragments before they can be completed.
  const structuredVehicles = useMemo(() => {
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

    return filtered;
  }, [vehicles, search.categoria, search.combustivel]);

  const filteredAndSortedVehicles = useMemo(() => {
    const filtered = search.busca
      ? structuredVehicles.filter((vehicle) =>
          matchesVehicleSearch(vehicle, parsedStockSearch),
        )
      : structuredVehicles;
    return sortShowroomVehicles(filtered, sortBy);
  }, [structuredVehicles, sortBy, search.busca, parsedStockSearch]);

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

  const availableVehicles = useMemo(
    () => filteredAndSortedVehicles.filter(isAvailableVehicle),
    [filteredAndSortedVehicles],
  );
  const soldVehicles = useMemo(
    () => filteredAndSortedVehicles.filter((vehicle) => !isAvailableVehicle(vehicle)),
    [filteredAndSortedVehicles],
  );
  const displayVehicles = useMemo(
    () => keepFirstRowAvailable(filteredAndSortedVehicles, 5),
    [filteredAndSortedVehicles],
  );

  // Contagens ao vivo pros chips rápidos quando o estoque base está carregado sem filtros.
  const baseChipCounts = useMemo(() => {
    if (appliedFiltersCount > 0 || search.busca?.trim() || !vehicles) return null;
    const active = vehicles.filter(isAvailableVehicle);
    let suv = 0;
    let hatch = 0;
    let sedan = 0;
    let automatic = 0;
    let under80k = 0;
    let under100k = 0;
    let year2024Plus = 0;
    for (const vehicle of active) {
      const cat = resolvedVehicleCategory(vehicle);
      if (cat === "SUV") suv++;
      else if (cat === "HATCH") hatch++;
      else if (cat === "SEDAN") sedan++;
      if (/autom/i.test(vehicle.cambio || "")) automatic++;
      const price = Number(vehicle.price || 0);
      if (price > 0 && price <= 80_000) under80k++;
      if (price > 0 && price <= 100_000) under100k++;
      if (Number(vehicle.year || 0) >= 2024) year2024Plus++;
    }
    return {
      all: active.length,
      suv,
      hatch,
      sedan,
      automatic,
      under80k,
      under100k,
      year2024Plus,
    };
  }, [vehicles, appliedFiltersCount, search.busca]);

  // Insere a ajuda depois de duas linhas completas, sem abrir lacunas no grid.
  const midGridBreak = stockLayout.compact ? 6 : stockLayout.columns * 2;
  const showMidGridBanner =
    displayVehicles.length > midGridBreak + stockLayout.columns;

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

  // Quando uma marca é escolhida, limita modelos àquela marca.
  const modelOptions = useMemo(() => {
    if (marca && vehicles && vehicles.length > 0) {
      const targetBrand = normalizeComparableText(marca);
      const brandModels = vehicles
        .filter((vehicle) => normalizeComparableText(vehicle.marca) === targetBrand)
        .map((vehicle) => vehicle.modelo || vehicle.name);
      if (brandModels.length > 0) {
        return toSelectOptions(brandModels);
      }
    }
    return toSelectOptions(models);
  }, [marca, vehicles, models]);

  // Contagem ao vivo para o botão do painel de filtros quando o estoque completo está disponível.
  const draftPreviewCount = useMemo(() => {
    if (appliedFiltersCount > 0 || !vehicles || vehicles.length === 0) return null;
    const minP = parseNumericPriceInput(precoMin);
    const maxP = parseNumericPriceInput(precoMax);
    const minY = anoMin ? Number(anoMin) : null;
    const maxY = anoMax ? Number(anoMax) : null;
    const normMarca = normalizeComparableText(marca);
    const normModelo = normalizeComparableText(modelo);
    const normCat = normalizeComparableText(categoria);
    const normCambio = normalizeComparableText(cambio);
    const normComb = normalizeComparableText(combustivel);
    const normCor = normalizeComparableText(cor);

    return vehicles.filter((vehicle) => {
      if (!isAvailableVehicle(vehicle)) return false;
      if (normMarca && normalizeComparableText(vehicle.marca) !== normMarca) return false;
      if (normModelo && !normalizeComparableText(vehicle.modelo || vehicle.name).includes(normModelo)) return false;
      if (normCat && resolvedVehicleCategory(vehicle) !== normCat) return false;
      if (normCambio && normalizeComparableText(vehicle.cambio) !== normCambio) return false;
      if (normComb && normalizeComparableText(vehicle.combustivel) !== normComb) return false;
      if (normCor && normalizeComparableText(vehicle.cor) !== normCor) return false;
      const yearNum = Number(vehicle.year || 0);
      if (minY && yearNum < minY) return false;
      if (maxY && yearNum > maxY) return false;
      const priceNum = Number(vehicle.price || 0);
      if (minP && priceNum < minP) return false;
      if (maxP && priceNum > maxP) return false;
      if (search.busca?.trim() && !matchesVehicleSearch(vehicle, parsedStockSearch)) return false;
      return true;
    }).length;
  }, [
    appliedFiltersCount,
    vehicles,
    marca,
    modelo,
    categoria,
    cambio,
    combustivel,
    cor,
    anoMin,
    anoMax,
    precoMin,
    precoMax,
    search.busca,
    parsedStockSearch,
  ]);
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
    if (search.busca?.trim()) parts.push(`busca ${search.busca.trim()}`);
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
    search.busca,
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

  const quickFilterChips = useMemo(() => {
    const activeCategoria = normalizeComparableText(search.categoria);
    const isAutomatic = /autom/i.test(search.cambio || "");
    const maxPriceNum = parseNumericPriceInput(search.precoMax);
    const minYearNum = search.anoMin ? Number(search.anoMin) : null;
    const isAllActive = appliedFiltersCount === 0 && !search.busca?.trim();

    return [
      {
        id: "todos",
        label: "Todos",
        count: baseChipCounts?.all,
        active: isAllActive,
        onClick: handleClearFilters,
      },
      {
        id: "suv",
        label: "SUV",
        count: baseChipCounts?.suv,
        active: activeCategoria === "SUV",
        onClick: () =>
          applySearchPatch({
            categoria: activeCategoria === "SUV" ? undefined : "SUV",
          }),
      },
      {
        id: "hatch",
        label: "Hatch",
        count: baseChipCounts?.hatch,
        active: activeCategoria === "HATCH",
        onClick: () =>
          applySearchPatch({
            categoria: activeCategoria === "HATCH" ? undefined : "HATCH",
          }),
      },
      {
        id: "sedan",
        label: "Sedã",
        count: baseChipCounts?.sedan,
        active: activeCategoria === "SEDAN",
        onClick: () =>
          applySearchPatch({
            categoria: activeCategoria === "SEDAN" ? undefined : "SEDAN",
          }),
      },
      {
        id: "automatico",
        label: "Automático",
        count: baseChipCounts?.automatic,
        active: isAutomatic,
        onClick: () =>
          applySearchPatch({
            cambio: isAutomatic ? undefined : "Automatico",
          }),
      },
      {
        id: "ate-80",
        label: "Até R$ 80 mil",
        count: baseChipCounts?.under80k,
        active: maxPriceNum === 80_000 && !search.precoMin,
        onClick: () =>
          applySearchPatch({
            precoMin: undefined,
            precoMax: maxPriceNum === 80_000 && !search.precoMin ? undefined : "80000",
          }),
      },
      {
        id: "ate-100",
        label: "Até R$ 100 mil",
        count: baseChipCounts?.under100k,
        active: maxPriceNum === 100_000 && !search.precoMin,
        onClick: () =>
          applySearchPatch({
            precoMin: undefined,
            precoMax: maxPriceNum === 100_000 && !search.precoMin ? undefined : "100000",
          }),
      },
      {
        id: "ano-2024",
        label: "2024+",
        count: baseChipCounts?.year2024Plus,
        active: minYearNum === 2024 && !search.anoMax,
        onClick: () =>
          applySearchPatch({
            anoMin: minYearNum === 2024 && !search.anoMax ? undefined : "2024",
            anoMax: undefined,
          }),
      },
    ];
  }, [
    appliedFiltersCount,
    baseChipCounts,
    search.anoMax,
    search.anoMin,
    search.busca,
    search.cambio,
    search.categoria,
    search.precoMax,
    search.precoMin,
  ]);

  const submitFiltersLabel =
    draftPreviewCount !== null
      ? draftPreviewCount === 0
        ? "Nenhum disponível"
        : `Ver ${draftPreviewCount} ${draftPreviewCount === 1 ? "carro" : "carros"}`
      : "Aplicar filtros";

  return (
    <main
      className="flex-1 pt-16 sm:pt-0 overflow-x-hidden max-w-full pb-6"
      data-black-friday={isBlackFriday || undefined}
      data-black-friday-stock={isBlackFriday || undefined}
    >
      <BlackFridayStockIntro />
      <div data-bf-stock-catalog className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-3 sm:py-4">
        <div data-bf-stock-toolbar className="mb-2.5 flex flex-col gap-2 sm:flex-row sm:items-start">
          <StockSearchField
            value={search.busca || ""}
            resetKey={stockFilterSignature(search)}
            onChange={handleStockSearch}
            vehicles={structuredVehicles}
          />
          <div className="flex items-center justify-between gap-2 sm:shrink-0">
            <button
              type="button"
              onClick={() => setAreFiltersVisible((visible) => !visible)}
              aria-expanded={areFiltersVisible}
              aria-controls="stock-filters"
              className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg bg-[#00283C] px-3 text-xs font-bold text-white sm:min-h-11 sm:gap-2 sm:px-4 sm:text-sm"
            >
              <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Filtros
              {visibleFiltersCount > 0 && (
                <span className="rounded-full bg-white px-1.5 py-0.5 text-xs text-[#00283C]">
                  {visibleFiltersCount}
                </span>
              )}
            </button>
            <label className="flex min-w-0 items-center gap-2">
              <span className="sr-only">Ordenar veículos</span>
              <div className="relative min-w-0">
                <select
                  value={sortBy}
                  onChange={(event) =>
                    setSortBy(event.target.value as ShowroomSortOption)
                  }
                  className="min-h-[34px] max-w-[190px] appearance-none rounded-lg border border-[#00283C]/10 bg-white px-2.5 pr-7 text-xs font-semibold text-fg focus:outline-none focus:ring-2 focus:ring-primary/20 sm:min-h-11 sm:px-3 sm:pr-8 sm:text-sm"
                >
                  <option value="recomendados">Recomendados</option>
                  <option value="ano-desc">Mais novos (ano)</option>
                  <option value="preco-asc">Menor preço</option>
                  <option value="preco-desc">Maior preço</option>
                  <option value="az">Modelo A–Z</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground sm:right-2.5 sm:h-4 sm:w-4" />
              </div>
            </label>
          </div>
        </div>

        {/* Atalhos de 1 clique pros recortes mais buscados */}
        <nav
          aria-label="Atalhos rápidos de filtro"
          className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible sm:pb-0"
        >
          {quickFilterChips.map((chip) => {
            const activeClass = isBlackFriday
              ? "border-[#5cc5ca] bg-[#5cc5ca] text-[#052d30] shadow-sm"
              : "border-[#00283C] bg-[#00283C] text-white shadow-sm";
            const idleClass = isBlackFriday
              ? "border-[#5cc5ca]/30 bg-[#122629] text-[#cfeaea] hover:border-[#5cc5ca]/70 hover:bg-[#193539]"
              : "border-[#00283C]/12 bg-white text-[#00283C] hover:border-[#008C95]/45 hover:bg-[#F3F8F8]";
            const countClass = chip.active
              ? isBlackFriday
                ? "text-[#052d30]/80"
                : "text-white/80"
              : isBlackFriday
                ? "text-[#8acfd2]"
                : "text-[#627780]";

            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={chip.active}
                onClick={chip.onClick}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${chip.active ? activeClass : idleClass}`}
              >
                <span>{chip.label}</span>
                {typeof chip.count === "number" && (
                  <span className={`text-[11px] font-semibold tabular-nums ${countClass}`}>
                    {chip.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {activeFilterChips.length > 0 ? (
          <div
            className="mb-2.5 flex flex-wrap items-center gap-2"
            aria-label="Filtros ativos"
          >
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => applySearchPatch(chip.patch)}
                aria-label={`Remover filtro ${chip.label}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-bold text-fg transition-colors hover:opacity-85"
              >
                <span>{chip.label}</span>
                <X className="h-3.5 w-3.5 opacity-75" aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : null}

        {/* Filtros: Bottom Sheet no mobile + Card expansível no desktop */}
        <div
          id="stock-filters"
          className={
            areFiltersVisible
              ? "fixed inset-0 z-[70] flex flex-col justify-end bg-black/60 backdrop-blur-[2px] sm:static sm:z-auto sm:mb-5 sm:block sm:bg-transparent sm:backdrop-blur-none"
              : "hidden"
          }
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setAreFiltersVisible(false);
            }
          }}
        >
          <div className="max-h-[85vh] overflow-y-auto rounded-t-2xl border border-[#00283C]/10 bg-bg p-5 shadow-2xl sm:max-h-none sm:overflow-visible sm:rounded-2xl sm:shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-fg">Filtros avançados</h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleClearFilters}
                  disabled={draftFiltersCount === 0}
                  className={`text-xs font-semibold uppercase tracking-wider transition-colors ${
                    draftFiltersCount > 0
                      ? "cursor-pointer text-primary hover:text-primary/80"
                      : "cursor-not-allowed text-muted-foreground opacity-50"
                  }`}
                >
                  Limpar filtros
                </button>
                <button
                  type="button"
                  onClick={() => setAreFiltersVisible(false)}
                  aria-label="Fechar filtros"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#00283C]/15 text-[#00283C] sm:hidden"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-5">
              {/* Marca */}
              <div className="min-w-[140px] flex-1">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Marca
                </label>
                <AutocompleteSelect
                  options={brandOptions}
                  matchesOption={matchesVehicleBrand}
                  value={marca}
                  onChange={(nextBrand) => {
                    setMarca(nextBrand);
                    if (nextBrand !== marca) setModelo("");
                  }}
                  placeholder="Selecione"
                  label=""
                />
              </div>

              <div className="min-w-[170px] flex-1">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Modelo
                </label>
                <AutocompleteSelect
                  options={modelOptions}
                  value={modelo}
                  onChange={setModelo}
                  placeholder={marca ? `Modelos ${marca}` : "Selecione"}
                />
              </div>

              <div className="min-w-[140px] flex-1">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Carroceria
                </label>
                <AutocompleteSelect
                  options={categoryOptions}
                  value={categoria}
                  onChange={setCategoria}
                  placeholder="Selecione"
                />
              </div>

              <div className="min-w-[140px] flex-1">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Câmbio
                </label>
                <AutocompleteSelect
                  options={transmissionOptions}
                  value={cambio}
                  onChange={setCambio}
                  placeholder="Selecione"
                />
              </div>

              <div className="min-w-[140px] flex-1">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Combustível
                </label>
                <AutocompleteSelect
                  options={fuelOptions}
                  value={combustivel}
                  onChange={setCombustivel}
                  placeholder="Selecione"
                />
              </div>

              <div className="min-w-[140px] flex-1">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
              <div className="min-w-[120px] flex-1">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
              <div className="min-w-[120px] flex-1">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
              <div className="min-w-[120px] flex-1">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Valor de
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={precoMin}
                  onChange={(e) => setPrecoMin(e.target.value.replace(/[^\d.,]/g, ""))}
                  placeholder={
                    minPrice > 0
                      ? `R$ ${minPrice.toLocaleString("pt-BR")}`
                      : "R$ 0"
                  }
                  className="w-full rounded-none border-0 border-b border-border bg-transparent px-0 py-2 text-sm text-fg placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>

              {/* Valor até */}
              <div className="min-w-[120px] flex-1">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Valor até
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={precoMax}
                  onChange={(e) => setPrecoMax(e.target.value.replace(/[^\d.,]/g, ""))}
                  placeholder={
                    maxPrice > 0
                      ? `R$ ${maxPrice.toLocaleString("pt-BR")}`
                      : "R$ 500.000"
                  }
                  className="w-full rounded-none border-0 border-b border-border bg-transparent px-0 py-2 text-sm text-fg placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>

              {/* Botão Filtrar */}
              <button
                type="button"
                onClick={handleFilter}
                className="w-full rounded-lg bg-fg px-6 py-3 text-sm font-bold uppercase text-white transition-all duration-200 hover:bg-fg/90 hover:shadow-md sm:w-auto sm:py-2.5"
              >
                {submitFiltersLabel}
              </button>
            </div>
          </div>
        </div>

        <div data-bf-stock-heading className="mb-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="min-w-0 text-lg font-bold leading-tight text-fg sm:text-xl">
                Carros seminovos e usados
              </h1>
              <p
                className="text-xs text-muted-foreground sm:text-sm"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {isLoading || isRefreshingVehicles ? (
                  "Atualizando estoque…"
                ) : (
                  <>
                    <strong className={isBlackFriday ? "font-bold text-[#9df0f2]" : "font-bold text-[#00283C]"}>
                      {availableVehicles.length}
                    </strong>{" "}
                    {availableVehicles.length === 1 ? "disponível" : "disponíveis"}
                    {soldVehicles.length > 0 && (
                      <> · {soldVehicles.length} vendidos recentemente</>
                    )}
                  </>
                )}
              </p>
            </div>
            <details className="group relative shrink-0">
              <summary className="flex min-h-[30px] min-w-[30px] cursor-pointer list-none items-center justify-center gap-1.5 rounded-lg text-xs font-semibold text-[#007A83] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008C95] sm:min-h-10 sm:min-w-10 [&::-webkit-details-marker]:hidden">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Sobre o estoque</span>
                <ChevronDown
                  className="h-3 w-3 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="absolute right-0 top-full z-20 w-[min(24rem,calc(100vw-2rem))] space-y-3 rounded-xl border border-[#00283C]/10 bg-white p-4 text-sm leading-relaxed text-muted-foreground shadow-lg">
                <p>
                  <strong className="text-fg">Seleção Netcar:</strong> origem
                  RS, sem locadora, leilão, sinistro, furto ou roubo.{" "}
                  <Link
                    to="/como-selecionamos-nossos-carros"
                    className="font-bold text-[#007A83] underline underline-offset-4"
                  >
                    Entenda
                  </Link>
                </p>
                <p>
                  Estoque disponível nas duas lojas da Netcar, na Av. Presidente
                  Vargas, em Esteio. Avaliamos seu usado na troca por qualquer
                  carro do estoque, inclusive com possibilidade de troco.
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
                        className="inline-flex min-h-11 items-center rounded-full border border-[#00283C]/15 px-3 text-xs font-bold text-[#00283C] hover:border-[#008C95]/40 hover:text-[#007A83]"
                      >
                        {stockCategoryLabels[landing.slug] || landing.name}
                      </Link>
                    ))}
                  <Link
                    to="/seminovos-automaticos"
                    className="inline-flex min-h-11 items-center rounded-full border border-[#00283C]/15 px-3 text-xs font-bold text-[#00283C] hover:border-[#008C95]/40 hover:text-[#007A83]"
                  >
                    Automáticos
                  </Link>
                </nav>
              </div>
            </details>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
            <StockFilterNotice
              active={Boolean(search.busca?.trim()) || appliedFiltersCount > 0}
              resultCount={availableVehicles.length}
              updating={isLoading || isRefreshingVehicles}
              onClear={handleClearFilters}
            />
          </div>
        </div>

        {/* Grid de Veículos */}
        <div id="stock-results">
          {isLoading ? (
            <div
              className="grid grid-cols-2 gap-3 py-4 md:gap-6 lg:grid-cols-3 lg:gap-8 xl:grid-cols-4 2xl:grid-cols-5"
              aria-label="Carregando veículos"
            >
              {Array.from({ length: 8 }).map((_, idx) => (
                <div
                  key={idx}
                  className={`h-[340px] animate-pulse rounded-[24px] p-4 sm:h-[430px] sm:rounded-[32px] ${
                    isBlackFriday ? "bg-white/10" : "bg-slate-100"
                  }`}
                />
              ))}
            </div>
          ) : availableVehicles.length === 0 && soldVehicles.length === 0 ? (
            <div data-bf-stock-empty className="mx-auto max-w-2xl space-y-4 py-10 text-center">
              <div>
                <p className="mb-2 text-lg font-semibold text-fg">
                  Nenhum veículo encontrado com essa busca
                </p>
                <p className="text-muted-foreground">
                  Ajuste os filtros ou deixe seu WhatsApp — buscamos opções parecidas no showroom pra você.
                </p>
              </div>
              {hasFilterParams && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="mx-auto block min-h-11 px-4 text-sm font-bold text-primary underline underline-offset-4"
                >
                  Limpar busca e filtros
                </button>
              )}
              <div data-bf-stock-help className="pt-2 text-left">
                <SeminovosWhatsAppHelpPanel
                  stockHelpHref={seminovosWhatsAppHref}
                  hasFilters={hasFilterParams}
                  filterSummary={filterSummaryText}
                  variant="inline"
                />
              </div>
            </div>
          ) : (
            <>
              {availableVehicles.length === 0 && soldVehicles.length > 0 && (
                <div data-bf-stock-empty className="mb-6 rounded-2xl border border-[#5cc5ca]/35 bg-[#122629] p-5 text-center text-white">
                  <p className="text-base font-bold">
                    As unidades dessa busca foram vendidas recentemente
                  </p>
                  <p className="mt-1 text-sm text-white/75">
                    Veja abaixo ou fale no WhatsApp para receber opções semelhantes que acabaram de entrar.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="min-h-10 rounded-xl border border-white/25 px-4 text-xs font-bold text-white hover:bg-white/10"
                    >
                      Ver todo o estoque
                    </button>
                    <a
                      href={seminovosWhatsAppHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-wa-source="seminovos_empty"
                      data-wa-intent="stock_help"
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#087A37] px-4 text-xs font-black text-white"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Pedir similares no WhatsApp
                    </a>
                  </div>
                </div>
              )}

              <div
                className="grid grid-cols-2 items-stretch gap-2 md:gap-6 lg:grid-cols-3 lg:gap-8 xl:grid-cols-4 xl:gap-8 2xl:grid-cols-5"
                style={{ overflow: "visible" }}
              >
                {displayVehicles.map((vehicle, index) => (
                  <Fragment key={vehicle.id}>
                    <VehicleCardStatic
                      id={vehicle.id}
                      warrantyVehicle={vehicle}
                      name={vehicle.modelo || vehicle.name}
                      price={vehicle.price || 0}
                      valor_formatado={vehicle.valor_formatado}
                      preco_com_troca={vehicle.preco_com_troca}
                      preco_com_troca_formatado={
                        vehicle.preco_com_troca_formatado
                      }
                      year={vehicle.year || new Date().getFullYear()}
                      anoFabricacao={vehicle.anoFabricacao}
                      km={vehicle.km || 0}
                      images={vehicle.images || vehicle.fotos || []}
                      imagens_site={vehicle.imagens_site}
                      marca={vehicle.marca}
                      modelo={vehicle.modelo}
                      combustivel={vehicle.combustivel}
                      cambio={vehicle.cambio}
                      potencia={vehicle.potencia}
                      pdf={vehicle.pdf}
                      pdf_url={vehicle.pdf_url}
                      diferenciais={vehicle.diferenciais}
                      delay={index}
                      fastAnimation={index >= midGridBreak}
                      showWhatsAppInterest
                      whatsAppSource="seminovos_grid"
                      whatsAppNumber={whatsAppNumber}
                      compact={stockLayout.compact}
                      blackFriday={isBlackFriday}
                      preserveShowroomPosition
                    />
                    {showMidGridBanner && index + 1 === midGridBreak && (
                      <div data-bf-stock-help className="col-span-full my-2 md:my-0">
                        <SeminovosWhatsAppHelpPanel
                          stockHelpHref={seminovosWhatsAppHref}
                          hasFilters={hasFilterParams}
                          filterSummary={filterSummaryText}
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
