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
      className={`w-full rounded-2xl border border-[#25D366]/30 bg-white/95 px-3 py-2.5 shadow-[0_12px_36px_rgba(0,0,0,0.10)] ${className}`}
    >
      <div className="mb-1.5 flex items-center justify-center gap-2.5">
        <img
          src={vehicle.image}
          alt=""
          className="h-11 w-14 shrink-0 rounded-lg bg-[#F3F5F6] object-contain"
          loading="lazy"
        />
        <div className="min-w-0 max-w-[70%] text-left">
          <p className="truncate text-[11px] font-bold uppercase tracking-wide text-[#00283C]/55">
            {eyebrow}
          </p>
          <p className="truncate text-sm font-black leading-tight text-[#00283C]">
            {vehicle.label}
          </p>
          <p className="truncate text-sm font-black text-[#5CD29D]">
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
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-black text-white shadow-[0_6px_18px_rgba(37,211,102,0.30)] transition-colors hover:bg-[#128C7E]"
      >
        <MessageCircle className="h-4 w-4" />
        {ctaLabel}
      </a>
    </div>
  );
}
