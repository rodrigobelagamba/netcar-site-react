import {
  useParams,
  useLocation,
  Link,
  useNavigate,
} from "@tanstack/react-router";
import {
  motion,
  AnimatePresence,
} from "@/design-system/components/utils/StaticMotion";
import {
  MessageCircleMore,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CalendarDays,
  Calculator,
  ArrowLeftRight,
  ArrowRight,
  Image as ImageIcon,
  LucideIcon,
} from "lucide-react";
import React, { useState, useMemo, useEffect, useLayoutEffect } from "react";
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
import icon1 from "@/assets/images/icon-1.svg";
import { ProductList } from "@/design-system/components/patterns/ProductList";
import type { VehicleCardProps } from "@/design-system/components/patterns/VehicleCard";
import { VehicleWhatsAppCard } from "@/design-system/components/patterns/VehicleWhatsAppCard";
import { FloatingPortal } from "@/components/FloatingPortal";
import { DeferredRender } from "@/design-system/components/layout/DeferredRender";
import { LazyLocalizacao } from "@/design-system/components/layout/LazyLocalizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";
import { generateVehicleSlug, maskPlate } from "@/lib/slug";
import {
  icheckProtocolFromDate,
  resolveIcheckProtocol,
} from "@/lib/icheck-protocol";
import { canonicalUrl } from "@/lib/seo";
import {
  optimizeStockImage,
  stockGalleryPreviewSource,
  stockImageSrcSet,
} from "@/lib/images";
import { useMetaTags } from "@/hooks/useMetaTags";
import { VehicleSchemaOrg } from "@/components/seo/VehicleSchemaOrg";
import { VehicleUnavailablePage } from "@/components/VehicleUnavailablePage";
import { emptySeminovosSearch } from "@/lib/seminovos-search";
import { parseGptContent, AccordionSection } from "@/lib/parseGptContent";
import { SHOW_CAMPAIGN_STAMP } from "@/config/features";
import { landingPages, matchesLandingFilters } from "@/data/seo";
import {
  buildVehicleHighlights,
  cleanOptionalDescription,
  normalizeVehicleFeatureTag,
  type VehicleHighlightsPresentation,
} from "@/modules/detalhes/lib/vehicleHighlights";

// Constantes de animação
const ANIMATION_EASING = [0.25, 0.1, 0.25, 1] as const;
const ANIMATION_DURATION = {
  fast: 0.3,
  normal: 0.7,
  slow: 0.8,
} as const;

// Constantes de imagem
const CAR_COVERED_PLACEHOLDER_URL = "/images/semcapa.webp";
const PROBLEMATIC_IMAGE_PATTERN = "271_131072img_8213";
const LOW_MILEAGE_HIGHLIGHT_THRESHOLD_KM = 10_000;

type EngineVehicle = {
  modelo?: string;
  name?: string;
  motor?: string;
  opcionais?: Array<{ tag?: string; descricao?: string } | string>;
};

function hasTurboEngine(vehicle?: EngineVehicle | null): boolean {
  if (!vehicle) return false;

  const vehicleName = `${vehicle.modelo || ""} ${vehicle.name || ""}`;
  if (/\bturbo\b/i.test(vehicleName)) return true;

  return (vehicle.opcionais || []).some((optional) => {
    const value =
      typeof optional === "string"
        ? optional
        : `${optional.tag || ""} ${optional.descricao || ""}`;
    return normalizeVehicleFeatureTag(value).includes("motor_turbo");
  });
}

function formatEngineDisplacement(vehicle?: EngineVehicle | null): string {
  const displacement = String(vehicle?.motor || "").trim();
  if (!displacement || !hasTurboEngine(vehicle)) return displacement;
  if (/\bturbo\b/i.test(displacement)) return displacement;
  return `${displacement} TURBO`;
}

const FabricaDeValor = React.lazy(() =>
  import("@/design-system/components/patterns/FabricaDeValor").then(
    (module) => ({
      default: module.FabricaDeValor,
    }),
  ),
);
const NetcarSocialSection = React.lazy(() =>
  import("@/design-system/components/patterns/social/NetcarSocialSection").then(
    (module) => ({ default: module.NetcarSocialSection }),
  ),
);

type BadgeVariant =
  | "oportunidade"
  | "icheck"
  | "garantia"
  | "baixa-km"
  | "green-dark";

interface Badge {
  text: string;
  variant: BadgeVariant;
}

/** Cores pill (screenshot selos). */
const BADGE_COLORS: Record<BadgeVariant, string> = {
  oportunidade: "#8A5E00",
  icheck: "#087A37",
  garantia: "#23747C",
  "baixa-km": "#004C5C",
  "green-dark": "#00363B",
};

function Badge({ text, variant }: Badge) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        duration: ANIMATION_DURATION.normal,
        ease: ANIMATION_EASING,
      }}
      className="rounded-[45px] flex items-center uppercase font-bold tracking-wide text-white info-badge"
      style={{ backgroundColor: BADGE_COLORS[variant] }}
    >
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
        transition={{
          duration: ANIMATION_DURATION.fast,
          ease: ANIMATION_EASING,
        }}
      />

      <div className="relative flex items-center h-full">
        <div className="relative overflow-hidden h-full flex items-center">
          <motion.span
            className={`${restingTextColor} whitespace-nowrap relative z-10`}
            initial={{ y: 0, opacity: 1 }}
            animate={{ y: isHovered ? -40 : 0, opacity: isHovered ? 0 : 1 }}
            transition={{
              duration: ANIMATION_DURATION.fast,
              ease: ANIMATION_EASING,
            }}
          >
            {text}
          </motion.span>
          <motion.span
            className="text-white whitespace-nowrap absolute left-0 top-0 h-full flex items-center z-10 info-contact-button"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: isHovered ? 0 : 40, opacity: isHovered ? 1 : 0 }}
            transition={{
              duration: ANIMATION_DURATION.fast,
              ease: ANIMATION_EASING,
            }}
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
        data-wa-vehicle-id={
          waVehicleId != null ? String(waVehicleId) : undefined
        }
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
  image?: string;
  priceLabel?: string;
}

function ContactButton({
  modeloCompleto,
  vehicleId,
  isSold = false,
  vehicleLabel,
  image,
  priceLabel,
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

  const identifiedVehicle =
    image && priceLabel && vehicleId != null
      ? {
          id: String(vehicleId),
          label,
          priceLabel,
          image,
        }
      : null;

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

  // Card WA fica flutuante (DetalheFloatingWhatsApp). Aqui só troca + fallback sem foto.
  return (
    <div className="flex w-full flex-col items-center gap-2.5">
      {!identifiedVehicle && href ? (
        <div className="w-full">
          <WhatsAppPulseRing>
            <CTAButton
              text="Chamar no WhatsApp"
              icon={MessageCircleMore}
              borderColor="border-[#25D366]"
              textColor="text-white"
              hoverBgColor="bg-green-dark"
              filled
              className="w-full info-contact-button-wrapper !bg-[#087A37] !border-[#087A37] shadow-[0_8px_24px_rgba(8,122,55,0.3)]"
              initialAnimation={true}
              href={href}
              waSource="hero"
              waIntent="vehicle_inquiry"
              waVehicleId={vehicleId}
              waVehicleName={modeloCompleto}
              disabled={!whatsapp?.numero}
            />
          </WhatsAppPulseRing>
        </div>
      ) : null}

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
      <ArrowLeftRight
        className={compact ? "h-3.5 w-3.5 shrink-0" : "h-4 w-4 shrink-0"}
      />
      <span className="underline underline-offset-4">
        Tenho um usado na troca
      </span>
    </a>
  );
}

interface DetalheFloatingWhatsAppProps {
  price: string;
  modeloCompleto: string;
  vehicleId?: string | number;
  isSold?: boolean;
  vehicleLabel?: string;
  image?: string;
}

/** Sticky flutuante com carro identificado — substitui bolinha iAN no detalhe. */
function DetalheFloatingWhatsApp({
  price,
  modeloCompleto,
  vehicleId,
  isSold = false,
  vehicleLabel,
  image,
}: DetalheFloatingWhatsAppProps) {
  const { data: whatsapp } = useWhatsAppQuery();
  const label = vehicleLabel || modeloCompleto || "veículo";
  const messages = vehicleWhatsAppMessages(label, modeloCompleto);
  const ready = Boolean(whatsapp?.numero);
  const priceLabel = price.replace(/<[^>]*>/g, "");

  if (isSold) {
    return (
      <FloatingPortal>
        <div className="pointer-events-none fixed inset-x-0 bottom-3 z-[60] flex justify-center px-3 lg:hidden">
          <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-[#00283C]/15 bg-white/95 px-3 py-2.5 shadow-[0_12px_36px_rgba(0,0,0,0.16)] backdrop-blur-md">
            <p className="mb-2 text-center text-sm font-black text-[#00283C]">
              Este seminovo já foi vendido
            </p>
            <a
              href="#opcoes-parecidas"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00283C] px-4 py-2.5 text-sm font-black text-white"
            >
              Ver opções parecidas
              <ArrowRight className="h-4 w-4" />
            </a>
            {ready ? (
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
                className="mt-2 flex w-full items-center justify-center gap-1.5 text-xs font-bold text-[#128C7E]"
              >
                <MessageCircleMore className="h-3.5 w-3.5" />
                Quero um similar no WhatsApp
              </a>
            ) : null}
          </div>
        </div>
      </FloatingPortal>
    );
  }

  if (!ready || vehicleId == null || !priceLabel) return null;

  const href = buildWhatsAppUrl(whatsapp!.numero, messages.info);
  const cardImage = image || "/images/semcapa.webp";

  return (
    <FloatingPortal>
      <div className="pointer-events-none fixed inset-x-0 bottom-2 z-[60] flex justify-center px-2 md:bottom-3 md:px-3 lg:hidden">
        <div className="pointer-events-auto w-full max-w-[22rem] md:max-w-sm">
          <VehicleWhatsAppCard
            vehicle={{
              id: String(vehicleId),
              label,
              priceLabel,
              image: cardImage,
            }}
            href={href}
            source="detalhe_sticky"
            eyebrow="Este carro"
          />
        </div>
      </div>
    </FloatingPortal>
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
      transition={{
        duration: ANIMATION_DURATION.normal,
        ease: ANIMATION_EASING,
      }}
      className={`mb-1 rounded-xl border-b border-[#00283C]/[0.08] px-1 pb-4 transition-colors ${
        isOpen ? "border-[#00283C]/15" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="group flex w-full items-center justify-between rounded-lg py-1 text-left transition-colors hover:bg-[#00283C]/[0.02]"
      >
        <h3 className="pr-4 text-[17px] font-medium text-[#23747C] sm:text-[18px] lg:text-[19px]">
          {title}
        </h3>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{
            duration: ANIMATION_DURATION.fast,
            ease: ANIMATION_EASING,
          }}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#00283C]/[0.05] text-[#00283C]/70 transition-colors group-hover:bg-[#00283C]/[0.08]"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </button>

      <motion.div
        initial={false}
        animate={{
          height: isOpen ? "auto" : 0,
          opacity: isOpen ? 1 : 0,
          marginTop: isOpen ? 16 : 0,
        }}
        transition={{
          duration: ANIMATION_DURATION.fast,
          ease: ANIMATION_EASING,
        }}
        style={{ display: isOpen ? "block" : "none" }}
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
        duration: 0.5,
        delay: index * 0.04,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className="flex min-h-[72px] flex-col items-start justify-center rounded-xl border border-[#00283C]/[0.08] bg-white px-4 py-3 shadow-[0_4px_16px_rgba(0,40,60,0.035)]"
    >
      <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[#23747C]">
        {label.replace(/:$/, "")}
      </span>
      <span className="mt-1 text-[15px] font-black leading-tight text-[#00283C] sm:text-[16px]">
        {value}
      </span>
    </motion.div>
  );
}

interface OptionalItemProps {
  text: string;
}

function OptionalItem({ text }: OptionalItemProps) {
  return (
    <div className="flex min-h-10 items-center gap-2.5 py-1.5">
      <div className="h-4 w-4 flex-shrink-0 text-[#23747C]">
        <svg
          className="block size-full"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M10 17V7L15 12L10 17Z" fill="currentColor" />
        </svg>
      </div>
      <span className="text-[13px] leading-5 text-fg sm:text-[14px]">
        {text}
      </span>
    </div>
  );
}

interface CTASidebarProps {
  vehicle?: any;
  modeloCompleto?: string;
  isSold?: boolean;
  /** Slug da URL atual (/veiculo/$slug) — NÃO usar vehicle.slug (link legado .html da API). */
  pageSlug?: string;
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
      <div className="flex items-center gap-3 rounded-xl border border-[#00283C]/[0.07] bg-[#F7F9FA] px-3 py-2.5 opacity-50">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#087A37]/10 text-[#087A37]">
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-left text-[13px] font-semibold leading-tight text-fg">
          {label}
        </span>
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
      whileHover={{ scale: 1.01, y: -1 }}
      whileTap={{ scale: 0.98 }}
      className="group flex items-center gap-3 rounded-xl border border-[#00283C]/[0.07] bg-[#FAFCFB] px-3 py-2.5 transition-colors hover:border-[#087A37]/25 hover:bg-[#087A37]/[0.04]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#087A37] text-white transition-transform group-hover:scale-105">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-left text-[13px] font-semibold leading-tight text-[#00283C] group-hover:text-green-dark">
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
      ? "border-[#087A37]/15 bg-white"
      : "border-[#00283C]/[0.08] bg-white";

  const badgeClass = variant === "trust" ? "text-[#087A37]" : "text-[#365463]";

  return (
    <div
      className={`relative flex flex-col items-start overflow-hidden rounded-2xl border p-5 shadow-[0_8px_24px_rgba(0,40,60,0.045)] ${styles}`}
    >
      <span
        className={`relative mb-3 inline-flex items-center text-[10px] font-black uppercase tracking-[0.16em] ${badgeClass}`}
      >
        {badge}
      </span>
      <div className="relative flex w-full flex-col items-start">
        {children}
      </div>
    </div>
  );
}

function CTASidebar({
  vehicle,
  modeloCompleto,
  isSold = false,
  pageSlug,
}: CTASidebarProps) {
  const { data: whatsapp } = useWhatsAppQuery();
  const [dataHoraConsulta, setDataHoraConsulta] = useState<string | null>(null);
  const [consultaIdMeta, setConsultaIdMeta] = useState<string | null>(null);
  const protocoloConsulta =
    consultaIdMeta || icheckProtocolFromDate(dataHoraConsulta);

  useEffect(() => {
    // Meta só a partir do PDF da API (Automacar) — sem mapa local.
    const pdfFromVehicle =
      vehicle?.pdf ||
      (vehicle?.pdf_url ? String(vehicle.pdf_url).split("/").pop() : "") ||
      "";
    if (!pdfFromVehicle) {
      setDataHoraConsulta(null);
      setConsultaIdMeta(null);
      return;
    }

    const metaName = String(pdfFromVehicle)
      .replace(/^.*\//, "")
      .replace(/\.pdf$/i, ".meta.json");

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/arquivos/autocheck/${metaName}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) {
            setDataHoraConsulta(null);
            setConsultaIdMeta(null);
          }
          return;
        }
        const json = await res.json();
        if (cancelled) return;
        const data =
          json?.dataHoraConsulta != null
            ? String(json.dataHoraConsulta).trim()
            : "";
        const fromMeta =
          json?.protocoloConsulta != null
            ? String(json.protocoloConsulta).trim()
            : "";
        setDataHoraConsulta(data || null);
        setConsultaIdMeta(resolveIcheckProtocol(fromMeta, data) || null);
      } catch {
        if (!cancelled) {
          setDataHoraConsulta(null);
          setConsultaIdMeta(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [vehicle?.pdf, vehicle?.pdf_url]);

  const handleOpenLaudo = () => {
    // pageSlug da rota tem o ID no fim; vehicle.slug da API é link legado .html sem ID
    const laudoSlug =
      (pageSlug && String(pageSlug).trim()) ||
      (vehicle?.id != null ? String(vehicle.id) : "");
    if (!laudoSlug) {
      console.warn("Slug indisponível para abrir laudo");
      return;
    }
    window.open(`/laudo/${laudoSlug}`, "_blank", "noopener,noreferrer");
  };

  const getWhatsAppLink = (message: string) => {
    if (!whatsapp?.numero) return "#";
    return buildWhatsAppUrl(whatsapp.numero, message);
  };

  const vehicleLabel = modeloCompleto || "veículo";
  const whatsappReady = Boolean(whatsapp?.numero);
  const vehicleMessages = vehicleWhatsAppMessages(vehicleLabel, modeloCompleto);
  const primaryWhatsAppHref =
    whatsappReady && isSold
      ? getWhatsAppLink(
          siteWhatsAppMessage(
            `o ${vehicleLabel} que eu vi no site já foi vendido. Quero opções parecidas disponíveis.`,
          ),
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
  const showIcheckCta = Boolean(hasPDF) && !isSold;

  return (
    <div className="space-y-3">
      {showIcheckCta && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{
            duration: ANIMATION_DURATION.normal,
            ease: ANIMATION_EASING,
          }}
        >
          <button
            type="button"
            onClick={handleOpenLaudo}
            className="group w-full rounded-2xl border border-[#087A37]/15 bg-white p-5 text-left shadow-[0_8px_24px_rgba(0,40,60,0.045)] transition-colors hover:border-[#087A37]/30 hover:bg-[#087A37]/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087A37]/30"
            aria-label={
              protocoloConsulta
                ? `Abrir laudo i-CHECK, ConsultaID ${protocoloConsulta}`
                : "Abrir laudo i-CHECK em nova aba"
            }
          >
            <span className="flex w-full items-center gap-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#EAF7F0]">
                <img
                  src="/brand/checkauto-dekra.png"
                  alt="DEKRA CheckAuto"
                  width="56"
                  height="56"
                  loading="lazy"
                  decoding="async"
                  className="h-12 w-12 object-contain"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[9px] font-black uppercase tracking-[0.16em] text-[#087A37]">
                  i-CHECK Netcar
                </span>
                <span className="mt-0.5 block text-[16px] font-black text-[#00283C]">
                  Histórico disponível
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                  Fotos e consulta DEKRA / CheckAuto
                </span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 text-[#087A37] transition-transform group-hover:translate-x-0.5" />
            </span>
            {protocoloConsulta ? (
              <span className="mt-4 flex w-full items-center justify-between border-t border-[#00283C]/[0.08] pt-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6B73]">
                  ConsultaID
                </span>
                <span className="text-[14px] font-black tabular-nums tracking-[0.08em] text-[#00283C]">
                  {protocoloConsulta}
                </span>
              </span>
            ) : null}
          </button>
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
          badge={isSold ? "Próximo passo" : "Fale com a Netcar"}
        >
          {isSold ? (
            <>
              <h3 className="mb-2 text-center text-[20px] font-bold text-[#00283C] sm:text-[22px] lg:text-[24px]">
                Quer um carro parecido?
              </h3>
              <p className="mb-5 text-center text-[15px] text-muted-foreground sm:text-[16px] lg:text-[17px]">
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
                  className="w-full !bg-[#087A37] !border-[#087A37] shadow-[0_8px_24px_rgba(8,122,55,0.35)]"
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
              <h3 className="mb-1 text-left text-[18px] font-black text-[#00283C]">
                Como prefere falar?
              </h3>
              <p className="mb-4 text-left text-[13px] leading-relaxed text-muted-foreground">
                Escolha o assunto e já abra a conversa certa no WhatsApp.
              </p>

              <div className="grid w-full grid-cols-1 gap-2">
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
          onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
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
  const previewSource = stockGalleryPreviewSource(image);

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
          src={optimizeStockImage(previewSource, 640)}
          srcSet={stockImageSrcSet(previewSource, [320, 480, 640, 768, 960])}
          sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, (max-width: 1535px) 25vw, (max-width: 1919px) 20vw, (max-width: 2559px) 17vw, (max-width: 3839px) 14vw, 13vw"
          alt={alt}
          width={1920}
          height={1441}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          onError={(event) => {
            const target = event.currentTarget;
            if (target.dataset.originalFallback === "true") {
              target.style.display = "none";
              return;
            }
            target.dataset.originalFallback = "true";
            target.removeAttribute("srcset");
            target.src = image;
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
      const sameMarca = marcaKey && (v.marca || "").toUpperCase() === marcaKey;
      const sameCat = catKey && (v.categoria || "").toUpperCase() === catKey;
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

    const minPrice =
      referencePrice > 0 ? referencePrice * (1 - priceRangeRatio) : 0;
    const maxPrice =
      referencePrice > 0 ? referencePrice * (1 + priceRangeRatio) : Infinity;

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
        score += Math.max(
          0,
          20 - Math.min(20, (priceDiff / Math.max(referencePrice, 1)) * 20),
        );

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
      ? scored.filter(
          (v) => v.inPriceRange || v.sameMarcaMatch || v.sameCatMatch,
        )
      : scored;

    const pool =
      preferred.length >= Math.min(4, maxRelatedVehicles) ? preferred : scored;

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
          transition={{
            duration: ANIMATION_DURATION.normal,
            ease: ANIMATION_EASING,
          }}
          className="mb-8 sm:mb-10 lg:mb-12"
        >
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-[26px] w-[26px] sm:h-[28px] sm:w-[28px] lg:h-[30px] lg:w-[30px]">
                <img
                  src={icon1}
                  alt=""
                  aria-hidden="true"
                  className="block size-full"
                />
              </div>
              <div>
                <h2 className="section-heading">
                  {isSold
                    ? "Opções parecidas no estoque"
                    : "Você também pode gostar"}
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
          whatsAppSource={
            isSold ? "detalhe_vendido_similares" : "detalhe_relacionados"
          }
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
            De:{" "}
            <span
              className="line-through"
              dangerouslySetInnerHTML={{ __html: previousPrice }}
            />
          </p>
          <span className="text-fg/60 text-[11px] font-semibold uppercase leading-none whitespace-nowrap">
            Para:
          </span>
          <p
            className={`font-bold whitespace-nowrap cursor-pointer text-[#087A37] leading-tight info-price info-price-shimmer ${
              isHovered ? "info-price-shimmer-hover" : ""
            }`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            dangerouslySetInnerHTML={{ __html: price }}
          />
        </div>
      ) : (
        <p
          className={`font-bold whitespace-nowrap cursor-pointer text-[#087A37] leading-tight info-price info-price-shimmer ${
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

/** Skeleton quieto — só cold load sem cache do estoque. */
function LoadingVehicleDetail({ slug }: { slug: string }) {
  const modeloCompleto = vehicleLabelFromSlug(slug) || "Seminovo";

  return (
    <main className="max-w-full overflow-x-clip pb-40" aria-busy="true">
      <section className="relative w-full min-h-[70vh] overflow-hidden py-8 lg:py-12">
        <div className="container-main grid grid-cols-1 items-center gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="order-2 space-y-4 lg:order-1">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-10 w-4/5 max-w-md animate-pulse rounded bg-muted" />
            <div className="h-8 w-40 animate-pulse rounded bg-muted" />
            <div className="h-12 w-56 animate-pulse rounded-full bg-muted" />
            <p className="sr-only">Carregando {modeloCompleto}</p>
          </div>
          <div className="order-1 aspect-[4/3] w-full animate-pulse rounded-2xl bg-muted lg:order-2" />
        </div>
      </section>
    </main>
  );
}

export function DetalhesPage() {
  const { slug: paramSlug } = useParams({ from: "/veiculo/$slug" });
  const location = useLocation();
  const navigate = useNavigate();
  const slug = paramSlug || location.pathname.replace(/^\/veiculo\//, "") || "";

  // A mesma página React é reutilizada ao trocar de veículo. Reinicia o scroll
  // de forma síncrona para o novo anúncio nunca herdar a posição do anterior.
  useLayoutEffect(() => {
    const scrollToTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    scrollToTop();
    const frame = window.requestAnimationFrame(scrollToTop);
    return () => window.cancelAnimationFrame(frame);
  }, [slug]);

  const {
    data: vehicle,
    isPlaceholderData,
    error,
    isPending,
  } = useVehicleQuery(slug);

  const modelLanding = useMemo(
    () =>
      vehicle
        ? landingPages.find(
            (landing) =>
              landing.type === "modelo" &&
              landing.indexable &&
              matchesLandingFilters(vehicle, landing.filters),
          )
        : undefined,
    [vehicle],
  );

  // A troca do placeholder pelos dados reais altera bastante a altura da rota.
  // Reafirma o topo nesse momento para impedir o scroll anchoring do navegador.
  useLayoutEffect(() => {
    if (!vehicle || isPlaceholderData) return;
    window.scrollTo(0, 0);
  }, [slug, vehicle?.id, isPlaceholderData]);

  const officialSlug = useMemo(() => {
    if (!vehicle) return "";
    return generateVehicleSlug({
      modelo: vehicle.modelo,
      marca: vehicle.marca,
      year: vehicle.year,
      placa: vehicle.placa,
      id: vehicle.id,
    });
  }, [vehicle]);

  // URL curta / slug legado → slug canônico oficial (evita conflito GSC)
  useEffect(() => {
    if (!vehicle || !officialSlug || !slug) return;
    if (slug === officialSlug) return;
    navigate({
      to: "/veiculo/$slug",
      params: { slug: officialSlug },
      replace: true,
    });
  }, [vehicle, officialSlug, slug, navigate]);

  // GA4: view_item — só dado real da API (não placeholder do estoque)
  useEffect(() => {
    if (!vehicle || isPlaceholderData) return;
    trackViewItem({
      vehicleId: vehicle.id,
      vehicleName:
        [vehicle.marca, vehicle.modelo, vehicle.year]
          .filter(Boolean)
          .join(" ") || vehicle.name,
      price: vehicle.price,
    });
  }, [vehicle, isPlaceholderData]);

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
      typeof vehicle.preco_com_troca === "number"
        ? vehicle.preco_com_troca
        : undefined;
    const showPriceComparison =
      SHOW_CAMPAIGN_STAMP &&
      tradePrice !== undefined &&
      Number.isFinite(tradePrice) &&
      tradePrice > basePrice;

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
  const motor = formatEngineDisplacement(vehicle);
  const potencia = vehicle?.potencia || "";
  const images = vehicleData?.images || [];

  // Formata motor com potência se disponível (ex: "1.0/240hp" ou "1.0")
  const motorFormatado =
    motor && potencia ? `${motor} / ${potencia}hp` : motor || "";

  // PRIORIDADE 1: Usa imagens_site.galeria se disponível, senão filtra AVIF das imagens
  const avifImages = useMemo(() => {
    if (
      vehicle?.imagens_site?.galeria &&
      vehicle.imagens_site.galeria.length > 0
    ) {
      return vehicle.imagens_site.galeria;
    }
    // FALLBACK: Comportamento anterior - filtra apenas imagens AVIF
    return images.filter(
      (img) =>
        img &&
        (img.toLowerCase().endsWith(".avif") ||
          img.toLowerCase().includes(".avif")),
    );
  }, [images, vehicle?.imagens_site?.galeria]);

  // PRIORIDADE 1: Usa imagens_site.capa se disponível
  const mainImage = useMemo(() => {
    if (vehicle?.imagens_site?.capa) {
      return vehicle.imagens_site.capa;
    }

    // FALLBACK: Comportamento anterior
    if (!images.length) return CAR_COVERED_PLACEHOLDER_URL;

    const pngImages = images.filter(
      (img) =>
        img &&
        (img.toLowerCase().endsWith(".png") ||
          img.toLowerCase().includes(".png")),
    );

    const firstPng = pngImages[0];
    const isProblematic = firstPng
      ?.toLowerCase()
      .includes(PROBLEMATIC_IMAGE_PATTERN);

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
    if (imageToUse.includes("/small/")) {
      imageToUse = imageToUse.replace("/small/", "/big/");
    }

    // Função para codificar apenas espaços e caracteres especiais (sem dupla codificação)
    const encodeImagePath = (path: string): string => {
      // Se já contém % (já está codificada), não codifica novamente
      if (path.includes("%")) {
        return path;
      }

      // Se já é URL absoluta, codifica apenas espaços e caracteres especiais
      if (path.startsWith("http://") || path.startsWith("https://")) {
        try {
          const url = new URL(path);
          // Codifica apenas espaços e caracteres especiais no pathname
          url.pathname = url.pathname
            .replace(/ /g, "%20")
            .replace(/\(/g, "%28")
            .replace(/\)/g, "%29");
          return url.toString();
        } catch {
          return path
            .replace(/ /g, "%20")
            .replace(/\(/g, "%28")
            .replace(/\)/g, "%29");
        }
      }

      // Para caminhos relativos, codifica apenas espaços e caracteres especiais
      return path
        .replace(/ /g, "%20")
        .replace(/\(/g, "%28")
        .replace(/\)/g, "%29");
    };

    // Codifica o caminho da imagem (especialmente espaços no nome do arquivo)
    const encodedImage = encodeImagePath(imageToUse);

    // Se já é URL absoluta, retorna como está (já codificada)
    if (
      encodedImage.startsWith("http://") ||
      encodedImage.startsWith("https://")
    ) {
      return encodedImage;
    }

    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://www.netcarmultimarcas.com.br";

    // Se começa com /, adiciona apenas o domínio
    if (encodedImage.startsWith("/")) {
      return `${baseUrl}${encodedImage}`;
    }

    // Se contém ./ no início, remove e adiciona domínio
    const cleanedImage = encodedImage.replace(/^\.\/+/, "");

    // Adiciona domínio e barra inicial
    return `${baseUrl}/${cleanedImage}`;
  }, [vehicle]);

  // URL canônica oficial (sempre slug com placa mascarada)
  const friendlyUrl = useMemo(() => {
    if (!officialSlug) return "";
    return canonicalUrl(`/veiculo/${officialSlug}`);
  }, [officialSlug]);

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
      : `${marca} ${modeloCompleto} ${vehicle.year || ""} por ${priceText}, com ${vehicle.km?.toLocaleString("pt-BR") || 0} km, na Netcar em Esteio/RS. Veja fotos, ficha e opcionais.`.trim();

    const pageTitle = isSold
      ? `${ogTitle} - Vendido | Netcar Esteio/RS`
      : priceText
        ? `${ogTitle} - ${priceText} | Netcar Esteio/RS`
        : `${ogTitle} | Netcar Esteio/RS`;

    return {
      title: pageTitle,
      description,
      image: absoluteImageUrl,
      url:
        friendlyUrl ||
        (typeof window !== "undefined"
          ? `${window.location.origin}${window.location.pathname}`
          : ""),
      type: "article" as const,
      imageWidth: 1200,
      imageHeight: 900,
      productBrand: marca,
      productAvailability: isSold
        ? ("out of stock" as const)
        : ("in stock" as const),
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
      description:
        "Veja fotos, preço e ficha dos seminovos da Netcar em Esteio/RS.",
      image: "",
      url: "",
      robots: !vehicle && (error || !isPending) ? "noindex, follow" : undefined,
    },
  );

  // Com placeholder do estoque, `vehicle` já existe → pula tela intermediária.
  if (!vehicle) {
    if (error || !isPending) {
      return <VehicleUnavailablePage />;
    }
    return <LoadingVehicleDetail slug={slug} />;
  }

  const isSold = !vehicle.price || vehicle.price <= 0;
  const vehicleLabel = [marca, modeloCompleto, vehicle.year]
    .filter(Boolean)
    .join(" ");

  // Badges (só selos de dados reais — sem Retire hoje / Vistoriado genérico)
  const diferenciais = vehicle?.diferenciais ?? [];
  const hasDiferencial = (tag: string) =>
    diferenciais.some((diff) => diff.tag === tag);
  const hasIcheckSeal = Boolean(vehicle?.pdf_url || vehicle?.pdf);
  const isCommercialHighlight =
    Number(vehicle?.km) > 0 &&
    Number(vehicle.km) < LOW_MILEAGE_HIGHLIGHT_THRESHOLD_KM;

  const badges: Badge[] = isSold
    ? []
    : [
        ...(isCommercialHighlight && vehicle.km
          ? [
              {
                text: `APENAS ${vehicle.km.toLocaleString("pt-BR")} KM`,
                variant: "oportunidade" as const,
              },
            ]
          : []),
        ...(hasDiferencial("garantia_fabrica")
          ? [{ text: "Garantia de Fábrica", variant: "garantia" as const }]
          : []),
        ...(hasDiferencial("unico_dono")
          ? [{ text: "Único Dono", variant: "green-dark" as const }]
          : []),
        ...(hasDiferencial("baixa_km") && !isCommercialHighlight
          ? [{ text: "Baixa KM", variant: "baixa-km" as const }]
          : []),
        ...(hasIcheckSeal
          ? [{ text: "i-CHECK DISPONÍVEL", variant: "icheck" as const }]
          : []),
      ];
  return (
    <main className="max-w-full overflow-x-clip pb-40">
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
      <section className="relative w-full max-w-full overflow-hidden py-0 pb-0 pt-0 lg:min-h-[820px] lg:pt-0 xl:min-h-[820px] 2xl:min-h-[830px] 3xl:min-h-[850px] 4xl:min-h-[1200px] 5xl:min-h-[1500px] 6xl:min-h-[1900px]">
        {/* Uma única imagem responsiva: evita baixar uma versão mobile e outra desktop. */}
        <div
          className="w-full mb-6 relative lg:mb-0 lg:absolute lg:pointer-events-none lg:select-none lg:z-[2]
                        lg:w-[70vw] lg:top-[-3rem] lg:right-0
                        xl:top-[-10rem]
                        2xl:top-[-15rem]
                        3xl:top-[-15rem]
                        4xl:w-[58vw] 4xl:top-[-20rem]
                        5xl:top-[-35rem]"
        >
          {mainImage && (
            <div className="w-full h-[300px] sm:h-[400px] lg:h-auto flex items-center lg:items-start justify-center bg-gray-50 lg:bg-transparent relative overflow-visible p-3 sm:p-5 lg:p-0">
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
                src={optimizeStockImage(mainImage, 960)}
                srcSet={stockImageSrcSet(mainImage, [480, 640, 768, 960, 1280])}
                sizes="(max-width: 1023px) 100vw, 70vw"
                alt={`${marca} ${modeloCompleto} ${vehicle.year || ""} - Frente - Netcar Multimarcas`}
                width={1600}
                height={900}
                loading="eager"
                decoding="sync"
                fetchPriority="high"
                className={`w-full h-full lg:h-auto max-w-full object-contain object-center ${isSold ? "grayscale-[0.25]" : ""}`}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
        </div>

        {/* Left Content - 50% com posicionamento absoluto */}
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 relative">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{
              duration: ANIMATION_DURATION.slow,
              ease: ANIMATION_EASING,
            }}
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
                  image={mainImage}
                  priceLabel={price.replace(/<[^>]*>/g, "") || undefined}
                />
                {!isSold && (
                  <div className="mt-4 border-l-2 border-primary pl-3 text-left">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#23747C]">
                      Seleção Netcar
                    </p>
                    <p className="mt-1 text-sm font-black leading-snug text-fg">
                      Este carro atende aos critérios da Netcar.
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Comprado no RS, sem origem de locadora e sem passagem por
                      leilão, sinistro, furto ou roubo. Depois, passa pela
                      preparação da nossa equipe antes de ir para a vitrine.
                    </p>
                    <Link
                      to="/como-selecionamos-nossos-carros"
                      className="mt-1.5 inline-block text-xs font-semibold text-fg underline decoration-border underline-offset-4 transition-colors hover:text-primary"
                    >
                      Veja como escolhemos o estoque
                    </Link>
                  </div>
                )}
                {!isSold && (
                  <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
                    Consulte as condições aprovadas por bancos e financeiras
                    parceiras. Taxa, entrada e prazo dependem da análise.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Gallery Section */}
      {avifImages.length > 0 && (
        <section className="w-full py-8 sm:py-12 lg:py-16">
          <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16"></div>
          {/* Grid Container - Ocupa toda a largura sem padding */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 4xl:grid-cols-7 5xl:grid-cols-8 gap-1 sm:gap-2">
            {avifImages.map((image, index) => (
              <GalleryItem
                key={index}
                image={image}
                index={index}
                alt={`${marca} ${modeloCompleto} ${vehicle.year || ""} - Foto ${index + 1} - Netcar Multimarcas`}
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
      <DeferredRender minHeight={900} rootMargin="700px">
        <DetailsSection
          vehicle={vehicle}
          anuncio={anuncio || null}
          isSold={isSold}
          pageSlug={slug}
        />
      </DeferredRender>

      {/* Fábrica de Valor Section */}
      <section className="w-full pt-4 pb-8 sm:pt-6 sm:pb-12 lg:pt-8 lg:pb-16 bg-surface">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <DeferredRender minHeight={600}>
            <React.Suspense fallback={null}>
              <FabricaDeValor />
            </React.Suspense>
          </DeferredRender>
        </div>
      </section>

      {modelLanding && (
        <section className="pb-10 sm:pb-12">
          <div className="container-main flex flex-wrap items-center gap-3 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
            <span className="text-sm font-semibold text-muted-foreground">
              Continue pesquisando:
            </span>
            <Link
              to="/comprar-{$landingSlug}"
              params={{ landingSlug: modelLanding.slug }}
              className="rounded-full border border-[#00283C]/15 bg-white px-4 py-2 text-sm font-bold text-[#00283C] hover:border-primary hover:text-primary"
            >
              Ver outros {modelLanding.name}
            </Link>
            <Link
              to="/comparar"
              className="rounded-full bg-[#00283C] px-4 py-2 text-sm font-bold text-white hover:bg-[#00435a]"
            >
              Comparar carros lado a lado
            </Link>
          </div>
        </section>
      )}

      {/* Related Vehicles Section */}
      <DeferredRender minHeight={600} rootMargin="500px">
        <RelatedVehiclesSection
          currentVehicleId={String(vehicle.id)}
          currentCategory={vehicle.categoria}
          currentPrice={vehicle.price}
          currentMarca={vehicle.marca}
          currentYear={vehicle.year}
          currentModelo={vehicle.modelo || vehicle.name}
          isSold={isSold}
        />
      </DeferredRender>

      {/* Social Embeds Section (deve ser a última sessão) */}
      <DeferredRender minHeight={800}>
        <React.Suspense fallback={null}>
          <NetcarSocialSection />
        </React.Suspense>
      </DeferredRender>

      <div className="w-full font-sans antialiased text-muted-foreground bg-muted py-12 px-4 md:px-8 space-y-8">
        <LazyLocalizacao />
        <IanBot />
      </div>

      <DetalheFloatingWhatsApp
        price={price}
        modeloCompleto={modeloCompleto}
        vehicleId={vehicle.id}
        isSold={isSold}
        vehicleLabel={vehicleLabel}
        image={mainImage}
      />
    </main>
  );
}

function VehicleDifferentialHighlights({
  modelo,
  presentation,
}: {
  modelo: string;
  presentation: VehicleHighlightsPresentation;
}) {
  const featuredHighlight = presentation.highlights.find(
    (highlight) => highlight.metric,
  );
  const regularHighlights = presentation.highlights.filter(
    (highlight) => !highlight.metric,
  );

  if (presentation.highlights.length === 0) return null;

  return (
    <motion.section
      aria-labelledby="vehicle-differentials-title"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        duration: ANIMATION_DURATION.normal,
        ease: ANIMATION_EASING,
      }}
      className="mt-2"
    >
      <div className="max-w-2xl">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#23747C]">
          Diferenciais do modelo
        </p>
        <h3
          id="vehicle-differentials-title"
          className="mt-1 text-2xl font-black tracking-[-0.025em] text-[#00283C] sm:text-3xl"
        >
          O que vale notar neste {modelo}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
          Os recursos mais relevantes deste carro, explicados pelo benefício.
        </p>
      </div>

      {featuredHighlight?.metric && (
        <article className="mt-6 grid gap-3 rounded-2xl border border-primary/20 bg-primary/[0.05] px-5 py-5 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-6 sm:px-6">
          <div className="text-4xl font-black tracking-[-0.04em] text-[#00283C] sm:text-5xl">
            {featuredHighlight.metric.value}{" "}
            <span className="text-2xl sm:text-3xl">
              {featuredHighlight.metric.unit}
            </span>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#23747C]">
              {featuredHighlight.category}
            </p>
            <h4 className="mt-1 text-lg font-black leading-snug text-[#00283C] sm:text-xl">
              {featuredHighlight.title}
            </h4>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {featuredHighlight.description}
            </p>
          </div>
        </article>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {regularHighlights.map((highlight) => (
          <article
            key={highlight.id}
            className="rounded-2xl border border-[#00283C]/10 bg-white px-5 py-4"
          >
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#23747C]">
              {highlight.category}
            </p>
            <h4 className="mt-1.5 text-base font-black leading-snug text-[#00283C] sm:text-lg">
              {highlight.title}
            </h4>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {highlight.description}
            </p>
          </article>
        ))}
      </div>
    </motion.section>
  );
}

interface DetailsSectionProps {
  vehicle: any;
  anuncio?: string | null;
  isSold?: boolean;
  pageSlug?: string;
}

function DetailsSection({
  vehicle,
  anuncio,
  isSold = false,
  pageSlug,
}: DetailsSectionProps) {
  const [showMoreOptionals, setShowMoreOptionals] = useState(false);

  const modeloCompleto = vehicle.modelo || vehicle.name || "";
  const year = vehicle.year || 0;
  const anoFabricacao = vehicle.anoFabricacao;

  // Parse do conteúdo do anúncio (vem do endpoint separado)
  const gptContent = useMemo(() => parseGptContent(anuncio || null), [anuncio]);
  const highlightPresentation = useMemo(
    () => buildVehicleHighlights(vehicle, anuncio),
    [vehicle, anuncio],
  );

  useEffect(() => {
    setShowMoreOptionals(false);
  }, [vehicle.id]);

  // Formata ano para especificações técnicas
  const anoDisplay =
    anoFabricacao && year
      ? `${anoFabricacao} / ${year}`
      : year
        ? String(year)
        : "";

  const specifications = [
    anoDisplay && { label: "Ano:", value: anoDisplay },
    vehicle.cor && { label: "Cor:", value: vehicle.cor },
    vehicle.portas && { label: "Portas:", value: `${vehicle.portas}` },
    vehicle.placa && { label: "Placa:", value: maskPlate(vehicle.placa) },
    vehicle.motor && {
      label: "Motor:",
      value: formatEngineDisplacement(vehicle),
    },
    vehicle.potencia && { label: "Potência:", value: `${vehicle.potencia} cv` },
    vehicle.combustivel && {
      label: "Combustível:",
      value: vehicle.combustivel,
    },
    vehicle.cambio && { label: "Câmbio:", value: vehicle.cambio },
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  // Mapeamento de tags para pesos (peso menor = maior prioridade)
  const OPTIONAL_PRIORITY_MAP: Record<string, number> = {
    sete_lugares: 1, // 7 Lugares
    teto_panoramico: 2, // Teto Panorâmico
    teto_solar: 3, // Teto Solar (somente se panorâmico não estiver presente)
    multimidia: 4, // Central Multimídia
    bancos_de_couro: 5, // Bancos em Couro
    piloto_adaptativo: 6, // Piloto Automático Adaptativo
    piloto_automatico: 7, // Piloto Automático (somente se adaptativo não estiver presente)
    botao: 8, // Botão de Partida
  };

  // Peso padrão para opcionais não listados
  const DEFAULT_PRIORITY = 999;

  // Função para ordenar opcionais por prioridade usando tags
  const sortOptionals = (
    optionals: Array<{ tag?: string; descricao?: string } | string>,
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
      (opt) => opt.tag === "teto_panoramico",
    );

    // Verifica se existe piloto automático adaptativo na lista
    const hasAdaptiveCruise = normalizedOptionals.some(
      (opt) => opt.tag === "piloto_adaptativo",
    );

    // Função para obter o peso de um opcional usando a tag
    const getPriority = (optional: {
      tag: string;
      descricao: string;
    }): number => {
      const tag = optional.tag.toLowerCase().trim();

      // Verifica se a tag está no mapeamento de prioridades
      if (OPTIONAL_PRIORITY_MAP[tag] !== undefined) {
        // Casos especiais com lógica condicional
        if (tag === "teto_solar") {
          // Teto solar só tem peso 3 se não houver panorâmico
          return hasPanoramicSunroof
            ? DEFAULT_PRIORITY
            : OPTIONAL_PRIORITY_MAP[tag];
        }

        if (tag === "piloto_automatico") {
          // Piloto automático só tem peso 7 se não houver adaptativo
          return hasAdaptiveCruise
            ? DEFAULT_PRIORITY
            : OPTIONAL_PRIORITY_MAP[tag];
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
      typeof op === "string"
        ? op
        : { tag: op.tag || "", descricao: op.descricao || op.nome || "" },
    ) || [];

  // Aplica ordenação por prioridade usando tags
  const sortedOptionals = sortOptionals(rawOptionals);

  // Limpa pequenas inconsistências do XML, remove duplicações e evita repetir
  // na lista os recursos que já foram explicados nos cards de diferenciação.
  const seenOptionals = new Set<string>();
  const displayedOptionals = sortedOptionals
    .map((op) => ({
      tag: normalizeVehicleFeatureTag(
        typeof op === "string" ? "" : op.tag || "",
      ),
      description: cleanOptionalDescription(
        typeof op === "string" ? op : op.descricao || "",
      ),
    }))
    .filter(({ tag, description }) => {
      const key = description
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      if (!description || seenOptionals.has(key)) return false;
      seenOptionals.add(key);
      return !highlightPresentation.explainedTags.has(tag);
    })
    .map(({ description }) => description);

  const SpecIcon = ({ className }: { className?: string }) => (
    <div
      className={
        className ||
        "h-[26px] w-[26px] sm:h-[28px] sm:w-[28px] lg:h-[30px] lg:w-[30px]"
      }
    >
      <img src={icon1} alt="" aria-hidden="true" className="block size-full" />
    </div>
  );

  return (
    <section className="w-full py-8 sm:py-12 lg:py-16">
      <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_410px] lg:gap-10">
          {/* Main Content */}
          <div className="order-1 lg:order-1">
            {/* Especificações */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: ANIMATION_DURATION.normal,
                ease: ANIMATION_EASING,
              }}
              className="mb-10"
            >
              <div className="mb-5 flex items-center gap-3 border-b border-primary/40 pb-4">
                <SpecIcon />
                <div>
                  <h2 className="text-[17px] font-black text-[#00283C] sm:text-[18px] lg:text-[19px]">
                    Resumo técnico
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                    Os dados objetivos deste veículo.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
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

            <VehicleDifferentialHighlights
              modelo={modeloCompleto}
              presentation={highlightPresentation}
            />

            {/* Opcionais secundários */}
            {displayedOptionals.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: ANIMATION_DURATION.normal,
                  ease: ANIMATION_EASING,
                }}
                className="mt-12"
              >
                <div className="mb-5 flex items-center gap-3 border-b border-primary/40 pb-4">
                  <SpecIcon />
                  <div>
                    <h2 className="text-[17px] font-black text-[#00283C] sm:text-[18px] lg:text-[19px]">
                      Outros opcionais
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                      A lista completa informada no cadastro deste carro.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-x-6 rounded-2xl border border-[#00283C]/[0.08] bg-white px-4 py-3 sm:grid-cols-2 sm:px-5 lg:grid-cols-3">
                  {displayedOptionals
                    .slice(0, showMoreOptionals ? displayedOptionals.length : 9)
                    .map((optional: string, index: number) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{
                          duration: 0.3,
                          delay: Math.min(index * 0.05, 0.4),
                        }}
                      >
                        <OptionalItem text={optional} />
                      </motion.div>
                    ))}
                </div>

                {displayedOptionals.length > 9 && (
                  <button
                    type="button"
                    onClick={() => setShowMoreOptionals((current) => !current)}
                    aria-expanded={showMoreOptionals}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#23747C]/25 bg-white px-4 py-2 text-[13px] font-bold text-[#175F67] transition-colors hover:bg-[#23747C]/[0.05] sm:text-[14px]"
                  >
                    {showMoreOptionals
                      ? "Mostrar menos"
                      : `Ver todos os ${displayedOptionals.length} opcionais`}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${showMoreOptionals ? "rotate-180" : ""}`}
                    />
                  </button>
                )}
              </motion.div>
            )}

            {/* O texto que chega da API é preservado, mas fica recolhido para a
                página não repetir de imediato o que os cards já explicam. */}
            {gptContent && (
              <div className="mt-8">
                <AccordionItem title="Ver descrição completa deste veículo">
                  {gptContent.apresentacao && (
                    <p className="section-text mb-6">
                      {gptContent.apresentacao}
                    </p>
                  )}
                  <div className="space-y-6">
                    {gptContent.accordions.map(
                      (accordion: AccordionSection, index: number) => (
                        <div key={`${accordion.title}-${index}`}>
                          <h4 className="mb-2 text-[16px] font-bold text-[#23747C] sm:text-[18px]">
                            {accordion.title}
                          </h4>
                          {typeof accordion.content === "object" &&
                          accordion.content !== null &&
                          "itens" in accordion.content ? (
                            <>
                              {accordion.content.introducao && (
                                <p className="section-text mb-3">
                                  {accordion.content.introducao}
                                </p>
                              )}
                              {accordion.content.itens.length > 0 && (
                                <ul className="ml-5 list-outside list-disc space-y-2 text-[14px] leading-[26px] text-fg sm:text-[15px]">
                                  {accordion.content.itens.map(
                                    (item, itemIndex) => (
                                      <li key={itemIndex} className="pl-2">
                                        {item.label && (
                                          <strong>{item.label}</strong>
                                        )}{" "}
                                        {item.texto}
                                      </li>
                                    ),
                                  )}
                                </ul>
                              )}
                            </>
                          ) : (
                            <p className="section-text">{accordion.content}</p>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                </AccordionItem>
              </div>
            )}
          </div>

          {/* Sticky Sidebar */}
          <div className="order-2 lg:sticky lg:top-24 lg:self-start">
            <CTASidebar
              vehicle={vehicle}
              modeloCompleto={modeloCompleto}
              isSold={isSold}
              pageSlug={pageSlug}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
