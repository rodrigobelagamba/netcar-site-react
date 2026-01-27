import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { Search, Phone, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useWhatsAppQuery } from "@/api/queries/useSiteQuery";
import { useSearchContext } from "@/contexts/SearchContext";
import { formatWhatsAppNumber } from "@/lib/formatters";
import logoNetcar from "@/assets/images/logo-netcar.png";

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { data: whatsapp } = useWhatsAppQuery();
  const { searchTerm, setSearchTerm } = useSearchContext();

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

  // Limpa a busca quando sai da página de seminovos
  useEffect(() => {
    if (location.pathname !== "/seminovos" && searchTerm) {
      setSearchTerm("");
    }
  }, [location.pathname, searchTerm, setSearchTerm]);

  // Função para lidar com a busca
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    
    // Se não está na página de seminovos e há texto, redireciona para seminovos
    if (location.pathname !== "/seminovos" && value.trim()) {
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
          cor: undefined,
          categoria: undefined,
        },
      });
      // Fecha o menu mobile após navegar
      setIsMobileMenuOpen(false);
    }
  };

  // Handler para quando o usuário pressionar Enter no campo de busca mobile
  const handleMobileSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchTerm.trim()) {
      setIsMobileMenuOpen(false);
    }
  };

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
                {/* Campo de Busca Mobile */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  className="w-full max-w-xs px-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-2 border-b border-white/30 pb-2">
                    <Search className="w-5 h-5 text-white flex-shrink-0" />
                    <input
                      ref={mobileSearchInputRef}
                      type="text"
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                      onKeyDown={handleMobileSearchKeyDown}
                      placeholder="Buscar veículo..."
                      className="flex-1 bg-transparent border-0 outline-none text-white text-lg placeholder:text-white/70"
                      onClick={(e) => e.stopPropagation()}
                      onFocus={(e) => e.stopPropagation()}
                    />
                  </div>
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
