import { Camera, MessageCircle } from "lucide-react";
import { SHOW_CAMPAIGN_STAMP } from "@/config/features";
import { optimizeStockImage, stockImageSrcSet } from "@/lib/images";
import { isFactoryWarrantyLayoutEnabled } from "@/lib/factoryWarrantyStamp";
import {
  FactoryWarrantyBadge,
  type FactoryWarrantyBadgeProps,
} from "./FactoryWarrantyBadge";

const MILEAGE_BADGE_TITLE =
  "Rodou menos de 10 mil km por ano — bem abaixo da média de uso";

interface CardsHeroProps {
  vehicleId?: string;
  image: string;
  brand: string;
  model: string;
  year: string;
  fuel: string;
  transmission: string;
  mileage: string;
  /** Pílula ao lado dos specs quando a km fica oculta mas o uso anual é baixo. */
  mileageBadge?: string;
  /** Ignorado: cards mostram sempre os mesmos campos. Mantido pra compatibilidade. */
  marketingBadge?: string;
  warrantyStamp?: Omit<FactoryWarrantyBadgeProps, "variant">;
  tractionBatteryStamp?: Omit<FactoryWarrantyBadgeProps, "variant"> & {
    scope: "traction-battery";
  };
  powertrainStamp?: Omit<FactoryWarrantyBadgeProps, "variant"> & {
    scope: "powertrain";
    termYears: number;
    sourceUrl: string;
    sourceLabel: string;
    sourceDescription: string;
  };
  proofBadge?: string;
  price: string;
  previousPrice?: string;
  showPriceComparison?: boolean;
  delay?: number;
  fastAnimation?: boolean;
  eagerImage?: boolean;
  onClick?: () => void;
  whatsAppHref?: string;
  tradeInHref?: string;
  financeHref?: string;
  whatsAppVehicleId?: string;
  whatsAppVehicleName?: string;
  whatsAppSource?: string;
  compact?: boolean;
  isSold?: boolean;
  /** Total de fotos: mostra pílula "N fotos" sobre a imagem. */
  photoCount?: number;
  /** Abertura da ficha pelo botão "Ver carro" (o card em si já navega). */
  onOpen?: (via: "button") => void;
}

export function CardsHero({
  vehicleId,
  image,
  brand,
  model,
  price,
  previousPrice,
  showPriceComparison = false,
  year,
  transmission,
  mileage,
  mileageBadge,
  warrantyStamp,
  tractionBatteryStamp,
  powertrainStamp,
  proofBadge,
  delay = 0,
  eagerImage = false,
  onClick,
  whatsAppHref,
  whatsAppVehicleId,
  whatsAppVehicleName,
  whatsAppSource = "home_destaques",
  compact = false,
  isSold = false,
  photoCount,
  onOpen,
}: CardsHeroProps) {
  // `delay` é o índice do card na lista. Os primeiros ficam acima da dobra e
  // costumam ser o elemento de LCP — carregar preguiçosamente atrasa a métrica.
  const isAboveTheFold = delay < (compact ? 4 : 5);
  const deferOffscreenPaint = !isAboveTheFold;
  // Linha de specs igual em todo card: ano · km · câmbio.
  const shortTransmission = /autom/i.test(transmission)
    ? "Aut."
    : /manual/i.test(transmission)
      ? "Man."
      : transmission;
  const specsLine = [year, mileage, shortTransmission]
    .filter(Boolean)
    .join(" · ");
  const hasMultipleCoverages = Boolean(
    tractionBatteryStamp && (warrantyStamp || powertrainStamp),
  );
  const stampClassName = `shrink-0 rounded-full bg-white/95 ${compact ? "w-[clamp(46px,14.25vw,56px)]" : "w-[68px]"}`;
  const content = (
    <div
      className={`group relative bg-white shadow-[0_10px_40px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.08)] transition-all duration-500 flex flex-col items-center h-full ${
        compact
          ? "rounded-[22px] p-3"
          : "rounded-[40px] p-8 short1600:rounded-[28px] short1600:p-5"
      }`}
      style={{ border: "1px solid rgba(229, 231, 235, 0.5)" }}
    >
      {/* Selo em formato de carimbo */}
      {SHOW_CAMPAIGN_STAMP && !isSold && (
        <img
          src="/selos/selo_campanha.png"
          alt="Selo de campanha"
          className={`absolute z-20 h-auto pointer-events-none select-none ${
            compact
              ? "top-16 right-2 w-20 md:top-16 md:right-3 md:w-24"
              : "top-16 right-2 w-20 md:top-16 md:right-3 md:w-24 short1600:top-14 short1600:right-3 short1600:w-20"
          }`}
        />
      )}

      {(warrantyStamp || powertrainStamp || tractionBatteryStamp) && (
        <div
          className={`pointer-events-none select-none absolute z-20 flex gap-1 ${compact ? "right-1 top-0" : "right-3 top-8 short1600:top-3"}`}
        >
          {warrantyStamp && (
            <div className={stampClassName}>
              <FactoryWarrantyBadge {...warrantyStamp} variant="card" />
            </div>
          )}
          {powertrainStamp && (
            <div className={stampClassName}>
              <FactoryWarrantyBadge {...powertrainStamp} variant="card" />
            </div>
          )}
          {tractionBatteryStamp && (
            <div className={stampClassName}>
              <FactoryWarrantyBadge {...tractionBatteryStamp} variant="card" />
            </div>
          )}
        </div>
      )}

      {/* Contador de fotos: sinaliza que tem galeria atrás da foto */}
      {!isSold && photoCount != null && photoCount > 1 && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute z-20 inline-flex items-center gap-1 rounded-full bg-black/55 font-bold text-white backdrop-blur-sm ${
            compact
              ? `left-2 ${hasMultipleCoverages ? "-top-6" : "top-11"} px-1.5 py-0.5 text-[10px]`
              : "left-3 top-24 px-2 py-1 text-[11px] md:top-28 short1600:top-20"
          }`}
        >
          <Camera className="h-3 w-3" />
          {photoCount} fotos
        </span>
      )}

      {/* Floating Image Section */}
      <div
        className={`!border-0 absolute left-[-2%] right-[-2%] flex items-center justify-center z-10 pointer-events-none ${
          compact
            ? "-top-16 h-32 md:-top-44 md:h-80"
            : "-top-32 md:-top-44 h-64 md:h-80 short1600:-top-24 short1600:h-52"
        }`}
      >
        <div
          className={`!border-0 relative w-full h-full origin-bottom ${compact ? "scale-[1.2]" : "scale-[1.15]"}`}
        >
          <img
            src={optimizeStockImage(image, compact ? 640 : 960)}
            srcSet={stockImageSrcSet(image, [320, 480, 640, 768, 960])}
            sizes={
              compact
                ? "(max-width: 767px) 50vw, 25vw"
                : "(max-width: 767px) 100vw, 25vw"
            }
            alt={`${brand} ${model}`.trim() || "Veículo seminovo"}
            width={960}
            height={640}
            loading={isAboveTheFold || eagerImage ? "eager" : "lazy"}
            fetchPriority={
              delay === 0 ? "high" : deferOffscreenPaint ? "low" : "auto"
            }
            decoding={delay === 0 ? "sync" : "async"}
            className={`!border-0 w-full h-full object-contain transition-transform duration-700 ${warrantyStamp || powertrainStamp ? "" : "group-hover:scale-105"} drop-shadow-[0_20px_30px_rgba(0,0,0,0.15)] ${isSold ? "grayscale-[0.25]" : ""}`}
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
      <div
        className={`!border-0 w-full flex flex-col items-start text-left flex-1 ${
          compact
            ? "pt-16 gap-2"
            : "pt-28 md:pt-32 gap-3 short1600:pt-24 short1600:gap-2"
        }`}
      >
        {/* Identidade com altura estável, inclusive quando não há i-CHECK. */}
        <div className="!border-0 w-full space-y-1">
          <div
            className={`!border-0 flex w-full items-center ${
              compact ? "min-h-5 gap-1" : "min-h-7 gap-2"
            }`}
          >
            <span
              title={brand}
              className={
                compact
                  ? "min-w-0 truncate text-[10px] font-bold uppercase tracking-wider text-gray-400"
                  : "min-w-0 truncate rounded-md bg-[#00283C] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white short1600:px-2.5 short1600:py-0.5 short1600:text-[9px]"
              }
            >
              {brand}
            </span>
            {proofBadge && (
              <span
                className={`ml-auto shrink-0 rounded-full border border-[#087A37]/25 bg-white font-extrabold uppercase tracking-wide text-[#087A37] ${
                  compact
                    ? "px-1.5 py-0.5 text-[9px]"
                    : "px-2.5 py-1 text-[10px] short1600:px-2 short1600:text-[9px]"
                }`}
              >
                {proofBadge}
              </span>
            )}
          </div>
          <h3
            className={`!border-0 line-clamp-2 font-bold leading-snug ${
              compact
                ? "min-h-[2.5rem] text-sm"
                : "min-h-[3rem] text-[17px] short1600:min-h-[2.6rem] short1600:text-[15px]"
            }`}
            style={{ color: "#00283C" }}
          >
            {model}
          </h3>
        </div>
        <div
          className={`!border-0 flex w-full min-w-0 flex-wrap content-start items-start ${
            compact ? "min-h-6 gap-x-1.5 gap-y-1" : "min-h-6 gap-x-2 gap-y-1"
          }`}
        >
          <p
            className={`!border-0 min-w-0 max-w-full whitespace-normal font-semibold text-gray-500 ${
              compact ? "text-[11px] leading-4" : "text-sm short1600:text-xs"
            }`}
          >
            {specsLine}
          </p>
          {mileageBadge && (
            <span
              className={`inline-flex shrink-0 items-center rounded-full bg-[#004C5C] py-0.5 font-extrabold uppercase tracking-wide text-white ${compact ? "px-1.5 text-[9px]" : "px-2.5 text-[10px] short1600:px-2 short1600:text-[9px]"}`}
              title={MILEAGE_BADGE_TITLE}
            >
              {mileageBadge}
            </span>
          )}
        </div>

        {/* Price and Action — altura reservada pra alinhar CTA entre cards */}
        <div
          className={`!border-0 w-full min-w-0 flex flex-col items-stretch ${isFactoryWarrantyLayoutEnabled ? "!mt-auto" : "mt-auto"} ${
            compact
              ? "gap-1.5 pt-2"
              : "gap-2 pt-4 short1600:gap-1.5 short1600:pt-2"
          }`}
        >
          <div
            className={`!border-0 w-full min-w-0 flex items-end ${
              compact
                ? "min-h-[1.25rem]"
                : "min-h-[2rem] short1600:min-h-[1.5rem]"
            }`}
          >
            {isSold ? (
              <p
                className={`!border-0 font-semibold font-sans tracking-tight leading-tight text-[#00283C]/45 ${compact ? "text-xs" : "text-sm"}`}
              >
                Indisponível · ver similares
              </p>
            ) : showPriceComparison && previousPrice ? (
              <div className="flex flex-col items-start gap-1 short1600:gap-0.5">
                <p
                  className={`!border-0 font-semibold text-gray-500 leading-none text-xs ${compact ? "whitespace-nowrap" : ""}`}
                >
                  De: <span className="line-through">{previousPrice}</span>
                </p>
                <div className="flex flex-col items-start leading-none gap-0.5">
                  <span className="!border-0 text-[11px] font-semibold uppercase text-gray-400">
                    Para:
                  </span>
                  <p
                    className={`!border-0 font-bold font-sans tracking-tight leading-tight ${compact ? "whitespace-nowrap text-[clamp(14px,4.35vw,17px)]" : "text-base short1600:text-sm"}`}
                    style={{ color: "#0B6B4B" }}
                  >
                    {price}
                  </p>
                </div>
              </div>
            ) : (
              <p
                className={`!border-0 font-bold font-sans tracking-tight leading-tight ${
                  compact
                    ? "whitespace-nowrap text-[clamp(14px,4.35vw,17px)]"
                    : "text-[24px] short1600:text-xl"
                }`}
                style={{ color: "#0B6B4B" }}
              >
                {price}
              </p>
            )}
          </div>

          {isSold ? (
            <div
              className={`!border-0 box-border flex w-full min-w-0 items-center justify-center rounded-full border border-[#00283C]/15 bg-[#F3F5F6] font-bold text-[#00283C] ${
                compact
                  ? "h-11 px-3 text-xs"
                  : "h-11 px-3 text-[12px] md:h-9 [@media(pointer:coarse)]:min-h-11 short1600:text-[11px]"
              }`}
            >
              Ver detalhes
            </div>
          ) : (
            /* "Ver carro" sempre; WhatsApp divide a linha quando existir.
               Muita gente não sabe que a foto é clicável. */
            <div className="!border-0 flex w-full min-w-0 items-stretch gap-1.5">
              <button
                type="button"
                data-card-action="ver_carro"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen?.("button");
                }}
                className={`!border-0 inline-flex min-w-0 flex-1 items-center justify-center gap-1 rounded-full bg-[#00283C] font-bold uppercase text-white transition-colors hover:bg-[#003d5c] ${
                  compact
                    ? "h-11 px-2 text-[11px] tracking-normal whitespace-nowrap"
                    : "h-11 px-3 text-[11px] tracking-wide md:h-9 [@media(pointer:coarse)]:min-h-11 short1600:text-[10px] short1600:whitespace-nowrap"
                }`}
              >
                Ver carro
              </button>
              {whatsAppHref && (
                <a
                  href={whatsAppHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Falar deste carro no WhatsApp"
                  data-wa-source={whatsAppSource}
                  data-wa-intent="vehicle_inquiry"
                  data-wa-vehicle-id={whatsAppVehicleId}
                  data-wa-vehicle-name={whatsAppVehicleName}
                  onClick={(e) => e.stopPropagation()}
                  className={`!border-0 inline-flex shrink-0 items-center justify-center gap-1 rounded-full bg-[#087A37] font-bold uppercase text-white transition-colors hover:bg-[#075E54] ${
                    compact
                      ? "h-11 w-11"
                      : "h-11 w-11 md:h-9 md:w-9 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
                  }`}
                >
                  <MessageCircle
                    className={`shrink-0 ${compact ? "h-4 w-4" : "h-4 w-4 short1600:h-3.5 short1600:w-3.5"}`}
                  />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div
      data-showroom-vehicle-id={vehicleId}
      className={`${
        compact ? "pt-12 h-full" : "pt-24 md:pt-32 h-full short1600:pt-20"
      } ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      {content}
    </div>
  );
}
