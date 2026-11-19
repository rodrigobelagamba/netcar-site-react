import { useState, type FormEvent } from "react";
import { MessageCircle, Calculator, Bot, Sparkles, PhoneCall, CheckCircle2 } from "lucide-react";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import {
  buildWhatsAppUrl,
  DEFAULT_SALES_WHATSAPP,
  homeWhatsAppMessages,
} from "@/lib/whatsappMessages";
import { submitVehicleCallbackLead } from "@/lib/leadCallback";

interface SeminovosWhatsAppHelpPanelProps {
  /** Mensagem já montada com filtros ativos (quando houver). */
  stockHelpHref: string;
  hasFilters: boolean;
  filterSummary?: string;
  variant?: "banner" | "inline";
}

function formatBrazilPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function StockQuickCallback({
  filterSummary,
  compact = false,
}: {
  filterSummary?: string;
  compact?: boolean;
}) {
  const [phone, setPhone] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [feedback, setFeedback] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setFeedback("");

    const result = await submitVehicleCallbackLead({
      phone,
      vehicleId: "",
      vehicleName: "Busca no estoque",
      intentSummary: filterSummary
        ? `Ajuda no estoque (${filterSummary})`
        : "Ajuda para escolher no estoque",
      website: honeypot,
    });

    if (result.ok) {
      setStatus("sent");
      setFeedback(
        result.duplicate
          ? "Pedido já recebido — nossa equipe retorna no WhatsApp."
          : "Recebido! Um consultor te chama no WhatsApp.",
      );
      return;
    }

    setStatus("error");
    setFeedback(result.error || "Não foi possível enviar. Chame no WhatsApp.");
  };

  if (status === "sent") {
    return (
      <p className="inline-flex items-center gap-1.5 rounded-lg border border-[#5CD29D]/35 bg-[#5CD29D]/15 px-3 py-2 text-xs font-semibold text-[#C8F7E1]">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#5CD29D]" aria-hidden="true" />
        {feedback}
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={`flex flex-wrap items-center gap-1.5 ${compact ? "" : "w-full sm:w-auto"}`}
    >
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        className="hidden"
        aria-hidden="true"
      />
      <label htmlFor="stock-callback-phone" className="sr-only">
        Seu WhatsApp com DDD
      </label>
      <input
        id="stock-callback-phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={phone}
        onChange={(e) => {
          setPhone(formatBrazilPhoneInput(e.target.value));
          if (status === "error") {
            setStatus("idle");
            setFeedback("");
          }
        }}
        placeholder="(51) 99999-9999"
        className="h-10 w-36 rounded-xl border border-white/20 bg-white/10 px-3 text-xs font-medium text-white placeholder:text-white/55 focus:border-[#5cc5ca] focus:outline-none sm:w-40"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#5cc5ca]/60 bg-white/10 px-3 text-xs font-bold text-[#c7f4f5] transition-colors hover:bg-white/15 disabled:opacity-60"
      >
        <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />
        {status === "sending" ? "Enviando…" : "Me chamar"}
      </button>
      {status === "error" && feedback && (
        <p className="w-full text-[11px] font-medium text-amber-200">{feedback}</p>
      )}
    </form>
  );
}

export function SeminovosWhatsAppHelpPanel({
  stockHelpHref,
  hasFilters,
  filterSummary,
  variant = "banner",
}: SeminovosWhatsAppHelpPanelProps) {
  const { data: whatsapp } = useWhatsAppQuery();
  const messages = homeWhatsAppMessages();
  const whatsappNumber = whatsapp?.numero || DEFAULT_SALES_WHATSAPP;

  const financeHref = buildWhatsAppUrl(
    whatsappNumber,
    messages.simulateFinance,
  );
  const ianHref = buildWhatsAppUrl(whatsappNumber, messages.talkToIan);

  const primaryLabel = hasFilters
    ? "Receber opções no WhatsApp"
    : "Quero ajuda para escolher";

  if (variant === "inline") {
    return (
      <div className="col-span-2 w-full rounded-2xl border border-[#25D366]/35 bg-[#00283C] px-4 py-4 text-white shadow-lg sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5CD29D]">
              Ainda em dúvida?
            </p>
            <p className="mt-1 text-sm font-black leading-snug sm:text-base">
              Conte o que procura ou deixe seu número — a equipe envia opções na hora.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <StockQuickCallback filterSummary={filterSummary} compact />
            <a
              href={stockHelpHref}
              target="_blank"
              rel="noopener noreferrer"
              data-wa-source="seminovos_midgrid"
              data-wa-intent="stock_help"
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#087A37] px-4 text-sm font-black text-white shadow-[0_6px_18px_rgba(8,122,55,0.30)]"
            >
              <MessageCircle className="h-4 w-4" />
              {primaryLabel}
            </a>
          </div>
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
            Atendimento pelo WhatsApp
          </span>
          <h2 className="mt-3 text-xl font-black leading-tight sm:text-2xl">
            {hasFilters
              ? "Filtrou e não encontrou? Envie seus filtros pelo WhatsApp."
              : "Ficou em dúvida entre os carros do estoque?"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/75 sm:text-base">
            {hasFilters
              ? "Seus filtros já vão na mensagem para a equipe consultar opções parecidas."
              : "Diga o que procura. A mensagem pode ser enviada a qualquer hora; a equipe continua o atendimento no horário comercial."}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:max-w-md lg:w-auto lg:min-w-[280px]">
          <a
            href={stockHelpHref}
            target="_blank"
            rel="noopener noreferrer"
            data-wa-source="seminovos_banner"
            data-wa-intent="stock_help"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#087A37] px-4 py-3 text-sm font-black text-white shadow-[0_6px_18px_rgba(8,122,55,0.30)]"
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
              Falar com o iAN
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
