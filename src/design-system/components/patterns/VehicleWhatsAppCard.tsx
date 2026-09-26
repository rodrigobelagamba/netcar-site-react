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

/** Barra de contato compacta: horizontal no desktop, duas linhas no celular. */
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
      className={`grid w-full gap-1 rounded-xl border border-[#25D366]/25 bg-white/95 px-2 py-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.10)] md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-3 md:px-3 md:py-2 ${className}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <img
          src={optimizeStockImage(vehicle.image, 200)}
          alt=""
          width={48}
          height={36}
          decoding="async"
          className="h-8 w-11 shrink-0 rounded-md bg-[#F3F5F6] object-contain md:h-9 md:w-12"
          loading="lazy"
        />
        <div className="min-w-0 flex-1 text-left">
          <p className="sr-only">{eyebrow}</p>
          <p
            className="truncate text-xs font-black leading-tight text-[#00283C]"
            title={vehicle.label}
          >
            {vehicle.label}
          </p>
          <p className="truncate text-xs font-black text-[#087A37] md:text-sm">
            {vehicle.priceLabel}
          </p>
        </div>
      </div>
      <div
        className={`grid gap-1.5 md:flex md:items-center md:gap-2 ${tradeHref ? "grid-cols-2" : "grid-cols-1"}`}
      >
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          data-wa-source={source}
          data-wa-intent="vehicle_inquiry"
          data-wa-vehicle-id={vehicle.id}
          data-wa-vehicle-name={vehicle.label}
          className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-[#087A37] px-2 py-2 text-center text-[11px] font-black leading-tight text-white transition-colors hover:bg-[#075E54] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087A37] md:w-auto md:whitespace-nowrap md:px-3 md:text-xs"
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
            aria-label={`${tradeCtaLabel}: meu carro por ${vehicle.label}`}
            className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-[#00283C] px-2 py-2 text-center text-[11px] font-black leading-tight text-white transition-colors hover:bg-[#00435A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00283C] md:w-auto md:whitespace-nowrap md:px-3 md:text-xs"
          >
            <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4" />
            <span>{tradeCtaLabel}</span>
          </a>
        )}
      </div>
    </div>
  );
}
