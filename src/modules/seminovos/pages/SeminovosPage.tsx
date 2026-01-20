import { useState, useMemo, useEffect, useRef } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { useVehiclesQuery } from "@/api/queries/useVehiclesQuery";
import { useAllStockDataQuery } from "@/api/queries/useStockQuery";
import { VehicleCard } from "@/design-system/components/patterns/VehicleCard";
import { AutocompleteSelect } from "@/design-system/components/ui/AutocompleteSelect";
import { cn } from "@/lib/cn";
import { ChevronDown, Car, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useDefaultMetaTags } from "@/hooks/useDefaultMetaTags";
import { useSearchContext } from "@/contexts/SearchContext";

type SortOption = "az" | "za" | "preco-asc" | "preco-desc";

const ITEMS_PER_PAGE = 12;

export function SeminovosPage() {
  const search = useSearch({ from: "/seminovos" });
  const navigate = useNavigate();
  const { data: vehicles, isLoading } = useVehiclesQuery(search);
  const { data: stockData } = useAllStockDataQuery();
  const { searchTerm } = useSearchContext();

  useDefaultMetaTags(
    "Showroom",
    "Confira nosso estoque de seminovos com procedência. Filtre por marca, ano, preço e encontre o veículo ideal na Netcar."
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
      },
    });
  };

  // Filtra e ordena veículos
  const filteredAndSortedVehicles = useMemo(() => {
    if (!vehicles) return [];

    let filtered = [...vehicles];

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
          return (a.name || "").localeCompare(b.name || "");
        case "za":
          return (b.name || "").localeCompare(a.name || "");
        case "preco-asc":
          return (a.price || 0) - (b.price || 0);
        case "preco-desc":
          return (b.price || 0) - (a.price || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [vehicles, sortBy, searchTerm]);

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
  }, [search.marca, search.precoMin, search.precoMax, search.anoMin, search.anoMax, sortBy, searchTerm]);

  const [localSearch, setLocalSearch] = useState("");

  const quickFilters = [
    { label: "ATÉ R$ 100K", value: "100000" },
    { label: "AUTOMÁTICO", value: "automatico" },
    { label: "SUV", value: "suv" },
    { label: "PRATA", value: "prata" },
  ];

  const handleQuickSearch = (value: string) => {
    setLocalSearch(value);
  };

  const handleSearchSubmit = () => {
    if (localSearch.trim()) {
      navigate({
        to: "/seminovos",
        search: {
          ...search,
          modelo: localSearch.trim(),
        },
      });
    }
  };

  return (
    <main className="flex-1 pt-16 overflow-x-hidden max-w-full">
      {/* Barra de Busca Principal */}
      <div className="bg-gradient-to-b from-gray-50 to-white py-6">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-full shadow-lg border border-gray-100 px-4 py-2 flex items-center gap-3">
            <Car className="w-5 h-5 text-primary flex-shrink-0" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
              placeholder="Busque por marca, modelo, cor, câmbio, valor..."
              className="flex-1 bg-transparent border-none outline-none text-sm text-gray-600 placeholder:text-gray-400"
            />
            <div className="hidden md:flex items-center gap-2 text-xs text-gray-400">
              <span>EXEMPLOS:</span>
              <button
                onClick={() => handleQuickSearch("automático")}
                className="px-2 py-0.5 rounded border border-gray-200 text-gray-500 hover:border-primary hover:text-primary transition-colors"
              >
                AUTOMÁTICO
              </button>
              <button
                onClick={() => handleQuickSearch("preto")}
                className="px-2 py-0.5 rounded border border-gray-200 text-gray-500 hover:border-primary hover:text-primary transition-colors"
              >
                PRETO
              </button>
            </div>
            <button
              onClick={handleSearchSubmit}
              className="bg-fg text-white px-5 py-2 rounded-full flex items-center gap-2 text-sm font-semibold hover:bg-fg/90 transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
              BUSCAR
            </button>
          </div>

          {/* Quick Filters */}
          <div className="flex justify-center gap-3 mt-4">
            {quickFilters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => handleQuickSearch(filter.label.toLowerCase())}
                className="px-4 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-600 hover:border-primary hover:text-primary transition-colors"
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filtros em Card Minimalista */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-8">
          <div className="flex flex-wrap items-end gap-6">
            {/* Marca */}
            <div className="flex-1 min-w-[140px]">
              <label className="mb-2 block text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Marca</label>
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
              <label className="mb-2 block text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Ano de</label>
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
              <label className="mb-2 block text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Ano até</label>
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
              <label className="mb-2 block text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Valor de</label>
              <input
                type="text"
                value={precoMin}
                onChange={(e) => setPrecoMin(e.target.value)}
                placeholder={minPrice > 0 ? `R$ ${minPrice.toLocaleString('pt-BR')}` : "R$ 0"}
                className="w-full border border-gray-200 rounded-lg bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>

            {/* Valor até */}
            <div className="flex-1 min-w-[120px]">
              <label className="mb-2 block text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Valor até</label>
              <input
                type="text"
                value={precoMax}
                onChange={(e) => setPrecoMax(e.target.value)}
                placeholder={maxPrice > 0 ? `R$ ${maxPrice.toLocaleString('pt-BR')}` : "R$ 500.000"}
                className="w-full border border-gray-200 rounded-lg bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
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
            <p className="text-sm text-gray-500 mt-1">
              {filteredAndSortedVehicles.length} veículo{filteredAndSortedVehicles.length !== 1 ? "s" : ""} encontrado{filteredAndSortedVehicles.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Ordenar por</span>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="appearance-none rounded-lg border border-gray-200 bg-white px-4 py-2 pr-8 text-sm text-gray-700 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              >
                <option value="az">A &gt; Z</option>
                <option value="za">Z &gt; A</option>
                <option value="preco-asc">Menor preço</option>
                <option value="preco-desc">Maior preço</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8" style={{ overflow: 'visible' }}>
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
    </main>
  );
}
