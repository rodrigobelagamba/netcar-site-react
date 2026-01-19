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

    // 3. Faixa de preço - usa a mesma lógica de parsing
    const parsePriceForSuggestions = (input: string): number | null => {
      if (!input) return null;
      const cleaned = input.toLowerCase().trim();
      const patterns = [
        /(\d+)\s*(?:k|mil|milh[oõ]es?)/i,
        /(\d{1,3}(?:\.\d{3})*)/,
        /(\d{4,})/,
        /(\d{1,3})/,
      ];
      for (const pattern of patterns) {
        const match = cleaned.match(pattern);
        if (match) {
          let value = parseInt(match[1].replace(/\./g, ''));
          if (!isNaN(value)) {
            if (cleaned.includes('k') || cleaned.includes('mil')) {
              value *= 1000;
            } else if (match[1].includes('.') || match[1].length >= 4) {
              // Já está correto
            } else if (value > 50 && value < 1000) {
              value *= 1000;
            }
            return value;
          }
        }
      }
      return null;
    };

    const pricePatterns = [
      /(?:até|menor\s+que|abaixo\s+de|até\s+r\$\s*)\s*(?:r\$\s*)?(.+?)(?:\s|$)/i,
      /(?:acima\s+de|maior\s+que|mais\s+de)\s*(?:r\$\s*)?(.+?)(?:\s|$)/i,
      /^(?:r\$\s*)?(.+?)(?:\s*(?:k|mil|milh[oõ]es?))$/i,
      /^(\d{4,})$/,
    ];

    for (const pattern of pricePatterns) {
      const match = lowerQuery.match(pattern);
      if (match) {
        const valueStr = match[1] || match[0];
        const priceValue = parsePriceForSuggestions(valueStr);
        if (priceValue !== null) {
          if (lowerQuery.includes('até') || lowerQuery.includes('menor') || lowerQuery.includes('abaixo')) {
            suggestions.push({
              type: "Filtro",
              text: `Até R$ ${priceValue.toLocaleString('pt-BR')}`,
              detail: "Faixa de Preço",
            });
          } else if (lowerQuery.includes('maior') || lowerQuery.includes('acima')) {
            suggestions.push({
              type: "Filtro",
              text: `Acima de R$ ${priceValue.toLocaleString('pt-BR')}`,
              detail: "Faixa de Preço",
            });
          } else {
            suggestions.push({
              type: "Filtro",
              text: `Até R$ ${priceValue.toLocaleString('pt-BR')}`,
              detail: "Faixa de Preço",
            });
          }
          break;
        }
      }
    }

    // Remove duplicatas e limita a 6 sugestões
    const uniqueSuggestions = suggestions.filter((suggestion, index, self) =>
      index === self.findIndex(s => s.text === suggestion.text && s.type === suggestion.type)
    );

    return uniqueSuggestions.slice(0, 6);
  }, [searchQuery, vehicles, stockData]);

  // Função helper para parsear valores monetários
  const parsePriceValue = (input: string): number | null => {
    if (!input) return null;
    
    // Remove espaços e caracteres especiais, mantém números e k/mil
    const cleaned = input.toLowerCase().trim();
    
    // Padrões: "100k", "100mil", "100 mil", "100.000", "100000"
    // Regex melhorada para capturar diferentes formatos
    const patterns = [
      // Formato com k ou mil: "100k", "100mil", "100 mil"
      /(\d+)\s*(?:k|mil|milh[oõ]es?)/i,
      // Formato com pontos: "100.000", "1.000.000"
      /(\d{1,3}(?:\.\d{3})*)/,
      // Formato simples: "100000", "200000"
      /(\d{4,})/,
      // Formato simples menor: "100", "200" (pode ser milhares se for contexto de preço)
      /(\d{1,3})/,
    ];

    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        let value = parseInt(match[1].replace(/\./g, '')); // Remove pontos de milhar
        if (!isNaN(value)) {
          // Se tem k ou mil no texto original, multiplica por 1000
          if (cleaned.includes('k') || cleaned.includes('mil')) {
            value *= 1000;
          }
          // Se o número tem 4+ dígitos ou tem pontos, já está em milhares
          else if (match[1].includes('.') || match[1].length >= 4) {
            // Já está correto
          }
          // Se é um número pequeno (1-3 dígitos) e não tem k/mil, assume milhares se > 50
          else if (value > 50 && value < 1000) {
            value *= 1000;
          }
          return value;
        }
      }
    }
    
    return null;
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) return;

    const query = searchQuery.trim().toLowerCase();
    const searchParams: {
      marca: string | undefined;
      modelo: string | undefined;
      precoMin: string | undefined;
      precoMax: string | undefined;
      anoMin: string | undefined;
      anoMax: string | undefined;
      cambio: string | undefined;
      cor: string | undefined;
    } = {
      marca: undefined,
      modelo: undefined,
      precoMin: undefined,
      precoMax: undefined,
      anoMin: undefined,
      anoMax: undefined,
      cambio: undefined,
      cor: undefined,
    };

    // Detecta faixa de preço com regex melhorada
    const pricePatterns = [
      // "até 100k", "menor que 100k", "abaixo de 100k"
      /(?:até|menor\s+que|abaixo\s+de|até\s+r\$\s*)\s*(?:r\$\s*)?(.+?)(?:\s|$)/i,
      // "acima de 100k", "maior que 100k"
      /(?:acima\s+de|maior\s+que|mais\s+de|a\s+partir\s+de)\s*(?:r\$\s*)?(.+?)(?:\s|$)/i,
      // Apenas números com k/mil no início ou fim
      /^(?:r\$\s*)?(.+?)(?:\s*(?:k|mil|milh[oõ]es?))$/i,
      // Números grandes sem prefixo
      /^(\d{4,})$/,
    ];

    let priceValue: number | null = null;
    let isMaxPrice = false;
    let isMinPrice = false;

    // Tenta detectar padrões de "até" ou "acima de"
    for (const pattern of pricePatterns) {
      const match = query.match(pattern);
      if (match) {
        const valueStr = match[1] || match[0];
        priceValue = parsePriceValue(valueStr);
        
        if (priceValue !== null) {
          if (query.includes('até') || query.includes('menor') || query.includes('abaixo')) {
            isMaxPrice = true;
          } else if (query.includes('acima') || query.includes('maior') || query.includes('mais')) {
            isMinPrice = true;
          } else {
            // Se não tem prefixo, assume "até" por padrão
            isMaxPrice = true;
          }
          break;
        }
      }
    }

    // Se não encontrou padrão específico, tenta parsear o valor diretamente
    if (priceValue === null) {
      priceValue = parsePriceValue(query);
      if (priceValue !== null) {
        // Se encontrou um valor mas não tem contexto, assume "até"
        isMaxPrice = true;
      }
    }

    // Aplica os filtros de preço
    if (priceValue !== null) {
      if (isMaxPrice) {
        // Para "até", define apenas o valor máximo, sem mínimo
        searchParams.precoMax = priceValue.toString();
      } else if (isMinPrice) {
        searchParams.precoMin = priceValue.toString();
      }
      
      // Se detectou um preço, não filtra por marca/modelo
      // Navega diretamente com os filtros de preço
      navigate({
        to: "/seminovos",
        search: searchParams,
      });
      return;
    }

    // Detecta tipo de câmbio (Automático ou Manual)
    const cambioKeywords = {
      'automático': 'AUTOMATICO',
      'automatico': 'AUTOMATICO',
      'manual': 'MANUAL',
    };

    for (const [keyword, cambioValue] of Object.entries(cambioKeywords)) {
      if (query.includes(keyword)) {
        searchParams.cambio = cambioValue;
        // Se detectou câmbio, navega diretamente sem filtrar por marca/modelo
        navigate({
          to: "/seminovos",
          search: searchParams,
        });
        return;
      }
    }

    // Detecta cor (verifica se corresponde a alguma cor conhecida)
    if (stockData?.colors && stockData.colors.length > 0) {
      const matchedColor = stockData.colors.find(color => {
        if (!color) return false;
        const colorLower = color.toLowerCase();
        const queryLower = query.toLowerCase();
        // Verifica se a query contém a cor ou se a cor contém a query
        return colorLower.includes(queryLower) || queryLower.includes(colorLower);
      });

      if (matchedColor) {
        searchParams.cor = matchedColor;
        // Se detectou cor, navega diretamente sem filtrar por marca/modelo
        navigate({
          to: "/seminovos",
          search: searchParams,
        });
        return;
      }
    }

    // Detecta marca (verifica se corresponde a alguma marca conhecida)
    // Só executa se não detectou um preço ou câmbio
    if (stockData?.enterprises) {
      const matchedBrand = stockData.enterprises.find(brand => 
        brand && (brand.toLowerCase().includes(query) || query.includes(brand.toLowerCase()))
      );
      if (matchedBrand) {
        searchParams.marca = matchedBrand;
      } else {
        // Se não encontrou marca exata, usa como busca geral
        searchParams.modelo = searchQuery.trim();
      }
    } else {
      searchParams.modelo = searchQuery.trim();
    }

    // Navega para a página de seminovos com os filtros
    navigate({
      to: "/seminovos",
      search: searchParams,
    });
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    // Se for uma sugestão de preço, executa a busca diretamente
    if (suggestion.detail === "Faixa de Preço") {
      setSearchQuery(suggestion.text);
      // Pequeno delay para garantir que o estado seja atualizado antes da busca
      setTimeout(() => {
        handleSearch();
      }, 0);
    } else if (suggestion.detail === "Cor") {
      // Se for uma sugestão de cor, navega diretamente
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
          cor: suggestion.text,
        },
      });
    } else if (suggestion.detail === "Câmbio") {
      // Se for uma sugestão de câmbio, navega diretamente
      const cambioValue = suggestion.text.toLowerCase().includes('automático') || 
                          suggestion.text.toLowerCase().includes('automatico') 
                          ? 'AUTOMATICO' 
                          : 'MANUAL';
      navigate({
        to: "/seminovos",
        search: {
          marca: undefined,
          modelo: undefined,
          precoMin: undefined,
          precoMax: undefined,
          anoMin: undefined,
          anoMax: undefined,
          cambio: cambioValue,
          cor: undefined,
        },
      });
    } else {
      // Para outras sugestões, apenas atualiza o campo de busca
      const cleanText = suggestion.text.replace(/.*: /, '');
      setSearchQuery(cleanText);
    }
  };

  const handleQuickFilterClick = (filterValue: string) => {
    if (filterValue === "Até R$ 100k") {
      // Define explicitamente o filtro de preço - apenas máximo, sem mínimo
      navigate({
        to: "/seminovos",
        search: {
          marca: undefined,
          modelo: undefined,
          precoMin: undefined,
          precoMax: "100000",
          anoMin: undefined,
          anoMax: undefined,
          cambio: undefined,
          cor: undefined,
        },
      });
    } else if (filterValue.toLowerCase() === "automático" || filterValue.toLowerCase() === "automatico") {
      // Define filtro de câmbio automático
      navigate({
        to: "/seminovos",
        search: {
          marca: undefined,
          modelo: undefined,
          precoMin: undefined,
          precoMax: undefined,
          anoMin: undefined,
          anoMax: undefined,
          cambio: "AUTOMATICO",
          cor: undefined,
        },
      });
    } else {
      // Verifica se é uma cor conhecida
      const filterLower = filterValue.toLowerCase();
      if (stockData?.colors) {
        const matchedColor = stockData.colors.find(color => {
          if (!color) return false;
          return color.toLowerCase() === filterLower || filterLower === color.toLowerCase();
        });

        if (matchedColor) {
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
              cor: matchedColor,
            },
          });
          return;
        }
      }

      // Para outros filtros, apenas define a query
      setSearchQuery(filterValue);
    }
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
            onClick={() => handleQuickFilterClick(filter)}
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

