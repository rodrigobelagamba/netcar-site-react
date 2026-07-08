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

  // Mensagem sempre genérica: botão fala "um seminovo", não deve puxar o
  // veículo sorteado aleatoriamente no destaque da Home.
  const messages = homeWhatsAppMessages();
  const href = buildWhatsAppUrl(whatsapp.numero, messages.vehicleInterest);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#25D366]/30 bg-white/95 px-3 py-2 shadow-[0_-10px_30px_rgba(0,0,0,0.10)] backdrop-blur-md md:hidden">
      <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[#00283C]/70">
        Atendimento 24h no WhatsApp
      </p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-wa-source="home_sticky"
        data-wa-intent="vehicle_interest"
        data-wa-vehicle-name={vehicleLabel}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-black text-white shadow-[0_6px_18px_rgba(37,211,102,0.30)]"
      >
        <MessageCircle className="h-4 w-4" />
        Tenho interesse em um seminovo
      </a>
    </div>
  );
}
