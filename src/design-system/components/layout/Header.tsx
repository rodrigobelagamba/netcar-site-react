import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { Search, Phone, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useWhatsAppQuery } from "@/api/queries/useSiteQuery";
import { useSearchContext } from "@/contexts/SearchContext";
import { useVehiclesQuery } from "@/api/queries/useVehiclesQuery";
import { formatWhatsAppNumber } from "@/lib/formatters";
import { generateVehicleSlug } from "@/lib/slug";
import logoNetcar from "@/assets/images/logo-netcar.png";

interface VehicleSuggestion {
  marca: string;
  modelo: string;
  ano: number;
  cor: string;
  id: string;
  placa?: string;
  displayText: string;
}

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileAutocompleteOpen, setIsMobileAutocompleteOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const mobileAutocompleteRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { data: whatsapp } = useWhatsAppQuery();
  const { searchTerm, setSearchTerm } = useSearchContext();
  const { data: vehicles } = useVehiclesQuery();

  // Formata telefone para exibição
  const formatPhone = (phone?: string) => {
    if (!phone) return "";
    // Remove caracteres não numéricos e formata
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  // Gera link do WhatsApp (usa link da API se disponível, senão gera)
  const getWhatsAppLink = () => {
    if (!whatsapp?.numero) return "#";
    
    // Se a API já retornou um link, usa ele
    if (whatsapp.link) {
      return whatsapp.link;
    }
    
    // Senão, gera o link do WhatsApp
    const formattedNumber = formatWhatsAppNumber(whatsapp.numero);
    const message = whatsapp.mensagem || "Olá! Gostaria de mais informações.";
    return `https://wa.me/${formattedNumber}?text=${encodeURIComponent(message)}`;
  };

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      setIsScrolled(scrollTop > 0);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Previne scroll do body quando menu mobile está aberto
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMobileMenuOpen]);

  // Foca no input quando o campo de busca é aberto
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Foca no input mobile quando o menu mobile é aberto
  useEffect(() => {
    if (isMobileMenuOpen && mobileSearchInputRef.current) {
      // Pequeno delay para garantir que o elemento está visível
      setTimeout(() => {
        mobileSearchInputRef.current?.focus();
      }, 300);
    }
  }, [isMobileMenuOpen]);

  // Limpa a busca apenas quando realmente sai da página de seminovos
  // Não limpa quando o menu mobile ou busca desktop estão abertos
  const prevPathnameRef = useRef(location.pathname);
  useEffect(() => {
    const prevPathname = prevPathnameRef.current;
    const currentPathname = location.pathname;
    
    // Só limpa se saiu da página de seminovos (estava em /seminovos e agora não está mais)
    // E se o menu mobile e busca desktop estão fechados
    if (
      prevPathname === "/seminovos" && 
      currentPathname !== "/seminovos" && 
      searchTerm && 
      !isMobileMenuOpen && 
      !isSearchOpen
    ) {
      setSearchTerm("");
    }
    
    prevPathnameRef.current = currentPathname;
  }, [location.pathname, searchTerm, isMobileMenuOpen, isSearchOpen, setSearchTerm]);

  // Gera sugestões de autocomplete baseadas em Marca Modelo Ano Cor
  const vehicleSuggestions = useMemo<VehicleSuggestion[]>(() => {
    if (!vehicles || vehicles.length === 0 || !searchTerm || searchTerm.length < 2) {
      return [];
    }

    const lowerQuery = searchTerm.toLowerCase().trim();
    const suggestions: VehicleSuggestion[] = [];

    // Cria um Set para evitar duplicatas baseado no ID do veículo
    const seenIds = new Set<string>();

    vehicles.forEach((vehicle) => {
      // Só processa se tiver todos os dados necessários
      if (!vehicle.marca || !vehicle.modelo || !vehicle.year || !vehicle.cor || !vehicle.id) {
        return;
      }

      // Evita duplicatas pelo ID
      if (seenIds.has(vehicle.id)) {
        return;
      }

      const marca = vehicle.marca.toLowerCase();
      const modelo = vehicle.modelo.toLowerCase();
      const ano = vehicle.year.toString();
      const cor = vehicle.cor.toLowerCase();

      // Verifica se a busca corresponde a marca, modelo, ano ou cor
      const matches =
        marca.includes(lowerQuery) ||
        modelo.includes(lowerQuery) ||
        ano.includes(lowerQuery) ||
        cor.includes(lowerQuery) ||
        `${marca} ${modelo}`.includes(lowerQuery) ||
        `${marca} ${modelo} ${ano}`.includes(lowerQuery) ||
        `${marca} ${modelo} ${ano} ${cor}`.includes(lowerQuery);

      if (matches) {
        seenIds.add(vehicle.id);
        suggestions.push({
          marca: vehicle.marca,
          modelo: vehicle.modelo,
          ano: vehicle.year,
          cor: vehicle.cor,
          id: vehicle.id,
          placa: vehicle.placa,
          displayText: `${vehicle.marca} ${vehicle.modelo} ${vehicle.year} ${vehicle.cor}`,
        });
      }
    });

    // Ordena por relevância (marca primeiro, depois modelo, depois ano)
    suggestions.sort((a, b) => {
      const aMarca = a.marca.toLowerCase();
      const bMarca = b.marca.toLowerCase();
      const aModelo = a.modelo.toLowerCase();
      const bModelo = b.modelo.toLowerCase();

      // Se a busca começa com marca, prioriza
      if (aMarca.startsWith(lowerQuery) && !bMarca.startsWith(lowerQuery)) return -1;
      if (!aMarca.startsWith(lowerQuery) && bMarca.startsWith(lowerQuery)) return 1;

      // Se a busca começa com modelo, prioriza
      if (aModelo.startsWith(lowerQuery) && !bModelo.startsWith(lowerQuery)) return -1;
      if (!aModelo.startsWith(lowerQuery) && bModelo.startsWith(lowerQuery)) return 1;

      return 0;
    });

    return suggestions.slice(0, 8); // Limita a 8 sugestões
  }, [vehicles, searchTerm]);

  // Função para lidar com a busca
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setIsMobileAutocompleteOpen(value.length >= 2);
    setHighlightedIndex(0);
  };

  // Função para selecionar uma sugestão do autocomplete
  const handleSuggestionSelect = (suggestion: VehicleSuggestion) => {
    // Gera o slug do veículo e navega diretamente para a página de detalhes
    const slug = generateVehicleSlug({
      modelo: suggestion.modelo,
      marca: suggestion.marca,
      year: suggestion.ano,
      placa: suggestion.placa,
      id: suggestion.id,
    });
    
    navigate({ to: `/veiculo/${slug}` });
    setIsMobileMenuOpen(false);
    setIsMobileAutocompleteOpen(false);
    setSearchTerm("");
  };

  // Handler para quando o usuário pressionar teclas no campo de busca mobile
  const handleMobileSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (vehicleSuggestions.length > 0 && highlightedIndex >= 0 && highlightedIndex < vehicleSuggestions.length) {
        // Se há sugestões e uma está destacada, seleciona ela
        handleSuggestionSelect(vehicleSuggestions[highlightedIndex]);
      } else if (searchTerm.trim()) {
        // Senão, faz busca normal
        navigate({
          to: "/seminovos",
          search: {
            modelo: searchTerm.trim(),
            marca: undefined,
            precoMin: undefined,
            precoMax: undefined,
            anoMin: undefined,
            anoMax: undefined,
            cambio: undefined,
            cor: undefined,
            categoria: undefined,
          },
        });
        setIsMobileMenuOpen(false);
        setIsMobileAutocompleteOpen(false);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (vehicleSuggestions.length > 0) {
        setIsMobileAutocompleteOpen(true);
        setHighlightedIndex((prev) =>
          prev < vehicleSuggestions.length - 1 ? prev + 1 : prev
        );
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Escape") {
      setIsMobileAutocompleteOpen(false);
      setHighlightedIndex(0);
    }
  };

  // Fecha autocomplete ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        mobileAutocompleteRef.current &&
        !mobileAutocompleteRef.current.contains(event.target as Node) &&
        mobileSearchInputRef.current &&
        !mobileSearchInputRef.current.contains(event.target as Node)
      ) {
        setIsMobileAutocompleteOpen(false);
      }
    };

    if (isMobileAutocompleteOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isMobileAutocompleteOpen]);

  // Função para abrir/fechar o campo de busca
  const toggleSearch = () => {
    setIsSearchOpen(!isSearchOpen);
    if (!isSearchOpen) {
      setSearchTerm("");
    }
  };

  const menuLinks = [
    { to: "/sobre", label: "Sobre" },
    { to: "/seminovos", label: "Showroom" },
    { to: "/compra", label: "Venda seu carro" },
    { to: "/blog", label: "Atualidades" },
    { to: "/contato", label: "Contato" },
    { to: "https://maps.app.goo.gl/i8uHquE8tNMfoTHr9", label: "Localização", external: true },
  ];

  return (
    <>
      <header 
        className={`fixed top-0 left-0 right-0 overflow-x-hidden max-w-full ${isMobileMenuOpen ? 'z-[75]' : 'z-50'}`}
      >
        {/* Fundo que aparece de cima para baixo */}
        <motion.div
          className="absolute inset-0 bg-white"
          initial={{ 
            clipPath: "inset(0% 0% 100% 0%)",
            boxShadow: "none",
          }}
          animate={{
            clipPath: isMobileMenuOpen
              ? "inset(0% 0% 100% 0%)"
              : isScrolled
              ? "inset(0% 0% 0% 0%)"
              : "inset(0% 0% 100% 0%)",
            boxShadow: isMobileMenuOpen
              ? "none"
              : isScrolled 
              ? "0 0 30px rgba(0,0,0,.35)" 
              : "none",
          }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        />

        <div className="container mx-auto relative flex h-16 items-center justify-between px-4">
          {/* Espaçador à esquerda para balancear */}
          <div className="hidden md:block flex-1"></div>

          {/* Logo e Menu centralizados juntos - Desktop */}
          <div className="hidden md:flex items-center gap-8 flex-1 justify-center">
            <Link to="/" aria-label="Netcar - Página inicial" className="flex-shrink-0">
              <img src={logoNetcar} alt="Netcar" className="h-8 w-auto" />
            </Link>

            <nav className="flex items-center gap-6 flex-shrink-0">
              {menuLinks.map((link) => {
                const linkClassName = "group relative text-[14px]  text-fg overflow-hidden h-[22px] flex items-center whitespace-nowrap";
                
                if (link.external) {
                  return (
                    <a
                      key={link.to}
                      href={link.to}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={linkClassName}
                    >
                      {/* Texto padrão */}
                      <span className="block transition-transform duration-300 ease-out group-hover:-translate-y-full">
                        {link.label}
                      </span>
                      {/* Texto que sobe no hover */}
                      <span className="absolute left-0 top-full block transition-transform duration-300 ease-out group-hover:-translate-y-full">
                        {link.label}
                      </span>
                    </a>
                  );
                }
                
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={linkClassName}
                  >
                    {/* Texto padrão */}
                    <span className="block transition-transform duration-300 ease-out group-hover:-translate-y-full">
                      {link.label}
                    </span>
                    {/* Texto que sobe no hover */}
                    <span className="absolute left-0 top-full block transition-transform duration-300 ease-out group-hover:-translate-y-full">
                      {link.label}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Logo - Mobile */}
          <Link to="/" aria-label="Netcar - Página inicial" className="md:hidden">
            <img src={logoNetcar} alt="Netcar" className="h-8 w-auto" />
          </Link>

          {/* Botões à direita - Desktop */}
          <div className="hidden md:flex items-center gap-4 flex-1 justify-end">
            {/* Campo de Busca */}
            <AnimatePresence>
              {isSearchOpen ? (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 250, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden bg-white rounded-md shadow-lg px-3 py-2 relative z-[100]"
                >
                  <div className="flex items-center gap-2 border-b border-border pb-1">
                    <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                      placeholder="Buscar veículo..."
                      className="flex-1 bg-transparent border-0 outline-none text-sm text-fg placeholder:text-muted-foreground"
                      onBlur={() => {
                        if (!searchTerm.trim()) {
                          setIsSearchOpen(false);
                        }
                      }}
                    />
                    <button
                      onClick={toggleSearch}
                      className="text-muted-foreground hover:text-fg transition-colors flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={toggleSearch}
                  className="flex items-center gap-2 hover:text-primary transition-colors"
                >
                  <Search className="w-4 h-4" />
                  <span>Buscar</span>
                </motion.button>
              )}
            </AnimatePresence>
            {whatsapp?.numero && (
              <a
                href={getWhatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-primary transition-colors"
              >
                <Phone className="w-4 h-4" />
                <span>{formatPhone(whatsapp.numero)}</span>
              </a>
            )}
          </div>

          {/* Botão hambúrguer/X - Mobile */}
          <button
            className="md:hidden p-2 relative z-10"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? "Fechar menu" : "Abrir menu"}
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6 text-white" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </header>

      {/* Menu Mobile Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Fundo colorido com fade-in - cobre toda a tela incluindo header */}
            <motion.div
              className="fixed inset-0 z-[60] bg-green-dark"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Menu centralizado com animação */}
            <motion.div
              className="fixed inset-0 z-[70] flex items-center justify-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <nav className="flex flex-col items-center gap-6">
                {/* Campo de Busca Mobile com Autocomplete */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  className="w-full max-w-xs px-4 relative"
                  onClick={(e) => e.stopPropagation()}
                  ref={mobileAutocompleteRef}
                >
                  <div className="flex items-center gap-2 border-b border-white/30 pb-2 relative">
                    <Search className="w-5 h-5 text-white flex-shrink-0" />
                    <input
                      ref={mobileSearchInputRef}
                      type="text"
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                      onKeyDown={handleMobileSearchKeyDown}
                      onFocus={() => {
                        if (searchTerm.length >= 2) {
                          setIsMobileAutocompleteOpen(true);
                        }
                      }}
                      placeholder="Buscar por marca, modelo, ano ou cor..."
                      className="flex-1 bg-transparent border-0 outline-none text-white text-lg placeholder:text-white/70"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  {/* Dropdown de Autocomplete */}
                  <AnimatePresence>
                    {isMobileAutocompleteOpen && vehicleSuggestions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden z-[80] max-h-64 overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {vehicleSuggestions.map((suggestion, index) => (
                          <div
                            key={suggestion.id}
                            onClick={() => handleSuggestionSelect(suggestion)}
                            className={`px-4 py-3 cursor-pointer transition-colors ${
                              highlightedIndex === index
                                ? "bg-primary/10"
                                : "hover:bg-gray-50"
                            }`}
                            onMouseEnter={() => setHighlightedIndex(index)}
                          >
                            <div className="text-sm font-medium text-gray-900">
                              {suggestion.displayText}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {suggestion.marca} • {suggestion.ano} • {suggestion.cor}
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
                
                {menuLinks.map((link, index) => (
                  <motion.div
                    key={link.to}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 + (index + 1) * 0.05 }}
                  >
                    {link.external ? (
                      <a
                        href={link.to}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white text-xl"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.to}
                        className="text-white text-xl"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {link.label}
                      </Link>
                    )}
                  </motion.div>
                ))}
                {whatsapp?.numero && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 + (menuLinks.length + 1) * 0.05 }}
                  >
                    <a
                      href={getWhatsAppLink()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-white text-xl hover:text-green-200 transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Phone className="w-5 h-5" />
                      <span>{formatPhone(whatsapp.numero)}</span>
                    </a>
                  </motion.div>
                )}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
