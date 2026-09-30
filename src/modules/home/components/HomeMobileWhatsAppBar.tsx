import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { ArrowRight, MessageCircle } from "lucide-react";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import { buildWhatsAppUrl, homeWhatsAppMessages } from "@/lib/whatsappMessages";
import { emptySeminovosSearch } from "@/lib/seminovos-search";
import { FloatingPortal } from "@/components/FloatingPortal";

interface HomeMobileWhatsAppBarProps {
  /** false = esconde (ex.: ainda no hero). */
  visible?: boolean;
  /** Oculta abaixo de 640 px sem alterar tablet/desktop. */
  hideOnMobile?: boolean;
  coldHref?: string;
  coldCtaLabel?: string;
  coldHint?: string;
  stockCtaLabel?: string;
  sourceCold?: string;
}

export function HomeMobileWhatsAppBar({
  visible = true,
  hideOnMobile = false,
  coldHref,
  coldCtaLabel = "Quero ajuda",
  coldHint = "Estoque completo ou ajuda no WhatsApp",
  stockCtaLabel = "Ver estoque",
  sourceCold = "sticky_cold",
}: HomeMobileWhatsAppBarProps) {
  const { data: whatsapp } = useWhatsAppQuery();
  const hintId = useId();

  if (!visible || !whatsapp?.numero) return null;

  const href =
    coldHref ||
    buildWhatsAppUrl(whatsapp.numero, homeWhatsAppMessages().vehicleInterest);

  return (
    <FloatingPortal>
      <div
        className={`pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] z-[60] justify-center px-2 ${
          hideOnMobile ? "hidden sm:flex" : "flex"
        }`}
      >
        <nav
          aria-label="Ações rápidas"
          aria-describedby={hintId}
          className="pointer-events-auto grid w-full max-w-[22rem] grid-cols-2 gap-1 rounded-xl border border-[#00283C]/10 bg-white/95 p-1 shadow-[0_3px_12px_rgba(0,40,60,0.10)]"
        >
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            data-wa-source={sourceCold}
            data-wa-intent="vehicle_interest"
            className="flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg bg-[#087A37] px-2 py-2 text-xs font-bold leading-tight text-white transition-colors hover:bg-[#075E54] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087A37] sm:text-sm"
          >
            <MessageCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="truncate">{coldCtaLabel}</span>
          </a>
          <Link
            to="/seminovos"
            search={emptySeminovosSearch}
            className="flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg bg-[#00283C] px-2 py-2 text-xs font-bold leading-tight text-white transition-colors hover:bg-[#00435a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00283C] sm:text-sm"
          >
            <span className="truncate">{stockCtaLabel}</span>
            <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
          </Link>
          <p id={hintId} className="sr-only">
            {coldHint}
          </p>
        </nav>
      </div>
    </FloatingPortal>
  );
}
