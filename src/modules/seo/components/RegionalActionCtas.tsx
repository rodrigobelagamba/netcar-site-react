import { Link } from "@tanstack/react-router";
import { ArrowRight, Banknote, Car, MessageCircle } from "lucide-react";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import { buildWhatsAppUrl, siteWhatsAppMessage } from "@/lib/whatsappMessages";
import { emptySeminovosSearch } from "@/lib/seminovos-search";
import { cn } from "@/lib/cn";

type StockSearch = {
  [K in keyof typeof emptySeminovosSearch]:
    | (typeof emptySeminovosSearch)[K]
    | string;
};

type RegionalActionCtasProps = {
  waText: string;
  sellTo?: "/compra" | "/compramos-seu-usado";
  sellCitySlug?: string;
  stockSearch?: StockSearch;
  stockLabel?: string;
  stockSubtitle?: string;
  waSubtitle?: string;
  sellSubtitle?: string;
  primary?: "stock" | "whatsapp" | "sell";
  className?: string;
};

function CtaContent({
  icon: Icon,
  title,
  subtitle,
  dark,
}: {
  icon: typeof Car;
  title: string;
  subtitle: string;
  dark?: boolean;
}) {
  return (
    <>
      <Icon className="h-5 w-5 shrink-0" strokeWidth={2.4} />
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-sm font-black uppercase tracking-wider sm:text-base">
          {title}
        </span>
        <span
          className={cn(
            "mt-0.5 block text-[11px] font-semibold normal-case tracking-normal sm:text-xs",
            dark ? "text-white/80" : "opacity-65",
          )}
        >
          {subtitle}
        </span>
      </span>
      <ArrowRight className="h-5 w-5 shrink-0 opacity-90" />
    </>
  );
}

/**
 * CTAs no visual da home, com subtítulo em cada botão.
 */
export function RegionalActionCtas({
  waText,
  sellTo = "/compra",
  sellCitySlug,
  stockSearch = emptySeminovosSearch,
  stockLabel = "Ver estoque",
  stockSubtitle = "Fotos, preço e km reais",
  waSubtitle = "Atendimento rápido · 24h",
  sellSubtitle = "Troca ou venda · avaliação",
  primary = "stock",
  className = "",
}: RegionalActionCtasProps) {
  const { data: whatsapp } = useWhatsAppQuery();
  const waHref =
    whatsapp?.numero
      ? buildWhatsAppUrl(whatsapp.numero, siteWhatsAppMessage(waText))
      : "#";

  const stockBtn = cn(
    "inline-flex min-h-[64px] items-center justify-center gap-2.5 rounded-2xl px-5 py-3.5 transition-all active:scale-[0.98] sm:min-w-[200px] sm:flex-1",
    primary === "stock"
      ? "bg-[#00283C] text-white shadow-[0_12px_32px_rgba(0,40,60,0.28)] hover:bg-[#00435a] hover:shadow-[0_16px_40px_rgba(0,40,60,0.34)]"
      : "bg-white text-[#00283C] shadow-[0_10px_28px_rgba(92,210,157,0.28)] ring-1 ring-[#00283C]/10 hover:bg-[#F3F5F6]",
  );

  const waBtn = cn(
    "inline-flex min-h-[64px] items-center justify-center gap-2.5 rounded-2xl px-5 py-3.5 text-white transition-transform hover:scale-[1.02] sm:min-w-[200px] sm:flex-1",
    primary === "whatsapp"
      ? "bg-[#25D366] shadow-[0_14px_34px_rgba(37,211,102,0.35)] hover:bg-[#1ebe57]"
      : "bg-[#25D366] shadow-[0_10px_28px_rgba(37,211,102,0.28)] hover:bg-[#128C7E]",
  );

  const sellBtn = cn(
    "inline-flex min-h-[64px] items-center justify-center gap-2.5 rounded-2xl px-5 py-3.5 transition-all active:scale-[0.98] sm:min-w-[200px] sm:flex-1",
    primary === "sell"
      ? "bg-[#5CD29D] text-[#00283C] shadow-[0_12px_32px_rgba(92,210,157,0.35)] hover:brightness-105"
      : "border border-[#00283C]/15 bg-[#F3F5F6] text-[#00283C] hover:bg-white hover:shadow-[0_8px_24px_rgba(0,40,60,0.08)]",
  );

  const sellInner = (
    <CtaContent
      icon={Banknote}
      title="Vender meu carro"
      subtitle={sellSubtitle}
    />
  );

  return (
    <div
      className={cn(
        "flex w-full max-w-3xl flex-col gap-3 sm:flex-row sm:flex-wrap",
        className,
      )}
      data-regional-ctas
    >
      <Link
        to="/seminovos"
        search={stockSearch}
        data-regional-action="view_stock"
        className={stockBtn}
      >
        <CtaContent
          icon={Car}
          title={stockLabel}
          subtitle={stockSubtitle}
          dark={primary === "stock"}
        />
      </Link>

      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        data-wa-source="landing"
        data-wa-intent="regional_help"
        data-regional-action="whatsapp"
        className={waBtn}
      >
        <CtaContent
          icon={MessageCircle}
          title="WhatsApp"
          subtitle={waSubtitle}
          dark
        />
      </a>

      {sellCitySlug ? (
        <Link
          to="/vender-carro-{$citySlug}"
          params={{ citySlug: sellCitySlug }}
          data-regional-action="sell_city"
          className={sellBtn}
        >
          {sellInner}
        </Link>
      ) : (
        <Link
          to={sellTo}
          data-regional-action="sell_evaluation"
          className={sellBtn}
        >
          {sellInner}
        </Link>
      )}
    </div>
  );
}
