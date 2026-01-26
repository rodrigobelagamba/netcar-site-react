import { useState, useMemo, useEffect, useRef } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { useVehiclesQuery } from "@/api/queries/useVehiclesQuery";
import { useAllStockDataQuery } from "@/api/queries/useStockQuery";
import { VehicleCard } from "@/design-system/components/patterns/VehicleCard";
import { AutocompleteSelect } from "@/design-system/components/ui/AutocompleteSelect";
import { ChevronDown } from "lucide-react";
import { useDefaultMetaTags } from "@/hooks/useDefaultMetaTags";
import { useSearchContext } from "@/contexts/SearchContext";
import { Localizacao } from "@/design-system/components/layout/Localizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";

type SortOption = "az" | "za" | "preco-asc" | "preco-desc";

const ITEMS_PER_PAGE = 12;

export function SeminovosPage() {
  const search = useSearch({ from: "/seminovos" });
  const navigate = useNavigate();
  
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
      cor?: string;
      categoria?: string;
    } = {};
    
    // Só adiciona campos que têm valores definidos
    if (search.marca) query.marca = search.marca;
    if (search.modelo) query.modelo = search.modelo;
    if (search.precoMin) query.precoMin = search.precoMin;
    if (search.precoMax) query.precoMax = search.precoMax;
    if (search.anoMin) query.anoMin = search.anoMin;
    if (search.anoMax) query.anoMax = search.anoMax;
    if (search.cambio) query.cambio = search.cambio;
    if (search.cor) query.cor = search.cor;
    if (search.categoria) {
      // Garante que categoria está em maiúsculas (como a API espera)
      query.categoria = search.categoria.toUpperCase();
    }
    
    // Retorna o objeto mesmo se vazio (para buscar todos os veículos)
    return query;
  }, [search.marca, search.modelo, search.precoMin, search.precoMax, search.anoMin, search.anoMax, search.cambio, search.cor, search.categoria]);
  
  const { data: vehicles, isLoading } = useVehiclesQuery(vehiclesQuery);
  const { data: stockData } = useAllStockDataQuery();
  const { searchTerm } = useSearchContext();

  useDefaultMetaTags(
    "Carros Seminovos",
    "Confira nosso estoque de seminovos. Todas as marcas, financiamento facilitado e garantia."
  );
  
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
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  
  // Ref para o elemento observado (infinite scroll)
  const observerTarget = useRef<HTMLDivElement>(null);

  // Sincroniza estados locais com parâmetros da URL quando mudam
  useEffect(() => {
    setMarca(search.marca || "");
    setAnoMin(search.anoMin || "");
    setAnoMax(search.anoMax || "");
    setPrecoMin(search.precoMin || "");
    setPrecoMax(search.precoMax || "");
  }, [search.marca, search.anoMin, search.anoMax, search.precoMin, search.precoMax]);

  // Aplica filtros
  const handleFilter = () => {
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
        cor: undefined,
        categoria: search.categoria || undefined, // Preserva categoria da URL
      },
    });
  };

  // Filtra e ordena veículos
  const filteredAndSortedVehicles = useMemo(() => {
    if (!vehicles) return [];

    let filtered = [...vehicles];

    // Filtro por categoria (fallback caso a API não filtre corretamente)
    if (search.categoria) {
      const categoriaUpper = search.categoria.toUpperCase();
      filtered = filtered.filter((vehicle) => {
        const vehicleCategoria = vehicle.categoria?.toUpperCase();
        return vehicleCategoria === categoriaUpper;
      });
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
          String(field).toLowerCase().includes(searchLower)
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
  }, [vehicles, sortBy, searchTerm, search.categoria]);

  // Anos para o dropdown (do mais recente para o mais antigo)
  const sortedYears = useMemo(() => {
    if (!years || years.length === 0) return [];
    // Converte todos para números e ordena do mais recente para o mais antigo
    return [...years]
      .map(y => typeof y === 'string' ? parseInt(y, 10) : y)
      .filter(y => !isNaN(y))
      .sort((a, b) => b - a);
  }, [years]);

  // Prepara opções para os componentes AutocompleteSelect
  const brandOptions = useMemo(() => {
    return brands.map(brand => ({ value: brand, label: brand }));
  }, [brands]);

  const yearOptions = useMemo(() => {
    return sortedYears.map(year => ({ value: String(year), label: String(year) }));
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

  // Veículos visíveis (carregamento gradual)
  const visibleVehicles = useMemo(() => {
    return filteredAndSortedVehicles.slice(0, visibleCount);
  }, [filteredAndSortedVehicles, visibleCount]);

  const hasMore = visibleCount < filteredAndSortedVehicles.length;

  // Infinite scroll com Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          setVisibleCount((prev) => Math.min(prev + ITEMS_PER_PAGE, filteredAndSortedVehicles.length));
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, isLoading, filteredAndSortedVehicles.length]);

  // Reset visible count quando filtros mudam
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [search.marca, search.precoMin, search.precoMax, search.anoMin, search.anoMax, search.categoria, sortBy, searchTerm]);

  return (
    <main className="flex-1 pt-16 overflow-x-hidden max-w-full">
      <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6">
        {/* Filtros em Card Minimalista */}
        <div className="bg-bg rounded-2xl shadow-sm p-5 mb-8">
          <div className="flex flex-wrap items-end gap-6">
            {/* Marca */}
            <div className="flex-1 min-w-[140px]">
              <label className="mb-2 block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Marca</label>
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
              <label className="mb-2 block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ano de</label>
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
              <label className="mb-2 block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ano até</label>
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
              <label className="mb-2 block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Valor de</label>
              <input
                type="text"
                value={precoMin}
                onChange={(e) => setPrecoMin(e.target.value)}
                placeholder={minPrice > 0 ? `R$ ${minPrice.toLocaleString('pt-BR')}` : "R$ 0"}
                className="w-full border-0 border-b border-border rounded-none bg-transparent px-0 py-2 text-sm text-fg placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>

            {/* Valor até */}
            <div className="flex-1 min-w-[120px]">
              <label className="mb-2 block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Valor até</label>
              <input
                type="text"
                value={precoMax}
                onChange={(e) => setPrecoMax(e.target.value)}
                placeholder={maxPrice > 0 ? `R$ ${maxPrice.toLocaleString('pt-BR')}` : "R$ 500.000"}
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-fg">Showroom</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredAndSortedVehicles.length} veículo{filteredAndSortedVehicles.length !== 1 ? "s" : ""} encontrado{filteredAndSortedVehicles.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase">Ordenar por</span>
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

        {/* Grid de Veículos */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        ) : filteredAndSortedVehicles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-fg text-lg font-semibold mb-2">Nenhum veículo encontrado</p>
            <p className="text-muted-foreground">Tente ajustar os filtros de busca.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 lg:gap-8 xl:gap-10" style={{ overflow: 'visible' }}>
              {visibleVehicles.map((vehicle, index) => (
                <VehicleCard
                  key={vehicle.id}
                  id={vehicle.id}
                  name={vehicle.modelo || vehicle.name}
                  price={vehicle.price || 0}
                  valor_formatado={vehicle.valor_formatado}
                  year={vehicle.year || new Date().getFullYear()}
                  km={vehicle.km || 0}
                  images={vehicle.images || vehicle.fotos || []}
                  marca={vehicle.marca}
                  modelo={vehicle.modelo}
                  delay={index}
                />
              ))}
            </div>
            
            {/* Elemento observado para infinite scroll */}
            {hasMore && (
              <div ref={observerTarget} className="h-20 flex items-center justify-center">
                <p className="text-muted-foreground text-sm">Carregando mais veículos...</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="w-full font-sans antialiased text-muted-foreground bg-muted py-12 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 space-y-8">
        <div className="container-main space-y-8">
          <Localizacao />
          <IanBot />
        </div>
      </div>
    </main>
  );
}
