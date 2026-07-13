import { useParams, useLocation, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircleMore,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  CheckSquare,
  CalendarDays,
  Calculator,
  ArrowLeftRight,
  ArrowRight,
  Image as ImageIcon,
  LucideIcon,
} from "lucide-react";
import React, { useState, useMemo, useEffect } from "react";
import { useVehicleQuery } from "@/catalog/queries/useVehicleQuery";
import { useVehiclesQuery } from "@/catalog/queries/useVehiclesQuery";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import { useAnuncioQuery } from "@/catalog/queries/useAnuncioQuery";
import {
  buildWhatsAppUrl,
  siteWhatsAppMessage,
  vehicleWhatsAppMessages,
} from "@/lib/whatsappMessages";
import type { WhatsAppClickSource } from "@/lib/analytics";
import { trackViewItem } from "@/lib/analytics";
import iCheckLogo from "@/assets/images/i-check-ogo.svg";
import icon1 from "@/assets/images/icon-1.svg";
import { ProductList } from "@/design-system/components/patterns/ProductList";
import type { VehicleCardProps } from "@/design-system/components/patterns/VehicleCard";
import { FabricaDeValor } from "@/design-system/components/patterns/FabricaDeValor";
import { NetcarSocialSection } from "@/design-system/components/patterns/social/NetcarSocialSection";
import { LazyLocalizacao } from "@/design-system/components/layout/LazyLocalizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";
import { maskPlate } from "@/lib/slug";
import { optimizeStockImage } from "@/lib/images";
import { useMetaTags } from "@/hooks/useMetaTags";
import { VehicleSchemaOrg } from "@/components/seo/VehicleSchemaOrg";
import { VehicleUnavailableRedirect } from "@/components/VehicleUnavailableRedirect";
import { emptySeminovosSearch } from "@/lib/seminovos-search";
import { parseGptContent, AccordionSection } from "@/lib/parseGptContent";
import { SHOW_CAMPAIGN_STAMP } from "@/config/features";

// Constantes de animação
const ANIMATION_EASING = [0.25, 0.1, 0.25, 1] as const;
const ANIMATION_DURATION = {
  fast: 0.3,
  normal: 0.7,
  slow: 0.8,
} as const;

// Constantes de imagem
const CAR_COVERED_PLACEHOLDER_URL = "/images/semcapa.png";
const PROBLEMATIC_IMAGE_PATTERN = "271_131072img_8213";

type BadgeVariant = "success" | "purple" | "blue" | "blue-dark" | "green-dark";

interface Badge {
  text: string;
  variant: BadgeVariant;
  icon?: boolean;
}

const BADGE_STYLES: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: "bg-secondary", text: "text-secondary-foreground" },
  purple: { bg: "bg-purple", text: "text-primary-foreground" },
  blue: { bg: "bg-blue", text: "text-white" },
  "blue-dark": { bg: "bg-blue-dark", text: "text-white" },
  "green-dark": { bg: "bg-green-dark", text: "text-white" },
};

function Badge({ text, variant, icon }: Badge) {
  const { bg: bgColor, text: textColor } = BADGE_STYLES[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASING }}
      className={`${bgColor} ${textColor} rounded-[45px] flex items-center uppercase font-bold tracking-wide info-badge`}
    >
      {icon && (
        <div className="flex-shrink-0">
          <CheckSquare className="w-full h-full text-fg" />
    </div>
      )}
      <span className="whitespace-nowrap">{text}</span>
    </motion.div>
  );
}

interface CTAButtonProps {
  text: string;
  icon?: LucideIcon;
  borderColor?: string;
  textColor?: string;
  hoverBgColor?: string;
  className?: string;
  initialAnimation?: boolean;
  onClick?: () => void;
  href?: string;
  waSource?: WhatsAppClickSource;
  waIntent?: string;
  waVehicleId?: string | number;
  waVehicleName?: string;
  disabled?: boolean;
  filled?: boolean;
}

function CTAButton({
  text,
  icon: Icon,
  borderColor = "border-green",
  textColor = "text-green",
  hoverBgColor = "bg-green-dark",
  className = "",
  initialAnimation = false,
  onClick,
  href,
  waSource,
  waIntent,
  waVehicleId,
  waVehicleName,
  disabled = false,
  filled = false,
}: CTAButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const restingTextColor = filled ? "text-white" : textColor;
  const restingIconColor = filled ? "text-white" : textColor;

  const animationProps = initialAnimation
    ? {
        initial: { opacity: 0 },
        whileInView: { opacity: 1 },
        viewport: { once: true },
        transition: {
          duration: ANIMATION_DURATION.slow,
          delay: 0.25,
          ease: ANIMATION_EASING,
        },
      }
    : {};

  const sharedClassName = `relative border ${borderColor} rounded-[65px] flex items-center justify-center uppercase font-bold tracking-wide overflow-hidden ${filled ? "bg-secondary border-secondary shadow-sm" : ""} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${className}`;
  const sharedHandlers = {
    onHoverStart: () => setIsHovered(true),
    onHoverEnd: () => setIsHovered(false),
  };
  const innerContent = (
    <>
      <motion.div
        className={`absolute inset-0 ${hoverBgColor} rounded-[65px]`}
        initial={{ opacity: 0 }}
        animate={{ opacity: isHovered ? 1 : 0 }}
        transition={{ duration: ANIMATION_DURATION.fast, ease: ANIMATION_EASING }}
      />

      <div className="relative flex items-center h-full">
        <div className="relative overflow-hidden h-full flex items-center">
            <motion.span
              className={`${restingTextColor} whitespace-nowrap relative z-10`}
              initial={{ y: 0, opacity: 1 }}
              animate={{ y: isHovered ? -40 : 0, opacity: isHovered ? 0 : 1 }}
              transition={{ duration: ANIMATION_DURATION.fast, ease: ANIMATION_EASING }}
            >
              {text}
            </motion.span>
            <motion.span
              className="text-white whitespace-nowrap absolute left-0 top-0 h-full flex items-center z-10 info-contact-button"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: isHovered ? 0 : 40, opacity: isHovered ? 1 : 0 }}
              transition={{ duration: ANIMATION_DURATION.fast, ease: ANIMATION_EASING }}
            >
              {text}
            </motion.span>
        </div>

        {Icon && (
          <div className="relative flex-shrink-0 z-10">
            <Icon
              className={`w-full h-full transition-colors duration-300 ${
                isHovered ? "text-white" : restingIconColor
              }`}
            />
          </div>
        )}
      </div>
    </>
  );

  if (href && !disabled) {
    return (
      <motion.a
        {...animationProps}
        {...sharedHandlers}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-wa-source={waSource}
        data-wa-intent={waIntent}
        data-wa-vehicle-id={waVehicleId != null ? String(waVehicleId) : undefined}
        data-wa-vehicle-name={waVehicleName}
        className={sharedClassName}
      >
        {innerContent}
      </motion.a>
    );
  }

  return (
    <motion.button
      {...animationProps}
      {...sharedHandlers}
      onClick={onClick}
      disabled={disabled}
      className={sharedClassName}
    >
      {innerContent}
    </motion.button>
  );
}

interface ContactButtonProps {
  modeloCompleto?: string;
  vehicleId?: string | number;
  isSold?: boolean;
  vehicleLabel?: string;
}

function ContactButton({
  modeloCompleto,
  vehicleId,
  isSold = false,
  vehicleLabel,
}: ContactButtonProps) {
  const { data: whatsapp } = useWhatsAppQuery();
  const label = vehicleLabel || modeloCompleto || "veículo";
  const messages = vehicleWhatsAppMessages(label, modeloCompleto);
  const href = whatsapp?.numero
    ? buildWhatsAppUrl(whatsapp.numero, messages.info)
    : undefined;
  const tradeHref = whatsapp?.numero
    ? buildWhatsAppUrl(whatsapp.numero, messages.trade)
    : undefined;
  const similarHref = whatsapp?.numero
    ? buildWhatsAppUrl(
        whatsapp.numero,
        siteWhatsAppMessage(
          `o ${label} que eu vi no site já foi vendido. Quero opções parecidas disponíveis.`,
        ),
      )
    : undefined;

  if (isSold) {
    return (
      <div className="relative w-full overflow-hidden rounded-2xl border border-[#00283C]/12 bg-[#F3F5F6]">
        <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(-12deg,transparent,transparent_10px,rgba(0,40,60,0.03)_10px,rgba(0,40,60,0.03)_20px)]" />
        <div className="relative space-y-3 px-4 py-5 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#00283C]/50">
            Indisponível para compra
          </p>
          <p className="text-base font-semibold leading-snug text-[#00283C]">
            Este seminovo já encontrou dono.
          </p>
          <p className="text-sm leading-relaxed text-[#00283C]/65">
            Confira opções parecidas ainda no estoque, na mesma faixa.
          </p>
          <div className="flex flex-col gap-2 pt-1">
            <a
              href="#opcoes-parecidas"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#00283C] px-4 py-3 text-sm font-black text-white"
            >
              Ver opções parecidas
              <ArrowRight className="h-4 w-4" />
            </a>
            {similarHref && (
              <a
                href={similarHref}
                target="_blank"
                rel="noopener noreferrer"
                data-wa-source="detalhe_vendido"
                data-wa-intent="similar_vehicle"
                data-wa-vehicle-id={vehicleId}
                data-wa-vehicle-name={label}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#25D366]/40 bg-white px-4 py-3 text-sm font-bold text-[#00283C]"
              >
                <MessageCircleMore className="h-4 w-4 text-[#25D366]" />
                Quero um similar
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-2.5">
      <WhatsAppPulseRing>
        <CTAButton
          text="Chamar no WhatsApp"
          icon={MessageCircleMore}
          borderColor="border-[#25D366]"
          textColor="text-white"
          hoverBgColor="bg-green-dark"
          filled
          className="w-full info-contact-button-wrapper !bg-[#25D366] !border-[#25D366] shadow-[0_8px_24px_rgba(37,211,102,0.3)]"
          initialAnimation={true}
          href={href}
          waSource="hero"
          waIntent="vehicle_inquiry"
          waVehicleId={vehicleId}
          waVehicleName={modeloCompleto}
          disabled={!whatsapp?.numero}
        />
      </WhatsAppPulseRing>
      <TradeInTextLink
        href={tradeHref}
        modeloCompleto={modeloCompleto}
        vehicleId={vehicleId}
        className="justify-center text-center"
      />
    </div>
  );
}

interface TradeInTextLinkProps {
  href?: string;
  modeloCompleto?: string;
  vehicleId?: string | number;
  className?: string;
  compact?: boolean;
}

function TradeInTextLink({
  href,
  modeloCompleto,
  vehicleId,
  className = "",
  compact = false,
}: TradeInTextLinkProps) {
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-wa-source="detalhe_trade"
      data-wa-intent="trade_in"
      data-wa-vehicle-id={vehicleId}
      data-wa-vehicle-name={modeloCompleto}
      className={`inline-flex items-center gap-1.5 font-bold text-[#00283C] transition-colors hover:text-[#5CD29D] ${compact ? "text-xs" : "text-sm"} ${className}`}
    >
      <ArrowLeftRight className={compact ? "h-3.5 w-3.5 shrink-0" : "h-4 w-4 shrink-0"} />
      <span className="underline underline-offset-4">Tenho carro na troca deste</span>
    </a>
  );
}

interface DetalheMobileStickyBarProps {
  price: string;
  modeloCompleto: string;
  vehicleId?: string | number;
  isSold?: boolean;
  vehicleLabel?: string;
}

function DetalheMobileStickyBar({
  price,
  modeloCompleto,
  vehicleId,
  isSold = false,
  vehicleLabel,
}: DetalheMobileStickyBarProps) {
  const { data: whatsapp } = useWhatsAppQuery();
  const label = vehicleLabel || modeloCompleto || "veículo";
  const messages = vehicleWhatsAppMessages(label, modeloCompleto);
  const ready = Boolean(whatsapp?.numero);
  const priceLabel = price.replace(/<[^>]*>/g, "");

  if (isSold) {
    return (
      <div className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-[#00283C]/15 bg-white/95 px-4 py-3 shadow-[0_-12px_40px_rgba(0,0,0,0.12)] backdrop-blur-md">
        <div className="mb-2 flex items-center gap-3">
          <p className="min-w-0 flex-1 truncate text-base font-black leading-tight text-[#00283C]">
            Vendido
          </p>
          <a
            href="#opcoes-parecidas"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#00283C] px-4 py-3 text-sm font-black text-white"
          >
            Ver opções
          </a>
        </div>
        {ready && (
          <div className="flex justify-center">
            <a
              href={buildWhatsAppUrl(
                whatsapp!.numero,
                siteWhatsAppMessage(
                  `o ${label} que eu vi no site já foi vendido. Quero opções parecidas disponíveis.`,
                ),
              )}
              target="_blank"
              rel="noopener noreferrer"
              data-wa-source="detalhe_sticky_vendido"
              data-wa-intent="similar_vehicle"
              data-wa-vehicle-id={vehicleId}
              data-wa-vehicle-name={label}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#128C7E]"
            >
              <MessageCircleMore className="h-3.5 w-3.5" />
              Quero um similar no WhatsApp
            </a>
          </div>
        )}
      </div>
    );
  }

  if (!ready) return null;

  const primaryHref = buildWhatsAppUrl(whatsapp!.numero, messages.info);
  const tradeHref = buildWhatsAppUrl(whatsapp!.numero, messages.trade);

  return (
    <div className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-[#25D366]/30 bg-white/95 px-4 py-3 shadow-[0_-12px_40px_rgba(0,0,0,0.12)] backdrop-blur-md">
      <div className="mb-2 flex items-center gap-3">
        <p className="min-w-0 flex-1 truncate text-base font-black leading-tight text-[#5CD29D]">
          {priceLabel}
        </p>
        <a
          href={primaryHref}
          target="_blank"
          rel="noopener noreferrer"
          data-wa-source="detalhe_sticky"
          data-wa-intent="vehicle_inquiry"
          data-wa-vehicle-id={vehicleId}
          data-wa-vehicle-name={modeloCompleto}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 py-3 text-sm font-black text-white shadow-[0_8px_24px_rgba(37,211,102,0.35)]"
        >
          <MessageCircleMore className="h-4 w-4" />
          WhatsApp
        </a>
      </div>
      <div className="flex justify-center">
        <TradeInTextLink
          href={tradeHref}
          modeloCompleto={modeloCompleto}
          vehicleId={vehicleId}
          compact
        />
      </div>
    </div>
  );
}


interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function AccordionItem({
  title,
  children,
  defaultOpen = false,
}: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASING }}
      className="border-b border-border pb-4 mb-4"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left group"
      >
        <h3 className="text-primary text-[17px] sm:text-[18px] lg:text-[19px] font-medium pr-4">
          {title}
        </h3>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: ANIMATION_DURATION.fast, ease: ANIMATION_EASING }}
          className="flex-shrink-0"
        >
          <ChevronDown className="w-6 h-6 text-muted-foreground" />
        </motion.div>
      </button>

      <motion.div
        initial={false}
        animate={{
          height: isOpen ? "auto" : 0,
          opacity: isOpen ? 1 : 0,
          marginTop: isOpen ? 16 : 0,
        }}
        transition={{ duration: ANIMATION_DURATION.fast, ease: ANIMATION_EASING }}
        className="overflow-hidden"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

interface SpecBadgeProps {
  label: string;
  value: string;
  index?: number;
}

function SpecBadge({ label, value, index = 0 }: SpecBadgeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        duration: 0.6,
        delay: index * 0.05,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className="border border-purple rounded-[45px] px-4 h-[26px] flex items-center justify-center whitespace-nowrap"
    >
      <p className="text-purple text-[14px] sm:text-[15px] lg:text-[16px] font-bold uppercase">
        <span>{label} </span>
        <span className="font-light">{value}</span>
      </p>
    </motion.div>
  );
}

interface OptionalItemProps {
  text: string;
}

function OptionalItem({ text }: OptionalItemProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 flex-shrink-0 text-primary">
        <svg className="block size-full" fill="none" viewBox="0 0 24 24">
          <mask
            height="24"
            id="mask0_19_234"
            maskUnits="userSpaceOnUse"
            style={{ maskType: "alpha" }}
            width="24"
            x="0"
            y="0"
          >
            <rect fill="hsl(var(--color-muted-foreground))" height="24" width="24" />
          </mask>
          <g mask="url(#mask0_19_234)">
            <path d="M10 17V7L15 12L10 17Z" fill="currentColor" />
          </g>
        </svg>
      </div>
      <span className="text-fg text-[14px] sm:text-[15px] leading-[29px]">
        {text}
      </span>
    </div>
  );
}

interface CTASidebarProps {
  vehicle?: any;
  modeloCompleto?: string;
  isSold?: boolean;
}

function WhatsAppPulseRing({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full">
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[65px] border-2 border-[#25D366]/50"
        animate={{
          scale: [1, 1.04, 1],
          opacity: [0.55, 0.15, 0.55],
        }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      {children}
    </div>
  );
}

function WhatsAppQuickAction({
  href,
  icon: Icon,
  label,
  intent,
  disabled,
  vehicleId,
  vehicleName,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  intent: string;
  disabled?: boolean;
  vehicleId?: string | number;
  vehicleName?: string;
}) {
  if (disabled || href === "#") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-muted/40 px-3 py-3 opacity-50">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366]/15 text-[#128C7E]">
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-left text-[13px] font-semibold leading-tight text-fg">{label}</span>
      </div>
    );
  }

  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-wa-source="sidebar_action"
      data-wa-intent={intent}
      data-wa-vehicle-id={vehicleId != null ? String(vehicleId) : undefined}
      data-wa-vehicle-name={vehicleName}
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      className="group flex items-center gap-3 rounded-xl border border-[#25D366]/25 bg-white px-3 py-3 shadow-sm transition-colors hover:border-[#25D366]/50 hover:bg-[#25D366]/[0.06] hover:shadow-md"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)] transition-transform group-hover:scale-105">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-left text-[13px] font-semibold leading-tight text-fg group-hover:text-green-dark">
        {label}
      </span>
      <MessageCircleMore className="ml-auto h-4 w-4 shrink-0 text-[#25D366] opacity-0 transition-opacity group-hover:opacity-100" />
    </motion.a>
  );
}

function SidebarActionCard({
  children,
  variant,
  badge,
}: {
  children: React.ReactNode;
  variant: "trust" | "contact";
  badge: string;
}) {
  const styles =
    variant === "trust"
      ? "border-secondary/40 bg-gradient-to-br from-secondary/[0.12] via-white to-white shadow-[0_10px_40px_rgba(108,190,157,0.16)]"
      : "border-[#25D366]/30 bg-gradient-to-br from-[#25D366]/[0.08] via-white to-primary/[0.05] shadow-[0_10px_40px_rgba(37,211,102,0.12)]";

  const badgeClass =
    variant === "trust"
      ? "border-secondary/30 text-secondary"
      : "border-[#25D366]/35 text-[#128C7E]";

  const glowColor =
    variant === "trust" ? "rgba(108,190,157,0.35)" : "rgba(37,211,102,0.28)";

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-6 sm:p-8 flex flex-col items-center transition-shadow duration-300 hover:shadow-[0_16px_48px_rgba(0,91,102,0.14)] ${styles}`}>
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full blur-3xl"
        style={{ backgroundColor: glowColor }}
        animate={{ opacity: [0.35, 0.65, 0.35], scale: [1, 1.08, 1] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-12 -left-8 h-28 w-28 rounded-full blur-3xl bg-primary/20"
        animate={{ opacity: [0.2, 0.45, 0.2], scale: [1, 1.12, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
      />

      {variant === "contact" && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366]/15"
          animate={{ rotate: [0, 8, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <MessageCircleMore className="h-5 w-5 text-[#25D366]" />
        </motion.div>
      )}

      <span className={`relative mb-4 inline-flex items-center rounded-full border bg-white/95 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] shadow-sm ${badgeClass}`}>
        {badge}
      </span>
      <div className="relative w-full flex flex-col items-center">{children}</div>
    </div>
  );
}

function CTASidebar({ vehicle, modeloCompleto, isSold = false }: CTASidebarProps) {
  const { data: whatsapp } = useWhatsAppQuery();

  const handleDownloadPDF = () => {
    if (!vehicle?.pdf_url && !vehicle?.pdf) {
      console.warn("PDF não disponível para este veículo");
      return;
    }

    // Obtém a URL do PDF (já deve estar normalizada pela API)
    let pdfUrl = vehicle.pdf_url;
    
    // Se não tiver pdf_url mas tiver pdf, constrói a URL
    if (!pdfUrl && vehicle.pdf) {
      const baseDomain = typeof window !== "undefined" 
        ? window.location.origin 
        : "https://www.netcarmultimarcas.com.br";
      pdfUrl = `${baseDomain}/arquivos/autocheck/${vehicle.pdf}`;
    }

    if (!pdfUrl) {
      console.warn("Não foi possível determinar a URL do PDF");
      return;
    }

    // Garante que a URL é absoluta
    if (!pdfUrl.startsWith("http://") && !pdfUrl.startsWith("https://")) {
      const baseDomain = typeof window !== "undefined" 
        ? window.location.origin 
        : "https://www.netcarmultimarcas.com.br";
      pdfUrl = pdfUrl.startsWith("/") 
        ? `${baseDomain}${pdfUrl}` 
        : `${baseDomain}/${pdfUrl}`;
    }

    // Cria um link temporário para fazer o download
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = vehicle.pdf || `relatorio-${vehicle.placa || vehicle.id}.pdf`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    
    // Adiciona ao DOM, clica e remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getWhatsAppLink = (message: string) => {
    if (!whatsapp?.numero) return "#";
    return buildWhatsAppUrl(whatsapp.numero, message);
  };

  const vehicleLabel = modeloCompleto || "veículo";
  const whatsappReady = Boolean(whatsapp?.numero);
  const vehicleMessages = vehicleWhatsAppMessages(vehicleLabel, modeloCompleto);
  const primaryWhatsAppHref = whatsappReady
    ? getWhatsAppLink(
        isSold
          ? siteWhatsAppMessage(
              `o ${vehicleLabel} que eu vi no site já foi vendido. Quero opções parecidas disponíveis.`,
            )
          : vehicleMessages.info,
      )
    : undefined;

  const whatsappActions = [
    {
      icon: Calculator,
      label: "Comparar financiamento",
      intent: "simulate_finance",
      message: vehicleMessages.finance,
    },
    {
      icon: CalendarDays,
      label: "Agendar visita",
      intent: "schedule_visit",
      message: vehicleMessages.visit,
    },
    {
      icon: ArrowLeftRight,
      label: "Avaliar meu usado na troca",
      intent: "trade_in",
      message: vehicleMessages.trade,
    },
    {
      icon: ImageIcon,
      label: "Pedir mais fotos ou vídeo",
      intent: "request_photos",
      message: vehicleMessages.photos,
    },
  ];

  const hasPDF = vehicle?.pdf_url || vehicle?.pdf;

  return (
    <div className="space-y-4 lg:space-y-6">
      {hasPDF && !isSold && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASING }}
        >
          <SidebarActionCard variant="trust" badge="Confiança Netcar">
            <div className="w-full max-w-[246px] h-[148px] mb-4 overflow-hidden">
              <img
                src={iCheckLogo}
                alt="i-Check"
                className="w-full h-full object-contain"
              />
            </div>
            <p className="text-muted-foreground text-sm text-center mb-5 max-w-[280px]">
              Histórico completo do veículo, pronto para download.
            </p>

            <div className="w-full max-w-[300px]">
              <CTAButton
                text="Baixe o relatório"
                icon={Download}
                borderColor="border-secondary"
                textColor="text-secondary"
                hoverBgColor="bg-green-dark"
                filled
                className="w-full"
                onClick={handleDownloadPDF}
              />
            </div>
          </SidebarActionCard>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <SidebarActionCard
          variant="contact"
          badge={isSold ? "Próximo passo" : "WhatsApp Netcar"}
        >
          {isSold ? (
            <>
              <h3 className="text-primary text-[20px] sm:text-[22px] lg:text-[24px] font-bold mb-2 text-center">
                Quer um carro parecido?
              </h3>
              <p className="text-fg text-[15px] sm:text-[16px] lg:text-[17px] mb-5 text-center text-muted-foreground">
                Este já saiu — a gente aponta opções no mesmo perfil
              </p>
              <div className="mb-3 w-full max-w-[300px]">
                <a
                  href="#opcoes-parecidas"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#00283C] px-4 py-3 text-sm font-black text-white"
                >
                  Ver opções parecidas
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
              <div className="w-full max-w-[300px]">
                <CTAButton
                  text="Quero um similar"
                  icon={MessageCircleMore}
                  borderColor="border-[#25D366]"
                  textColor="text-white"
                  hoverBgColor="bg-green-dark"
                  filled
                  className="w-full !bg-[#25D366] !border-[#25D366] shadow-[0_8px_24px_rgba(37,211,102,0.35)]"
                  href={primaryWhatsAppHref}
                  waSource="sidebar_primary"
                  waIntent="similar_vehicle"
                  waVehicleId={vehicle?.id}
                  waVehicleName={modeloCompleto}
                  disabled={!whatsappReady}
                />
              </div>
            </>
          ) : (
            <>
              <h3 className="text-primary text-[20px] sm:text-[22px] lg:text-[24px] font-bold mb-2 text-center">
                Ficou com dúvidas?
              </h3>
              <p className="text-fg text-[17px] sm:text-[18px] lg:text-[19px] mb-5 text-center">
                Nós te ajudamos — resposta rápida no WhatsApp
              </p>

              <div className="mb-4 w-full max-w-[300px]">
                <WhatsAppPulseRing>
                  <CTAButton
                    text="Chamar no WhatsApp"
                    icon={MessageCircleMore}
                    borderColor="border-[#25D366]"
                    textColor="text-white"
                    hoverBgColor="bg-green-dark"
                    filled
                    className="w-full !bg-[#25D366] !border-[#25D366] shadow-[0_8px_24px_rgba(37,211,102,0.35)]"
                    href={primaryWhatsAppHref}
                    waSource="sidebar_primary"
                    waIntent="vehicle_inquiry"
                    waVehicleId={vehicle?.id}
                    waVehicleName={modeloCompleto}
                    disabled={!whatsappReady}
                  />
                </WhatsAppPulseRing>
              </div>

              <div className="mb-4 flex w-full max-w-[300px] justify-center">
                <TradeInTextLink
                  href={whatsappReady ? getWhatsAppLink(vehicleMessages.trade) : undefined}
                  modeloCompleto={modeloCompleto}
                  vehicleId={vehicle?.id}
                />
              </div>

              <p className="mb-3 w-full max-w-[300px] text-center text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Outras formas de falar conosco
              </p>

              <div className="grid w-full max-w-[300px] grid-cols-1 gap-2">
                {whatsappActions.map((action) => (
                  <WhatsAppQuickAction
                    key={action.label}
                    href={getWhatsAppLink(action.message)}
                    icon={action.icon}
                    label={action.label}
                    intent={action.intent}
                    disabled={!whatsappReady}
                    vehicleId={vehicle?.id}
                    vehicleName={modeloCompleto}
                  />
                ))}
              </div>
            </>
          )}
        </SidebarActionCard>
      </motion.div>
    </div>
  );
}

interface LightboxProps {
  images: string[];
  currentIndex: number;
  onClose: () => void;
  vehicleName: string;
}

function Lightbox({
  images,
  currentIndex,
  onClose,
  vehicleName,
}: LightboxProps) {
  const [index, setIndex] = useState(currentIndex);

  const handlePrev = () => {
    setIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black flex items-center justify-center"
        onClick={onClose}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 text-white hover:text-gray-300 transition-colors z-10"
        >
          <X className="w-8 h-8 sm:w-10 sm:h-10" />
        </button>

        {/* Image Counter */}
        <div className="absolute top-4 left-4 sm:top-6 sm:left-6 text-white text-sm sm:text-base font-bold z-10">
          {index + 1} / {images.length}
        </div>

        {/* Main Image */}
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="relative w-full h-full flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={images[index]}
            alt={`${vehicleName} - Foto ${index + 1} de ${images.length} - Netcar Multimarcas`}
            className="w-full h-full max-w-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </motion.div>

        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition-colors p-2 sm:p-3 bg-black/50 rounded-full z-10"
            >
              <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition-colors p-2 sm:p-3 bg-black/50 rounded-full z-10"
            >
              <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
            </button>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

interface GalleryItemProps {
  image: string;
  index: number;
  onClick: () => void;
  alt: string;
}

function GalleryItem({ image, index, onClick, alt }: GalleryItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{
        duration: 0.7,
        delay: index * 0.04,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className="relative overflow-hidden cursor-pointer bg-gray-200 group aspect-[1920/1441]"
      onClick={onClick}
    >
      <div className="relative w-full h-full">
        <img
          src={image}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500 ease-out" />
      </div>
    </motion.div>
  );
}


function medianPrice(prices: number[]): number {
  if (prices.length === 0) return 0;
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function RelatedVehiclesSection({
  currentVehicleId,
  currentCategory,
  currentPrice,
  currentMarca,
  currentYear,
  currentModelo,
  isSold = false,
}: {
  currentVehicleId: string;
  currentCategory?: string;
  currentPrice?: number;
  currentMarca?: string;
  currentYear?: number;
  currentModelo?: string;
  isSold?: boolean;
}) {
  const { data: vehicles, isLoading } = useVehiclesQuery();
  const maxRelatedVehicles = isSold ? 8 : 4;
  const priceRangeRatio = 0.25;

  const relatedVehicleCards = useMemo((): VehicleCardProps[] => {
    if (!vehicles) return [];

    const available = vehicles.filter((v) => {
      if (String(v.id) === String(currentVehicleId)) return false;
      const price = typeof v.price === "number" ? v.price : Number(v.price);
      if (!price || Number.isNaN(price) || price <= 0) return false;
      const temFotos = v.imagens_site?.tem_fotos;
      if (temFotos === 0 || temFotos === undefined) return false;
      return true;
    });

    const marcaKey = (currentMarca || "").toUpperCase();
    const catKey = (currentCategory || "").toUpperCase();
    const modelToken = (currentModelo || "")
      .toUpperCase()
      .replace(marcaKey, "")
      .trim()
      .split(/\s+/)[0];

    const sameMarcaCat = available.filter((v) => {
      const sameMarca =
        marcaKey && (v.marca || "").toUpperCase() === marcaKey;
      const sameCat =
        catKey && (v.categoria || "").toUpperCase() === catKey;
      return sameMarca && sameCat;
    });
    const sameMarca = available.filter(
      (v) => marcaKey && (v.marca || "").toUpperCase() === marcaKey,
    );
    const sameCat = available.filter(
      (v) => catKey && (v.categoria || "").toUpperCase() === catKey,
    );

    const referencePool =
      sameMarcaCat.length >= 3
        ? sameMarcaCat
        : sameMarca.length >= 3
          ? sameMarca
          : sameCat.length >= 3
            ? sameCat
            : available;

    const referencePrice =
      currentPrice && currentPrice > 0
        ? currentPrice
        : medianPrice(
            referencePool.map((v) =>
              typeof v.price === "number" ? v.price : Number(v.price),
            ),
          );

    const minPrice = referencePrice > 0 ? referencePrice * (1 - priceRangeRatio) : 0;
    const maxPrice = referencePrice > 0 ? referencePrice * (1 + priceRangeRatio) : Infinity;

    const scored = available
      .map((v) => {
        const price = typeof v.price === "number" ? v.price : Number(v.price);
        const sameMarcaMatch =
          marcaKey && (v.marca || "").toUpperCase() === marcaKey;
        const sameCatMatch =
          catKey && (v.categoria || "").toUpperCase() === catKey;
        const modelo = (v.modelo || v.name || "").toUpperCase();
        const sameModelFamily =
          Boolean(modelToken) &&
          modelToken.length > 2 &&
          modelo.includes(modelToken);
        const yearDiff =
          currentYear && v.year ? Math.abs(v.year - currentYear) : 99;
        const inPriceRange = price >= minPrice && price <= maxPrice;
        const priceDiff = referencePrice
          ? Math.abs(price - referencePrice)
          : Number.POSITIVE_INFINITY;

        let score = 0;
        if (sameMarcaMatch) score += 100;
        if (sameCatMatch) score += 50;
        if (sameModelFamily) score += 40;
        if (inPriceRange) score += 35;
        score += Math.max(0, 24 - yearDiff * 4);
        score += Math.max(0, 20 - Math.min(20, priceDiff / Math.max(referencePrice, 1) * 20));

        return {
          ...v,
          score,
          inPriceRange,
          priceDiff,
          sameMarcaMatch,
          sameCatMatch,
        };
      })
      .sort((a, b) => {
        if (isSold) {
          if (a.inPriceRange !== b.inPriceRange) {
            return a.inPriceRange ? -1 : 1;
          }
          return b.score - a.score;
        }
        if (a.sameCatMatch !== b.sameCatMatch) {
          return a.sameCatMatch ? -1 : 1;
        }
        return a.priceDiff - b.priceDiff;
      });

    const preferred = isSold
      ? scored.filter((v) => v.inPriceRange || v.sameMarcaMatch || v.sameCatMatch)
      : scored;

    const pool = preferred.length >= Math.min(4, maxRelatedVehicles) ? preferred : scored;

    return pool.slice(0, maxRelatedVehicles).map((vehicle) => ({
      id: String(vehicle.id),
      name: vehicle.modelo || vehicle.name,
      price: vehicle.price || 0,
      valor_formatado: vehicle.valor_formatado,
      preco_com_troca: vehicle.preco_com_troca,
      preco_com_troca_formatado: vehicle.preco_com_troca_formatado,
      year: vehicle.year || new Date().getFullYear(),
      km: vehicle.km || 0,
      images: vehicle.images || vehicle.fotos || vehicle.fullImages || [],
      imagens_site: vehicle.imagens_site,
      marca: vehicle.marca,
      modelo: vehicle.modelo,
      placa: vehicle.placa,
    }));
  }, [
    vehicles,
    currentVehicleId,
    currentCategory,
    currentPrice,
    currentMarca,
    currentYear,
    currentModelo,
    isSold,
    maxRelatedVehicles,
  ]);

  if (isLoading || relatedVehicleCards.length === 0) {
    return null;
  }

  return (
    <section
      id="opcoes-parecidas"
      className="scroll-mt-24 w-full py-8 sm:py-12 lg:py-16"
    >
      <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASING }}
          className="mb-8 sm:mb-10 lg:mb-12"
        >
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-[26px] w-[26px] sm:h-[28px] sm:w-[28px] lg:h-[30px] lg:w-[30px]">
                <img src={icon1} alt="" aria-hidden="true" className="block size-full" />
              </div>
              <div>
                <h2 className="section-heading">
                  {isSold ? "Opções parecidas no estoque" : "Você também pode gostar"}
                </h2>
                {isSold && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Seminovos no mesmo perfil e faixa de preço deste carro.
                  </p>
                )}
              </div>
            </div>
            {isSold && (
              <Link
                to="/seminovos"
                search={emptySeminovosSearch}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-[#128C7E] hover:underline"
              >
                Ver estoque completo
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
          <div className="h-[1px] w-full bg-primary" />
        </motion.div>

        <ProductList
          vehicles={relatedVehicleCards}
          showWhatsAppInterest
          whatsAppSource={isSold ? "detalhe_vendido_similares" : "detalhe_relacionados"}
        />
      </div>
    </section>
  );
}


function PriceWithShimmer({
  price,
  previousPrice,
  showComparison = false,
}: {
  price: string;
  previousPrice?: string;
  showComparison?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        duration: 0.7,
        delay: 0.3,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className="flex-shrink-0"
    >
      {showComparison && previousPrice ? (
        <div className="flex flex-col items-start gap-1">
          <p className="text-fg/70 text-[16px] font-semibold leading-none whitespace-nowrap">
            De: <span className="line-through" dangerouslySetInnerHTML={{ __html: previousPrice }} />
          </p>
          <span className="text-fg/60 text-[11px] font-semibold uppercase leading-none whitespace-nowrap">
            Para:
          </span>
          <p
            className={`font-bold whitespace-nowrap cursor-pointer text-secondary leading-tight info-price info-price-shimmer ${
              isHovered ? "info-price-shimmer-hover" : ""
            }`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            dangerouslySetInnerHTML={{ __html: price }}
          />
        </div>
      ) : (
        <p
          className={`font-bold whitespace-nowrap cursor-pointer text-secondary leading-tight info-price info-price-shimmer ${
            isHovered ? "info-price-shimmer-hover" : ""
          }`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          dangerouslySetInnerHTML={{ __html: price }}
        />
      )}
    </motion.div>
  );
}

function vehicleLabelFromSlug(slug: string): string {
  const parts = slug.split("-").filter(Boolean);
  if (/^\d+$/.test(parts[parts.length - 1] || "")) parts.pop();

  return parts
    .map((part) =>
      /^\d+$/.test(part)
        ? part
        : `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
    )
    .join(" ");
}

function vehicleIdFromSlug(slug: string): string | undefined {
  const parts = slug.split("-").filter(Boolean);
  const id = parts[parts.length - 1];
  return id && /^\d+$/.test(id) ? id : undefined;
}

function LoadingVehicleDetail({ slug }: { slug: string }) {
  const modeloCompleto = vehicleLabelFromSlug(slug) || "este seminovo";
  const vehicleId = vehicleIdFromSlug(slug);

  return (
    <main className="min-h-[70vh] bg-gradient-to-b from-white to-gray-50 px-4 pb-36 pt-10 md:pb-16 md:pt-16">
      <section className="container-main mx-auto max-w-4xl">
        <div className="grid items-center gap-8 rounded-[32px] border border-gray-100 bg-white p-6 shadow-sm md:grid-cols-[1fr_0.9fr] md:p-10">
          <div
            className="aspect-[4/3] animate-pulse rounded-3xl bg-gray-100"
            aria-hidden="true"
          />
          <div>
            <span className="text-xs font-black uppercase tracking-[0.18em] text-[#128C7E]">
              Carregando detalhes
            </span>
            <h1 className="mt-2 text-3xl font-black leading-tight text-[#00283C] md:text-4xl">
              {modeloCompleto}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-gray-600">
              Enquanto preço, fotos e ficha carregam, você já pode confirmar
              disponibilidade e tirar dúvidas no WhatsApp.
            </p>
            <div className="mt-6">
              <ContactButton
                modeloCompleto={modeloCompleto}
                vehicleId={vehicleId}
              />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-gray-500">
              Financiamento disponível com comparação entre diversos bancos e
              financeiras parceiras para buscar a melhor condição disponível
              para seu perfil. Sujeito à análise.
            </p>
          </div>
        </div>
      </section>
      <DetalheMobileStickyBar
        price="Consultando preço"
        modeloCompleto={modeloCompleto}
        vehicleId={vehicleId}
      />
    </main>
  );
}

export function DetalhesPage() {
  const { slug: paramSlug } = useParams({ from: "/veiculo/$slug" });
  const location = useLocation();
  const slug = paramSlug || location.pathname.replace(/^\/veiculo\//, "") || "";
  
  const { data: vehicle, isLoading, error } = useVehicleQuery(slug);

  // GA4: view_item — dispara quando detalhe carrega
  useEffect(() => {
    if (!vehicle) return;
    trackViewItem({
      vehicleId: vehicle.id,
      vehicleName:
        [vehicle.marca, vehicle.modelo, vehicle.year].filter(Boolean).join(" ") ||
        vehicle.name,
      price: vehicle.price,
    });
  }, [vehicle]);
  
  // Busca o anúncio (campo GPT) separadamente usando o novo endpoint
  const { data: anuncio } = useAnuncioQuery(vehicle?.id);
  
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const vehicleData = useMemo(() => {
    if (!vehicle) return null;
    
    // Formata ano fabricação / ano modelo
    let yearDisplay = "";
    if (vehicle.anoFabricacao && vehicle.year) {
      // Se tem ambos, mostra: "2023 / 2024" (ano fabricação / ano modelo)
      yearDisplay = `${vehicle.anoFabricacao} / ${vehicle.year}`;
    } else if (vehicle.year) {
      // Se só tem ano modelo, mostra apenas ele
      yearDisplay = String(vehicle.year);
    }
    
    const sanitizeFormattedPrice = (formatted?: string) =>
      formatted ? formatted.replace(/<[^>]*>/g, "") : "";
    const basePrice = Number(vehicle.price) || 0;
    const tradePrice =
      typeof vehicle.preco_com_troca === "number" ? vehicle.preco_com_troca : undefined;
    const showPriceComparison =
      tradePrice !== undefined && Number.isFinite(tradePrice) && tradePrice !== basePrice;

    return {
      marca: vehicle.marca || vehicle.name?.split(" ")[0] || "",
      modeloCompleto: vehicle.modelo || vehicle.name || "",
      price:
        vehicle.valor_formatado ||
        (vehicle.price ? `R$ ${vehicle.price.toLocaleString("pt-BR")}` : ""),
      previousPrice: showPriceComparison
        ? sanitizeFormattedPrice(vehicle.preco_com_troca_formatado) ||
          `R$ ${tradePrice!.toLocaleString("pt-BR")}`
        : "",
      showPriceComparison,
      year: yearDisplay,
      combustivel: vehicle.combustivel || "",
      cambio: vehicle.cambio || "",
      images: vehicle.fullImages || vehicle.fotos || vehicle.images || [],
    };
  }, [vehicle]);

  const marca = vehicleData?.marca || "";
  const modeloCompleto = vehicleData?.modeloCompleto || "";
  const price = vehicleData?.price || "";
  const previousPrice = vehicleData?.previousPrice || "";
  const showPriceComparison = vehicleData?.showPriceComparison || false;
  const year = vehicleData?.year || "";
  const combustivel = vehicleData?.combustivel || "";
  const cambio = vehicleData?.cambio || "";
  const motor = vehicle?.motor || "";
  const potencia = vehicle?.potencia || "";
  const images = vehicleData?.images || [];
  
  // Formata motor com potência se disponível (ex: "1.0/240hp" ou "1.0")
  const motorFormatado = motor && potencia 
    ? `${motor} / ${potencia}hp` 
    : motor || "";
  
  // PRIORIDADE 1: Usa imagens_site.galeria se disponível, senão filtra AVIF das imagens
  const avifImages = useMemo(() => {
    if (vehicle?.imagens_site?.galeria && vehicle.imagens_site.galeria.length > 0) {
      return vehicle.imagens_site.galeria;
    }
    // FALLBACK: Comportamento anterior - filtra apenas imagens AVIF
    return images.filter(
      (img) =>
        img &&
        (img.toLowerCase().endsWith(".avif") || img.toLowerCase().includes(".avif"))
    );
  }, [images, vehicle?.imagens_site?.galeria]);
  
  // PRIORIDADE 1: Usa imagens_site.capa se disponível
  const mainImage = useMemo(() => {
    if (vehicle?.imagens_site?.capa) {
      return optimizeStockImage(vehicle.imagens_site.capa, 1600);
    }
    
    // FALLBACK: Comportamento anterior
    if (!images.length) return CAR_COVERED_PLACEHOLDER_URL;

    const pngImages = images.filter(
      (img) =>
        img &&
        (img.toLowerCase().endsWith(".png") || img.toLowerCase().includes(".png"))
    );

    const firstPng = pngImages[0];
    const isProblematic =
      firstPng?.toLowerCase().includes(PROBLEMATIC_IMAGE_PATTERN);

    return pngImages.length > 0 && !isProblematic && firstPng
      ? firstPng
      : CAR_COVERED_PLACEHOLDER_URL;
  }, [images, vehicle?.imagens_site?.capa]);

  // Converte imagem para URL absoluta para metatags (Open Graph)
  // USA APENAS imagens_site.capa_opengraph (sem fallback)
  const absoluteImageUrl = useMemo(() => {
    if (!vehicle) return "";
    
    // USA APENAS imagens_site.capa_opengraph (sem fallback)
    if (!vehicle.imagens_site?.capa_opengraph) return "";
    
    let imageToUse = vehicle.imagens_site.capa_opengraph;
    
    // Se a imagem estiver em 'small/', substitui por 'big/' para garantir imagem grande
    // Isso garante que a imagem apareça grande em cima no WhatsApp/Facebook
    if (imageToUse.includes('/small/')) {
      imageToUse = imageToUse.replace('/small/', '/big/');
    }
    
    // Função para codificar apenas espaços e caracteres especiais (sem dupla codificação)
    const encodeImagePath = (path: string): string => {
      // Se já contém % (já está codificada), não codifica novamente
      if (path.includes('%')) {
        return path;
      }
      
      // Se já é URL absoluta, codifica apenas espaços e caracteres especiais
      if (path.startsWith("http://") || path.startsWith("https://")) {
        try {
          const url = new URL(path);
          // Codifica apenas espaços e caracteres especiais no pathname
          url.pathname = url.pathname
            .replace(/ /g, '%20')
            .replace(/\(/g, '%28')
            .replace(/\)/g, '%29');
          return url.toString();
        } catch {
          return path.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');
        }
      }
      
      // Para caminhos relativos, codifica apenas espaços e caracteres especiais
      return path
        .replace(/ /g, '%20')
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29');
    };
    
    // Codifica o caminho da imagem (especialmente espaços no nome do arquivo)
    const encodedImage = encodeImagePath(imageToUse);
    
    // Se já é URL absoluta, retorna como está (já codificada)
    if (encodedImage.startsWith("http://") || encodedImage.startsWith("https://")) {
      return encodedImage;
    }
    
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://www.netcarmultimarcas.com.br";
    
    // Se começa com /, adiciona apenas o domínio
    if (encodedImage.startsWith("/")) {
      return `${baseUrl}${encodedImage}`;
    }
    
    // Se contém ./ no início, remove e adiciona domínio
    const cleanedImage = encodedImage.replace(/^\.\/+/, "");
    
    // Adiciona domínio e barra inicial
    return `${baseUrl}/${cleanedImage}`;
  }, [vehicle]);

  // URL amigável para compartilhamento (og:url/canonical) — ex.: /veiculo/fluence-gt-2013
  const friendlyUrl = useMemo(() => {
    if (!vehicle || !slug) return "";
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `${baseUrl}/veiculo/${slug}`;
  }, [vehicle, slug]);

  // Configura metatags para compartilhamento
  const metaTags = useMemo(() => {
    if (!vehicle) return null;

    // Título no formato: "Peugeot 2008 Allure Turbo 2025 - R$ 123.900,00 | Netcar Esteio/RS"
    // Sem placa (irrelevante pra busca e expõe dado do veículo).
    const toTitleCase = (text: string) =>
      text.toLowerCase().replace(/(^|\s)\S/g, (char) => char.toUpperCase());

    const titleParts: string[] = [];

    if (marca) {
      titleParts.push(toTitleCase(String(marca)));
    }

    if (modeloCompleto) {
      titleParts.push(toTitleCase(modeloCompleto));
    }

    if (vehicle.year) {
      titleParts.push(String(vehicle.year));
    }

    const ogTitle = titleParts.length > 0 ? titleParts.join(" ") : "Veículo";
    const isSold = !vehicle.price || vehicle.price <= 0;
    const priceText = vehicle.valor_formatado?.replace(/<[^>]*>/g, "") || "";
    const description = isSold
      ? `${marca} ${modeloCompleto} ${vehicle.year || ""} — veículo vendido. Confira seminovos similares na Netcar Multimarcas, Esteio/RS.`.trim()
      : `${marca} ${modeloCompleto} ${vehicle.year || ""} seminovo por ${priceText}, ${vehicle.km?.toLocaleString("pt-BR") || 0} km, em Esteio/RS. Vistoriado, com garantia Netcar.`.trim();

    const pageTitle = isSold
      ? `${ogTitle} - Vendido | Netcar Esteio/RS`
      : priceText
        ? `${ogTitle} - ${priceText} | Netcar Esteio/RS`
        : `${ogTitle} | Netcar Esteio/RS`;

    return {
      title: pageTitle,
      description,
      image: absoluteImageUrl,
      url: friendlyUrl || (typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : ""),
      type: "article" as const,
      imageWidth: 1200,
      imageHeight: 900,
      productBrand: "Netcar Multimarcas",
      productAvailability: isSold ? ("out of stock" as const) : ("in stock" as const),
      productCondition: "used_like_new" as const,
      productPriceAmount: vehicle.price || 0,
      productPriceCurrency: "BRL" as const,
      productRetailerItemId: vehicle.placa
        ? maskPlate(vehicle.placa).toUpperCase()
        : "",
      ogTitle: ogTitle,
    };
  }, [vehicle, modeloCompleto, marca, absoluteImageUrl, friendlyUrl]);

  useMetaTags(
    metaTags || {
      title: "Veículo",
      description: "Seminovos com garantia na Netcar Multimarcas, Esteio/RS.",
      image: "",
      url: "",
    }
  );

  if (isLoading) {
    return <LoadingVehicleDetail slug={slug} />;
  }

  if (error || !vehicle) {
    return <VehicleUnavailableRedirect />;
  }

  const isSold = !vehicle.price || vehicle.price <= 0;
  const vehicleLabel = [marca, modeloCompleto, vehicle.year]
    .filter(Boolean)
    .join(" ");

  // Badges
  const diferenciais = vehicle?.diferenciais ?? [];
  const hasDiferencial = (tag: string) =>
    diferenciais.some((diff) => diff.tag === tag);

  const badges: Badge[] = isSold
    ? []
    : [
        { text: "Vistoriado e aprovado", variant: "success", icon: true },
        { text: "Retire hoje", variant: "purple" },
        ...(hasDiferencial("garantia_fabrica")
          ? [{ text: "Garantia de Fábrica", variant: "blue" as const }]
          : []),
        ...(hasDiferencial("baixa_km")
          ? [{ text: "Baixa KM", variant: "blue-dark" as const }]
          : []),
        ...(hasDiferencial("unico_dono")
          ? [{ text: "Único Dono", variant: "green-dark" as const }]
          : []),
      ];

  return (
    <main className="overflow-x-hidden max-w-full pb-36 md:pb-0">
      {vehicle && (
        <VehicleSchemaOrg
          marca={marca}
          modelo={modeloCompleto}
          ano={vehicle.year}
          km={vehicle.km}
          combustivel={combustivel}
          cambio={cambio}
          cor={vehicle.cor}
          images={images}
          price={vehicle.price || 0}
          placa={vehicle.placa}
          isSold={isSold}
        />
      )}
      {/* Hero Section */}
      <section className="w-full py-0 pt-0 lg:pt-0 pb-0 relative overflow-hidden max-w-full min-h-[calc(100vh+8vh)] lg:min-h-[calc(100vh+3vh)] 
      xl:min-h-[calc(100vh+1vh)] 2xl:min-h-[95vh] 4xl:min-h-[75vh]">
        {/* Mobile Image - Aparece primeiro no mobile, acima das informações */}
        <div className="lg:hidden w-full mb-6 relative">
          {mainImage && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASING }}
              className="w-full h-[300px] sm:h-[400px] flex items-center justify-center bg-gray-50 relative overflow-visible"
            >
              {isSold && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
                >
                  <span className="-rotate-[18deg] rounded-2xl border-[7px] border-[#E10600]/70 bg-white/40 px-8 py-3 text-5xl font-black uppercase tracking-[0.1em] text-[#E10600]/80 shadow-[0_10px_32px_rgba(0,0,0,0.14)] sm:rounded-[1.25rem] sm:border-[8px] sm:px-10 sm:py-4 sm:text-6xl">
                    Vendido
                  </span>
                </div>
              )}
              {SHOW_CAMPAIGN_STAMP && !isSold && (
                <img
                  src="/selos/selo_campanha.png"
                  alt="Selo de campanha"
                  className="absolute bottom-[6%] right-[10%] sm:bottom-[8%] sm:right-[14%] w-20 sm:w-24 h-auto z-50 pointer-events-none select-none"
                />
              )}
              <img
                src={mainImage}
                alt={`${marca} ${modeloCompleto} ${vehicle.year || ''} - Frente - Netcar Multimarcas`}
                className={`w-full h-full max-w-full object-contain ${isSold ? "grayscale-[0.25]" : ""}`}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </motion.div>
          )}
        </div>

        {/* Left Content - 50% com posicionamento absoluto */}
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 relative">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: ANIMATION_DURATION.slow, ease: ANIMATION_EASING }}
            className="w-full lg:absolute 
            lg:w-[25%] lg:left-[10%] lg:top-[20%]
            xl:w-[25%] xl:left-[5rem] xl:top-[1rem]
            2xl:w-[30%] 2xl:left-[5rem] 2xl:top-[2rem]
            3xl:w-[30%] 3xl:left-[5rem] 3xl:top-[3rem]
            4xl:w-[600px] 4xl:left-[-15rem] 4xl:top-[10rem]
            5xl:w-[50%] 5xl:left-[-50rem] 5xl:top-[20rem] 
            6xl:w-[65%] 6xl:left-[-70rem] 6xl:top-[25rem] 
            pt-2 sm:py-6 lg:py-4 lg:py-6 flex flex-col relative lg:relative z-10
            border border-none"
          >
            {/* Brand */}
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.8,
                delay: 0.15,
                ease: [0.25, 0.1, 0.25, 1],
              }}
              className="text-muted-foreground uppercase tracking-[0.15em] font-semibold mb-1 sm:mb-1.5 info-brand"
            >
              {marca}
            </motion.p>

            {/* Model */}
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.8,
                delay: 0.2,
                ease: [0.25, 0.1, 0.25, 1],
              }}
              className="text-fg font-bold leading-[1.15] mb-6 sm:mb-8 max-w-full  break-words info-model"
            >
              {modeloCompleto}
            </motion.h1>

            {/* Badges */}
            {badges.length > 0 && (
              <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4 sm:mb-5">
                {badges.map((badge, idx) => (
                  <Badge key={idx} {...badge} />
                ))}
              </div>
            )}

            {/* Details Grid - Melhorado */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-5 pb-3 sm:pb-4 border-b border-border/60">
              {year && (
                <div className="flex flex-col">
                  <span className="text-muted-foreground uppercase tracking-wider mb-0.5 font-medium info-label">
                    Ano
                  </span>
                  <span className="text-fg font-semibold info-value">
                    {year}
                  </span>
                </div>
              )}
              {combustivel && (
                <div className="flex flex-col">
                  <span className="text-muted-foreground uppercase tracking-wider mb-0.5 font-medium info-label">
                    Combustível
                  </span>
                  <span className="text-fg font-semibold uppercase info-value">
                    {combustivel}
                  </span>
                </div>
              )}
              {cambio && (
                <div className="flex flex-col">
                  <span className="text-muted-foreground uppercase tracking-wider mb-0.5 font-medium info-label">
                    Câmbio
                  </span>
                  <span className="text-fg font-semibold info-value">
                    {cambio}
                  </span>
                </div>
              )}
              {motorFormatado && (
                <div className="flex flex-col">
                  <span className="text-muted-foreground uppercase tracking-wider mb-0.5 font-medium info-label">
                    Motor
                  </span>
                  <span className="text-fg font-semibold info-value">
                    {motorFormatado}
                  </span>
                </div>
              )}
            </div>

            {/* Price & CTA - Melhorado */}
            <div className="flex flex-col items-center gap-3 w-full">
              {!isSold && (
                <div className="w-full flex justify-center items-center">
                  <PriceWithShimmer
                    price={price}
                    previousPrice={previousPrice}
                    showComparison={showPriceComparison}
                  />
                </div>
              )}
              <div className="w-full">
                <ContactButton
                  modeloCompleto={modeloCompleto}
                  vehicleId={vehicle?.id}
                  isSold={isSold}
                  vehicleLabel={vehicleLabel}
                />
                {!isSold && (
                  <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
                    Compare condições em diversos bancos e financeiras parceiras
                    para buscar a melhor opção disponível para seu perfil.
                    Sujeito à análise.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Desktop Image - Posicionamento absoluto apenas no desktop - Vindo da direita - Sem limite */}
        <motion.div
          initial={{ opacity: 0, x: 100 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: ANIMATION_DURATION.slow, ease: ANIMATION_EASING }}
          className="desktop-hero-image hidden lg:block absolute pointer-events-none select-none z-[2]
                     lg:w-[70vw] lg:top-[-3rem] lg:right-[-15%] lg:translate-x-0
                     xl:w-[70vw] xl:top-[-10rem] xl:right-[-5rem]
                     2xl:w-[70vw] 2xl:top-[-15rem] 2xl:right-[-25rem]
                     3xl:w-[70vw] 3xl:top-[-15rem] 3xl:right-[-30rem]
                     4xl:w-[70vw] 4xl:top-[-20rem] 4xl:right-[-30rem]
                     5xl:w-[70vw] 5xl:top-[-35rem] 5xl:right-[-30rem]"
        >
          {mainImage && (
            <div className="w-full h-full flex items-start justify-center overflow-visible relative">
              {isSold && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
                >
                  <span className="-rotate-[18deg] rounded-[1.75rem] border-[10px] border-[#E10600]/70 bg-white/40 px-14 py-5 text-7xl font-black uppercase tracking-[0.12em] text-[#E10600]/80 shadow-[0_16px_48px_rgba(0,0,0,0.16)] xl:border-[12px] xl:px-16 xl:py-6 xl:text-8xl 2xl:border-[14px] 2xl:px-20 2xl:py-7 2xl:text-9xl">
                    Vendido
                  </span>
                </div>
              )}
              {SHOW_CAMPAIGN_STAMP && !isSold && (
                <img
                  src="/selos/selo_campanha.png"
                  alt="Selo de campanha"
                  className="absolute bottom-[6%] right-[10%]
                             md:bottom-[7%] md:right-[11%]
                             xl:bottom-[8%] xl:right-[16%]
                             2xl:bottom-[9%] 2xl:right-[18%]
                             w-24 md:w-28 xl:w-32 2xl:w-36
                             h-auto z-50 pointer-events-none select-none"
                />
              )}
              <img
                src={mainImage}
                alt={`${marca} ${modeloCompleto} ${vehicle.year || ''} - Frente - Netcar Multimarcas`}
                className={`w-full h-auto object-contain ${isSold ? "grayscale-[0.25]" : ""}`}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
        </motion.div>
      </section>

      {/* Gallery Section */}
      {avifImages.length > 0 && (
        <section className="w-full py-8 sm:py-12 lg:py-16">
          <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          </div>
          {/* Grid Container - Ocupa toda a largura sem padding */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 4xl:grid-cols-7 5xl:grid-cols-8 gap-1 sm:gap-2">
            {avifImages.map((image, index) => (
              <GalleryItem
                key={index}
                image={image}
                index={index}
                alt={`${marca} ${modeloCompleto} ${vehicle.year || ''} - Foto ${index + 1} - Netcar Multimarcas`}
                onClick={() => {
                  setLightboxIndex(index);
                  setLightboxOpen(true);
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <Lightbox
          images={avifImages}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          vehicleName={modeloCompleto}
        />
      )}

      {/* Details Section */}
      <DetailsSection
        vehicle={vehicle}
        anuncio={anuncio || null}
        isSold={isSold}
      />

      {/* Fábrica de Valor Section */}
      <section className="w-full pt-4 pb-8 sm:pt-6 sm:pb-12 lg:pt-8 lg:pb-16 bg-surface">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <FabricaDeValor />
        </div>
      </section>

      {/* Related Vehicles Section */}
      <RelatedVehiclesSection 
        currentVehicleId={String(vehicle.id)} 
        currentCategory={vehicle.categoria}
        currentPrice={vehicle.price}
        currentMarca={vehicle.marca}
        currentYear={vehicle.year}
        currentModelo={vehicle.modelo || vehicle.name}
        isSold={isSold}
      />

      {/* Social Embeds Section (deve ser a última sessão) */}
      <NetcarSocialSection />

      <div className="w-full font-sans antialiased text-muted-foreground bg-muted py-12 px-4 md:px-8 space-y-8">
        <LazyLocalizacao />
        <IanBot />
      </div>

      <DetalheMobileStickyBar
        price={price}
        modeloCompleto={modeloCompleto}
        vehicleId={vehicle.id}
        isSold={isSold}
        vehicleLabel={vehicleLabel}
      />
    </main>
  );
}

interface DetailsSectionProps {
  vehicle: any;
  anuncio?: string | null;
  isSold?: boolean;
}

function DetailsSection({ vehicle, anuncio, isSold = false }: DetailsSectionProps) {
  const [showMoreOptionals, setShowMoreOptionals] = useState(false);

  const marca = vehicle.marca || vehicle.name?.split(" ")[0] || "";
  const modeloCompleto = vehicle.modelo || vehicle.name || "";
  const year = vehicle.year || 0;
  const anoFabricacao = vehicle.anoFabricacao;

  // Parse do conteúdo do anúncio (vem do endpoint separado)
  const gptContent = useMemo(() => parseGptContent(anuncio || null), [anuncio]);

  // Formata ano para especificações técnicas
  const anoDisplay = anoFabricacao && year 
    ? `${anoFabricacao} / ${year}` 
    : year 
    ? String(year) 
    : "";

  const specifications = [
    anoDisplay && { label: "Ano:", value: anoDisplay },
    vehicle.cor && { label: "Cor:", value: vehicle.cor },
    vehicle.portas && { label: "Portas:", value: `${vehicle.portas}` },
    vehicle.placa && { label: "Placa:", value: maskPlate(vehicle.placa) },
    vehicle.motor && { label: "Motor:", value: vehicle.motor },
    vehicle.potencia && { label: "Potência:", value: `${vehicle.potencia} cv` },
    vehicle.combustivel && {
      label: "Combustível:",
      value: vehicle.combustivel,
    },
    vehicle.cambio && { label: "Câmbio:", value: vehicle.cambio },
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  // Mapeamento de tags para pesos (peso menor = maior prioridade)
  const OPTIONAL_PRIORITY_MAP: Record<string, number> = {
    "sete_lugares": 1,           // 7 Lugares
    "teto_panoramico": 2,        // Teto Panorâmico
    "teto_solar": 3,             // Teto Solar (somente se panorâmico não estiver presente)
    "multimidia": 4,             // Central Multimídia
    "bancos_de_couro": 5,       // Bancos em Couro
    "piloto_adaptativo": 6,      // Piloto Automático Adaptativo
    "piloto_automatico": 7,     // Piloto Automático (somente se adaptativo não estiver presente)
    "botao": 8,                  // Botão de Partida
  };

  // Peso padrão para opcionais não listados
  const DEFAULT_PRIORITY = 999;

  // Função para ordenar opcionais por prioridade usando tags
  const sortOptionals = (
    optionals: Array<{ tag?: string; descricao?: string } | string>
  ): Array<{ tag?: string; descricao?: string } | string> => {
    // Converte para formato padronizado
    const normalizedOptionals = optionals.map((op) => {
      if (typeof op === "string") {
        return { tag: "", descricao: op };
      }
      return { tag: op.tag || "", descricao: op.descricao || "" };
    });

    // Verifica se existe teto solar panorâmico na lista
    const hasPanoramicSunroof = normalizedOptionals.some(
      (opt) => opt.tag === "teto_panoramico"
    );

    // Verifica se existe piloto automático adaptativo na lista
    const hasAdaptiveCruise = normalizedOptionals.some(
      (opt) => opt.tag === "piloto_adaptativo"
    );

    // Função para obter o peso de um opcional usando a tag
    const getPriority = (optional: { tag: string; descricao: string }): number => {
      const tag = optional.tag.toLowerCase().trim();

      // Verifica se a tag está no mapeamento de prioridades
      if (OPTIONAL_PRIORITY_MAP[tag] !== undefined) {
        // Casos especiais com lógica condicional
        if (tag === "teto_solar") {
          // Teto solar só tem peso 3 se não houver panorâmico
          return hasPanoramicSunroof ? DEFAULT_PRIORITY : OPTIONAL_PRIORITY_MAP[tag];
        }

        if (tag === "piloto_automatico") {
          // Piloto automático só tem peso 7 se não houver adaptativo
          return hasAdaptiveCruise ? DEFAULT_PRIORITY : OPTIONAL_PRIORITY_MAP[tag];
        }

        // Para os outros, retorna o peso direto do mapa
        return OPTIONAL_PRIORITY_MAP[tag];
      }

      return DEFAULT_PRIORITY;
    };

    // Ordena por prioridade (menor peso primeiro)
    return normalizedOptionals.sort((a, b) => {
      const priorityA = getPriority(a as { tag: string; descricao: string });
      const priorityB = getPriority(b as { tag: string; descricao: string });

      // Se as prioridades forem iguais, mantém a ordem original
      if (priorityA === priorityB) {
        return 0;
      }

      return priorityA - priorityB;
    });
  };

  // Extrai opcionais do veículo (pode ser string ou objeto com tag/descricao)
  const rawOptionals =
    vehicle.opcionais?.map((op: any) =>
      typeof op === "string" ? op : { tag: op.tag || "", descricao: op.descricao || op.nome || "" }
    ) || [];

  // Aplica ordenação por prioridade usando tags
  const sortedOptionals = sortOptionals(rawOptionals);

  // Converte de volta para strings (descrição) para renderização
  const optionals = sortedOptionals.map((op) =>
    typeof op === "string" ? op : op.descricao || ""
  );

  // SVG Icon Component
  const SpecIcon = ({ className }: { className?: string }) => (
    <div
      className={
        className ||
        "w-[26px] h-[26px] sm:w-[28px] sm:h-[28px] lg:w-[30px] lg:h-[30px]"
      }
    >
      <img src={icon1} alt="" aria-hidden="true" className="block size-full" />
    </div>
  );

  return (
    <section className="w-full py-8 sm:py-12 lg:py-16">
      <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_410px] gap-8 lg:gap-10">
          {/* Main Content */}
          <div className="order-1 lg:order-1">
            {/* Specifications Section */}
                <motion.div
              initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASING }}
              className="mb-12"
            >
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-primary">
                      <SpecIcon />
                <h2 className="section-heading">
                        Especificações
                      </h2>
                    </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                      {specifications.map((spec, index) => (
                  <SpecBadge
                          key={index}
                    label={spec.label}
                    value={spec.value}
                    index={index}
                  />
                ))}
                  </div>
                </motion.div>

            {/* Optionals Section */}
            {optionals.length > 0 && (
                  <motion.div
                initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASING }}
                className="mb-12"
              >
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-primary">
                        <SpecIcon />
                  <h2 className="section-heading">
                          Opcionais
                        </h2>
                      </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {optionals
                    .slice(0, showMoreOptionals ? optionals.length : 15)
                    .map((optional: string, index: number) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                      transition={{
                          duration: 0.3,
                        delay: index * 0.05,
                        }}
                      >
                        <OptionalItem text={optional} />
                        </motion.div>
                    ))}
                </div>

                {!showMoreOptionals && optionals.length > 15 && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    onClick={() => setShowMoreOptionals(true)}
                    className="mt-4 text-primary text-[14px] sm:text-[15px] font-bold underline hover:text-primary/80 transition-colors"
                  >
                    Carregar mais informações [+]
                  </motion.button>
                )}
                    </motion.div>
            )}

            {/* Header with Icon */}
              <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
              transition={{ duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASING }}
              className="flex items-start gap-3 mb-6"
            >
              <SpecIcon className="w-[36px] h-[36px] sm:w-[40px] sm:h-[40px] lg:w-[42px] lg:h-[42px] flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-fg text-[18px] sm:text-[20px] lg:text-[22px] font-medium mb-1">
                  {marca} {modeloCompleto} {year}
                </h2>
                <p className="text-primary text-[16px] sm:text-[18px] lg:text-[22px] font-light">
                  Conquiste a cidade com estilo, tecnologia e conforto.
                </p>
              </div>
              </motion.div>

            {/* Introduction */}
            {(gptContent?.apresentacao || !gptContent) && (
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
              transition={{ duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASING }}
              className="section-text mb-8"
            >
              {gptContent?.apresentacao ? (
                gptContent.apresentacao
              ) : (
                `O novo ${marca} ${modeloCompleto} é a escolha perfeita para quem
                busca um veículo versátil, ideal para famílias modernas e
                aventureiros urbanos. Com um design atrativo e sofisticado, este
                modelo não só parece bom, mas também oferece uma experiência de
                condução excepcional, graças às suas características técnicas
                avançadas e conforto superior.`
              )}
                </motion.p>
            )}

            {/* Accordion Sections */}
            <div className="space-y-2">
              {/* Accordions dinâmicos do GPT */}
              {gptContent && gptContent.accordions.length > 0 ? (
                gptContent.accordions.map((accordion: AccordionSection, index: number) => (
                  <AccordionItem
                    key={index}
                    title={accordion.title}
                    defaultOpen={index === 0}
                  >
                    {typeof accordion.content === "object" && accordion.content !== null && "itens" in accordion.content ? (
                      <>
                        {accordion.content.introducao && (
                          <p className="section-text mb-4">
                            {accordion.content.introducao}
                          </p>
                        )}
                        {accordion.content.itens.length > 0 && (
                          <ul className="space-y-2 list-disc list-outside text-fg text-[14px] sm:text-[15px] leading-[26px] ml-5">
                            {accordion.content.itens.map((item, itemIndex) => (
                              <li key={itemIndex} className="pl-2">
                                {item.label && <strong>{item.label}</strong>} {item.texto}
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : (
                      <p className="section-text">
                        {accordion.content}
                      </p>
                    )}
                  </AccordionItem>
                ))
              ) : (
                /* Fallback: Accordions estáticos quando não há conteúdo GPT */
                <>
                  <AccordionItem
                    title="Diferenciais técnicos que destacam o modelo"
                    defaultOpen={true}
                  >
                    <p className="section-text mb-4">
                      O {modeloCompleto} é projetado para proporcionar uma jornada
                      suave e eficiente. Entre os destaques técnicos, este modelo
                      inclui:
                    </p>
                    <ul className="space-y-2 list-disc list-outside section-text ml-5">
                      <li className="pl-2">
                        Motor {vehicle.motor || "potente"} que oferece excelente
                        desempenho e eficiência energética.
                      </li>
                      <li className="pl-2">
                        Câmbio {vehicle.cambio?.toLowerCase() || "automático"} que
                        garante trocas suaves e ágeis.
                      </li>
                      <li className="pl-2">
                        Direção elétrica que proporciona um manuseio preciso e
                        facilita a condução em espaços apertados.
                      </li>
                      <li className="pl-2">
                        Suspensão otimizada que melhora o conforto em diferentes
                        tipos de terreno.
                      </li>
                    </ul>
                  </AccordionItem>

                  <AccordionItem title="Tecnologia e conforto a bordo">
                    <p className="text-fg text-[14px] sm:text-[15px] leading-[26px]">
                      Equipado com as mais recentes tecnologias para garantir
                      conforto e conectividade durante toda a jornada.
                    </p>
                  </AccordionItem>

                  <AccordionItem title="Recursos avançados de segurança">
                    <p className="text-fg text-[14px] sm:text-[15px] leading-[26px]">
                      Sistema completo de segurança com múltiplos air bags, controle
                      de estabilidade e muito mais.
                    </p>
                  </AccordionItem>

                  <AccordionItem title="Espaço e capacidade">
                    <p className="text-fg text-[14px] sm:text-[15px] leading-[26px]">
                      Amplo espaço interno para passageiros e bagagens, perfeito
                      para viagens longas.
                    </p>
                  </AccordionItem>

                  <AccordionItem title="Por que optar pelo modelo?">
                    <p className="text-fg text-[14px] sm:text-[15px] leading-[26px]">
                      Combinação perfeita de design, tecnologia, conforto e
                      economia, ideal para seu dia a dia.
                    </p>
                  </AccordionItem>
                </>
              )}
            </div>
          </div>

          {/* Sticky Sidebar - ordem invertida no mobile */}
          <div className="order-2 lg:order-2 lg:sticky lg:top-8 lg:self-start">
            <CTASidebar
              vehicle={vehicle}
              modeloCompleto={modeloCompleto}
              isSold={isSold}
            />
          </div>
        </div>
      </div>
        </section>
  );
}
