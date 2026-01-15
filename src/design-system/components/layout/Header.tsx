import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Search, Phone, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useWhatsAppQuery } from "@/api/queries/useSiteQuery";
import logoNetcar from "@/assets/images/logo-netcar.png";

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { data: whatsapp, isLoading: isLoadingWhatsApp, error: whatsappError } = useWhatsAppQuery();

  // Debug: log do WhatsApp quando carregar
  useEffect(() => {
    console.log("WhatsApp Status:", {
      isLoading: isLoadingWhatsApp,
      data: whatsapp,
      error: whatsappError,
      hasNumero: !!whatsapp?.numero,
      numero: whatsapp?.numero
    });
  }, [whatsapp, isLoadingWhatsApp, whatsappError]);

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
    const cleaned = whatsapp.numero.replace(/\D/g, "");
    const message = whatsapp.mensagem || "Olá! Gostaria de mais informações.";
    return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
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

  const menuLinks = [
    { to: "/sobre", label: "Sobre" },
    { to: "/seminovos", label: "Showroom" },
    { to: "/social", label: "Social" },
    { to: "/blog", label: "Blog" },
    { to: "/contato", label: "Contato" },
    { to: "/localizacao", label: "Localização" },
  ];

  return (
    <>
      <header 
        className={`fixed top-0 left-0 right-0 ${isMobileMenuOpen ? 'z-[75]' : 'z-50'}`}
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
            <Link to="/" aria-label="NetCar - Página inicial" className="flex-shrink-0">
              <img src={logoNetcar} alt="NetCar" className="h-8 w-auto" />
            </Link>

            <nav className="flex items-center gap-6 flex-shrink-0">
              {menuLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="group relative text-[14px]  text-fg overflow-hidden h-[22px] flex items-center whitespace-nowrap"
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
              ))}
            </nav>
          </div>

          {/* Logo - Mobile */}
          <Link to="/" aria-label="NetCar - Página inicial" className="md:hidden">
            <img src={logoNetcar} alt="NetCar" className="h-8 w-auto" />
          </Link>

          {/* Botões à direita - Desktop */}
          <div className="hidden md:flex items-center gap-4 flex-1 justify-end">
            <button className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              <span>Buscar</span>
            </button>
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
                {menuLinks.map((link, index) => (
                  <motion.div
                    key={link.to}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 + index * 0.05 }}
                  >
                    <Link
                      to={link.to}
                      className="text-white text-xl"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                ))}
                {whatsapp?.numero && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 + menuLinks.length * 0.05 }}
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
