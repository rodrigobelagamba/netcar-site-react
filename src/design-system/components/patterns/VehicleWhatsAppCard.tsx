import { ArrowLeftRight, MessageCircle } from "lucide-react";
import type { VehicleFocusPayload } from "./VehicleCard";
import { optimizeStockImage } from "@/lib/images";

interface VehicleWhatsAppCardProps {
  vehicle: VehicleFocusPayload;
  href: string;
  source: string;
  tradeHref?: string;
  tradeSource?: string;
  eyebrow?: string;
  ctaLabel?: string;
  tradeCtaLabel?: string;
  className?: string;
}

/** Card WA com carro identificado (mesmo visual do sticky da home). */
export function VehicleWhatsAppCard({
  vehicle,
  href,
  source,
  tradeHref,
  tradeSource = `${source}_trade`,
  eyebrow = "Último que você viu",
  ctaLabel = "Falar deste carro",
  tradeCtaLabel = "Avaliar meu carro na troca deste",
  className = "",
}: VehicleWhatsAppCardProps) {
  return (
    <div
      className={`w-full rounded-xl border border-[#25D366]/30 bg-white/95 px-2 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)] md:rounded-2xl md:px-3 md:py-2.5 md:shadow-[0_12px_36px_rgba(0,0,0,0.10)] ${className}`}
    >
      <div className="mb-1 flex items-center justify-center gap-2 md:mb-1.5 md:gap-2.5">
        <img
          src={optimizeStockImage(vehicle.image, 200)}
          alt=""
          width={56}
          height={44}
          decoding="async"
          className="h-8 w-11 shrink-0 rounded-md bg-[#F3F5F6] object-contain md:h-11 md:w-14 md:rounded-lg"
          loading="lazy"
        />
        <div className="min-w-0 max-w-[70%] text-left">
          <p className="hidden truncate text-[11px] font-bold uppercase tracking-wide text-[#00283C]/55 md:block">
            {eyebrow}
          </p>
          <p className="truncate text-xs font-black leading-tight text-[#00283C] md:text-sm">
            {vehicle.label}
          </p>
          <p className="truncate text-xs font-black text-[#087A37] md:text-sm">
            {vehicle.priceLabel}
          </p>
        </div>
      </div>
      <div className={tradeHref ? "grid grid-cols-2 gap-1.5 md:gap-2" : ""}>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          data-wa-source={source}
          data-wa-intent="vehicle_inquiry"
          data-wa-vehicle-id={vehicle.id}
          data-wa-vehicle-name={vehicle.label}
          className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-[#087A37] px-2 py-2 text-center text-[11px] font-black leading-tight text-white shadow-[0_4px_12px_rgba(8,122,55,0.28)] transition-colors hover:bg-[#075E54] md:min-h-12 md:gap-2 md:rounded-xl md:px-3 md:py-2.5 md:text-xs md:shadow-[0_6px_18px_rgba(8,122,55,0.30)]"
        >
          <MessageCircle className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4" />
          <span>{ctaLabel}</span>
        </a>
        {tradeHref && (
          <a
            href={tradeHref}
            target="_blank"
            rel="noopener noreferrer"
            data-wa-source={tradeSource}
            data-wa-intent="trade_in"
            data-wa-vehicle-id={vehicle.id}
            data-wa-vehicle-name={vehicle.label}
            className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-[#00283C] px-2 py-2 text-center text-[11px] font-black leading-tight text-white shadow-[0_4px_12px_rgba(0,40,60,0.22)] transition-colors hover:bg-[#00435A] md:min-h-12 md:gap-2 md:rounded-xl md:px-3 md:py-2.5 md:text-xs"
          >
            <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4" />
            <span>{tradeCtaLabel}</span>
          </a>
        )}
      </div>
    </div>
  );
}
