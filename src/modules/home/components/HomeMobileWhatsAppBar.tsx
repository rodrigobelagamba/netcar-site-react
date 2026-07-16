import { MessageCircle } from "lucide-react";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import {
  buildWhatsAppUrl,
  homeWhatsAppMessages,
  vehicleWhatsAppMessages,
} from "@/lib/whatsappMessages";
import type { VehicleFocusPayload } from "@/design-system/components/patterns/VehicleCard";

export type HomeStickyVehicle = VehicleFocusPayload;

interface HomeMobileWhatsAppBarProps {
  focusedVehicle?: HomeStickyVehicle | null;
  /** Override do link frio (ex.: filtros do estoque). */
  coldHref?: string;
  coldCtaLabel?: string;
  coldHint?: string;
  sourceHot?: string;
  sourceCold?: string;
}

export function HomeMobileWhatsAppBar({
  focusedVehicle = null,
  coldHref,
  coldCtaLabel = "Quero ajuda pra escolher",
  coldHint = "Passe o mouse ou role o estoque pra falar de um carro",
  sourceHot = "sticky_hot",
  sourceCold = "sticky_cold",
}: HomeMobileWhatsAppBarProps) {
  const { data: whatsapp } = useWhatsAppQuery();

  if (!whatsapp?.numero) return null;

  const hot = focusedVehicle;
  const coldMessages = homeWhatsAppMessages();
  const href = hot
    ? buildWhatsAppUrl(
        whatsapp.numero,
        vehicleWhatsAppMessages(hot.label).info,
      )
    : coldHref ||
      buildWhatsAppUrl(whatsapp.numero, coldMessages.vehicleInterest);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center px-3">
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-[#25D366]/30 bg-white/95 px-3 py-2.5 shadow-[0_12px_36px_rgba(0,0,0,0.16)] backdrop-blur-md">
        {hot ? (
          <>
            <div className="mb-1.5 flex items-center justify-center gap-2.5">
              <img
                src={hot.image}
                alt=""
                className="h-11 w-14 shrink-0 rounded-lg bg-[#F3F5F6] object-contain"
                loading="lazy"
              />
              <div className="min-w-0 max-w-[70%] text-left">
                <p className="truncate text-[11px] font-bold uppercase tracking-wide text-[#00283C]/55">
                  Último que você viu
                </p>
                <p className="truncate text-sm font-black leading-tight text-[#00283C]">
                  {hot.label}
                </p>
                <p className="truncate text-sm font-black text-[#5CD29D]">
                  {hot.priceLabel}
                </p>
              </div>
            </div>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              data-wa-source={sourceHot}
              data-wa-intent="vehicle_inquiry"
              data-wa-vehicle-id={hot.id}
              data-wa-vehicle-name={hot.label}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-black text-white shadow-[0_6px_18px_rgba(37,211,102,0.30)]"
            >
              <MessageCircle className="h-4 w-4" />
              Falar deste carro
            </a>
          </>
        ) : (
          <>
            <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[#00283C]/70">
              Atendimento 24h no WhatsApp
            </p>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              data-wa-source={sourceCold}
              data-wa-intent="vehicle_interest"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-black text-white shadow-[0_6px_18px_rgba(37,211,102,0.30)]"
            >
              <MessageCircle className="h-4 w-4" />
              {coldCtaLabel}
            </a>
            <p className="mt-1 text-center text-[10px] font-medium text-[#00283C]/50">
              {coldHint}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
