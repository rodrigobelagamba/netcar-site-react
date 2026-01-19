import { Car, ArrowRight, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/design-system/components/ui/button";
import { useVehiclesQuery } from "@/api/queries/useVehiclesQuery";
import { useAllStockDataQuery } from "@/api/queries/useStockQuery";

interface SearchSuggestion {
  type: string;
  text: string;
  detail: string;
}

export function SearchBar() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const navigate = useNavigate();
  const { data: vehicles } = useVehiclesQuery();
  const { data: stockData } = useAllStockDataQuery();

  // Gera sugestões baseadas na query
  const filteredSuggestions = useMemo<SearchSuggestion[]>(() => {
    if (!searchQuery || searchQuery.length === 0) return [];
    
    const lowerQuery = searchQuery.toLowerCase();
    const suggestions: SearchSuggestion[] = [];

    // 1. Busca por marca/modelo nos veículos
    if (vehicles && vehicles.length > 0) {
      const vehicleMatches = vehicles
        .filter(vehicle => {
          const marca = vehicle.marca?.toLowerCase() || "";
          const modelo = vehicle.modelo?.toLowerCase() || "";
          const name = vehicle.name?.toLowerCase() || "";
          return marca.includes(lowerQuery) || modelo.includes(lowerQuery) || name.includes(lowerQuery);
        })
        .slice(0, 3)
        .map(vehicle => ({
          type: "Veículo",
          text: `${vehicle.marca || ""} ${vehicle.modelo || vehicle.name || ""}`.trim(),
          detail: vehicle.year?.toString() || "",
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
      brands.forEach(brand => {
        if (brand && brand.toLowerCase().includes(lowerQuery)) {
          suggestions.push({
            type: "Filtro",
            text: brand,
            detail: "Marca",
          });
        }
      });

      // Cores
      colors.forEach(color => {
        if (color && color.toLowerCase().includes(lowerQuery)) {
          suggestions.push({
            type: "Filtro",
            text: color,
            detail: "Cor",
          });
        }
      });

      // Câmbios
      transmissions.forEach(transmission => {
        if (transmission && transmission.toLowerCase().includes(lowerQuery)) {
          suggestions.push({
            type: "Filtro",
            text: transmission,
            detail: "Câmbio",
          });
        }
      });

      // Combustíveis
      fuels.forEach(fuel => {
        if (fuel && fuel.toLowerCase().includes(lowerQuery)) {
          suggestions.push({
            type: "Filtro",
            text: fuel,
            detail: "Combustível",
          });
        }
      });
    }

    // 3. Faixa de preço
    const priceRegex = /(?:até|menor que|abaixo de|acima de|maior que|entre)\s*(?:r\$\s*)?(\d+)(?:k|mil)?/i;
    const priceMatch = lowerQuery.match(priceRegex);
    if (priceMatch) {
      let value = parseInt(priceMatch[1]);
      if (isNaN(value)) return suggestions;
      
      if (lowerQuery.includes('k') || lowerQuery.includes('mil') || value < 1000) {
        value *= 1000;
      }
      
      if (lowerQuery.includes('até') || lowerQuery.includes('menor') || lowerQuery.includes('abaixo')) {
        suggestions.push({
          type: "Filtro",
          text: `Até R$ ${value.toLocaleString('pt-BR')}`,
          detail: "Faixa de Preço",
        });
      } else if (lowerQuery.includes('maior') || lowerQuery.includes('acima')) {
        suggestions.push({
          type: "Filtro",
          text: `Acima de R$ ${value.toLocaleString('pt-BR')}`,
          detail: "Faixa de Preço",
        });
      }
    }

    // Remove duplicatas e limita a 6 sugestões
    const uniqueSuggestions = suggestions.filter((suggestion, index, self) =>
      index === self.findIndex(s => s.text === suggestion.text && s.type === suggestion.type)
    );

    return uniqueSuggestions.slice(0, 6);
  }, [searchQuery, vehicles, stockData]);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;

    const query = searchQuery.trim().toLowerCase();
    const searchParams: Record<string, string | number | undefined> = {};

    // Detecta faixa de preço
    const priceRegex = /(?:até|menor que|abaixo de|acima de|maior que|entre)\s*(?:r\$\s*)?(\d+)(?:k|mil)?/i;
    const priceMatch = query.match(priceRegex);
    if (priceMatch) {
      let value = parseInt(priceMatch[1]);
      if (!isNaN(value)) {
        if (query.includes('k') || query.includes('mil') || value < 1000) {
          value *= 1000;
        }
        
        if (query.includes('até') || query.includes('menor') || query.includes('abaixo')) {
          searchParams.precoMax = value;
        } else if (query.includes('maior') || query.includes('acima')) {
          searchParams.precoMin = value;
        }
      }
    }

    // Detecta marca (verifica se corresponde a alguma marca conhecida)
    if (stockData?.enterprises) {
      const matchedBrand = stockData.enterprises.find(brand => 
        brand && (brand.toLowerCase().includes(query) || query.includes(brand.toLowerCase()))
      );
      if (matchedBrand) {
        searchParams.marca = matchedBrand;
      } else {
        // Se não encontrou marca exata, usa como busca geral
        searchParams.marca = searchQuery.trim();
      }
    } else {
      searchParams.marca = searchQuery.trim();
    }

    // Detecta cor
    if (stockData?.colors) {
      const matchedColor = stockData.colors.find(color => 
        color && (color.toLowerCase().includes(query) || query.includes(color.toLowerCase()))
      );
      if (matchedColor) {
        searchParams.cor = matchedColor;
      }
    }

    // Detecta câmbio
    if (stockData?.transmissions) {
      const matchedTransmission = stockData.transmissions.find(trans => 
        trans && (trans.toLowerCase().includes(query) || query.includes(trans.toLowerCase()))
      );
      if (matchedTransmission) {
        searchParams.cambio = matchedTransmission;
      }
    }

    // Navega para a página de seminovos com os filtros
    navigate({
      to: "/seminovos",
      search: searchParams,
    });
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    // Remove prefixos como "Filtro: " ou "Cor: "
    const cleanText = suggestion.text.replace(/.*: /, '');
    setSearchQuery(cleanText);
  };

  const quickFilters = [
    "Até R$ 100k",
    "Automático",
    "SUV",
    "Prata",
  ];

  return (
    <section className="relative z-30 pt-12 container mx-auto px-4">
      <div className="bg-white/80 backdrop-blur-2xl rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] p-3 md:p-4 border border-white/50 max-w-5xl mx-auto flex flex-col md:flex-row gap-2 items-center relative">
        <div className="relative flex-1 w-full group">
          <div className="absolute left-6 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-secondary" style={{ color: 'rgba(0, 40, 60, 0.3)' }}>
            <Car className="w-6 h-6" />
          </div>
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
            placeholder="Busque por marca, modelo, cor, câmbio, valor..."
            className="w-full bg-gray-50/50 border-none rounded-2xl py-6 pl-16 pr-6 md:pr-64 text-lg font-medium placeholder:text-primary/20 focus:ring-2 transition-all outline-none"
            style={{ 
              '--tw-ring-color': 'rgba(92, 210, 157, 0.2)',
            } as React.CSSProperties & { '--tw-ring-color': string }}
          />
          <div className="absolute right-6 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-2 pointer-events-none">
            <span className="text-[10px] font-bold uppercase tracking-widest mr-2" style={{ color: 'rgba(0, 40, 60, 0.2)' }}>Exemplos:</span>
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: 'rgba(0, 40, 60, 0.05)', color: 'rgba(0, 40, 60, 0.4)' }}>AUTOMÁTICO</span>
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: 'rgba(0, 40, 60, 0.05)', color: 'rgba(0, 40, 60, 0.4)' }}>PRETO</span>
          </div>

          {/* Live Search Results Dropdown */}
          <AnimatePresence>
            {isFocused && searchQuery.length > 0 && filteredSuggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 py-2"
              >
                <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-50 mb-1">Sugestões Inteligentes</div>
                {filteredSuggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="px-6 py-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between gap-3 group transition-colors"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          suggestion.type === 'Veículo' 
                            ? 'bg-primary/10' 
                            : 'bg-secondary/20'
                        }`}
                        style={{ 
                          color: suggestion.type === 'Veículo' ? '#00283C' : '#5CD29D' 
                        }}
                      >
                        {suggestion.type === 'Veículo' ? (
                          <Car className="w-4 h-4" />
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <span 
                          className="text-gray-700 font-bold block transition-colors"
                          style={{ color: '#374151' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#00283C';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#374151';
                          }}
                        >
                          {suggestion.text}
                        </span>
                        <span className="text-xs text-gray-400 font-medium">{suggestion.detail}</span>
                      </div>
                    </div>
                    <div 
                      className="text-[10px] font-bold uppercase tracking-wider transition-colors"
                      style={{ color: '#D1D5DB' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#5CD29D';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#D1D5DB';
                      }}
                    >
                      {suggestion.type}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <Button 
          onClick={handleSearch}
          className="w-full md:w-auto md:px-12 h-[72px] text-white font-black hover:bg-primary/90 rounded-2xl flex items-center gap-3 transition-all active:scale-95 shadow-lg"
          style={{ 
            backgroundColor: '#00283C',
            boxShadow: '0 10px 15px -3px rgba(0, 40, 60, 0.2)',
          }}
        >
          <ArrowRight className="w-5 h-5" />
          BUSCAR
        </Button>
      </div>
      
      {/* Quick Filters */}
      <div className="flex flex-wrap justify-center gap-3 mt-6">
        {quickFilters.map((filter) => (
          <button 
            key={filter} 
            onClick={() => setSearchQuery(filter)}
            className="px-4 py-2 rounded-full bg-white/50 backdrop-blur-sm border border-gray-100 text-[11px] font-bold uppercase tracking-widest text-primary/60 hover:bg-primary hover:text-white hover:border-primary transition-all duration-300 active:scale-95"
            style={{ color: 'rgba(0, 40, 60, 0.6)' }}
          >
            {filter}
          </button>
        ))}
      </div>
    </section>
  );
}

