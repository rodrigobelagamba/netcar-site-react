import {
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  Fragment,
  lazy,
  Suspense,
} from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { useVehiclesQuery } from "@/catalog/queries/useVehiclesQuery";
import { useAllStockDataQuery } from "@/catalog/queries/useStockQuery";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import { VehicleCardStatic } from "@/design-system/components/patterns/VehicleCard";
import { AutocompleteSelect } from "@/design-system/components/ui/AutocompleteSelect";
import { ChevronDown, Filter, MessageCircle } from "lucide-react";
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
import { SeminovosWhatsAppHelpPanel } from "../components/SeminovosWhatsAppHelpPanel";

type SortOption = "az" | "za" | "preco-asc" | "preco-desc";
const SearchBar = lazy(() =>
  import("@/design-system/components/patterns/SearchBar").then((module) => ({
    default: module.SearchBar,
  })),
);

type StockLayout = {
  compact: boolean;
  columns: number;
};

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
    } = { fetchAll: true };

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
    "Carros Seminovos à Venda em Esteio/RS",
    "Confira o estoque de seminovos da Netcar em Esteio. Filtre por marca, modelo, ano e preço. Vistoriados e com garantia.",
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
  const years = stockData?.years || [];
  const priceRanges = stockData?.prices || [];

  // Estados dos filtros
  const [marca, setMarca] = useState(search.marca || "");
  const [anoMin, setAnoMin] = useState(search.anoMin || "");
  const [anoMax, setAnoMax] = useState(search.anoMax || "");
  const [precoMin, setPrecoMin] = useState(search.precoMin || "");
  const [precoMax, setPrecoMax] = useState(search.precoMax || "");
  const [sortBy, setSortBy] = useState<SortOption>("az");
  const [isSearchBarVisible, setIsSearchBarVisible] = useState(false);

  // Sincroniza estados locais com parâmetros da URL quando mudam
  useEffect(() => {
    setMarca(search.marca || "");
    setAnoMin(search.anoMin || "");
    setAnoMax(search.anoMax || "");
    setPrecoMin(search.precoMin || "");
    setPrecoMax(search.precoMax || "");
  }, [
    search.marca,
    search.anoMin,
    search.anoMax,
    search.precoMin,
    search.precoMax,
  ]);

  // Aplica filtros
  const handleFilter = () => {
    trackStockFilterApply({
      filters: {
        marca: marca || undefined,
        anoMin: anoMin || undefined,
        anoMax: anoMax || undefined,
        precoMin: precoMin || undefined,
        precoMax: precoMax || undefined,
        categoria: search.categoria || undefined,
        combustivel: search.combustivel || undefined,
      },
      resultCount: filteredAndSortedVehicles.length,
    });
    navigate({
      to: "/seminovos",
      search: {
        marca: marca || undefined,
        modelo: undefined,
        precoMin: precoMin || undefined,
        precoMax: precoMax || undefined,
        anoMin: anoMin || undefined,
        anoMax: anoMax || undefined,
        cambio: undefined,
        combustivel: search.combustivel || undefined,
        cor: undefined,
        categoria: search.categoria || undefined, // Preserva categoria da URL
      },
    });
  };

  // Limpa todos os filtros
  const handleClearFilters = () => {
    setMarca("");
    setAnoMin("");
    setAnoMax("");
    setPrecoMin("");
    setPrecoMax("");
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
        categoria: search.categoria || undefined, // Preserva categoria da URL
      },
    });
  };

  // Conta quantos filtros estão ativos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (marca) count++;
    if (anoMin) count++;
    if (anoMax) count++;
    if (precoMin) count++;
    if (precoMax) count++;
    if (search.combustivel) count++;
    return count;
  }, [marca, anoMin, anoMax, precoMin, precoMax, search.combustivel]);

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

    // Ordenação
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "az":
          // Ordena por modelo (A-Z)
          const modeloA = (a.modelo || a.name || "").toLowerCase();
          const modeloB = (b.modelo || b.name || "").toLowerCase();
          return modeloA.localeCompare(modeloB);
        case "za":
          // Ordena por modelo (Z-A)
          const modeloZA = (a.modelo || a.name || "").toLowerCase();
          const modeloZB = (b.modelo || b.name || "").toLowerCase();
          return modeloZB.localeCompare(modeloZA);
        case "preco-asc":
          return (a.price || 0) - (b.price || 0);
        case "preco-desc":
          return (b.price || 0) - (a.price || 0);
        default:
          // Por padrão, ordena alfabeticamente por modelo (A-Z)
          const defaultModeloA = (a.modelo || a.name || "").toLowerCase();
          const defaultModeloB = (b.modelo || b.name || "").toLowerCase();
          return defaultModeloA.localeCompare(defaultModeloB);
      }
    });

    return filtered;
  }, [vehicles, sortBy, searchTerm, search.categoria, search.combustivel]);

  const visibleVehicles = filteredAndSortedVehicles;

  // Banner WA depois de 3 linhas no mobile e 2 linhas no desktop.
  const midGridBreak = stockLayout.compact ? 6 : stockLayout.columns * 2;
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
    return brands.map((brand) => ({ value: brand, label: brand }));
  }, [brands]);

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
        `quero help pra achar um seminovo com: ${parts.join(", ")}.`,
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
      {/* SearchBar - Fixada logo abaixo do Header, apenas Mobile, controlada por estado */}
      {isSearchBarVisible && (
        <div className="md:hidden fixed top-16 left-0 right-0 z-40 bg-white border-b border-gray-200 shadow-lg">
          <Suspense fallback={null}>
            <SearchBar onAction={() => setIsSearchBarVisible(false)} />
          </Suspense>
        </div>
      )}

      {/* Espaçamento para compensar Header (64px) + SearchBar fixa (~180px) no mobile, apenas quando visível */}
      {isSearchBarVisible && <div className="md:hidden h-[244px]"></div>}

      {/* Botão Filtrar Fixo - Apenas Mobile */}
      <div className="md:hidden fixed bottom-6 left-4 z-[51]">
        <button
          onClick={() => setIsSearchBarVisible(!isSearchBarVisible)}
          className="px-5 py-3.5 rounded-full bg-fg text-white shadow-lg hover:bg-fg/90 transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 font-semibold"
          style={{ backgroundColor: "#00283C" }}
          aria-label="Filtrar"
        >
          <Filter className="w-5 h-5" />
          <span>Filtrar</span>
        </button>
      </div>

      <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6">
        {/* Filtros em Card Minimalista - Desktop */}
        <div className="hidden md:block bg-bg rounded-2xl shadow-sm p-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-fg">Filtros</h2>
            <button
              onClick={handleClearFilters}
              disabled={activeFiltersCount === 0}
              className={`text-xs font-medium uppercase tracking-wider transition-colors ${
                activeFiltersCount > 0
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
              <label className="mb-2 block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
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

            {/* Ano mínimo */}
            <div className="flex-1 min-w-[120px]">
              <label className="mb-2 block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
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
              <label className="mb-2 block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
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
              <label className="mb-2 block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
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
              <label className="mb-2 block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-fg">Seminovos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredAndSortedVehicles.length} veículo
              {filteredAndSortedVehicles.length !== 1 ? "s" : ""} encontrado
              {filteredAndSortedVehicles.length !== 1 ? "s" : ""}
            </p>
          </div>
          {/* Ordenação - Ocultar no mobile (está no modal) */}
          <div className="hidden md:flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase">
              Ordenar por
            </span>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="appearance-none rounded-lg border-0 bg-surface px-4 py-2 pr-8 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-primary/20"
              >
                <option value="az">A &gt; Z</option>
                <option value="za">Z &gt; A</option>
                <option value="preco-asc">Menor preço</option>
                <option value="preco-desc">Maior preço</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>

        <SeminovosWhatsAppHelpPanel
          stockHelpHref={seminovosWhatsAppHref}
          hasFilters={hasFilterParams}
          variant="banner"
        />

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
                    delay={index}
                    fastAnimation={index >= midGridBreak}
                    eagerImage
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
