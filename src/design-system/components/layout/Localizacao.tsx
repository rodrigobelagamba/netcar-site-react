import { MapPin, ExternalLink } from "lucide-react";

export function Localizacao() {
  return (
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
  );
}

