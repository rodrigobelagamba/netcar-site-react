export function IanBot() {
  return (
    <section className="container-main w-full bg-white rounded-[32px] shadow-sm border border-white py-10 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 overflow-hidden relative">
      
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
  );
}

