import { MessageCircle } from "lucide-react";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import { buildWhatsAppUrl, homeWhatsAppMessages } from "@/lib/whatsappMessages";

interface HomeMobileWhatsAppBarProps {
  vehicleLabel?: string;
}

export function HomeMobileWhatsAppBar({
  vehicleLabel,
}: HomeMobileWhatsAppBarProps) {
  const { data: whatsapp } = useWhatsAppQuery();

  if (!whatsapp?.numero) return null;

  const messages = homeWhatsAppMessages({ vehicleLabel });
  const href = buildWhatsAppUrl(whatsapp.numero, messages.vehicleInterest);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#25D366]/30 bg-white/95 px-4 py-3 shadow-[0_-12px_40px_rgba(0,0,0,0.12)] backdrop-blur-md md:hidden">
      <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[#00283C]/70">
        Atendimento no WhatsApp 24 horas, 7 dias por semana
      </p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-wa-source="home_sticky"
        data-wa-intent="vehicle_interest"
        data-wa-vehicle-name={vehicleLabel}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 py-3.5 text-base font-black text-white shadow-[0_8px_24px_rgba(37,211,102,0.35)]"
      >
        <MessageCircle className="h-5 w-5" />
        Tenho interesse em um seminovo
      </a>
    </div>
  );
}
