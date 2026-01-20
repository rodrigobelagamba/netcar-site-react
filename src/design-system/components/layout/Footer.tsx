import { 
  Headphones,
  Instagram,
  Facebook
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { 
  useBannersLoja1Query, 
  useBannersLoja2Query,
  usePhoneQuery,
  useWhatsAppQuery,
  useScheduleQuery
} from "@/api";

import logoNetcar from "@/assets/images/logo-netcar.png";

const menuLinks = [
  { to: "/sobre", label: "Sobre" },
  { to: "/seminovos", label: "Showroom" },
  { to: "/compra", label: "Compra" },
  { to: "/blog", label: "Atualidades" },
  { to: "/contato", label: "Contato" },
  { to: "https://maps.app.goo.gl/i8uHquE8tNMfoTHr9", label: "Localização", external: true },
];

export function Footer() {
  const { data: bannersLoja1 } = useBannersLoja1Query();
  const { data: bannersLoja2 } = useBannersLoja2Query();
  const { data: phoneLoja1 } = usePhoneQuery("Loja1");
  const { data: phoneLoja2 } = usePhoneQuery("Loja2");
  const { data: whatsapp } = useWhatsAppQuery();
  const { data: schedule } = useScheduleQuery();

  const getFachadaImage = (banners: Array<{ titulo?: string; imagem: string }> | undefined, fallback: string): string => {
    if (!banners || banners.length === 0) return fallback;
    const fachada = banners.find((banner) => banner.titulo?.toLowerCase() === "fachada");
    if (fachada?.imagem) return fachada.imagem;
    return banners[0]?.imagem || fallback;
  };

  const imagemLoja1 = getFachadaImage(bannersLoja1, "/images/loja1.jpg");
  const imagemLoja2 = getFachadaImage(bannersLoja2, "/images/loja2.jpg");

  const formatPhone = (phone?: string) => {
    if (!phone) return "";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  return (
    <footer className="w-full font-sans antialiased text-muted-foreground bg-muted py-12 px-4 md:px-8">
      <section className="max-w-[1400px] mx-auto w-full bg-white rounded-[32px] shadow-sm border border-white pt-10 pb-8 px-8 md:px-12">
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[220px_1fr_140px_120px] gap-x-10 gap-y-10 mb-10">
          
          {/* Coluna 1: Contato & Nethelp */}
          <div className="flex flex-col space-y-6 items-start">
            <img
              src={logoNetcar}
              alt="Netcar"
              className="h-8 w-auto object-contain"
            />

            {whatsapp?.numero && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">WhatsApp Vendas</p>
                <a 
                  href={whatsapp.link || `https://wa.me/${whatsapp.numero.replace(/\D/g, "")}`} 
                  className="text-base text-primary font-bold hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {formatPhone(whatsapp.numero)}
                </a>
              </div>
            )}

            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Atendimento</p>
              <div className="text-sm font-semibold text-fg space-y-1">
                <p>Seg a Sex: <span className="text-primary">{schedule?.dias_semana || "9h às 18h"}</span></p>
                <p>Sábado: <span className="text-amber-500">{schedule?.sabado || "9h às 16h30"}</span></p>
                <p>Jan-Fev (Sáb): <span className="text-amber-500">9h às 13h30</span></p>
                <p className="text-xs text-gray-400 font-medium pt-1">Não fechamos ao meio-dia</p>
              </div>
            </div>

            <a 
              href="https://wa.me/5551995109169?text=Olá!%20Preciso%20de%20suporte%20Nethelp."
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gradient-to-b from-[#1a3a4a] to-[#1d4a5a] rounded-xl p-4 text-white shadow-md hover:-translate-y-0.5 transition-transform duration-300"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1 bg-white/20 rounded-lg">
                  <Headphones className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm text-primary">Nethelp</span>
              </div>
              <p className="text-xs leading-snug opacity-90">
                Suporte exclusivo para veículos em período de garantia legal.
              </p>
            </a>
          </div>

          {/* Coluna 2: Lojas */}
          <div>
            <h4 className="text-[10px] font-bold text-gray-400 mb-5 uppercase tracking-widest">Nossas Lojas</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* Loja 1 */}
              <div className="group">
                <div className="aspect-[16/10] rounded-xl overflow-hidden mb-3 relative">
                  <div className="absolute top-2 left-2 bg-primary/90 backdrop-blur px-2.5 py-1 rounded text-[9px] font-bold text-white uppercase tracking-wide z-10">
                    Matriz
                  </div>
                  <img 
                    src={imagemLoja1}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    alt="Loja 1"
                    onError={(e) => {
                      if (e.currentTarget.src !== "/images/loja1.jpg") {
                        e.currentTarget.src = "/images/loja1.jpg";
                      }
                    }}
                  />
                </div>
                <h5 className="font-bold text-fg text-sm mb-1">Loja 1</h5>
                <p className="text-xs text-gray-500 leading-relaxed mb-2">
                  Av. Presidente Vargas, 740<br/>Centro – Esteio/RS
                </p>
                <p className="text-sm font-semibold text-fg">
                  {phoneLoja1?.telefone ? formatPhone(phoneLoja1.telefone) : "(51) 3473-7900"}
                </p>
              </div>

              {/* Loja 2 */}
              <div className="group">
                <div className="aspect-[16/10] rounded-xl overflow-hidden mb-3 relative">
                  <div className="absolute top-2 left-2 bg-amber-500/90 backdrop-blur px-2.5 py-1 rounded text-[9px] font-bold text-white uppercase tracking-wide z-10">
                    Filial
                  </div>
                  <img 
                    src={imagemLoja2}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    alt="Loja 2"
                    onError={(e) => {
                      if (e.currentTarget.src !== "/images/loja2.jpg") {
                        e.currentTarget.src = "/images/loja2.jpg";
                      }
                    }}
                  />
                </div>
                <h5 className="font-bold text-fg text-sm mb-1">Loja 2</h5>
                <p className="text-xs text-gray-500 leading-relaxed mb-2">
                  Av. Presidente Vargas, 1106<br/>Centro – Esteio/RS
                </p>
                <p className="text-sm font-semibold text-fg">
                  {phoneLoja2?.telefone ? formatPhone(phoneLoja2.telefone) : "(51) 3033-3900"}
                </p>
              </div>

            </div>
          </div>

          {/* Coluna 3: Menu */}
          <div>
            <h4 className="text-[10px] font-bold text-gray-400 mb-5 uppercase tracking-widest">Menu</h4>
            <ul className="space-y-2.5">
              {menuLinks.map((link) => (
                <li key={link.to}>
                  {link.external ? (
                    <a 
                      href={link.to}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gray-600 hover:text-primary transition-colors"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link 
                      to={link.to}
                      className="text-sm text-gray-600 hover:text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Coluna 4: Social */}
          <div>
            <h4 className="text-[10px] font-bold text-gray-400 mb-5 uppercase tracking-widest">Conecte-se</h4>
            <div className="flex gap-2">
              <a 
                href="https://instagram.com/netcar_rc" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-primary hover:text-primary transition-colors"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a 
                href="https://www.facebook.com/NetcarRC" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-primary hover:text-primary transition-colors"
              >
                <Facebook className="w-4 h-4" />
              </a>
            </div>
          </div>

        </div>

        {/* Texto Legal */}
        <div className="border-t border-gray-100 pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <p className="text-[10px] text-gray-400 leading-relaxed flex-1">
            <span className="font-bold block mb-1">R&C VEÍCULOS LTDA - CNPJ: 02.237.969/0001-06</span>
            Política de Reserva: devido à grande rotatividade de nosso estoque e dinâmica da nossa equipe comercial, informamos que só será aceita reserva de veículo mediante pagamento de sinal de negócio e aceite do Termo de Sinal de Negócio.
          </p>
          
          <a 
            href="https://app.zapsign.com.br/verificar/sustentabilidade/netcar" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex-shrink-0 hover:opacity-80 transition-opacity"
          >
             <img 
               src="/images/selo-sustentabilidade.png" 
               alt="Selo Sustentabilidade" 
               className="h-16 w-auto object-contain"
               onError={(e) => {
                 e.currentTarget.style.display = 'none';
               }}
             />
          </a>
        </div>

      </section>
    </footer>
  );
}
