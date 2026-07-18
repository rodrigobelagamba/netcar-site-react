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
  financeHref?: string;
  whatsAppVehicleId?: string;
  whatsAppVehicleName?: string;
  whatsAppSource?: string;
  compact?: boolean;
  isSold?: boolean;
  hasFactoryWarranty?: boolean;
  hasBaixaKm?: boolean;
  hasIcheck?: boolean;
}

const SEAL_COLORS = {
  garantia: "#69BDCD",
  baixaKm: "#004C5C",
  icheck: "#59C897",
} as const;

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
  financeHref,
  whatsAppVehicleId,
  whatsAppVehicleName,
  whatsAppSource = "home_destaques",
  compact = false,
  isSold = false,
  hasFactoryWarranty = false,
  hasBaixaKm = false,
  hasIcheck = false,
}: CardsHeroProps) {
  const showSeals = !isSold && (hasFactoryWarranty || hasBaixaKm || hasIcheck);
  const sealBase = compact
    ? "rounded-full px-2 py-0.5 text-[7px] tracking-[0.04em] font-bold uppercase text-white leading-none"
    : "rounded-full px-2.5 py-1 text-[9px] tracking-[0.06em] font-bold uppercase text-white leading-none short1600:px-2 short1600:py-0.5 short1600:text-[8px]";

  const content = (
    <div className={`group relative bg-white shadow-[0_10px_40px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.08)] transition-all duration-500 flex flex-col items-center h-full ${
      compact
        ? "rounded-[22px] p-3"
        : "rounded-[40px] p-8 short1600:rounded-[28px] short1600:p-5"
    }`} style={{ border: '1px solid rgba(229, 231, 235, 0.5)' }}>
      {/* Selo em formato de carimbo */}
      {SHOW_CAMPAIGN_STAMP && !isSold && (
        <img
          src="/selos/selo_campanha.png"
          alt="Selo de campanha"
          className={`absolute z-20 pointer-events-none select-none h-auto ${
            compact
              ? "top-16 right-2 md:top-16 md:right-3 w-20 md:w-24"
              : "top-16 right-2 md:top-16 md:right-3 w-20 md:w-24 short1600:top-14 short1600:right-3 short1600:w-20"
          }`}
        />
      )}
      
      {/* Floating Image Section */}
      <div className={`!border-0 absolute left-[-2%] right-[-2%] flex items-center justify-center z-10 pointer-events-none ${
        compact
          ? "-top-16 h-32 md:-top-44 md:h-80"
          : "-top-32 md:-top-44 h-64 md:h-80 short1600:-top-24 short1600:h-52"
      }`}>
        <div className="!border-0 relative w-full h-full">
          <img 
            src={image} 
            alt={`${brand} ${model}`.trim() || "Veículo seminovo"}
            loading="lazy"
            decoding="async"
            className={`!border-0 w-full h-full object-contain transition-transform duration-700 group-hover:scale-110 group-hover:-rotate-2 drop-shadow-[0_20px_30px_rgba(0,0,0,0.15)] ${isSold ? "grayscale-[0.25]" : ""}`}
          />
          {isSold && (
            <div
              aria-hidden="true"
              className={`absolute inset-0 z-20 flex items-center justify-center ${
                compact ? "pt-4 md:pt-8" : "pt-4 md:pt-8 short1600:pt-4"
              }`}
            >
              <span
                className={`-rotate-[16deg] border-[#E10600]/70 bg-white/40 font-black uppercase tracking-[0.08em] text-[#E10600]/80 shadow-[0_8px_24px_rgba(0,0,0,0.12)] ${
                  compact
                    ? "rounded-lg border-[3px] px-2 py-0.5 text-xs sm:rounded-xl sm:border-[4px] sm:px-3 sm:py-1 sm:text-sm md:text-base"
                    : "rounded-xl border-[5px] px-4 py-1.5 text-2xl sm:rounded-2xl sm:border-[6px] sm:px-6 sm:py-2 sm:text-3xl md:border-[7px] md:px-7 md:py-2.5 md:text-4xl short1600:border-[5px] short1600:px-4 short1600:py-1.5 short1600:text-2xl"
                }`}
              >
                Vendido
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content Section */}
      <div className={`!border-0 w-full flex flex-col items-start text-left flex-1 ${
        compact
          ? "pt-16 space-y-1.5"
          : "pt-28 md:pt-32 space-y-4 short1600:pt-24 short1600:space-y-2"
      }`}>
         <span className={`!border-0 bg-[#00283C] text-white hover:bg-[#00283C] rounded-md font-bold tracking-widest uppercase w-fit inline-block ${
           compact ? "px-2 py-0.5 text-[8px]" : "px-3 py-1 text-[10px] short1600:px-2.5 short1600:py-0.5 short1600:text-[9px]"
         }`}>
           {brand}
         </span>

         {/* Model and Year - Left aligned */}
         <div className="!border-0 space-y-0.5 w-full">
           <h3 className={`!border-0 font-bold leading-snug ${
             compact
               ? "line-clamp-2 min-h-[2.35rem] text-[11px]"
               : "text-[17px] short1600:line-clamp-2 short1600:text-[15px]"
           }`} style={{ color: '#00283C' }}>
             {model}
           </h3>
           <p className={`!border-0 text-gray-400 font-medium ${compact ? "text-[10px]" : "text-base short1600:text-sm"}`}>{year}</p>
         </div>

         {/* Selos pill: body do card (não overlay da foto) */}
         {showSeals ? (
           <div className={`!border-0 flex flex-wrap items-center ${compact ? "gap-1" : "gap-1.5"}`}>
             {hasFactoryWarranty ? (
               <span className={sealBase} style={{ backgroundColor: SEAL_COLORS.garantia }}>
                 Garantia de fábrica
               </span>
             ) : null}
             {hasBaixaKm ? (
               <span className={sealBase} style={{ backgroundColor: SEAL_COLORS.baixaKm }}>
                 Baixa KM
               </span>
             ) : null}
             {hasIcheck ? (
               <span className={sealBase} style={{ backgroundColor: SEAL_COLORS.icheck }}>
                 iCheck aprovado
               </span>
             ) : null}
           </div>
         ) : null}

         {/* Price and Action — altura reservada pra alinhar CTA entre cards */}
         <div className={`!border-0 w-full min-w-0 flex flex-col items-stretch mt-auto ${
           compact ? "gap-1.5 pt-2" : "gap-2 pt-4 short1600:gap-1.5 short1600:pt-2"
         }`}>
           <div
             className={`!border-0 w-full min-w-0 flex items-end ${
               compact ? "min-h-[1.25rem]" : "min-h-[2rem] short1600:min-h-[1.5rem]"
             }`}
           >
             {isSold ? (
               <p className={`!border-0 font-semibold font-sans tracking-tight leading-tight text-[#00283C]/45 ${compact ? "text-xs" : "text-sm"}`}>
                 Indisponível · ver similares
               </p>
             ) : showPriceComparison && previousPrice ? (
               <div className="flex flex-col items-start gap-1 short1600:gap-0.5">
                 <p className="!border-0 font-semibold text-gray-500 leading-none text-xs">
                   De: <span className="line-through">{previousPrice}</span>
                 </p>
                 <div className="flex flex-col items-start leading-none gap-0.5">
                   <span className="!border-0 text-[11px] font-semibold uppercase text-gray-400">Para:</span>
                   <p className="!border-0 font-bold font-sans tracking-tight text-base leading-tight short1600:text-sm" style={{ color: '#5CD29D' }}>
                     {price}
                   </p>
                 </div>
               </div>
             ) : (
               <p className={`!border-0 font-bold font-sans tracking-tight leading-tight ${
                 compact ? "text-sm" : "text-[24px] short1600:text-xl"
               }`} style={{ color: '#5CD29D' }}>
                 {price}
               </p>
             )}
           </div>

           {isSold ? (
             <div
               className={`!border-0 box-border flex w-full min-w-0 items-center justify-center rounded-full border border-[#00283C]/15 bg-[#F3F5F6] font-bold text-[#00283C] ${
                 compact ? "h-9 px-3 text-[9px]" : "h-10 px-4 text-[12px] short1600:h-9 short1600:px-3 short1600:text-[11px]"
               }`}
             >
               Ver detalhes
             </div>
           ) : whatsAppHref ? (
             <a
               href={whatsAppHref}
               target="_blank"
               rel="noopener noreferrer"
               data-wa-source={whatsAppSource}
               data-wa-intent="vehicle_inquiry"
               data-wa-vehicle-id={whatsAppVehicleId}
               data-wa-vehicle-name={whatsAppVehicleName}
               onClick={(e) => e.stopPropagation()}
               className={`!border-0 inline-flex w-full items-center justify-center gap-1 rounded-full bg-[#25D366] font-black uppercase text-white shadow-lg transition-colors hover:bg-[#128C7E] ${
                 compact
                   ? "h-9 px-2 text-[9px] tracking-normal whitespace-nowrap"
                   : "h-10 px-3 text-[11px] tracking-wide short1600:h-9 short1600:text-[10px] short1600:whitespace-nowrap"
               }`}
             >
              <MessageCircle className={`shrink-0 ${compact ? "h-3.5 w-3.5" : "h-4 w-4 short1600:h-3.5 short1600:w-3.5"}`} />
              <span className={compact ? undefined : "short1600:hidden"}>
                {compact ? "Tenho interesse" : "Tenho interesse neste carro"}
              </span>
              {!compact ? (
                <span className="hidden short1600:inline">Tenho interesse</span>
              ) : null}
             </a>
           ) : (
             <button
               className="!border-0 h-10 w-10 short1600:h-9 short1600:w-9 rounded-full transition-all duration-300 shadow-lg group/btn flex items-center justify-center shrink-0"
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

           {/* Mobile compact: links curtos */}
           {!isSold && compact && whatsAppHref && (tradeInHref || financeHref) ? (
             <div className="flex items-center justify-center gap-1.5 text-[9px] font-bold leading-none">
               {tradeInHref ? (
                 <a
                   href={tradeInHref}
                   target="_blank"
                   rel="noopener noreferrer"
                   data-wa-source={`${whatsAppSource}_trade`}
                   data-wa-intent="trade_in"
                   data-wa-vehicle-id={whatsAppVehicleId}
                   data-wa-vehicle-name={whatsAppVehicleName}
                   onClick={(e) => e.stopPropagation()}
                   className="text-[#00283C] underline underline-offset-2 transition-colors hover:text-[#5CD29D]"
                 >
                   Troca →
                 </a>
               ) : null}
               {tradeInHref && financeHref ? (
                 <span className="text-gray-300" aria-hidden="true">·</span>
               ) : null}
               {financeHref ? (
                 <a
                   href={financeHref}
                   target="_blank"
                   rel="noopener noreferrer"
                   data-wa-source={`${whatsAppSource}_finance`}
                   data-wa-intent="simulate_finance"
                   data-wa-vehicle-id={whatsAppVehicleId}
                   data-wa-vehicle-name={whatsAppVehicleName}
                   onClick={(e) => e.stopPropagation()}
                   className="text-[#00283C] underline underline-offset-2 transition-colors hover:text-[#5CD29D]"
                 >
                  Simular →
                 </a>
               ) : null}
             </div>
           ) : null}

           {/* Desktop normal: textos longos; short1600: linha compacta */}
           {!compact ? (
             <>
               <div className="flex min-h-[2.75rem] flex-col justify-start gap-2 short1600:hidden">
                 {!isSold && whatsAppHref && tradeInHref ? (
                   <a
                     href={tradeInHref}
                     target="_blank"
                     rel="noopener noreferrer"
                     data-wa-source={`${whatsAppSource}_trade`}
                     data-wa-intent="trade_in"
                     data-wa-vehicle-id={whatsAppVehicleId}
                     data-wa-vehicle-name={whatsAppVehicleName}
                     onClick={(e) => e.stopPropagation()}
                     className="!border-0 w-full text-center text-xs font-bold text-[#00283C] underline underline-offset-4 transition-colors hover:text-[#5CD29D]"
                   >
                     Avaliar meu carro na troca deste →
                   </a>
                 ) : null}
                 {!isSold && whatsAppHref && financeHref ? (
                   <a
                     href={financeHref}
                     target="_blank"
                     rel="noopener noreferrer"
                     data-wa-source={`${whatsAppSource}_finance`}
                     data-wa-intent="simulate_finance"
                     data-wa-vehicle-id={whatsAppVehicleId}
                     data-wa-vehicle-name={whatsAppVehicleName}
                     onClick={(e) => e.stopPropagation()}
                     className="!border-0 w-full text-center text-xs font-bold text-[#00283C] underline underline-offset-4 transition-colors hover:text-[#5CD29D]"
                   >
                     Comparar financiamento →
                   </a>
                 ) : null}
               </div>

               {!isSold && whatsAppHref && (tradeInHref || financeHref) ? (
                 <div className="hidden short1600:flex items-center justify-center gap-1.5 text-[10px] font-bold leading-none">
                   {tradeInHref ? (
                     <a
                       href={tradeInHref}
                       target="_blank"
                       rel="noopener noreferrer"
                       data-wa-source={`${whatsAppSource}_trade`}
                       data-wa-intent="trade_in"
                       data-wa-vehicle-id={whatsAppVehicleId}
                       data-wa-vehicle-name={whatsAppVehicleName}
                       onClick={(e) => e.stopPropagation()}
                       className="text-[#00283C] underline underline-offset-2 transition-colors hover:text-[#5CD29D]"
                     >
                       Troca →
                     </a>
                   ) : null}
                   {tradeInHref && financeHref ? (
                     <span className="text-gray-300" aria-hidden="true">·</span>
                   ) : null}
                   {financeHref ? (
                     <a
                       href={financeHref}
                       target="_blank"
                       rel="noopener noreferrer"
                       data-wa-source={`${whatsAppSource}_finance`}
                       data-wa-intent="simulate_finance"
                       data-wa-vehicle-id={whatsAppVehicleId}
                       data-wa-vehicle-name={whatsAppVehicleName}
                       onClick={(e) => e.stopPropagation()}
                       className="text-[#00283C] underline underline-offset-2 transition-colors hover:text-[#5CD29D]"
                     >
                       Financiar →
                     </a>
                   ) : null}
                 </div>
               ) : null}
             </>
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
        className={`${
          compact
            ? "pt-12 h-full"
            : "pt-24 md:pt-32 h-full short1600:pt-20"
        } ${onClick ? 'cursor-pointer' : ''}`}
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
      className={`${
        compact
          ? "pt-12 h-full"
          : "pt-24 md:pt-32 h-full short1600:pt-20"
      } ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {content}
    </motion.div>
  );
}
