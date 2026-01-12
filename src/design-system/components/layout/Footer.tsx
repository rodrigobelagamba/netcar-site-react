import { 
  Headphones,
  Instagram,
  Facebook,
  Youtube
} from "lucide-react";

// Logo
import logoNetcar from "@/assets/images/logo-netcar.png";

export function Footer() {

  return (
    <footer className="w-full font-sans antialiased text-muted-foreground bg-muted py-12 px-4 md:px-8">
      {/* ========== CARD 3: FOOTER INFO ========== */}
      <section className="max-w-[1400px] mx-auto w-full bg-white rounded-[32px] shadow-sm border border-white pt-10 pb-8 px-8 md:px-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[280px_1fr_180px_160px] gap-x-12 gap-y-10 mb-10 items-stretch">
          
          {/* Coluna 1: Contato */}
          <div className="flex flex-col items-start space-y-6 h-full justify-between">
            <div className="space-y-6 w-full">
              <img
                src={logoNetcar}
                alt="Netcar"
                className="h-[42px] w-auto opacity-90"
              />

              <div className="space-y-5 w-full">
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">WhatsApp Vendas</p>
                  <a href="https://wa.me/5551998879281" className="text-[17px] text-primary font-bold hover:underline tracking-tight">
                    (51) 99887-9281
                  </a>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Telefone</p>
                  <p className="text-[15px] font-medium text-gray-600">
                    (51) 3473-7900 <span className="text-gray-300 mx-1">/</span> (51) 3033-3900
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Atendimento</p>
                  <div className="text-[14px] font-bold text-gray-700 leading-snug">
                    <span className="block text-fg mb-1">Seg a Sex: <span className="text-primary">9h às 18h</span></span>
                    <span className="block text-fg">Sábado: <span className="text-amber-500">9h às 16h30</span></span>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full bg-primary rounded-xl p-5 text-white shadow-md shadow-primary/10 hover:-translate-y-0.5 transition-transform duration-300 cursor-default mt-auto">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Headphones className="w-5 h-5" />
                </div>
                <span className="font-bold text-[15px] tracking-tight">Nethelp</span>
              </div>
              <p className="text-[13px] leading-snug opacity-95 font-medium">
                Suporte exclusivo para veículos em período de garantia legal.
              </p>
            </div>
          </div>

          {/* Coluna 2: Lojas */}
          <div className="flex flex-col h-full">
            <h4 className="text-[12px] font-bold text-gray-400 mb-6 uppercase tracking-widest">Nossas lojas</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 flex-1">
              
              <div className="group cursor-pointer flex flex-col h-full bg-gray-50/50 rounded-xl p-0 hover:bg-gray-50 transition-colors">
                <div className="w-full aspect-[16/9] bg-gray-200 rounded-lg overflow-hidden mb-4 border border-gray-100 relative shadow-sm flex-shrink-0">
                  <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-bold text-primary uppercase tracking-wide z-10 shadow-sm">
                    Matriz
                  </div>
                  <img 
                    src="/images/loja1.jpg"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    alt="Loja 1"
                  />
                </div>
                <div className="flex flex-col flex-1 gap-4 px-1">
                  <div>
                    <h5 className="font-bold text-fg text-[16px] mb-2 group-hover:text-primary transition-colors">Loja 1</h5>
                    <p className="text-[14px] text-muted-foreground leading-relaxed">
                      Av. Presidente Vargas, 740<br/>Centro – Esteio/RS
                    </p>
                  </div>
                  <a href="#" className="inline-flex items-center text-[13px] font-bold text-fg group-hover:underline mt-auto pt-4 border-t border-border w-full">
                    Ver no mapa <span className="text-primary ml-2 mr-2">•</span> (51) 3473-7900
                  </a>
                </div>
              </div>

              <div className="group cursor-pointer flex flex-col h-full bg-gray-50/50 rounded-xl p-0 hover:bg-gray-50 transition-colors">
                <div className="w-full aspect-[16/9] bg-gray-200 rounded-lg overflow-hidden mb-4 border border-gray-100 relative shadow-sm flex-shrink-0">
                  <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-bold text-amber-500 uppercase tracking-wide z-10 shadow-sm">
                    Filial
                  </div>
                  <img 
                    src="/images/loja2.jpg"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    alt="Loja 2"
                  />
                </div>
                <div className="flex flex-col flex-1 gap-4 px-1">
                  <div>
                    <h5 className="font-bold text-fg text-[16px] mb-2 group-hover:text-primary transition-colors">Loja 2</h5>
                    <p className="text-[14px] text-muted-foreground leading-relaxed">
                      Av. Presidente Vargas, 1106<br/>Centro – Esteio/RS
                    </p>
                  </div>
                  <a href="#" className="inline-flex items-center text-[13px] font-bold text-fg group-hover:underline mt-auto pt-4 border-t border-border w-full">
                    Ver no mapa <span className="text-primary ml-2 mr-2">•</span> (51) 3033-3900
                  </a>
                </div>
              </div>

            </div>
          </div>

          {/* Coluna 3: Institucional */}
          <div className="lg:pl-6 h-full">
            <h4 className="text-[12px] font-bold text-gray-400 mb-6 uppercase tracking-widest">Institucional</h4>
            <ul className="space-y-3">
              {[
                "Sobre nós", 
                "Serviços", 
                "Pós-venda (Nethelp)", 
                "Contato", 
                "Política de privacidade", 
                "Termos de uso"
              ].map((item) => (
                <li key={item}>
                  <a href="#" className="text-[14px] text-muted-foreground hover:text-primary hover:translate-x-1 transition-all duration-300 inline-block font-medium">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Coluna 4: Social */}
          <div className="h-full">
            <h4 className="text-[12px] font-bold text-gray-400 mb-6 uppercase tracking-widest">Conecte-se</h4>
            <div className="flex gap-2">
              {[Instagram, Facebook, Youtube].map((Icon, idx) => (
                <a 
                  key={idx} 
                  href="#" 
                  className="w-11 h-11 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-all duration-300 bg-surface"
                >
                  <Icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

        </div>

        {/* Texto Legal + Selo */}
        <div className="border-t border-gray-100 pt-6 mt-2 mb-6 flex flex-col md:flex-row items-center justify-between gap-8">
          <p className="text-[10px] text-gray-400 leading-relaxed text-justify flex-1">
            <span className="font-bold block mb-1">R&C VEÍCULOS LTDA - CNPJ: 02.237.969/0001-06</span>
            Política de Reserva: devido à grande rotatividade de nosso estoque e dinâmica da nossa equipe comercial, informamos que só será aceita reserva de veículo mediante pagamento de sinal de negócio e aceite do Termo de Sinal de Negócio. Orçamentos comerciais, negociações, atendimentos, agendamentos de visita ou análises de crédito não configuram reserva de veículo.
          </p>
          
          <a 
            href="https://app.zapsign.com.br/verificar/sustentabilidade/netcar" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex-shrink-0 hover:opacity-80 transition-opacity"
            title="Verificar Selo de Sustentabilidade"
          >
             <img 
               src="/images/selo-sustentabilidade.png" 
               alt="Selo Sustentabilidade ZapSign" 
               className="h-[80px] w-auto object-contain"
               onError={(e) => {
                 // Fallback visual caso a imagem não exista ainda
                 e.currentTarget.style.display = 'none';
                 e.currentTarget.parentElement!.innerHTML = '<span class="px-4 py-2 bg-green-50 text-green-700 text-xs font-bold rounded-lg border border-green-200">Selo Sustentabilidade</span>';
               }}
             />
          </a>
        </div>

        <div className="border-t border-gray-100 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[12px] font-medium text-gray-400">
            © {new Date().getFullYear()} Netcar Multimarcas.
          </p>
          <div className="flex gap-6">
             <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Design by Netcar</span>
          </div>
      </div>
      </section>

    </footer>
  );
}
