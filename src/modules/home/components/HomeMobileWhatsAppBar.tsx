import { Link } from "@tanstack/react-router";
import { ArrowRight, MessageCircle } from "lucide-react";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import {
  buildWhatsAppUrl,
  homeWhatsAppMessages,
} from "@/lib/whatsappMessages";
import { emptySeminovosSearch } from "@/lib/seminovos-search";
import { FloatingPortal } from "@/components/FloatingPortal";

interface HomeMobileWhatsAppBarProps {
  /** false = esconde (ex.: ainda no hero). */
  visible?: boolean;
  coldHref?: string;
  coldCtaLabel?: string;
  coldHint?: string;
  stockCtaLabel?: string;
  sourceCold?: string;
}

export function HomeMobileWhatsAppBar({
  visible = true,
  coldHref,
  coldCtaLabel = "Quero ajuda",
  coldHint = "Estoque completo ou ajuda no WhatsApp",
  stockCtaLabel = "Ver estoque",
  sourceCold = "sticky_cold",
}: HomeMobileWhatsAppBarProps) {
  const { data: whatsapp } = useWhatsAppQuery();

  if (!visible || !whatsapp?.numero) return null;

  const href =
    coldHref ||
    buildWhatsAppUrl(whatsapp.numero, homeWhatsAppMessages().vehicleInterest);

  return (
    <FloatingPortal>
      <div className="pointer-events-none fixed inset-x-0 bottom-2 z-[60] flex justify-center px-2 md:bottom-3 md:px-3">
        <div className="pointer-events-auto w-full max-w-[22rem] rounded-xl border border-[#25D366]/30 bg-white/95 px-2 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.14)] backdrop-blur-md md:max-w-sm md:rounded-2xl md:px-3 md:py-2.5 md:shadow-[0_12px_36px_rgba(0,0,0,0.16)]">
          <p className="mb-1 hidden text-center text-[10px] font-semibold uppercase tracking-wide text-[#00283C]/70 md:mb-1.5 md:block">
            Atendimento 24h no WhatsApp
          </p>
          <div className="grid grid-cols-2 gap-1.5 md:gap-2">
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              data-wa-source={sourceCold}
              data-wa-intent="vehicle_interest"
              className="flex items-center justify-center gap-1 rounded-lg bg-[#25D366] px-1.5 py-2 text-[11px] font-black leading-none text-white shadow-[0_4px_12px_rgba(37,211,102,0.28)] md:gap-1.5 md:rounded-xl md:px-2 md:py-2.5 md:text-sm md:shadow-[0_6px_18px_rgba(37,211,102,0.30)]"
            >
              <MessageCircle className="h-3 w-3 shrink-0 md:h-3.5 md:w-3.5" />
              <span className="truncate">{coldCtaLabel}</span>
            </a>
            <Link
              to="/seminovos"
              search={emptySeminovosSearch}
              className="flex items-center justify-center gap-1 rounded-lg bg-[#00283C] px-1.5 py-2 text-[11px] font-black leading-none text-white shadow-[0_4px_12px_rgba(0,40,60,0.20)] transition-colors hover:bg-[#00435a] md:gap-1.5 md:rounded-xl md:px-2 md:py-2.5 md:text-sm md:shadow-[0_6px_18px_rgba(0,40,60,0.22)]"
            >
              <span className="truncate">{stockCtaLabel}</span>
              <ArrowRight className="h-3 w-3 shrink-0 md:h-3.5 md:w-3.5" />
            </Link>
          </div>
          <p className="mt-1.5 hidden text-center text-[10px] font-medium text-[#00283C]/50 md:block">
            {coldHint}
          </p>
        </div>
      </div>
    </FloatingPortal>
  );
}
