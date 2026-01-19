import { useState, useMemo, useEffect, useRef } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { useVehiclesQuery } from "@/api/queries/useVehiclesQuery";
import { useAllStockDataQuery } from "@/api/queries/useStockQuery";
import { VehicleCard } from "@/design-system/components/patterns/VehicleCard";
import { AutocompleteSelect } from "@/design-system/components/ui/AutocompleteSelect";
import { cn } from "@/lib/cn";
import { ChevronDown } from "lucide-react";
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

  return (
    <main className="flex-1 pt-16 overflow-x-hidden max-w-full">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filtros Horizontais */}
        <div className="mb-6 pb-6">
          <h2 className="text-sm font-semibold text-muted-foreground mb-4 uppercase">Filtros</h2>
          <div className="flex flex-wrap items-end gap-4">
            {/* Marca */}
            <div className="flex-1 min-w-[150px]">
              <AutocompleteSelect
                options={brandOptions}
                value={marca}
                onChange={setMarca}
                placeholder="SELECIONE"
                label="Marca:"
              />
            </div>

            {/* Ano mínimo */}
            <div className="flex-1 min-w-[150px]">
              <AutocompleteSelect
                options={yearOptions}
                value={anoMin}
                onChange={setAnoMin}
                placeholder="SELECIONE"
                label="Ano mínimo:"
              />
            </div>

            {/* Ano máximo */}
            <div className="flex-1 min-w-[150px]">
              <AutocompleteSelect
                options={yearOptions}
                value={anoMax}
                onChange={setAnoMax}
                placeholder="SELECIONE"
                label="Ano até:"
              />
            </div>

            {/* Valor de */}
            <div className="flex-1 min-w-[150px]">
              <label className="mb-1 block text-xs font-medium text-fg uppercase">Valor de:</label>
              <input
                type="number"
                value={precoMin}
                onChange={(e) => setPrecoMin(e.target.value)}
                placeholder={minPrice > 0 ? `R$ ${minPrice.toLocaleString('pt-BR')}` : "DIGITE"}
                min={minPrice}
                max={maxPrice}
                className={cn(
                  "w-full border-0 border-b border-border bg-transparent px-0 py-2",
                  "text-sm text-fg placeholder:text-muted-foreground",
                  "focus:outline-none focus:border-primary"
                )}
              />
            </div>

            {/* Valor até */}
            <div className="flex-1 min-w-[150px]">
              <label className="mb-1 block text-xs font-medium text-fg uppercase">Valor até:</label>
              <input
                type="number"
                value={precoMax}
                onChange={(e) => setPrecoMax(e.target.value)}
                placeholder={maxPrice > 0 ? `R$ ${maxPrice.toLocaleString('pt-BR')}` : "DIGITE"}
                min={minPrice}
                max={maxPrice}
                className={cn(
                  "w-full border-0 border-b border-border bg-transparent px-0 py-2",
                  "text-sm text-fg placeholder:text-muted-foreground",
                  "focus:outline-none focus:border-primary"
                )}
              />
            </div>

            {/* Botão Filtrar */}
            <button
              onClick={handleFilter}
              className={cn(
                "px-6 py-2.5 rounded-lg bg-fg text-white",
                "text-sm font-semibold uppercase",
                "hover:bg-fg/90 transition-all duration-200 hover:shadow-md",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              )}
            >
              Filtrar
            </button>
          </div>
          
          {/* Linha animada abaixo dos filtros */}
          <motion.div
            className="h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent mt-6"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>

        {/* Título */}
        <h1 className="text-3xl md:text-4xl font-bold text-fg mb-6">Showroom</h1>

        {/* Ordenação */}
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            {filteredAndSortedVehicles.length} veículo{filteredAndSortedVehicles.length !== 1 ? "s" : ""} encontrado{filteredAndSortedVehicles.length !== 1 ? "s" : ""}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-fg">Ordenar por</span>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className={cn(
                  "appearance-none rounded-md border border-border bg-bg px-4 py-2 pr-8",
                  "text-sm text-fg",
                  "focus:outline-none focus:ring-2 focus:ring-primary"
                )}
              >
                <option value="az">A &gt; Z</option>
                <option value="za">Z &gt; A</option>
                <option value="preco-asc">Preço menor para maior</option>
                <option value="preco-desc">Preço maior para menor</option>
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
            <div className="grid grid-cols-1 gap-y-32 gap-x-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 pt-32" style={{ overflow: 'visible' }}>
              {visibleVehicles.map((vehicle) => (
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
