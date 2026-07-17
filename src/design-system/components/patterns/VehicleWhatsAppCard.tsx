import { MessageCircle } from "lucide-react";
import type { VehicleFocusPayload } from "./VehicleCard";

interface VehicleWhatsAppCardProps {
  vehicle: VehicleFocusPayload;
  href: string;
  source: string;
  eyebrow?: string;
  ctaLabel?: string;
  className?: string;
}

/** Card WA com carro identificado (mesmo visual do sticky da home). */
export function VehicleWhatsAppCard({
  vehicle,
  href,
  source,
  eyebrow = "Último que você viu",
  ctaLabel = "Falar deste carro",
  className = "",
}: VehicleWhatsAppCardProps) {
  return (
    <div
      className={`w-full rounded-xl border border-[#25D366]/30 bg-white/95 px-2 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)] md:rounded-2xl md:px-3 md:py-2.5 md:shadow-[0_12px_36px_rgba(0,0,0,0.10)] ${className}`}
    >
      <div className="mb-1 flex items-center justify-center gap-2 md:mb-1.5 md:gap-2.5">
        <img
          src={vehicle.image}
          alt=""
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
          <p className="truncate text-xs font-black text-[#5CD29D] md:text-sm">
            {vehicle.priceLabel}
          </p>
        </div>
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-wa-source={source}
        data-wa-intent="vehicle_inquiry"
        data-wa-vehicle-id={vehicle.id}
        data-wa-vehicle-name={vehicle.label}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-black text-white shadow-[0_4px_12px_rgba(37,211,102,0.28)] transition-colors hover:bg-[#128C7E] md:gap-2 md:rounded-xl md:px-4 md:py-2.5 md:text-sm md:shadow-[0_6px_18px_rgba(37,211,102,0.30)]"
      >
        <MessageCircle className="h-3.5 w-3.5 md:h-4 md:w-4" />
        {ctaLabel}
      </a>
    </div>
  );
}
