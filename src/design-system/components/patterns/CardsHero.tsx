import { MessageCircle, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { SHOW_CAMPAIGN_STAMP } from "@/config/features";

interface CardsHeroProps {
  image: string;
  brand: string;
  model: string;
  year: string;
  fuel: string;
  transmission: string;
  mileage: string;
  price: string;
  previousPrice?: string;
  showPriceComparison?: boolean;
  delay?: number;
  fastAnimation?: boolean;
  onClick?: () => void;
  whatsAppHref?: string;
  tradeInHref?: string;
  whatsAppVehicleId?: string;
  whatsAppVehicleName?: string;
  whatsAppSource?: string;
  compact?: boolean;
}

export function CardsHero({
  image,
  brand,
  model,
  price,
  previousPrice,
  showPriceComparison = false,
  year,
  delay = 0,
  fastAnimation = false,
  onClick,
  whatsAppHref,
  tradeInHref,
  whatsAppVehicleId,
  whatsAppVehicleName,
  whatsAppSource = "home_destaques",
  compact = false,
}: CardsHeroProps) {
  const content = (
    <div className={`group relative bg-white shadow-[0_10px_40px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.08)] transition-all duration-500 flex flex-col items-center ${
      compact
        ? "rounded-[28px] p-4"
        : "rounded-[40px] p-8"
    }`} style={{ border: '1px solid rgba(229, 231, 235, 0.5)' }}>
      {/* Selo em formato de carimbo */}
      {SHOW_CAMPAIGN_STAMP && (
        <img
          src="/selos/selo_campanha.png"
          alt="Selo de campanha"
          className="absolute top-16 right-2 md:top-16 md:right-3 w-20 md:w-24 h-auto z-20 pointer-events-none select-none"
        />
      )}
      
      {/* Floating Image Section - LARGER */}
      <div className={`!border-0 absolute left-[-2%] right-[-2%] flex items-center justify-center z-10 pointer-events-none ${
        compact
          ? "-top-16 h-32 md:-top-44 md:h-80"
          : "-top-32 md:-top-44 h-64 md:h-80"
      }`}>
        <div className="!border-0 relative w-full h-full">
          <img 
            src={image} 
            alt={`${brand} ${model}`.trim() || "Veículo seminovo"}
            loading="lazy"
            decoding="async"
            className="!border-0 w-full h-full object-contain transition-transform duration-700 group-hover:scale-110 group-hover:-rotate-2 drop-shadow-[0_20px_30px_rgba(0,0,0,0.15)]"
          />
        </div>
      </div>

      {/* Content Section - Adjusted to match photo exactly */}
      <div className={`!border-0 w-full flex flex-col items-start text-left ${
        compact ? "pt-14 space-y-2" : "pt-28 md:pt-32 space-y-4"
      }`}>
         <span className={`!border-0 bg-[#00283C] text-white hover:bg-[#00283C] rounded-md font-bold tracking-widest uppercase w-fit inline-block ${
           compact ? "px-2 py-0.5 text-[8px]" : "px-3 py-1 text-[10px]"
         }`}>
           {brand}
         </span>

         {/* Model and Year - Left aligned */}
         <div className="!border-0 space-y-1">
           <h3 className={`!border-0 font-bold leading-tight ${compact ? "text-sm" : "text-[17px]"}`} style={{ color: '#00283C' }}>
             {model}
           </h3>
           <p className={`!border-0 text-gray-400 font-medium ${compact ? "text-xs" : "text-base"}`}>{year}</p>
         </div>

         {/* Price and Action — sempre stacked, botão largura total (evita sobrepor preço) */}
         <div className="!border-0 w-full pt-4 flex flex-col items-stretch gap-2">
           <div className="!border-0 w-full">
             {showPriceComparison && previousPrice ? (
               <div className="flex flex-col items-start gap-1">
                 <p className="!border-0 font-semibold text-gray-500 leading-none text-xs">
                   De: <span className="line-through">{previousPrice}</span>
                 </p>
                 <div className="flex flex-col items-start leading-none gap-0.5">
                   <span className="!border-0 text-[11px] font-semibold uppercase text-gray-400">Para:</span>
                   <p className="!border-0 font-bold font-sans tracking-tight text-base leading-tight" style={{ color: '#5CD29D' }}>
                     {price}
                   </p>
                 </div>
               </div>
             ) : (
               <p className={`!border-0 font-bold font-sans tracking-tight leading-tight ${compact ? "text-base" : "text-[24px]"}`} style={{ color: '#5CD29D' }}>
                 {price}
               </p>
             )}
           </div>

           {whatsAppHref ? (
             <a
               href={whatsAppHref}
               target="_blank"
               rel="noopener noreferrer"
               data-wa-source={whatsAppSource}
               data-wa-intent="ask_km"
               data-wa-vehicle-id={whatsAppVehicleId}
               data-wa-vehicle-name={whatsAppVehicleName}
               onClick={(e) => e.stopPropagation()}
               className={`!border-0 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#25D366] font-black uppercase text-white shadow-lg transition-colors hover:bg-[#128C7E] h-10 px-3 ${
                 compact ? "text-[10px] tracking-normal whitespace-nowrap" : "text-[11px] tracking-wide"
               }`}
             >
              <MessageCircle className={`shrink-0 ${compact ? "h-3.5 w-3.5" : "h-4 w-4"}`} />
              {compact ? "Saber KM" : "Saber sobre a KM"}
             </a>
           ) : (
             <button
               className="!border-0 h-10 w-10 rounded-full transition-all duration-300 shadow-lg group/btn flex items-center justify-center shrink-0"
               style={{
                 backgroundColor: '#00283C',
                 color: 'white',
                 outline: 'none'
               }}
               onMouseEnter={(e) => {
                 e.currentTarget.style.backgroundColor = '#5CD29D';
                 e.currentTarget.style.color = '#00283C';
               }}
               onMouseLeave={(e) => {
                 e.currentTarget.style.backgroundColor = '#00283C';
                 e.currentTarget.style.color = 'white';
               }}
             >
               <Plus className="h-5 w-5 group-hover/btn:rotate-90 transition-transform duration-300" />
             </button>
           )}

           {whatsAppHref && tradeInHref ? (
             <a
               href={tradeInHref}
               target="_blank"
               rel="noopener noreferrer"
               data-wa-source={`${whatsAppSource}_trade`}
               data-wa-intent="trade_in"
               data-wa-vehicle-id={whatsAppVehicleId}
               data-wa-vehicle-name={whatsAppVehicleName}
               onClick={(e) => e.stopPropagation()}
               className={`!border-0 w-full text-center font-bold text-[#00283C] underline underline-offset-4 transition-colors hover:text-[#5CD29D] ${
                 compact ? "text-[10px] leading-tight" : "text-xs"
               }`}
             >
               {compact ? "Troca deste →" : "Avaliar meu carro na troca deste →"}
             </a>
           ) : null}
         </div>
      </div>
    </div>
  );

  // Efeito original para os primeiros cards (com whileInView)
  if (!fastAnimation) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: delay * 0.1 }}
        viewport={{ once: true }}
        className={`${compact ? "pt-14" : "pt-24 md:pt-32"} ${onClick ? 'cursor-pointer' : ''}`}
        onClick={onClick}
      >
        {content}
      </motion.div>
    );
  }

  // Efeito rápido para os demais cards
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: delay * 0.05 }}
      className={`${compact ? "pt-14" : "pt-24 md:pt-32"} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {content}
    </motion.div>
  );
}

