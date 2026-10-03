import { Car, Search, X, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useVehiclesQuery } from "@/catalog/queries/useVehiclesQuery";
import { useAllStockDataQuery } from "@/catalog/queries/useStockQuery";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import { buildWhatsAppUrl, siteWhatsAppMessage } from "@/lib/whatsappMessages";
import { emptySeminovosSearch } from "@/lib/seminovos-search";
import { matchesVehicleBrand } from "@/lib/vehicleBrand";
import {
  matchesVehicleSearch,
  normalizeVehicleSearch,
  parseVehicleSearch,
} from "@/lib/vehicleSearch";

interface SearchSuggestion {
  type: string;
  text: string;
  detail: string;
  marca?: string;
  modelo?: string;
  query?: string;
}

interface SearchBarProps {
  onAction?: () => void; // Callback chamado quando buscar ou clicar em tag
}

export function SearchBar({ onAction }: SearchBarProps = {}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Obtém os search params da URL (funciona em qualquer rota)
  const searchParams = new URLSearchParams(location.searchStr);
  const search = {
    busca: searchParams.get("busca") || undefined,
    marca: searchParams.get("marca") || undefined,
    modelo: searchParams.get("modelo") || undefined,
    categoria: searchParams.get("categoria") || undefined,
    cor: searchParams.get("cor") || undefined,
    cambio: searchParams.get("cambio") || undefined,
    combustivel: searchParams.get("combustivel") || undefined,
    precoMin: searchParams.get("precoMin") || undefined,
    precoMax: searchParams.get("precoMax") || undefined,
    anoMin: searchParams.get("anoMin") || undefined,
    anoMax: searchParams.get("anoMax") || undefined,
  };

  const { data: vehicles } = useVehiclesQuery(
    { fetchAll: true },
    { enabled: isFocused, refreshImmediately: true },
  );
  const { data: stockData } = useAllStockDataQuery();
  const { data: whatsapp } = useWhatsAppQuery();

  const notFoundWhatsAppHref = useMemo(() => {
    if (!whatsapp?.numero) return "#";
    const parts: string[] = [];
    if (searchQuery.trim() || search.busca) {
      parts.push(`busca por ${searchQuery.trim() || search.busca}`);
    }
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
    const body = parts.length
      ? `não achei o carro que quero. Pode me ajudar com: ${parts.join(", ")}?`
      : "não achei o carro que quero. Pode me enviar opções parecidas?";
    return buildWhatsAppUrl(whatsapp.numero, siteWhatsAppMessage(body));
  }, [
    whatsapp?.numero,
    searchQuery,
    search.busca,
    search.marca,
    search.modelo,
    search.categoria,
    search.cambio,
    search.combustivel,
    search.cor,
    search.precoMin,
    search.precoMax,
  ]);

  // Gera sugestões baseadas na query
  const filteredSuggestions = useMemo<SearchSuggestion[]>(() => {
    const query = searchQuery.trim();
    if (!query) return [];

    const lowerQuery = normalizeVehicleSearch(query);
    const parsedQuery = parseVehicleSearch(query);
    const suggestions: SearchSuggestion[] = [
      {
        type: "Busca",
        text: `Buscar “${query}”`,
        detail:
          parsedQuery.labels?.join(" · ") ||
          "Ver todos os carros que correspondem à sua busca",
        query,
      },
    ];

    // 1. Busca por marca/modelo nos veículos
    if (vehicles && vehicles.length > 0) {
      const vehicleMatches = vehicles
        .filter((vehicle) => matchesVehicleSearch(vehicle, parsedQuery))
        .slice(0, 5)
        .map((vehicle) => ({
          type: "Veículo",
          text: `${vehicle.marca || ""} ${vehicle.modelo || vehicle.name || ""}`.trim(),
          detail: vehicle.year?.toString() || "",
          marca: vehicle.marca,
          modelo: vehicle.modelo || vehicle.name,
        }));
      suggestions.push(...vehicleMatches);
    }

    // 2. Busca por atributos (marcas, cores, câmbios, combustíveis)
    if (stockData) {
      const brands = stockData.enterprises || [];
      const colors = stockData.colors || [];
      const transmissions = stockData.transmissions || [];
      const fuels = stockData.fuels || [];

      // Marcas
      brands.forEach((brand) => {
        if (brand && matchesVehicleBrand(brand, query)) {
          suggestions.push({
            type: "Filtro",
            text: brand,
            detail: "Marca",
          });
        }
      });

      // Cores
      colors.forEach((color) => {
        if (color && normalizeVehicleSearch(color).includes(lowerQuery)) {
          suggestions.push({
            type: "Filtro",
            text: color,
            detail: "Cor",
          });
        }
      });

      // Câmbios
      transmissions.forEach((transmission) => {
        if (
          transmission &&
          normalizeVehicleSearch(transmission).includes(lowerQuery)
        ) {
          suggestions.push({
            type: "Filtro",
            text: transmission,
            detail: "Câmbio",
          });
        }
      });

      // Combustíveis
      fuels.forEach((fuel) => {
        if (fuel && normalizeVehicleSearch(fuel).includes(lowerQuery)) {
          suggestions.push({
            type: "Filtro",
            text: fuel,
            detail: "Combustível",
          });
        }
      });
    }

    // Remove duplicatas e limita a 6 sugestões
    const uniqueSuggestions = suggestions.filter(
      (suggestion, index, self) =>
        index ===
        self.findIndex(
          (s) => s.text === suggestion.text && s.type === suggestion.type,
        ),
    );

    return uniqueSuggestions.slice(0, 6);
  }, [searchQuery, vehicles, stockData]);

  // Formata os filtros ativos para exibição
  const activeFiltersText = useMemo(() => {
    const filters: string[] = [];

    if (search?.busca) {
      filters.push(`Busca: ${search.busca}`);
    }
    if (search?.marca) {
      filters.push(`Marca: ${search.marca}`);
    }
    if (search?.modelo) {
      filters.push(`Modelo: ${search.modelo}`);
    }
    if (search?.categoria) {
      filters.push(`Categoria: ${search.categoria}`);
    }
    if (search?.cor) {
      filters.push(`Cor: ${search.cor}`);
    }
    if (search?.cambio) {
      filters.push(`Câmbio: ${search.cambio}`);
    }
    if (search?.combustivel) {
      filters.push("Combustível: " + search.combustivel);
    }
    if (search?.precoMin) {
      filters.push(
        `Preço min: R$ ${parseInt(search.precoMin).toLocaleString("pt-BR")}`,
      );
    }
    if (search?.precoMax) {
      filters.push(
        `Preço max: R$ ${parseInt(search.precoMax).toLocaleString("pt-BR")}`,
      );
    }
    if (search?.anoMin) {
      filters.push(`Ano min: ${search.anoMin}`);
    }
    if (search?.anoMax) {
      filters.push(`Ano max: ${search.anoMax}`);
    }

    return filters.length > 0 ? filters.join(" • ") : "";
  }, [search]);

  // Limpa todos os filtros
  const handleClearFilters = () => {
    navigate({
      to: "/seminovos",
      search: {
        ...emptySeminovosSearch,
      },
    });
    setSearchQuery("");
    onAction?.();
  };

  // Verifica se há filtros ativos
  const hasActiveFilters = useMemo(() => {
    return !!(
      search?.busca ||
      search?.marca ||
      search?.modelo ||
      search?.categoria ||
      search?.cor ||
      search?.cambio ||
      search?.combustivel ||
      search?.precoMin ||
      search?.precoMax ||
      search?.anoMin ||
      search?.anoMax
    );
  }, [search]);

  // A mesma consulta é interpretada na home, na lupa e no estoque.
  // Passar o texto explicitamente evita ler um estado antigo ao clicar na sugestão.
  const handleSearch = (value = searchQuery) => {
    const query = value.trim();
    if (!query) return;
    navigate({
      to: "/seminovos",
      search: { ...emptySeminovosSearch, busca: query },
    });
    setIsFocused(false);
    onAction?.();
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    if (suggestion.query) {
      handleSearch(suggestion.query);
      return;
    }

    const filters: Partial<
      Record<
        "busca" | "marca" | "modelo" | "cor" | "cambio" | "combustivel",
        string
      >
    > = {};
    if (
      suggestion.type === "Veículo" &&
      suggestion.marca &&
      suggestion.modelo
    ) {
      filters.marca = suggestion.marca;
      filters.modelo = suggestion.modelo;
      filters.busca = searchQuery.trim();
    } else if (suggestion.detail === "Marca") {
      filters.marca = suggestion.text;
    } else if (suggestion.detail === "Cor") {
      filters.cor = suggestion.text;
    } else if (suggestion.detail === "Câmbio") {
      filters.cambio = suggestion.text;
    } else if (suggestion.detail === "Combustível") {
      filters.combustivel = suggestion.text;
    } else {
      handleSearch(suggestion.text);
      return;
    }

    navigate({
      to: "/seminovos",
      search: { ...emptySeminovosSearch, ...filters },
    });
    setIsFocused(false);
    onAction?.();
  };

  const handleQuickFilterClick = (filterValue: string) => {
    handleSearch(filterValue);
  };

  const quickFilters = ["Até R$ 100k", "Automático", "SUV", "Prata"];

  return (
    <section className="relative z-30 pt-2 md:pt-12 container mx-auto px-4 pb-2 md:pb-0 py-2">
      {/* Quick Filters - Apenas Mobile, acima da barra de busca */}
      <div className="md:hidden flex flex-wrap justify-center gap-3 mb-3">
        {quickFilters.map((filter) => {
          const className =
            "px-4 py-2 rounded-full bg-white/50 backdrop-blur-sm border border-gray-100 text-[11px] font-bold uppercase tracking-widest text-[#365565] hover:bg-primary hover:text-white hover:border-primary transition-all duration-300 active:scale-95";
          if (filter === "Até R$ 100k") {
            return (
              <Link
                key={filter}
                to="/comprar-{$landingSlug}"
                params={{ landingSlug: "carros-ate-100-mil" }}
                onClick={onAction}
                className={className}
              >
                {filter}
              </Link>
            );
          }
          if (filter === "Automático") {
            return (
              <Link
                key={filter}
                to="/seminovos-automaticos"
                onClick={onAction}
                className={className}
              >
                {filter}
              </Link>
            );
          }
          if (filter === "SUV") {
            return (
              <Link
                key={filter}
                to="/comprar-{$landingSlug}"
                params={{ landingSlug: "suv" }}
                onClick={onAction}
                className={className}
              >
                {filter}
              </Link>
            );
          }
          return (
            <button
              key={filter}
              type="button"
              onClick={() => handleQuickFilterClick(filter)}
              className={className}
            >
              {filter}
            </button>
          );
        })}
      </div>

      <div className="bg-white/80 backdrop-blur-2xl rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] p-3 md:p-4 border border-white/50 max-w-5xl mx-auto flex flex-col md:flex-row gap-2 items-center relative">
        <div className="relative flex-1 w-full group">
          <div
            className="absolute left-6 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-secondary z-10"
            style={{ color: "rgba(0, 40, 60, 0.3)" }}
          >
            <Car className="w-6 h-6" />
          </div>

          {/* Mostra filtros ativos quando não está focado e não há texto digitado */}
          {!isFocused && !searchQuery && hasActiveFilters && (
            <div className="absolute left-16 right-12 top-1/2 -translate-y-1/2 text-sm text-primary/60 truncate pointer-events-none">
              {activeFiltersText}
            </div>
          )}

          <input
            type="text"
            role="searchbox"
            aria-label="Buscar carros"
            maxLength={120}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              } else if (e.key === "Escape") {
                setIsFocused(false);
              }
            }}
            placeholder={
              hasActiveFilters && !isFocused
                ? ""
                : "Ex.: hatch automático até 100 mil"
            }
            className={`w-full bg-gray-50/50 border-none rounded-2xl py-6 pl-16 text-lg font-medium placeholder:text-primary/20 focus:ring-2 transition-all outline-none ${
              hasActiveFilters && !isFocused && !searchQuery
                ? "pr-20"
                : "pr-6 md:pr-16"
            }`}
            style={
              {
                "--tw-ring-color": "rgba(92, 210, 157, 0.2)",
              } as React.CSSProperties & { "--tw-ring-color": string }
            }
          />

          {/* Botão para limpar filtros */}
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-gray-200/50 transition-colors z-10"
              aria-label="Limpar filtros"
              title="Limpar filtros"
            >
              <X className="w-5 h-5 text-primary/60 hover:text-primary" />
            </button>
          )}

          {/* Live Search Results Dropdown */}
          <AnimatePresence>
            {isFocused &&
              searchQuery.length > 0 &&
              filteredSuggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 py-2"
                >
                  <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-50 mb-1">
                    Sugestões Inteligentes
                  </div>
                  {filteredSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      className="w-full text-left px-6 py-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between gap-3 group transition-colors"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            suggestion.type === "Veículo"
                              ? "bg-primary/10"
                              : "bg-secondary/20"
                          }`}
                          style={{
                            color:
                              suggestion.type === "Veículo"
                                ? "#00283C"
                                : "#5CD29D",
                          }}
                        >
                          {suggestion.type === "Veículo" ? (
                            <Car className="w-4 h-4" />
                          ) : (
                            <Search className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <span
                            className="text-gray-700 font-bold block transition-colors"
                            style={{ color: "#374151" }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = "#00283C";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = "#374151";
                            }}
                          >
                            {suggestion.text}
                          </span>
                          <span className="text-xs text-gray-400 font-medium">
                            {suggestion.detail}
                          </span>
                        </div>
                      </div>
                      <div
                        className="text-[10px] font-bold uppercase tracking-wider transition-colors"
                        style={{ color: "#D1D5DB" }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "#5CD29D";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "#D1D5DB";
                        }}
                      >
                        {suggestion.type}
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
          </AnimatePresence>
        </div>
      </div>

      {/* Quick Filters - Desktop, abaixo da barra de busca */}
      <div className="hidden md:flex flex-wrap justify-center gap-3 mt-6">
        {quickFilters.map((filter) => (
          <button
            key={filter}
            onClick={() => handleQuickFilterClick(filter)}
            className="px-4 py-2 rounded-full bg-white/50 backdrop-blur-sm border border-gray-100 text-[11px] font-bold uppercase tracking-widest text-[#365565] hover:bg-primary hover:text-white hover:border-primary transition-all duration-300 active:scale-95"
          >
            {filter}
          </button>
        ))}
      </div>

      {/* CTA "Não achou? WhatsApp" — aparece quando busca/filtros ativos */}
      {(searchQuery || hasActiveFilters) && (
        <div className="mt-4 flex justify-center">
          <a
            href={notFoundWhatsAppHref}
            target="_blank"
            rel="noopener noreferrer"
            data-wa-source="searchbar_notfound"
            data-wa-intent="similar_options"
            className="inline-flex items-center gap-2 rounded-full bg-[#087A37] px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-colors hover:bg-[#075E54]"
          >
            <MessageCircle className="h-4 w-4" />
            Não achou? Receba opções no WhatsApp
          </a>
        </div>
      )}
    </section>
  );
}
