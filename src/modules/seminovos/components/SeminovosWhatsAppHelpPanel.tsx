import { MessageCircle, Calculator, Bot, Sparkles } from "lucide-react";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import { buildWhatsAppUrl, homeWhatsAppMessages } from "@/lib/whatsappMessages";

interface SeminovosWhatsAppHelpPanelProps {
  /** Mensagem já montada com filtros ativos (quando houver). */
  stockHelpHref: string;
  hasFilters: boolean;
  variant?: "banner" | "inline";
}

export function SeminovosWhatsAppHelpPanel({
  stockHelpHref,
  hasFilters,
  variant = "banner",
}: SeminovosWhatsAppHelpPanelProps) {
  const { data: whatsapp } = useWhatsAppQuery();
  const messages = homeWhatsAppMessages();

  if (!whatsapp?.numero) return null;

  const financeHref = buildWhatsAppUrl(whatsapp.numero, messages.simulateFinance);
  const ianHref = buildWhatsAppUrl(whatsapp.numero, messages.talkToIan);

  const primaryLabel = hasFilters
    ? "Receber opções no WhatsApp"
    : "Quero ajuda pra escolher";

  if (variant === "inline") {
    return (
      <div className="col-span-2 w-full rounded-2xl border border-[#25D366]/35 bg-[#00283C] px-4 py-4 text-white shadow-lg sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5CD29D]">
              Ainda em dúvida?
            </p>
            <p className="mt-1 text-sm font-black leading-snug sm:text-base">
              Manda o que procura — a gente responde no WhatsApp com opções do estoque.
            </p>
          </div>
          <a
            href={stockHelpHref}
            target="_blank"
            rel="noopener noreferrer"
            data-wa-source="seminovos_midgrid"
            data-wa-intent="stock_help"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-black text-white shadow-[0_6px_18px_rgba(37,211,102,0.30)]"
          >
            <MessageCircle className="h-4 w-4" />
            {primaryLabel}
          </a>
        </div>
      </div>
    );
  }

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-[#00283C]/10 bg-[#00283C] px-4 py-5 text-white shadow-md sm:px-6">
      <div className="pointer-events-none absolute" aria-hidden />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#5CD29D]/30 bg-[#5CD29D]/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#5CD29D]">
            <Sparkles className="h-3.5 w-3.5" />
            Atendimento 24h · estoque
          </span>
          <h2 className="mt-3 text-xl font-black leading-tight sm:text-2xl">
            {hasFilters
              ? "Filtrou e não achou o ideal? Pedimos opções no WhatsApp."
              : "Olhou o estoque e ficou na dúvida? Fala com a Netcar agora."}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/75 sm:text-base">
            {hasFilters
              ? "Seus filtros vão na mensagem. Respondemos com opções parecidas do estoque."
              : "Não achou o carro certo? Peça opções do estoque pelo WhatsApp, respondemos 24h/7."}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:max-w-md lg:w-auto lg:min-w-[280px]">
          <a
            href={stockHelpHref}
            target="_blank"
            rel="noopener noreferrer"
            data-wa-source="seminovos_banner"
            data-wa-intent="stock_help"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-black text-white shadow-[0_6px_18px_rgba(37,211,102,0.30)]"
          >
            <MessageCircle className="h-4 w-4" />
            {primaryLabel}
          </a>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={financeHref}
              target="_blank"
              rel="noopener noreferrer"
              data-wa-source="seminovos_banner"
              data-wa-intent="simulate_finance"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-bold text-white transition-colors hover:bg-white/16"
            >
              <Calculator className="h-3.5 w-3.5" />
              Simular parcelas
            </a>
            <a
              href={ianHref}
              target="_blank"
              rel="noopener noreferrer"
              data-wa-source="seminovos_banner"
              data-wa-intent="talk_to_ian"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-bold text-white transition-colors hover:bg-white/16"
            >
              <Bot className="h-3.5 w-3.5" />
              Falar com a IA
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
