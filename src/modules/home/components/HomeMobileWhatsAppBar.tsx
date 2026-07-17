import { Link } from "@tanstack/react-router";
import { ArrowRight, MessageCircle } from "lucide-react";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import {
  buildWhatsAppUrl,
  homeWhatsAppMessages,
  vehicleWhatsAppMessages,
} from "@/lib/whatsappMessages";
import type { VehicleFocusPayload } from "@/design-system/components/patterns/VehicleCard";
import { VehicleWhatsAppCard } from "@/design-system/components/patterns/VehicleWhatsAppCard";
import { emptySeminovosSearch } from "@/lib/seminovos-search";
import { FloatingPortal } from "@/components/FloatingPortal";

export type HomeStickyVehicle = VehicleFocusPayload;

interface HomeMobileWhatsAppBarProps {
  focusedVehicle?: HomeStickyVehicle | null;
  /** false = esconde (ex.: ainda no hero). */
  visible?: boolean;
  /** Override do link frio (ex.: filtros do estoque). */
  coldHref?: string;
  coldCtaLabel?: string;
  coldHint?: string;
  stockCtaLabel?: string;
  sourceHot?: string;
  sourceCold?: string;
  /** Trava foco por scroll enquanto mira/clica o sticky. */
  onPointerLockChange?: (locked: boolean) => void;
}

export function HomeMobileWhatsAppBar({
  focusedVehicle = null,
  visible = true,
  coldHref,
  coldCtaLabel = "Quero ajuda",
  coldHint = "Toque num carro pra falar dele",
  stockCtaLabel = "Ver estoque",
  sourceHot = "sticky_hot",
  sourceCold = "sticky_cold",
  onPointerLockChange,
}: HomeMobileWhatsAppBarProps) {
  const { data: whatsapp } = useWhatsAppQuery();

  if (!visible || !whatsapp?.numero) return null;

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
    <FloatingPortal>
      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-[60] flex justify-center px-3">
        <div
          className="pointer-events-auto w-full max-w-sm rounded-2xl border border-[#25D366]/30 bg-white/95 px-3 py-2.5 shadow-[0_12px_36px_rgba(0,0,0,0.16)] backdrop-blur-md"
          onPointerEnter={() => onPointerLockChange?.(true)}
          onPointerLeave={() => onPointerLockChange?.(false)}
        >
          {hot ? (
            <VehicleWhatsAppCard
              vehicle={hot}
              href={href}
              source={sourceHot}
              className="border-0 bg-transparent p-0 shadow-none"
            />
          ) : (
            <>
              <p className="mb-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-[#00283C]/70">
                Atendimento 24h no WhatsApp
              </p>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-wa-source={sourceCold}
                  data-wa-intent="vehicle_interest"
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-2 py-2.5 text-xs font-black text-white shadow-[0_6px_18px_rgba(37,211,102,0.30)] sm:text-sm"
                >
                  <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{coldCtaLabel}</span>
                </a>
                <Link
                  to="/seminovos"
                  search={emptySeminovosSearch}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-[#00283C] px-2 py-2.5 text-xs font-black text-white shadow-[0_6px_18px_rgba(0,40,60,0.22)] transition-colors hover:bg-[#00435a] sm:text-sm"
                >
                  <span className="truncate">{stockCtaLabel}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                </Link>
              </div>
              <p className="mt-1.5 text-center text-[10px] font-medium text-[#00283C]/50">
                {coldHint}
              </p>
            </>
          )}
        </div>
      </div>
    </FloatingPortal>
  );
}
