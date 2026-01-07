import { 
  MapPin, 
  Headphones,
  Instagram,
  Facebook,
  Youtube,
  ExternalLink
} from "lucide-react";

// Logo
import logoNetcar from "@/assets/images/logo-netcar.png";

export function Footer() {

  return (
    <footer className="w-full font-sans antialiased text-muted-foreground bg-muted py-12 px-4 md:px-8 space-y-8">
      
      {/* ========== CARD 1: MAPA ========== */}
      <section className="max-w-[1400px] mx-auto w-full bg-white rounded-[32px] shadow-sm overflow-hidden border border-white relative group">
        <div className="w-full h-[450px] relative grayscale-[0.1]">
          
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d6914.0!2d-51.171175!3d-29.839405!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1spt-BR!2sbr!4v1704628800000!5m2!1spt-BR!2sbr"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Localização das lojas NetCar"
            className="w-full h-full"
          />

          {/* ================= PINOS MANUAIS ================= */}
          
          {/* LOJA 1 (Nº 740) */}
          <div className="absolute top-[25%] left-[65%] -translate-x-1/2 -translate-y-1/2 z-10 hover:z-20 group">
             <div className="relative flex flex-col items-center">
                <div className="mb-2 bg-white px-3 py-1.5 rounded-lg shadow-md border border-gray-100 flex items-center gap-2 whitespace-nowrap transform transition-transform group-hover:-translate-y-1">
                  <span className="w-2 h-2 rounded-full bg-primary"></span>
                  <p className="text-[11px] font-bold text-gray-800">LOJA 1</p>
                </div>
                <div className="relative">
                  <span className="absolute -inset-3 rounded-full bg-primary opacity-30 animate-ping"></span>
                  <span className="absolute -inset-1 rounded-full bg-white opacity-90"></span>
                  <MapPin className="w-8 h-8 text-primary drop-shadow-lg relative z-10" fill="currentColor" />
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-1 h-8 bg-gradient-to-b from-primary to-transparent opacity-50"></div>
                </div>
             </div>
          </div>

          {/* LOJA 2 (Nº 1106) */}
          <div className="absolute top-[75%] left-[35%] -translate-x-1/2 -translate-y-1/2 z-10 hover:z-20 group">
             <div className="relative flex flex-col items-center">
                <div className="mb-2 bg-white px-3 py-1.5 rounded-lg shadow-md border border-gray-100 flex items-center gap-2 whitespace-nowrap transform transition-transform group-hover:-translate-y-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <p className="text-[11px] font-bold text-gray-800">LOJA 2</p>
                </div>
                <div className="relative">
                  <span className="absolute -inset-3 rounded-full bg-amber-500 opacity-30 animate-ping delay-700"></span>
                  <span className="absolute -inset-1 rounded-full bg-white opacity-90"></span>
                  <MapPin className="w-8 h-8 text-amber-500 drop-shadow-lg relative z-10" fill="currentColor" />
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-1 h-8 bg-gradient-to-b from-amber-500 to-transparent opacity-50"></div>
                </div>
             </div>
          </div>

          
          {/* Card Flutuante */}
          <div className="absolute top-6 right-6 md:top-8 md:right-8 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-6 border border-white/50 hidden md:block max-w-[340px] z-30">
             <h5 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
               Nossas Unidades
             </h5>

             {/* Loja 1 */}
             <div className="flex items-start gap-4 mb-6 relative group/item hover:bg-gray-50/50 p-2 -mx-2 rounded-lg transition-colors cursor-pointer">
               <div className="absolute left-[17px] top-10 bottom-[-16px] w-[2px] border-l-2 border-dotted border-gray-200"></div>
               <div className="relative mt-1 flex-shrink-0">
                  <div className="relative w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white shadow-sm z-10">
                    <MapPin className="w-3 h-3" strokeWidth={3} />
                  </div>
               </div>
               <div>
                 <div className="flex items-center gap-2 mb-1">
                   <p className="font-bold text-gray-800 text-sm">LOJA 1</p>
                   <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold uppercase">Matriz</span>
                 </div>
                 <p className="text-[13px] text-gray-500 leading-snug">
                   Av. Presidente Vargas, 740<br/>Esteio/RS
                 </p>
               </div>
             </div>

             {/* Loja 2 */}
             <div className="flex items-start gap-4 group/item hover:bg-gray-50/50 p-2 -mx-2 rounded-lg transition-colors cursor-pointer">
               <div className="relative mt-1 flex-shrink-0">
                  <div className="relative w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-white shadow-sm z-10">
                    <MapPin className="w-3 h-3" strokeWidth={3} />
                  </div>
               </div>
               <div>
                 <div className="flex items-center gap-2 mb-1">
                   <p className="font-bold text-gray-800 text-sm">LOJA 2</p>
                   <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold uppercase">Filial</span>
                 </div>
                 <p className="text-[13px] text-gray-500 leading-snug">
                   Av. Presidente Vargas, 1106<br/>Esteio/RS
                 </p>
               </div>
             </div>

             <div className="mt-6 pt-4 border-t border-gray-100">
                <a 
                href="https://maps.google.com/?q=Netcar+Multimarcas+Esteio" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-xs font-bold text-primary hover:opacity-80 transition-colors group/link"
               >
                 ABRIR NO GOOGLE MAPS
                 <ExternalLink className="w-3 h-3 group-hover/link:translate-x-0.5 transition-transform" />
               </a>
             </div>
          </div>
        </div>
      </section>

      {/* ========== CARD 2: iAN - ASSISTENTE VIRTUAL ========== */}
      <section className="max-w-[1400px] mx-auto w-full bg-white rounded-[32px] shadow-sm border border-white py-10 px-8 md:px-12 overflow-hidden relative">
        
        {/* Background Pattern - Pontos Sutis */}
        <div className="absolute inset-0 opacity-[0.4] pointer-events-none">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(#d1d5db 1px, transparent 1px)',
            backgroundSize: '32px 32px'
          }} />
        </div>

        <div className="relative flex flex-col lg:flex-row items-center justify-between gap-8 z-10">
          
          {/* Avatar + Info */}
          <div className="flex items-center gap-6">
            {/* Avatar do iAN */}
            <div className="relative flex-shrink-0">
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-white p-1 shadow-lg border border-gray-100">
                <img 
                  src="/images/IMG_8886.JPG"
                  alt="iAN - Assistente Virtual"
                  className="w-full h-full rounded-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://ui-avatars.com/api/?name=iAN&background=6cbe9d&color=fff&size=128&bold=true";
                  }}
                />
              </div>
              {/* Badge Online */}
              <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1.5 shadow-md border border-gray-50">
                <div className="w-4 h-4 bg-secondary rounded-full animate-pulse ring-2 ring-white" />
              </div>
            </div>

            {/* Texto */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-[28px] md:text-[32px] font-bold tracking-tight text-fg">
                  Olá, eu sou o iAN!
                </h3>
                <span className="text-[24px]">👋</span>
              </div>
              <p className="text-gray-500 text-[16px] md:text-[18px] font-medium leading-relaxed max-w-[500px]">
                Seu assistente virtual da Netcar. Me conta o carro que você procura e eu encontro as melhores opções pra você!
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col items-center lg:items-end gap-3">
            <a
              href="https://wa.me/5551998879281?text=Oi%20iAN!%20Estou%20procurando%20um%20carro..."
              target="_blank"
              rel="noopener noreferrer"
              className="relative overflow-hidden group flex items-center gap-4 bg-secondary hover:opacity-90 text-white font-bold text-[16px] md:text-[18px] px-8 py-4 rounded-full shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              {/* Efeito Espelhamento (Shimmer) */}
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out z-10" />
              
              <svg className="w-7 h-7 text-white relative z-20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <span className="relative z-20">Conversar com iAN</span>
              <span className="ml-1 group-hover:translate-x-1 transition-transform relative z-20">→</span>
            </a>
            
            <p className="text-gray-400 text-[13px] font-medium flex items-center justify-end gap-2 w-full">
              <span className="w-2 h-2 bg-secondary rounded-full animate-pulse"></span>
              Online agora • Resposta instantânea
            </p>
          </div>

        </div>
      </section>

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
