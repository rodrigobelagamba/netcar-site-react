import { resolveVehicleColor } from "@/lib/vehicleColor";
import { FactoryWarrantyBadge, FactoryWarrantyNote } from "@/design-system/components/patterns/FactoryWarrantyBadge";
import { useFactoryWarrantyStamps } from "@/lib/useFactoryWarrantyStamps";
import { useVehicleFipeOffer } from "@/lib/useVehicleFipeOffer";
import { VehicleFipeOfferNote } from "@/design-system/components/patterns/VehicleFipeOfferNote";
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
  Gauge,
  Calculator,
  ArrowLeftRight,
  ArrowRight,
  Image as ImageIcon,
  LucideIcon,
  Check,
  Play,
  MapPin,
  Clock,
  PhoneCall,
  ExternalLink,
  ShieldCheck,
  KeyRound,
  Sparkles,
} from "lucide-react";
import React, {
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { useVehicleQuery, isVehicleGone } from "@/catalog/queries/useVehicleQuery";
import { useVehiclesQuery } from "@/catalog/queries/useVehiclesQuery";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import {
  buildWhatsAppUrl,
  siteWhatsAppMessage,
  vehicleWhatsAppMessages,
  withVehicleRef,
  type VehicleWhatsAppRef,
} from "@/lib/whatsappMessages";
import { vehicleWhatsAppRef } from "@/lib/vehicleWhatsAppRef";
import {
  trackCompareInteraction,
  trackVehicleDiscoveryClick,
  trackVehicleVideoClick,
  trackViewItem,
  type WhatsAppClickSource,
} from "@/lib/analytics";
import {
  submitVehicleCallbackLead,
  type CrmLeadPayload,
} from "@/lib/leadCallback";
import icon1 from "@/assets/images/icon-1.svg";
import { ProductList } from "@/design-system/components/patterns/ProductList";
import type { VehicleCardProps } from "@/design-system/components/patterns/VehicleCard";
import { VehicleWhatsAppCard } from "@/design-system/components/patterns/VehicleWhatsAppCard";
import { GoogleRatingBadge } from "@/design-system/components/patterns/social/GoogleRatingBadge";
import { FloatingPortal } from "@/components/FloatingPortal";
import { DeferredRender } from "@/design-system/components/layout/DeferredRender";
import { LazyLocalizacao } from "@/design-system/components/layout/LazyLocalizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";
import { generateVehicleSlug, maskPlate } from "@/lib/slug";
import { formatCatalogMileage, formatPrice } from "@/lib/formatters";
import { useIcheckMetadata } from "@/hooks/useIcheckMetadata";
import { getHistorySummary } from "@/reports/icheck/icheckHistory";
import { ICHECK_SOURCE_LABEL } from "@/reports/icheck/icheckCopy";
import { VEHICLE_EQUIPMENT_NOTICE } from "@/lib/vehicleEquipmentNotice";
import { canonicalUrl } from "@/lib/seo";
import {
  optimizeStockImage,
  stockDetailAvifSrcSet,
  stockGalleryPreviewSource,
  stockImageSrcSet,
} from "@/lib/images";
import { useMetaTags } from "@/hooks/useMetaTags";
import { VehicleSchemaOrg } from "@/components/seo/VehicleSchemaOrg";
import { VehicleUnavailablePage } from "@/components/VehicleUnavailablePage";
import { emptySeminovosSearch } from "@/lib/seminovos-search";
import { buildVehiclePhotoCaptions } from "../lib/vehiclePhotoCaptions";
import { buildVehicleEditorialSummary } from "../lib/vehicleEditorialSummary";
import { buildVehicleHeroGallery, type HeroGallerySlide } from "../lib/vehicleHeroGallery";
import { SHOW_CAMPAIGN_STAMP } from "@/config/features";
import { landingPages, matchesLandingFilters } from "@/data/seo";
import {
  buildVehicleHighlights,
  getVehicleHeroEquipmentLabels,
  normalizeVehicleFeatureTag,
  type VehicleHighlight,
  type VehicleHighlightsPresentation,
} from "@/modules/detalhes/lib/vehicleHighlights";
import {
  getVehicleMerchandising,
  hasVehicleLowAnnualMileage,
  LOW_ANNUAL_MILEAGE_DETAIL_LABEL,
  hasVehicleIcheck,
} from "@/lib/vehicleMerchandising";
import { VehicleVideoLink } from "../components/VehicleVideoLink";
import { CustomerDeliveriesCallout } from "../components/CustomerDeliveriesCallout";
import { selectVehicleInstagramVideo } from "../lib/vehicleInstagramVideos";
import { useVehicleVideosQuery } from "../queries/useVehicleVideosQuery";
import { vehicleVideosForDisplay } from "../lib/vehicleVideosResponse";
import { BlackFridayVehicleOffer, BlackFridayVehicleRibbon } from "@/features/black-friday/CampaignSurfaces";
import { useBlackFridayCampaign } from "@/features/black-friday/CampaignProvider";
import "@/features/black-friday/vehicle-photo-theme.css";

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
const HIDDEN_RESPONSIVE_IMAGE =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

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
type BadgeVariant =
  | "oportunidade"
  | "icheck"
  | "garantia"
  | "baixa-km"
  | "capacidade"
  | "green-dark";

interface Badge {
  text: string;
  variant: BadgeVariant;
  onClick?: () => void;
  title?: string;
}

/** Estilo refinado para selos do Hero (família visual única, sem disputar com preço/CTA). */
const BADGE_CLASSES: Record<BadgeVariant, string> = {
  oportunidade:
    "border-[#D99B26]/30 bg-[#FEF7E6] text-[#7A4D00]",
  icheck:
    "border-[#087A37]/30 bg-[#EAF7F0] text-[#065E2B] hover:bg-[#DCF1E5]",
  garantia:
    "border-[#23747C]/25 bg-[#EAF5F6] text-[#0F5257]",
  "baixa-km":
    "border-[#23747C]/25 bg-[#EAF5F6] text-[#0F5257]",
  capacidade:
    "border-[#23747C]/25 bg-[#EAF5F6] text-[#0F5257]",
  "green-dark":
    "border-[#00283C]/12 bg-[#00283C]/[0.06] text-[#00283C]",
};

function Badge({ text, variant, onClick, title }: Badge) {
  const baseClass =
    "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-bold uppercase tracking-[0.04em] leading-none transition-colors";
  const variantClass = BADGE_CLASSES[variant];

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        className={`${baseClass} ${variantClass} cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087A37]`}
      >
        {variant === "icheck" && (
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#087A37]" aria-hidden="true" />
        )}
        <span className="whitespace-nowrap">{text}</span>
        <ExternalLink className="h-3 w-3 shrink-0 opacity-75" aria-hidden="true" />
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        duration: ANIMATION_DURATION.normal,
        ease: ANIMATION_EASING,
      }}
      className={`${baseClass} ${variantClass}`}
    >
      {variant === "icheck" && (
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#087A37]" aria-hidden="true" />
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
  vehiclePrice?: number;
  isSold?: boolean;
  vehicleLabel?: string;
  waRef?: VehicleWhatsAppRef;
  onIntentContextChange?: (context: {
    summary: string;
    whatsappUrl?: string;
  }) => void;
}

type HeroConversionTab = "financiar" | "troca" | "visita";
type VisitOption = "hoje" | "amanha" | "sabado" | "video";

function formatShortBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function buildDownPaymentPresets(price?: number): Array<{ value: number; label: string }> {
  if (!price || !Number.isFinite(price) || price <= 0) {
    return [
      { value: 0, label: "Sem entrada" },
      { value: 15000, label: "R$ 15 mil" },
      { value: 25000, label: "R$ 25 mil" },
      { value: 40000, label: "R$ 40 mil" },
    ];
  }
  const roundTo5k = (amount: number) => Math.max(5000, Math.round(amount / 5000) * 5000);
  const rawValues = [0, roundTo5k(price * 0.2), roundTo5k(price * 0.3), roundTo5k(price * 0.45)];
  const unique = Array.from(new Set(rawValues)).filter((v) => v === 0 || v < price * 0.85);
  return unique.map((value) => ({
    value,
    label: value === 0 ? "Sem entrada" : `R$ ${Math.round(value / 1000)} mil`,
  }));
}

function formatBrazilPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

interface QuickCallbackFormProps {
  inputId: string;
  vehicleId?: string | number;
  vehicleName: string;
  intentSummary?: string;
  contextLabel?: string;
  fallbackWhatsAppUrl?: string;
  compact?: boolean;
}

function QuickCallbackForm({
  inputId,
  vehicleId,
  vehicleName,
  intentSummary,
  contextLabel,
  fallbackWhatsAppUrl,
  compact = false,
}: QuickCallbackFormProps) {
  const [phone, setPhone] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    sent: boolean;
    duplicate?: boolean;
    dryRun?: boolean;
    payload?: CrmLeadPayload;
  } | null>(null);
  const [showDryPayload, setShowDryPayload] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Informe seu WhatsApp com DDD.");
      return;
    }

    setError("");
    setSubmitting(true);
    const response = await submitVehicleCallbackLead({
      phone,
      vehicleId,
      vehicleName,
      intentSummary: intentSummary || contextLabel,
      website: honeypot,
    });
    setSubmitting(false);

    if (!response.ok) {
      setError(
        response.error ||
          "Não foi possível confirmar agora. Chame direto no WhatsApp.",
      );
      return;
    }

    setResult({
      sent: true,
      duplicate: response.duplicate,
      dryRun: response.dryRun,
      payload: response.payload,
    });
  };

  if (result?.sent) {
    return (
      <div className="relative rounded-xl bg-[#EAF7F0] px-3 py-2 text-left">
        <p className="text-[11px] font-bold text-[#075E54]">
          {result.duplicate
            ? `Pedido já registrado: ${phone}`
            : `Recebemos seu número: ${phone}`}
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-[#365565]">
          {result.duplicate
            ? "Um consultor da Netcar já recebeu seu contato para este carro."
            : `Nossa equipe chama no WhatsApp em ~1 min${contextLabel ? ` (${contextLabel})` : ""}.`}
        </p>
        {result.dryRun && (
          <div className="mt-1.5 border-t border-[#087A37]/15 pt-1.5">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.04em] text-[#075E54]">
                Dry-run local · fila CRM intacta
              </span>
              {result.payload && (
                <button
                  type="button"
                  onClick={() => setShowDryPayload((prev) => !prev)}
                  className="text-[10px] font-bold text-[#00283C] underline underline-offset-2"
                >
                  {showDryPayload ? "Ocultar payload" : "Ver payload crmleads"}
                </button>
              )}
            </div>
            {showDryPayload && result.payload && (
              <pre className="mt-1.5 max-h-52 overflow-auto rounded-lg border border-white/15 bg-[#00283C] p-2.5 text-[10px] leading-relaxed text-[#D8F3E5] shadow-xl lg:absolute lg:bottom-full lg:right-0 lg:z-40 lg:mb-2 lg:mt-0 lg:w-[420px]">
                {JSON.stringify(result.payload, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-1">
      <input
        type="text"
        name="website"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />
      <label
        htmlFor={inputId}
        className="flex items-center gap-1 text-[11px] font-semibold text-[#526974]"
      >
        <PhoneCall className="h-3 w-3 shrink-0 text-[#23747C]" aria-hidden="true" />
        Sem WhatsApp aberto? A Netcar te chama:
      </label>
      <div className="flex gap-1.5">
        <input
          id={inputId}
          type="tel"
          inputMode="tel"
          value={phone}
          disabled={submitting}
          onChange={(e) => {
            setPhone(formatBrazilPhoneInput(e.target.value));
            if (error) setError("");
          }}
          placeholder="(51) 99999-9999"
          className={`${compact ? "h-8" : "h-9"} min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-3 text-xs text-[#00283C] placeholder:text-slate-400 focus:border-[#00283C] focus:outline-none disabled:opacity-60`}
        />
        <button
          type="submit"
          disabled={submitting}
          className={`${compact ? "h-8 px-3.5" : "h-9 px-4"} shrink-0 rounded-full bg-[#00283C] text-xs font-bold text-white transition-colors hover:bg-[#003E5C] disabled:opacity-60`}
        >
          {submitting ? "Enviando..." : "Me chamar"}
        </button>
      </div>
      {error && (
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-red-600">{error}</p>
          {fallbackWhatsAppUrl && (
            <a
              href={fallbackWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-wa-source="hero_callback_fallback"
              data-wa-intent="callback_fallback"
              data-wa-vehicle-id={vehicleId}
              data-wa-vehicle-name={vehicleName}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#087A37] underline underline-offset-2"
            >
              <MessageCircleMore className="h-3 w-3 shrink-0" aria-hidden="true" />
              Chamar direto no WhatsApp
            </a>
          )}
        </div>
      )}
    </form>
  );
}

function ContactButton({
  modeloCompleto,
  vehicleId,
  vehiclePrice,
  isSold = false,
  vehicleLabel,
  waRef,
  onIntentContextChange,
}: ContactButtonProps) {
  const { data: whatsapp } = useWhatsAppQuery();
  const { active: isBlackFriday } = useBlackFridayCampaign();
  const label = vehicleLabel || modeloCompleto || "veículo";
  const presets = useMemo(() => buildDownPaymentPresets(vehiclePrice), [vehiclePrice]);

  const [activeTab, setActiveTab] = useState<HeroConversionTab>("financiar");
  const [downPayment, setDownPayment] = useState<number>(() => presets[1]?.value ?? 0);
  const [months, setMonths] = useState<number>(48);
  const [tradeModel, setTradeModel] = useState("");
  const [tradeYear, setTradeYear] = useState("");
  const [tradeKm, setTradeKm] = useState("");
  const [visitOption, setVisitOption] = useState<VisitOption>("hoje");

  useEffect(() => {
    setDownPayment(presets[1]?.value ?? 0);
  }, [vehicleId, presets]);

  const activeMessage = (() => {
    if (activeTab === "financiar") {
      const entradaText =
        downPayment > 0
          ? `entrada de ${formatShortBRL(downPayment)}`
          : "sem entrada";
      const bfPrefix = isBlackFriday
        ? `quero consultar o valor real da parcela nos bancos parceiros para o ${label} nas condições Black Friday, com ${entradaText} em ${months}x.`
        : `quero consultar o valor real da parcela nos bancos parceiros para o ${label}, com ${entradaText} em ${months}x.`;
      return withVehicleRef(siteWhatsAppMessage(bfPrefix), waRef);
    }

    if (activeTab === "troca") {
      const parts = [
        tradeModel.trim(),
        tradeYear.trim(),
        tradeKm.trim() ? `${tradeKm.trim()} km` : "",
      ].filter(Boolean);
      const body = parts.length
        ? `quero avaliar meu ${parts.join(", ")} na troca pelo ${label}.`
        : `quero avaliar meu carro usado na troca pelo ${label}.`;
      return withVehicleRef(siteWhatsAppMessage(body), waRef);
    }

    if (visitOption === "video") {
      return withVehicleRef(
        siteWhatsAppMessage(`quero receber um vídeo atual do showroom do ${label}.`),
        waRef,
      );
    }

    const dayLabel =
      visitOption === "hoje"
        ? "hoje"
        : visitOption === "amanha"
          ? "amanhã"
          : "no sábado";
    return withVehicleRef(
      siteWhatsAppMessage(
        `quero agendar uma visita em Esteio/RS ${dayLabel} para ver o ${label}.`,
      ),
      waRef,
    );
  })();

  const href = whatsapp?.numero
    ? buildWhatsAppUrl(whatsapp.numero, activeMessage)
    : undefined;

  const callbackContext =
    activeTab === "financiar"
      ? `Financiar · ${downPayment > 0 ? `Entrada ${formatShortBRL(downPayment)}` : "Sem entrada"} em ${months}x`
      : activeTab === "troca"
        ? `Troca · ${[tradeModel.trim(), tradeYear.trim(), tradeKm.trim() ? `${tradeKm.trim()} km` : ""].filter(Boolean).join(" ") || "usado na troca"}`
        : visitOption === "video"
          ? "Pedido de vídeo do showroom"
          : `Visita · ${visitOption === "hoje" ? "Hoje" : visitOption === "amanha" ? "Amanhã" : "Sábado"}`;

  useEffect(() => {
    if (isSold) return;
    onIntentContextChange?.({ summary: callbackContext, whatsappUrl: href });
  }, [isSold, callbackContext, href, onIntentContextChange]);

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

  const activeIntent =
    activeTab === "financiar"
      ? "simulate_finance"
      : activeTab === "troca"
        ? "trade_in"
        : visitOption === "video"
          ? "request_photos"
          : "schedule_visit";

  const ctaLabel =
    activeTab === "financiar"
      ? isBlackFriday
        ? "Simular parcela Black Friday no WhatsApp"
        : "Consultar parcela nos bancos no WhatsApp"
      : activeTab === "troca"
        ? "Avaliar meu usado no WhatsApp"
        : visitOption === "video"
          ? "Pedir vídeo do showroom no WhatsApp"
          : "Confirmar visita no WhatsApp";

  return (
    <div className="mt-2 flex w-full flex-col gap-2">
      {/* Seletor leve de intenção — integrado ao Hero, sem caixona pesada */}
      <div
        role="tablist"
        aria-label="Como prefere falar sobre este carro"
        className="grid grid-cols-3 gap-1 rounded-full border border-slate-200/90 bg-white/90 p-1"
      >
        {(
          [
            { id: "financiar", label: "Financiar", icon: Calculator },
            { id: "troca", label: "Na troca", icon: ArrowLeftRight },
            { id: "visita", label: "Visita", icon: CalendarDays },
          ] as const
        ).map(({ id, label: tabLabel, icon: Icon }) => {
          const isSelected = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setActiveTab(id)}
              className={`flex min-h-8 items-center justify-center gap-1 rounded-full px-1.5 py-1 text-[11px] font-bold leading-tight whitespace-nowrap transition-colors ${
                isSelected
                  ? "bg-[#00283C] text-white"
                  : "text-[#365565] hover:bg-slate-100 hover:text-[#00283C]"
              }`}
            >
              <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>{tabLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Opções compactas por intenção — sem inventar parcela */}
      <div className="space-y-2">
        {activeTab === "financiar" && (
          <div className="space-y-2">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#526974]">
                Entrada desejada
              </p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                {presets.map((preset) => {
                  const active = downPayment === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setDownPayment(preset.value)}
                      className={`rounded-full border px-2 py-1 text-[11px] font-bold whitespace-nowrap transition-colors ${
                        active
                          ? "border-[#087A37] bg-[#EAF7F0] text-[#075E54]"
                          : "border-slate-200 bg-white/90 text-[#365565] hover:border-[#23747C]/50"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="mr-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#526974]">
                  Prazo:
                </span>
                {[36, 48, 60].map((term) => {
                  const active = months === term;
                  return (
                    <button
                      key={term}
                      type="button"
                      onClick={() => setMonths(term)}
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold transition-colors ${
                        active
                          ? "border-[#087A37] bg-[#EAF7F0] text-[#075E54]"
                          : "border-slate-200 bg-white/90 text-[#365565] hover:border-[#23747C]/50"
                      }`}
                    >
                      {term}x
                    </button>
                  );
                })}
              </div>
              <span className="text-[10px] font-medium text-[#526974]">
                {isBlackFriday
                  ? "Entrada até 10x s/ juros no cartão"
                  : "Entrada em até 21x no cartão"}
              </span>
            </div>

            <p className="text-[11px] leading-snug text-[#526974]">
              Consultamos a parcela real nos bancos parceiros conforme seu perfil. Sujeito à análise de crédito.
            </p>
          </div>
        )}

        {activeTab === "troca" && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-[#075E54]">
              Avaliação na hora · Aceita financiado · Troco na troca
            </p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[1.4fr_0.7fr_0.9fr]">
              <input
                type="text"
                value={tradeModel}
                onChange={(e) => setTradeModel(e.target.value)}
                placeholder="Seu carro (ex: Onix)"
                aria-label="Modelo do seu carro para troca"
                className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-[#00283C] placeholder:text-slate-400 focus:border-[#087A37] focus:outline-none"
              />
              <input
                type="text"
                inputMode="numeric"
                value={tradeYear}
                onChange={(e) => setTradeYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="Ano"
                aria-label="Ano do seu carro para troca"
                className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-[#00283C] placeholder:text-slate-400 focus:border-[#087A37] focus:outline-none"
              />
              <input
                type="text"
                inputMode="numeric"
                value={tradeKm}
                onChange={(e) => setTradeKm(e.target.value)}
                placeholder="KM"
                aria-label="Quilometragem do seu carro para troca"
                className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-[#00283C] placeholder:text-slate-400 focus:border-[#087A37] focus:outline-none"
              />
            </div>
          </div>
        )}

        {activeTab === "visita" && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: "hoje", label: "Ver hoje" },
                  { id: "amanha", label: "Ver amanhã" },
                  { id: "sabado", label: "Ver no sábado" },
                  { id: "video", label: "Pedir vídeo do showroom" },
                ] as const
              ).map((option) => {
                const active = visitOption === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setVisitOption(option.id)}
                    className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${
                      active
                        ? "border-[#087A37] bg-[#EAF7F0] text-[#075E54]"
                        : "border-slate-200 bg-white/90 text-[#365565] hover:border-[#23747C]/50"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="flex items-center gap-1.5 text-[11px] text-[#526974]">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#23747C]" aria-hidden="true" />
              Av. Pres. Vargas 740 e 1106 · Esteio/RS
            </p>
          </div>
        )}

        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            data-wa-source="hero"
            data-wa-intent={activeIntent}
            data-wa-vehicle-id={vehicleId}
            data-wa-vehicle-name={modeloCompleto}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#087A37] px-4 py-2.5 text-center text-sm font-bold leading-snug text-white transition-colors hover:bg-green-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087A37] sm:min-h-12"
          >
            <MessageCircleMore className="h-4 w-4 shrink-0" aria-hidden="true" />
            {ctaLabel}
          </a>
        )}
      </div>

      {/* Captura anti-abandono no mobile/tablet (no desktop fica abaixo do carro para equilibrar o Hero) */}
      <div className="border-t border-slate-200/80 pt-2 lg:hidden">
        <QuickCallbackForm
          inputId={`wa-callback-mobile-${vehicleId ?? "carro"}`}
          vehicleId={vehicleId}
          vehicleName={label}
          intentSummary={callbackContext}
          contextLabel={callbackContext}
          fallbackWhatsAppUrl={href}
        />
      </div>

      {vehicleId != null && (
        <div className="flex w-full items-center justify-center">
          <Link
            to="/comparar"
            search={{ veiculo: String(vehicleId) }}
            onClick={() =>
              trackCompareInteraction({
                action: "from_vehicle",
                vehicleIds: [vehicleId],
                vehicleNames: [label],
              })
            }
            className="inline-flex min-h-8 items-center justify-center gap-1.5 text-xs font-bold text-[#00283C] underline underline-offset-4 transition-colors hover:text-[#5CD29D]"
          >
            Comparar com outros carros
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}

interface DetalheFloatingWhatsAppProps {
  price: string;
  modeloCompleto: string;
  vehicleId?: string | number;
  isSold?: boolean;
  vehicleLabel?: string;
  image?: string;
  visible?: boolean;
  waRef?: VehicleWhatsAppRef;
}

/** Sticky flutuante com carro identificado — substitui bolinha iAN no detalhe. */
function DetalheFloatingWhatsApp({
  price,
  modeloCompleto,
  vehicleId,
  isSold = false,
  vehicleLabel,
  image,
  visible = false,
  waRef,
}: DetalheFloatingWhatsAppProps) {
  const { data: whatsapp } = useWhatsAppQuery();
  const { active: isBlackFriday } = useBlackFridayCampaign();
  const label = vehicleLabel || modeloCompleto || "veículo";
  const messages = vehicleWhatsAppMessages(label, modeloCompleto, waRef);
  const ready = Boolean(whatsapp?.numero);
  const priceLabel = price.replace(/<[^>]*>/g, "");

  if (isSold) {
    return (
      <FloatingPortal>
        <div
          className={`pointer-events-none fixed inset-x-0 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[60] justify-center px-3 md:bottom-3 ${visible ? "flex" : "hidden"}`}
        >
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

  const inquiryMessage = isBlackFriday
    ? withVehicleRef(
        siteWhatsAppMessage(`quero conhecer as condições da Black Friday para o ${label}.`),
        waRef,
      )
    : messages.info;
  const href = buildWhatsAppUrl(whatsapp!.numero, inquiryMessage);
  const tradeHref = buildWhatsAppUrl(whatsapp!.numero, messages.trade);
  const cardImage = image || "/images/semcapa.webp";

  return (
    <FloatingPortal>
      <div
        className={`pointer-events-none fixed inset-x-0 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-[60] justify-center px-2 md:bottom-3 md:px-3 ${visible ? "flex" : "hidden"}`}
      >
        <div className="pointer-events-auto w-full max-w-sm md:max-w-[44rem]">
          <VehicleWhatsAppCard
            vehicle={{
              id: String(vehicleId),
              label,
              priceLabel,
              image: cardImage,
            }}
            href={href}
            source="detalhe_sticky"
            tradeHref={tradeHref}
            tradeSource="detalhe_sticky_trade"
            eyebrow="Este carro"
            ctaLabel={isBlackFriday ? "Condições Black Friday" : undefined}
            tradeCtaLabel="Avaliar troca"
            compact
          />
        </div>
      </div>
    </FloatingPortal>
  );
}

interface SpecBadgeProps {
  label: string;
  value: string;
  index?: number;
  highlighted?: boolean;
}

function SpecBadge({ label, value, index = 0, highlighted = false }: SpecBadgeProps) {
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
      className={`flex min-h-[72px] min-w-0 flex-col items-start justify-center rounded-xl border px-4 py-3 shadow-[0_4px_16px_rgba(0,40,60,0.035)] ${highlighted ? "border-[#23747C]/25 bg-[#e5f3ec]" : "border-[#00283C]/[0.08] bg-white"}`}
    >
      <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-[#23747C]">
        {highlighted && <Gauge className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
        {label.replace(/:$/, "")}
      </span>
      <span className={`mt-1 font-black leading-tight ${highlighted ? "text-[18px] text-[#075E54] sm:text-[20px]" : "text-[15px] text-[#00283C] sm:text-[16px]"}`}>
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
  const { data: icheck } = useIcheckMetadata(vehicle);
  const protocol = icheck?.protocol;
  const summary = getHistorySummary(protocol?.history);
  const protocoloConsulta = protocol?.consultaId || protocol?.protocoloConsulta;

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
  const vehicleMessages = vehicleWhatsAppMessages(
    vehicleLabel,
    modeloCompleto,
    vehicle ? vehicleWhatsAppRef(vehicle) : undefined,
  );
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
      label: "Consultar financiamento",
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

  const hasPDF = vehicle ? hasVehicleIcheck(vehicle) : false;
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
                ? `Ver certificado da consulta DEKRA / CheckAuto, ConsultaID ${protocoloConsulta}`
                : "Ver certificado da consulta DEKRA / CheckAuto em nova aba"
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
                  {ICHECK_SOURCE_LABEL}
                </span>
                <span
                  className={`mt-1 flex items-center gap-1.5 text-[18px] font-black ${summary.approved ? "text-[#087A37]" : "text-[#00283C]"}`}
                >
                  {summary.approved ? (
                    <Check className="h-5 w-5 shrink-0" aria-hidden="true" />
                  ) : null}
                  {summary.approved
                    ? "I-CHECK APROVADO"
                    : protocol
                      ? summary.title
                      : "Consultar histórico"}
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                  Ver certificado e resultados da consulta
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
                Escolha o assunto para falar no WhatsApp.
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
  captions: string[];
  currentIndex: number;
  onClose: () => void;
  vehicleName: string;
}

function Lightbox({
  images,
  captions,
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
        className="fixed inset-0 z-[70] bg-black flex items-center justify-center"
        onClick={onClose}
      >
        {/* Close Button */}
        <button
          type="button"
          aria-label="Fechar galeria"
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
            alt={`${vehicleName} - ${captions[index] || `Foto ${index + 1}`} - Netcar Multimarcas`}
            className="w-full h-full max-w-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </motion.div>

        {index > 0 && captions[index] && (
          <p className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 mx-auto w-fit max-w-[calc(100%-1.5rem)] rounded-md bg-black/65 px-2.5 py-1 text-center text-xs leading-tight text-white sm:bottom-4">
            {captions[index]}
          </p>
        )}

        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Foto anterior"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition-colors p-2 sm:p-3 bg-black/50 rounded-full z-10"
            >
              <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
            </button>
            <button
              type="button"
              aria-label="Próxima foto"
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
  caption: string;
  rounded?: boolean;
}

function GalleryItem({ image, index, onClick, alt, caption, rounded = true }: GalleryItemProps) {
  const previewSource = stockGalleryPreviewSource(image);

  return (
    <figure className={`relative min-w-0 ${rounded ? "overflow-hidden rounded-2xl" : ""}`}>
      <motion.button
        type="button"
        aria-label={`Ampliar foto ${index + 1}`}
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{
          duration: 0.7,
          delay: index * 0.04,
          ease: [0.25, 0.1, 0.25, 1],
        }}
        className={`relative block w-full overflow-hidden cursor-pointer bg-gray-200 group aspect-[1920/1441] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#008B95] ${rounded ? "rounded-2xl" : ""}`}
        onClick={onClick}
      >
        <div className="relative w-full h-full">
          <picture>
            <source
              type="image/avif"
              srcSet={stockDetailAvifSrcSet(previewSource, [320, 480, 640, 768, 960])}
              sizes="(max-width: 1023px) 50vw, (max-width: 1279px) 33vw, (max-width: 1535px) 25vw, (max-width: 1919px) 20vw, (max-width: 2559px) 17vw, (max-width: 3839px) 14vw, 13vw"
            />
            <img
              src={optimizeStockImage(previewSource, 640)}
              srcSet={stockImageSrcSet(previewSource, [320, 480, 640, 768, 960])}
              sizes="(max-width: 1023px) 50vw, (max-width: 1279px) 33vw, (max-width: 1535px) 25vw, (max-width: 1919px) 20vw, (max-width: 2559px) 17vw, (max-width: 3839px) 14vw, 13vw"
              alt={alt}
              width={1920}
              height={1441}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-contain lg:object-cover transition-transform duration-500 ease-out lg:group-hover:scale-105"
              onError={(event) => {
                const target = event.currentTarget;
                if (target.dataset.originalFallback === "true") {
                  target.style.display = "none";
                  return;
                }
                target.dataset.originalFallback = "true";
                target.closest("picture")?.querySelectorAll("source").forEach((source) => source.removeAttribute("srcset"));
                target.removeAttribute("srcset");
                target.src = image;
              }}
            />
          </picture>
          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500 ease-out" />
        </div>
      </motion.button>
      {index > 0 && caption && (
        <figcaption className="pointer-events-none absolute bottom-1.5 left-2 right-2 mx-auto w-fit max-w-[calc(100%-1rem)] rounded bg-black/60 px-2 py-1 text-center text-[11px] leading-tight text-white">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

/**
 * Mobile: deslize na abertura ou veja a galeria em duas colunas abaixo do resumo.
 */
function MobileGalleryCarousel({
  slides,
  altBase,
  onOpen,
  isSold = false,
  campaignActive = false,
}: {
  slides: HeroGallerySlide[];
  altBase: string;
  onOpen: (index: number) => void;
  isSold?: boolean;
  campaignActive?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const firstImage = slides[0]?.image;

  useEffect(() => {
    setCurrent(0);
    if (trackRef.current) trackRef.current.scrollLeft = 0;
  }, [firstImage, slides.length]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const slide = track.firstElementChild as HTMLElement | null;
        const step = slide?.offsetWidth || track.clientWidth;
        if (!step) return;
        const next = Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / step)));
        setCurrent(next);
      });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      track.removeEventListener("scroll", onScroll);
    };
  }, [slides.length]);

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label={`Fotos do ${altBase}`}
      >
        {slides.map((slide, index) => {
          const image = slide.image;
          const previewSource = slide.isCover ? image : stockGalleryPreviewSource(image);
          return (
            <figure key={index} className="relative w-full shrink-0 snap-start overflow-hidden">
              <button
                type="button"
                onClick={() => onOpen(index)}
                aria-label={`Abrir foto ${index + 1} de ${slides.length}`}
                data-black-friday-photo={campaignActive && !isSold && slide.isCover || undefined}
                className={`relative block aspect-[1920/1441] max-h-[55svh] w-full overflow-hidden ${slide.isCover ? "bg-gray-50" : "bg-gray-200"}`}
              >
                {campaignActive && !isSold && slide.isCover && (
                  <img className="bf-photo-arc" src="/images/campaigns/black-friday-2026/ribbon-black.png" width={1080} height={406} alt="" aria-hidden="true" />
                )}
                {isSold && (
                  <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                    <span className="-rotate-[18deg] rounded-2xl border-[7px] border-[#E10600]/70 bg-white/40 px-8 py-3 text-5xl font-black uppercase tracking-[0.1em] text-[#E10600]/80 shadow-[0_10px_32px_rgba(0,0,0,0.14)] sm:rounded-[1.25rem] sm:border-[8px] sm:px-10 sm:py-4 sm:text-6xl">
                      Vendido
                    </span>
                  </span>
                )}
                <picture className="contents">
                  {slide.isCover && <source media="(min-width: 1024px)" srcSet={HIDDEN_RESPONSIVE_IMAGE} />}
                  <source
                    type="image/avif"
                    srcSet={stockDetailAvifSrcSet(previewSource, [480, 640, 960])}
                    sizes="100vw"
                  />
                  <img
                    src={optimizeStockImage(previewSource, 640)}
                    srcSet={stockImageSrcSet(previewSource, [480, 640, 960])}
                    sizes="100vw"
                    alt={`${altBase} - ${slide.caption || `Foto ${index + 1}`} - Netcar Multimarcas`}
                    width={1920}
                    height={1441}
                    loading={slide.isCover ? "eager" : "lazy"}
                    decoding={slide.isCover ? "sync" : "async"}
                    fetchPriority={slide.isCover ? "high" : undefined}
                    className={`absolute inset-0 h-full w-full object-contain object-center ${isSold ? "grayscale-[0.25]" : ""}`}
                    onError={(event) => {
                      const target = event.currentTarget;
                      if (target.dataset.originalFallback === "true") {
                        target.style.display = "none";
                        return;
                      }
                      target.dataset.originalFallback = "true";
                      target.closest("picture")?.querySelectorAll("source").forEach((source) => source.removeAttribute("srcset"));
                      target.removeAttribute("srcset");
                      target.src = image;
                    }}
                  />
                </picture>
              </button>
              {index > 0 && slide.caption && (
                <figcaption className="pointer-events-none absolute bottom-1.5 left-3 right-3 mx-auto w-fit max-w-[calc(100%-1.5rem)] rounded bg-black/60 px-2 py-1 text-center text-[11px] leading-tight text-white">
                  {slide.caption}
                </figcaption>
              )}
            </figure>
          );
        })}
      </div>
      <p
        className="pointer-events-none absolute left-4 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white"
        aria-live="polite"
      >
        {current + 1}/{slides.length}
      </p>
      <div className="flex h-6 items-center px-4 pr-24 text-[11px] text-slate-500 sm:px-6 sm:pr-32">
        {slides.length > 1 && (
          <p className="flex items-center gap-1.5">
            <ArrowLeftRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            Deslize as fotos
          </p>
        )}
      </div>
    </div>
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
      warrantyVehicle: vehicle,
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
      combustivel: vehicle.combustivel,
      cambio: vehicle.cambio,
      potencia: vehicle.potencia,
      pdf: vehicle.pdf,
      pdf_url: vehicle.pdf_url,
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
      <div className="container-main w-full px-4 sm:px-6 lg:px-8">
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

        {/* Sem WhatsApp aqui: eram 3 botões × 4 cards (12 dos 28 links WA da
            ficha). Quem quer outro carro abre a ficha dele e fala de lá. */}
        <ProductList vehicles={relatedVehicleCards} fitRow />
      </div>
    </section>
  );
}

function formatHeroSpecValue(raw?: string): string {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  const map: Record<string, string> = {
    AUTOMATICO: "Automático",
    AUTOMÁTICO: "Automático",
    MANUAL: "Manual",
    AUTOMATIZADO: "Automatizado",
    CVT: "CVT",
    FLEX: "Flex",
    GASOLINA: "Gasolina",
    DIESEL: "Diesel",
    ETANOL: "Etanol",
    HIBRIDO: "Híbrido",
    HÍBRIDO: "Híbrido",
    ELETRICO: "Elétrico",
    ELÉTRICO: "Elétrico",
  };
  const upper = value.toUpperCase();
  if (map[upper]) return map[upper];
  return value.replace(/\bTURBO\b/g, "Turbo");
}

function VehiclePrice({
  price,
  previousPrice,
  showComparison = false,
}: {
  price: string;
  previousPrice?: string;
  showComparison?: boolean;
}) {
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
          <p className="text-sm font-semibold leading-none text-[#526974] whitespace-nowrap">
            De:{" "}
            <span
              className="line-through"
              dangerouslySetInnerHTML={{ __html: previousPrice }}
            />
          </p>
          <p
            className="text-[32px] font-extrabold leading-none tracking-[-0.03em] tabular-nums whitespace-nowrap text-[#00283C] sm:text-[36px]"
            dangerouslySetInnerHTML={{ __html: price }}
          />
        </div>
      ) : (
        <p
          className="text-[32px] font-extrabold leading-none tracking-[-0.03em] tabular-nums whitespace-nowrap text-[#00283C] sm:text-[36px]"
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
    <main className="max-w-full min-w-0 overflow-x-clip pt-16 md:pt-0" aria-busy="true">
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
  const { active: isBlackFriday } = useBlackFridayCampaign();
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
  const { warrantyStamp, tractionBatteryStamp, powertrainStamp } =
    useFactoryWarrantyStamps(isPlaceholderData || isVehicleGone(error) ? undefined : vehicle);
  const fipeOffer = useVehicleFipeOffer(isPlaceholderData || isVehicleGone(error) ? undefined : vehicle);
  const { data: icheck } = useIcheckMetadata(
    isPlaceholderData ? undefined : vehicle,
  );
  const vehicleVideosQuery = useVehicleVideosQuery(
    Boolean(vehicle && vehicle.price > 0),
  );

  const vehicleDiscoveryLandings = useMemo(() => {
    if (!vehicle) return [];

    const matching = landingPages.filter(
      (landing) =>
        landing.indexable &&
        landing.count > 1 &&
        matchesLandingFilters(vehicle, landing.filters),
    );

    const firstOfType = (type: (typeof landingPages)[number]["type"]) =>
      matching.find((landing) => landing.type === type);

    const priceLanding = matching
      .filter((landing) => landing.type === "faixa")
      .sort((left, right) => {
        const leftMin = left.filters.precoMin ?? 0;
        const leftMax = left.filters.precoMax ?? Number.POSITIVE_INFINITY;
        const rightMin = right.filters.precoMin ?? 0;
        const rightMax = right.filters.precoMax ?? Number.POSITIVE_INFINITY;
        return leftMax - leftMin - (rightMax - rightMin);
      })[0];

    return [
      firstOfType("modelo"),
      firstOfType("marca"),
      firstOfType("categoria"),
      priceLanding,
    ].filter((landing): landing is (typeof landingPages)[number] =>
      Boolean(landing),
    );
  }, [vehicle]);

  const discoveryLabel = (landing: (typeof landingPages)[number]) => {
    if (landing.type === "modelo" || landing.type === "marca") {
      return `Outros ${landing.name}`;
    }

    if (landing.type === "categoria") {
      const categoryLabels: Record<string, string> = {
        suv: "Outros SUVs",
        hatch: "Outros hatches",
        sedan: "Outros sedãs",
      };
      return categoryLabels[landing.slug] || `Outros ${landing.name}`;
    }

    const priceLabel = landing.name.replace(/^Carros\s+/i, "");
    return `${priceLabel.charAt(0).toUpperCase()}${priceLabel.slice(1)}`;
  };

  const brandLanding = vehicleDiscoveryLandings.find(
    (landing) => landing.type === "marca",
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

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOrigin, setLightboxOrigin] = useState<"gallery" | "hero">("gallery");
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [heroIntentContext, setHeroIntentContext] = useState<{
    summary: string;
    whatsappUrl?: string;
  }>({ summary: "" });
  const { data: heroWhatsApp } = useWhatsAppQuery();
  const heroRef = useRef<HTMLElement>(null);
  const heroMediaRef = useRef<HTMLDivElement>(null);
  const primaryCtaRef = useRef<HTMLDivElement>(null);
  const [isPrimaryCtaPastHeader, setIsPrimaryCtaPastHeader] = useState(false);

  // O card flutuante só entra depois que o CTA principal sai pelo
  // topo. Assim ele não encobre preço e links enquanto o usuário avalia o carro.
  useEffect(() => {
    if (!vehicle) {
      setIsPrimaryCtaPastHeader(false);
      return;
    }

    const updateFloatingCta = () => {
      const primaryCta = primaryCtaRef.current;
      const footer = document.querySelector("footer");
      const footerVisible = footer !== null && footer.getBoundingClientRect().top < window.innerHeight;
      setIsPrimaryCtaPastHeader(
        Boolean(primaryCta && primaryCta.getBoundingClientRect().bottom < 64 && !footerVisible),
      );
    };

    updateFloatingCta();
    window.addEventListener("scroll", updateFloatingCta, { passive: true });
    window.addEventListener("resize", updateFloatingCta);

    return () => {
      window.removeEventListener("scroll", updateFloatingCta);
      window.removeEventListener("resize", updateFloatingCta);
    };
  }, [vehicle?.id]);

  const vehicleData = useMemo(() => {
    if (!vehicle) return null;

    // A ficha apresenta somente o ano-modelo, sem alterar o ano de fabricação do cadastro.
    const yearDisplay = vehicle.year ? String(vehicle.year) : "";

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

  const photoCaptions = useMemo(
    () => buildVehiclePhotoCaptions(vehicle, avifImages),
    [vehicle, avifImages],
  );

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

  const heroGallery = useMemo(
    () => buildVehicleHeroGallery(
      mainImage,
      avifImages,
      photoCaptions,
      buildVehiclePhotoCaptions(vehicle, [mainImage])[0] || "",
    ),
    [mainImage, avifImages, photoCaptions, vehicle],
  );

  useLayoutEffect(() => {
    const hero = heroRef.current;
    const media = heroMediaRef.current;
    if (!hero || !media) return;
    const reserveMediaSpace = () => {
      const minimumHeight = window.matchMedia("(min-width: 1024px)").matches
        ? Math.ceil(media.getBoundingClientRect().bottom - hero.getBoundingClientRect().top + 32)
        : 0;
      hero.style.setProperty("--hero-media-min-height", `${minimumHeight}px`);
    };
    reserveMediaSpace();
    const observer = new ResizeObserver(reserveMediaSpace);
    observer.observe(media);
    window.addEventListener("resize", reserveMediaSpace);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", reserveMediaSpace);
    };
  }, [mainImage, vehicle?.id, warrantyStamp, tractionBatteryStamp, powertrainStamp]);

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

  // Depois das metatags: uma ficha em cache não deve herdar o título da
  // página anterior. Só dado real da API, nunca placeholder do estoque.
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

  // Com placeholder do estoque, `vehicle` já existe → pula tela intermediária.
  if (!vehicle) {
    if (error || !isPending) {
      return <VehicleUnavailablePage />;
    }
    return <LoadingVehicleDetail slug={slug} />;
  }

  const isSold = !vehicle.price || vehicle.price <= 0;
  const hasRealPhotos =
    vehicle.imagens_site?.tem_fotos === 1 ||
    (vehicle.imagens_site?.tem_fotos !== 0 &&
      (avifImages.length > 0 || mainImage !== CAR_COVERED_PLACEHOLDER_URL));
  const instagramVideo = selectVehicleInstagramVideo(
    String(vehicle.id),
    vehicle.price,
    vehicleVideosForDisplay(
      vehicleVideosQuery.data,
      vehicleVideosQuery.isError,
    ),
  );
  const vehicleLabel = [marca, modeloCompleto, vehicle.year]
    .filter(Boolean)
    .join(" ");
  const waRef = vehicleWhatsAppRef(vehicle);

  const mileageFormatted = formatCatalogMileage(vehicle.km);

  // Badges (só selos de dados reais — sem Retire hoje / Vistoriado genérico)
  const diferenciais = vehicle?.diferenciais ?? [];
  const hasDiferencial = (tag: string) =>
    diferenciais.some((diff) => diff.tag === tag);
  const hasIcheckSeal = getHistorySummary(icheck?.protocol?.history).approved;
  const canOpenHeroLaudo = Boolean(hasIcheckSeal && hasVehicleIcheck(vehicle) && !isSold);
  const handleOpenHeroLaudo = () => {
    const laudoSlug =
      (slug && String(slug).trim()) ||
      (vehicle?.id != null ? String(vehicle.id) : "");
    if (!laudoSlug) return;
    window.open(`/laudo/${laudoSlug}`, "_blank", "noopener,noreferrer");
  };
  const videoWhatsappHref = heroWhatsApp?.numero
    ? buildWhatsAppUrl(
        heroWhatsApp.numero,
        vehicleWhatsAppMessages(vehicleLabel, modeloCompleto, waRef).info,
      )
    : undefined;
  const quickProvenanceItems = (() => {
    const items = ["Origem RS", "Sem locadora", "Sem leilão"];
    const optionalTexts = [
      ...(vehicle.opcionais ?? []).map((item) =>
        typeof item === "string" ? item : `${item.tag ?? ""} ${item.descricao ?? ""}`,
      ),
      ...diferenciais.map((item) => `${item.tag ?? ""} ${item.descricao ?? ""}`),
    ]
      .join(" ")
      .toLowerCase();
    if (/manual|chave reserva/.test(optionalTexts)) {
      items.push("Manual e chave reserva");
    } else if (/revis[aã]o|revis[oõ]es|revisado/.test(optionalTexts)) {
      items.push("Revisões conferidas");
    } else if (/ipva/.test(optionalTexts)) {
      items.push("IPVA verificado");
    }
    return items;
  })();
  const merchandising = getVehicleMerchandising(vehicle);
  const isCommercialHighlight =
    Number(vehicle?.km) > 0 &&
    Number(vehicle.km) < LOW_MILEAGE_HIGHLIGHT_THRESHOLD_KM;
  // Sem "APENAS X KM", o selo destaca o uso por ano (ano de fabricação).
  const isLowAnnualMileage =
    !isCommercialHighlight && hasVehicleLowAnnualMileage(vehicle);
  const heroEquipmentLabels = getVehicleHeroEquipmentLabels(vehicle);

  const badges: Badge[] = (
    isSold
      ? []
      : [
          ...heroEquipmentLabels.map((text) => ({
            text,
            variant: "capacidade" as const,
          })),
          ...(merchandising?.detailLabel
            ? [
                {
                  text: merchandising.detailLabel,
                  variant: "green-dark" as const,
                },
              ]
            : []),
          ...(isCommercialHighlight && vehicle.km
            ? [
                {
                  text: `APENAS ${vehicle.km.toLocaleString("pt-BR")} KM`,
                  variant: "oportunidade" as const,
                },
              ]
            : []),
          ...(isLowAnnualMileage
            ? [
                {
                  text: LOW_ANNUAL_MILEAGE_DETAIL_LABEL,
                  variant: "baixa-km" as const,
                },
              ]
            : []),
          ...(hasDiferencial("unico_dono")
            ? [{ text: "Único Dono", variant: "green-dark" as const }]
            : []),
          ...(hasIcheckSeal
            ? [
                {
                  text: "I-CHECK APROVADO",
                  variant: "icheck" as const,
                  ...(canOpenHeroLaudo
                    ? {
                        onClick: handleOpenHeroLaudo,
                        title: "Abrir certificado DEKRA / CheckAuto em nova aba",
                      }
                    : {}),
                },
              ]
            : []),
        ]
  ).slice(0, 4);
  return (
    <main
      className="max-w-full min-w-0 overflow-x-clip pt-16 md:pt-0"
      data-black-friday={(isBlackFriday && !isSold) || undefined}
    >
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
          brandLandingSlug={brandLanding?.slug}
        />
      )}
      {!isSold && <BlackFridayVehicleRibbon />}
      <nav
        aria-label="Navegação estrutural"
        className="border-b border-slate-100 bg-white"
      >
        <ol className="container-main flex items-center gap-1.5 overflow-hidden px-4 py-3 text-xs text-muted-foreground sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <li className="shrink-0">
            <Link to="/" className="transition-colors hover:text-primary">
              Início
            </Link>
          </li>
          <li aria-hidden className="shrink-0">
            <ChevronRight className="h-3.5 w-3.5" />
          </li>
          <li className="shrink-0">
            <Link
              to="/seminovos"
              onClick={() =>
                trackVehicleDiscoveryClick({
                  source: "breadcrumb",
                  targetType: "inventory",
                  targetSlug: "seminovos",
                  targetName: "Seminovos",
                  vehicleId: vehicle.id,
                  vehicleName: vehicleLabel,
                })
              }
              className="transition-colors hover:text-primary"
            >
              Seminovos
            </Link>
          </li>
          {brandLanding && (
            <>
              <li aria-hidden className="shrink-0">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li className="shrink-0">
                <Link
                  to="/comprar-{$landingSlug}"
                  params={{ landingSlug: brandLanding.slug }}
                  onClick={() =>
                    trackVehicleDiscoveryClick({
                      source: "breadcrumb",
                      targetType: "marca",
                      targetSlug: brandLanding.slug,
                      targetName: brandLanding.name,
                      vehicleId: vehicle.id,
                      vehicleName: vehicleLabel,
                    })
                  }
                  className="transition-colors hover:text-primary"
                >
                  {brandLanding.name}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden className="shrink-0">
            <ChevronRight className="h-3.5 w-3.5" />
          </li>
          <li
            aria-current="page"
            className="min-w-0 truncate font-semibold text-[#00283C]"
          >
            {modeloCompleto}
          </li>
        </ol>
      </nav>
      {/* Hero Section */}
      <section ref={heroRef} className={`relative w-full max-w-full overflow-hidden py-0 pb-5 pt-0 lg:min-h-[var(--hero-media-min-height,0px)] lg:pb-8 lg:pt-0${isBlackFriday && !isSold ? " bf-detail-hero" : ""}`}>
        {/* Mobile starts with the same cover and continues through the existing photos. */}
        <div
          ref={heroMediaRef}
          className="w-full mb-2 relative lg:mb-0 lg:absolute lg:pointer-events-none lg:select-none lg:z-[2]
                        lg:w-[70vw] lg:top-[-3rem] lg:right-0
                        xl:top-[-10rem]
                        2xl:top-[-15rem]
                        3xl:top-[-15rem]
                        4xl:w-[58vw] 4xl:top-[-15rem] 4xl:right-[3vw]
                        5xl:top-[-35rem]"
        >
          <div className="lg:hidden">
            <MobileGalleryCarousel
              key={vehicle.id}
              slides={heroGallery}
              altBase={`${marca} ${modeloCompleto} ${vehicle.year || ""}`.trim()}
              isSold={isSold}
              campaignActive={isBlackFriday}
              onOpen={(index) => {
                setLightboxOrigin("hero");
                setLightboxIndex(index);
                setLightboxOpen(true);
              }}
            />
          </div>
          {mainImage && (
            <div data-black-friday-photo={isBlackFriday && !isSold || undefined} className="bf-desktop-photo w-full h-[240px] sm:h-[400px] lg:h-auto hidden items-center lg:flex lg:items-start justify-center bg-gray-50 lg:bg-transparent relative overflow-visible p-2 sm:p-5 lg:p-0">
              {isBlackFriday && !isSold && (
                <img className="bf-photo-arc" src="/images/campaigns/black-friday-2026/ribbon-black.png" width={1080} height={406} alt="" aria-hidden="true" />
              )}
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
              <picture className="contents">
                <source media="(max-width: 1023px)" srcSet={HIDDEN_RESPONSIVE_IMAGE} />
                <source
                  type="image/avif"
                  srcSet={stockDetailAvifSrcSet(mainImage, [480, 640, 768, 960, 1280])}
                  sizes="(max-width: 1023px) 100vw, 70vw"
                />
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
                    const target = e.currentTarget;
                    if (target.dataset.originalFallback === "true") {
                      target.style.display = "none";
                      return;
                    }
                    target.dataset.originalFallback = "true";
                    target.closest("picture")?.querySelectorAll("source").forEach((source) => source.removeAttribute("srcset"));
                    target.removeAttribute("srcset");
                    target.src = mainImage;
                  }}
                />
              </picture>
            </div>
          )}
          {(warrantyStamp || tractionBatteryStamp || powertrainStamp || (SHOW_CAMPAIGN_STAMP && !isSold)) && (
            <div
              className={`relative flex items-start justify-end gap-3 px-4 sm:px-6 lg:hidden ${[warrantyStamp, tractionBatteryStamp, powertrainStamp, SHOW_CAMPAIGN_STAMP && !isSold].filter(Boolean).length === 1 ? "-mt-6" : "pt-1"}`}
              data-vehicle-stamps="mobile-near-floor"
            >
              {SHOW_CAMPAIGN_STAMP && !isSold && (
                <img src="/selos/selo_campanha.png" alt="Selo de campanha" className="h-auto w-20 shrink-0 pointer-events-none select-none sm:w-24" />
              )}
              {warrantyStamp && (
                <div className="w-[68px] shrink-0 sm:w-[96px]">
                  <FactoryWarrantyBadge {...warrantyStamp} variant="hero" />
                </div>
              )}
              {tractionBatteryStamp && (
                <div className="w-[68px] shrink-0 sm:w-[96px]">
                  <FactoryWarrantyBadge {...tractionBatteryStamp} variant="hero" />
                </div>
              )}
              {powertrainStamp && (
                <div className="w-[68px] shrink-0 sm:w-[96px]">
                  <FactoryWarrantyBadge {...powertrainStamp} variant="hero" />
                </div>
              )}
            </div>
          )}
          {(warrantyStamp || tractionBatteryStamp || powertrainStamp || (SHOW_CAMPAIGN_STAMP && !isSold)) && (
            <div
              className={`relative hidden items-start justify-end gap-4 px-[8%] lg:flex ${[warrantyStamp, tractionBatteryStamp, powertrainStamp, SHOW_CAMPAIGN_STAMP && !isSold].filter(Boolean).length === 1 ? "-mt-[min(10.5vw,164px)]" : "pt-1"}`}
              data-vehicle-stamps="near-floor"
            >
              {SHOW_CAMPAIGN_STAMP && !isSold && (
                <img src="/selos/selo_campanha.png" alt="Selo de campanha" className="h-auto w-24 shrink-0 pointer-events-none select-none" />
              )}
              {warrantyStamp && (
                <div className="w-[10.5vw] max-w-[164px]">
                  <FactoryWarrantyBadge {...warrantyStamp} variant="hero" />
                </div>
              )}
              {tractionBatteryStamp && (
                <div className="w-[10.5vw] max-w-[164px]">
                  <FactoryWarrantyBadge {...tractionBatteryStamp} variant="hero" />
                </div>
              )}
              {powertrainStamp && (
                <div className="w-[10.5vw] max-w-[164px]">
                  <FactoryWarrantyBadge {...powertrainStamp} variant="hero" />
                </div>
              )}
            </div>
          )}
          {/* Faixa sob a foto do carro no Desktop: elimina espaço vazio e destaca entrega imediata + procedência + Me chamar */}
          {!isSold && (
            <div className="pointer-events-auto select-auto relative z-20 mt-2 hidden pl-[8%] pr-[4%] lg:block xl:pl-[9%] xl:pr-[5%]">
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3.5 backdrop-blur-sm xl:flex-row xl:items-center xl:justify-between xl:gap-5 xl:px-5">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#00283C] px-3 py-1 text-[11px] font-black uppercase tracking-[0.07em] text-white">
                      <Sparkles className="h-3 w-3 shrink-0 text-[#5CD29D]" aria-hidden="true" />
                      Única unidade
                    </span>
                    {hasRealPhotos && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#087A37]/30 bg-[#EAF7F0] px-3 py-1 text-[12px] font-black uppercase tracking-[0.04em] text-[#065E2B]">
                        <KeyRound className="h-3.5 w-3.5 shrink-0 text-[#087A37]" aria-hidden="true" />
                        Saia de carro ainda hoje
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#526974]">
                      <MapPin className="h-3 w-3 text-[#23747C]" aria-hidden="true" />
                      Esteio/RS
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#526974]">
                      <Clock className="h-3 w-3 text-[#23747C]" aria-hidden="true" />
                      Resposta ~1 min
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {quickProvenanceItems.map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center gap-1 rounded-full border border-[#23747C]/15 bg-[#F4FAF8] px-2.5 py-0.5 text-[11px] font-semibold text-[#23545B]"
                      >
                        <ShieldCheck className="h-3 w-3 shrink-0 text-[#087A37]" aria-hidden="true" />
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="w-full shrink-0 border-t border-slate-200/80 pt-2.5 xl:w-[270px] xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0">
                  <QuickCallbackForm
                    inputId={`wa-callback-desktop-${vehicle.id}`}
                    vehicleId={vehicle.id}
                    vehicleName={vehicleLabel}
                    intentSummary={heroIntentContext.summary}
                    contextLabel={heroIntentContext.summary || vehicleLabel}
                    fallbackWhatsAppUrl={
                      heroIntentContext.whatsappUrl ||
                      (heroWhatsApp?.numero
                        ? buildWhatsAppUrl(
                            heroWhatsApp.numero,
                            vehicleWhatsAppMessages(vehicleLabel, modeloCompleto, waRef).info,
                          )
                        : undefined)
                    }
                    compact
                  />
                </div>
              </div>
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
            className="relative z-10 flex w-full min-w-0 flex-col pt-2 sm:py-4 lg:w-[32%] lg:max-w-[28rem] lg:pb-5 lg:pt-6 xl:w-[30%] xl:max-w-[32rem] 2xl:w-[32%] 2xl:max-w-[36rem]"
          >
            {/* Brand and a direct route to the verified video, when available. */}
            <div
              className={
                instagramVideo
                  ? "mb-2 flex min-h-10 items-center justify-between gap-3"
                  : "mb-1 sm:mb-1.5"
              }
            >
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.8,
                  delay: 0.15,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
                className="min-w-0 text-muted-foreground uppercase tracking-[0.15em] font-semibold info-brand"
              >
                {marca}
              </motion.p>
              {instagramVideo && (
                <button
                  type="button"
                  onClick={() => {
                    trackVehicleVideoClick(String(vehicle.id));
                    setVideoModalOpen(true);
                  }}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-[#23747C]/25 bg-white px-3 py-2 text-xs font-bold text-[#075E64] transition-colors hover:bg-[#E5F3F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#008B95]"
                >
                  <Play
                    className="h-3.5 w-3.5 fill-current"
                    aria-hidden="true"
                  />
                  Ver vídeo
                </button>
              )}
            </div>

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
              className="text-fg font-bold leading-[1.15] mb-2.5 sm:mb-3 max-w-full break-words info-model"
            >
              {modeloCompleto}
            </motion.h1>

            {/* A capacidade confirmada aparece logo após o nome, inclusive no mobile. */}

            {/* Badges */}
            {badges.length > 0 && (
              <div
                aria-label="Destaques do veículo"
                className={`${heroEquipmentLabels.length > 0 ? "order-none mt-0" : "order-3 sm:order-none mt-2 sm:mt-0"} mb-3.5 flex flex-wrap gap-1.5`}
              >
                {badges.map((badge, idx) => (
                  <Badge key={idx} {...badge} />
                ))}
              </div>
            )}

            {/* Ficha técnica resumida — alinhada em 2 linhas balanceadas sem célula órfã */}
            <div className="order-4 sm:order-none mb-3.5 space-y-2.5 border-y border-slate-200/80 py-3">
              <div className="grid grid-cols-3 gap-x-3">
                {year && (
                  <div className="flex min-w-0 flex-col">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#647B86]">
                      Modelo
                    </span>
                    <span className="mt-0.5 text-[14px] font-bold leading-snug tabular-nums text-[#00283C] sm:text-[15px]">
                      {year}
                    </span>
                  </div>
                )}
                {mileageFormatted && (
                  <div className="flex min-w-0 flex-col">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#23747C]">
                      <Gauge className="h-3 w-3 shrink-0" aria-hidden="true" />
                      Km
                    </span>
                    <span className="mt-0.5 text-[14px] font-bold leading-snug tabular-nums text-[#075E54] sm:text-[15px]">
                      {mileageFormatted}
                    </span>
                  </div>
                )}
                {cambio && (
                  <div className="flex min-w-0 flex-col">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#647B86]">
                      Câmbio
                    </span>
                    <span className="mt-0.5 truncate text-[14px] font-bold leading-snug text-[#00283C] sm:text-[15px]">
                      {formatHeroSpecValue(cambio)}
                    </span>
                  </div>
                )}
              </div>

              {(combustivel || motorFormatado) && (
                <div
                  className={`grid gap-x-3 border-t border-slate-200/70 pt-2.5 ${
                    combustivel && motorFormatado ? "grid-cols-2" : "grid-cols-1"
                  }`}
                >
                  {combustivel && (
                    <div className="flex min-w-0 flex-col">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#647B86]">
                        Combustível
                      </span>
                      <span className="mt-0.5 text-[14px] font-bold leading-snug text-[#00283C] sm:text-[15px]">
                        {formatHeroSpecValue(combustivel)}
                      </span>
                    </div>
                  )}
                  {motorFormatado && (
                    <div className="flex min-w-0 flex-col">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#647B86]">
                        Motor
                      </span>
                      <span className="mt-0.5 text-[14px] font-bold leading-snug text-[#00283C] sm:text-[15px]">
                        {formatHeroSpecValue(motorFormatado)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Preço, confiança e CTA — tudo alinhado à esquerda com hierarquia limpa */}
            <div className="order-1 sm:order-none flex w-full flex-col items-start gap-1.5">
              {!isSold && (
                <div className="flex w-full flex-col items-start gap-2">
                  {/* Destaque de escassez real + entrega imediata no mobile/tablet (no desktop aparece sob a foto do carro) */}
                  <div className="mb-1 flex w-full flex-col items-start gap-1.5 lg:hidden">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#00283C] px-3 py-1 text-[11px] font-black uppercase tracking-[0.07em] text-white">
                        <Sparkles className="h-3 w-3 shrink-0 text-[#5CD29D]" aria-hidden="true" />
                        Única unidade
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#526974]">
                        <MapPin className="h-3 w-3 text-[#23747C]" aria-hidden="true" />
                        Esteio/RS
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#526974]">
                        <Clock className="h-3 w-3 text-[#23747C]" aria-hidden="true" />
                        Resposta ~1 min
                      </span>
                    </div>

                    {hasRealPhotos && (
                      <div className="flex w-full items-center gap-2.5 rounded-xl border border-[#087A37]/30 border-l-4 border-l-[#087A37] bg-[#EAF7F0] px-3 py-2 text-left">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#087A37] text-white">
                          <KeyRound className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 leading-tight">
                          <p className="text-[12px] font-black uppercase tracking-[0.04em] text-[#065E2B] sm:text-[13px]">
                            Saia de carro ainda hoje
                          </p>
                          <p className="mt-0.5 text-[11px] font-semibold text-[#23545B]">
                            Veículo pronto no showroom para entrega imediata
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex w-full flex-col items-start gap-1.5">
                    {isBlackFriday && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#23747C]/25 bg-[#E6F5F6] px-2.5 py-0.5 text-[11px] font-bold text-[#064B50]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#087A37]" aria-hidden="true" />
                        Black Friday Netcar · Até 30/11
                      </span>
                    )}
                    <VehiclePrice
                      price={fipeOffer && vehicle ? formatPrice(vehicle.price) : price}
                      previousPrice={previousPrice}
                      showComparison={showPriceComparison}
                    />
                    <VehicleFipeOfferNote offer={fipeOffer} />
                    <GoogleRatingBadge variant="inline" />
                  </div>

                  {/* Procedência e documentação rápida no mobile/tablet (no desktop fica sob o carro) */}
                  <div className="flex flex-wrap items-center gap-1.5 lg:hidden">
                    {quickProvenanceItems.map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center gap-1 rounded-full border border-[#23747C]/15 bg-[#F4FAF8] px-2 py-0.5 text-[10px] font-semibold text-[#23545B]"
                      >
                        <ShieldCheck className="h-3 w-3 shrink-0 text-[#087A37]" aria-hidden="true" />
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div ref={primaryCtaRef} className="w-full">
                <ContactButton
                  modeloCompleto={modeloCompleto}
                  vehicleId={vehicle?.id}
                  vehiclePrice={vehicle?.price}
                  isSold={isSold}
                  vehicleLabel={vehicleLabel}
                  waRef={waRef}
                  onIntentContextChange={setHeroIntentContext}
                />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {!isSold && (
        <BlackFridayVehicleOffer
          vehicleLabel={vehicleLabel}
          vehicleId={vehicle.id}
          waRef={waRef}
        />
      )}

      {/* One media gallery: the verified video stays available without photos. */}
      {(instagramVideo || avifImages.length > 0) && (
        <section
          id="galeria-fotos"
          className="w-full scroll-mt-20 py-6 sm:py-12 lg:pb-16 lg:pt-4"
          aria-label="Fotos e vídeo do veículo"
        >
          <h2 className="mb-3 px-4 text-sm font-semibold text-[#00283C] lg:hidden">
            {avifImages.length > 0 ? "Galeria de fotos" : "Vídeo do veículo"}
          </h2>
          <div
            className={
              instagramVideo
                ? `grid gap-2 px-4 sm:gap-3 lg:px-6 ${avifImages.length > 0 ? "grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 3xl:grid-cols-6 4xl:grid-cols-7 5xl:grid-cols-8" : "mx-auto max-w-3xl grid-cols-1"}`
                : "contents"
            }
          >
            {instagramVideo && (
              <section
                id="video-do-carro"
                aria-label="Vídeo deste veículo"
                className={`min-w-0 scroll-mt-24 ${avifImages.length > 0 ? "col-span-2 lg:row-span-2" : "sm:aspect-[4/3]"}`}
              >
                <VehicleVideoLink
                  permalink={instagramVideo.permalink}
                  vehicleName={vehicleLabel}
                  displayModel={instagramVideo.displayModel}
                  coverImage={instagramVideo.coverImage}
                  onOpen={() => trackVehicleVideoClick(String(vehicle.id))}
                  isOpen={videoModalOpen}
                  onOpenChange={setVideoModalOpen}
                  whatsappHref={videoWhatsappHref}
                />
              </section>
            )}
            {avifImages.length > 0 && (
              <>
                {/* Photos share the video grid on mobile and desktop. */}
                <div
                  className={
                    instagramVideo
                      ? "contents"
                      : "grid w-full grid-cols-2 gap-2 px-4 lg:px-0 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 4xl:grid-cols-7 5xl:grid-cols-8"
                  }
                >
                  {avifImages.map((image, index) => (
                    <GalleryItem
                      key={index}
                      image={image}
                      index={index}
                      rounded
                      alt={`${marca} ${modeloCompleto} ${vehicle.year || ""} - Foto ${index + 1} - Netcar Multimarcas`}
                      caption={photoCaptions[index]}
                      onClick={() => {
                        setLightboxOrigin("gallery");
                        setLightboxIndex(index);
                        setLightboxOpen(true);
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <Lightbox
          images={lightboxOrigin === "hero" ? heroGallery.map((slide) => slide.canonicalIndex === null ? slide.image : avifImages[slide.canonicalIndex]) : avifImages}
          captions={lightboxOrigin === "hero" ? heroGallery.map((slide) => slide.caption) : photoCaptions}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          vehicleName={modeloCompleto}
        />
      )}

      {/* Details Section */}
      <DeferredRender minHeight={900} rootMargin="700px">
        <DetailsSection
          vehicle={vehicle}
          isSold={isSold}
          pageSlug={slug}
          warrantyConditions={(warrantyStamp || tractionBatteryStamp || powertrainStamp) ? (
            <FactoryWarrantyNote compact tractionBattery={!!tractionBatteryStamp} powertrain={powertrainStamp} />
          ) : undefined}
        />
      </DeferredRender>

      <section className="w-full pb-2 pt-6 sm:pt-8" aria-label="Por que este carro">
        <div className={`container-main grid items-stretch gap-4 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 ${isSold ? "max-w-xl" : "lg:grid-cols-2"}`}>
          <CustomerDeliveriesCallout />
          {!isSold && (
            <div className="flex flex-col rounded-2xl border border-[#23747C]/15 bg-[#F7FBFA] p-4 text-left shadow-[0_3px_16px_rgba(0,40,60,0.03)] sm:p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#23747C] sm:text-[11px]">
                Seleção Netcar
              </p>
              <p className="mt-2 text-lg font-bold leading-snug tracking-[-0.02em] text-fg sm:text-xl">
                Este carro atende aos critérios da Netcar.
              </p>
              <div className="mt-4 grid flex-1 grid-cols-1 gap-2 text-sm font-semibold leading-snug text-[#365565] sm:grid-cols-2">
                {[
                  "Comprado no RS",
                  "Sem origem de locadora",
                  "Sem leilão, sinistro, furto ou roubo",
                  "Preparado antes da vitrine",
                ].map((item) => (
                  <span
                    key={item}
                    className="flex items-start gap-2 rounded-xl bg-white px-3 py-2.5"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#087A37]" />
                    {item}
                  </span>
                ))}
              </div>
              <Link
                to="/como-selecionamos-nossos-carros"
                className="mt-4 inline-block text-sm font-semibold leading-5 text-[#075E54] underline decoration-[#075E54]/30 underline-offset-4 transition-colors hover:text-primary"
              >
                Entenda como selecionamos
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Fábrica de Valor Section */}
      <section className="w-full py-3 sm:py-4 bg-surface" aria-label="Preparação do veículo">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <DeferredRender minHeight={112}>
            <FabricaDeValor />
          </DeferredRender>
        </div>
      </section>

      {vehicleDiscoveryLandings.length > 0 && (
        <section className="pt-8 pb-10 sm:pt-10 sm:pb-12">
          <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
            <div className="grid gap-5 rounded-3xl border border-[#00283C]/10 bg-white px-5 py-5 shadow-[0_12px_35px_rgba(0,40,60,0.06)] sm:px-6 sm:py-6 lg:grid-cols-[minmax(250px,0.75fr)_minmax(0,1.6fr)] lg:items-center lg:gap-8">
              <div className="flex items-start gap-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E8F8F4] text-[#087A6A]">
                  <ArrowLeftRight className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#087A6A]">
                    Outras opções
                  </p>
                  <h2 className="mt-1 text-xl font-black leading-tight text-[#00283C]">
                    Continue comparando
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#536273]">
                    Veja carros parecidos sem começar a busca de novo.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5 lg:justify-end">
                {vehicleDiscoveryLandings.map((landing) => (
                  <Link
                    key={landing.slug}
                    to="/comprar-{$landingSlug}"
                    params={{ landingSlug: landing.slug }}
                    onClick={() =>
                      trackVehicleDiscoveryClick({
                        source: "comparison_block",
                        targetType: landing.type,
                        targetSlug: landing.slug,
                        targetName: landing.name,
                        vehicleId: vehicle.id,
                        vehicleName: vehicleLabel,
                      })
                    }
                    className="rounded-full border border-[#00283C]/15 bg-[#F8FAFA] px-4 py-2.5 text-sm font-bold text-[#00283C] transition-all hover:-translate-y-0.5 hover:border-[#087A6A] hover:bg-[#F0FBF8] hover:text-[#087A6A]"
                  >
                    {discoveryLabel(landing)}
                  </Link>
                ))}
                <Link
                  to="/comparar"
                  search={{ veiculo: String(vehicle.id) }}
                  onClick={() =>
                    trackCompareInteraction({
                      action: "from_vehicle",
                      vehicleIds: [vehicle.id],
                      vehicleNames: [vehicleLabel],
                    })
                  }
                  className="rounded-full bg-[#00283C] px-4 py-2.5 text-sm font-bold text-white shadow-[0_7px_18px_rgba(0,40,60,0.18)] transition-all hover:-translate-y-0.5 hover:bg-[#00435a]"
                >
                  Comparar lado a lado
                </Link>
              </div>
            </div>
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

      <div className="w-full font-sans antialiased text-muted-foreground bg-muted pt-12 pb-8 px-4 md:px-8 space-y-8">
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
        visible={isPrimaryCtaPastHeader}
        waRef={waRef}
      />
    </main>
  );
}

function isCanonicalHighlightTitle(highlight: VehicleHighlight): boolean {
  return highlight.equipmentLabels.length === 1 && highlight.title === highlight.equipmentLabels[0];
}

function VehicleDifferentialHighlights({
  modelo,
  presentation,
  context,
}: {
  modelo: string;
  presentation: VehicleHighlightsPresentation;
  context: string;
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
      data-equipment-presentation="editorial"
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
          Diferenciais deste veículo
        </p>
        <h3
          id="vehicle-differentials-title"
          className="mt-1 text-2xl font-black tracking-[-0.025em] text-[#00283C] sm:text-3xl"
        >
          Por que escolher este {modelo}
        </h3>
        {context && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
            {context}
          </p>
        )}
      </div>

      {featuredHighlight?.metric && (
        <article className="mt-6 grid min-w-0 gap-3 rounded-2xl border border-primary/20 bg-primary/[0.05] px-5 py-5 sm:grid-cols-[minmax(0,150px)_minmax(0,1fr)] sm:items-center sm:gap-6 sm:px-6">
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
            <h4 data-equipment-label={isCanonicalHighlightTitle(featuredHighlight) ? true : undefined} className="mt-1 text-lg font-black leading-snug text-[#00283C] sm:text-xl">
              {featuredHighlight.title}
            </h4>
            <p data-equipment-benefit className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {featuredHighlight.description}
            </p>
            {!isCanonicalHighlightTitle(featuredHighlight) && <p className="mt-2 text-xs leading-relaxed text-[#365565]">
              {featuredHighlight.equipmentLabels.map((label, index) => (
                <React.Fragment key={label}>
                  {index > 0 && <span aria-hidden="true"> · </span>}
                  <span data-equipment-label>{label}</span>
                </React.Fragment>
              ))}
            </p>}
          </div>
        </article>
      )}

      <div className="mt-6 grid min-w-0 gap-3 sm:grid-cols-2">
        {regularHighlights.map((highlight) => (
          <article
            key={highlight.id}
            className="min-w-0 rounded-2xl border border-[#00283C]/10 bg-white px-5 py-4"
          >
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#23747C]">
              {highlight.category}
            </p>
            <h4 data-equipment-label={isCanonicalHighlightTitle(highlight) ? true : undefined} className="mt-1.5 text-base font-black leading-snug text-[#00283C] sm:text-lg">
              {highlight.title}
            </h4>
            <p data-equipment-benefit className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {highlight.description}
            </p>
            {!isCanonicalHighlightTitle(highlight) && <p className="mt-2 text-xs leading-relaxed text-[#365565]">
              {highlight.equipmentLabels.map((label, index) => (
                <React.Fragment key={label}>
                  {index > 0 && <span aria-hidden="true"> · </span>}
                  <span data-equipment-label>{label}</span>
                </React.Fragment>
              ))}
            </p>}
          </article>
        ))}
      </div>
    </motion.section>
  );
}

interface DetailsSectionProps {
  vehicle: any;
  isSold?: boolean;
  pageSlug?: string;
  warrantyConditions?: React.ReactNode;
}

function DetailsSection({
  vehicle,
  isSold = false,
  pageSlug,
  warrantyConditions,
}: DetailsSectionProps) {
  const [showMoreOptionals, setShowMoreOptionals] = useState(false);

  const modeloCompleto = vehicle.modelo || vehicle.name || "";
  const year = vehicle.year || 0;
  const mileageFormatted = formatCatalogMileage(vehicle.km);

  const highlightPresentation = useMemo(
    () => buildVehicleHighlights(vehicle),
    [vehicle],
  );

  useEffect(() => {
    setShowMoreOptionals(false);
  }, [vehicle.id]);

  // O resumo técnico detalha fabricação/modelo; o destaque inicial mantém só o modelo.
  const anoDisplay =
    vehicle.anoFabricacao && year
      ? `${vehicle.anoFabricacao} / ${year}`
      : year
        ? String(year)
        : "";

  const specifications = [
    anoDisplay && { label: "Ano/modelo:", value: anoDisplay },
    mileageFormatted && { label: "Quilometragem:", value: mileageFormatted },
    vehicle.cor && { label: "Cor:", value: resolveVehicleColor(vehicle).display.toLocaleUpperCase("pt-BR") },
    vehicle.portas && { label: "Portas:", value: `${vehicle.portas}` },
    vehicle.placa && { label: "Placa:", value: maskPlate(vehicle.placa) },
    vehicle.motor && {
      label: "Motor:",
      value: formatEngineDisplacement(vehicle),
    },
    vehicle.potencia && { label: "Potência:", value: `${vehicle.potencia} cv` },
    vehicle.combustivel && {
      label: "Combustível:",
      value: vehicle.combustivel.toUpperCase(),
    },
    vehicle.cambio && { label: "Câmbio:", value: vehicle.cambio },
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const displayedOptionals = highlightPresentation.remainingOptionals;

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
    <section className="w-full py-8 sm:py-12 lg:py-16" data-equipment-presentation="editorial">
      <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,410px)] lg:gap-10">
          {/* Main Content */}
          <div className="order-1 min-w-0 lg:order-1">
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
                </div>
              </div>

              <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
                {specifications.map((spec, index) => (
                  <SpecBadge
                    key={index}
                    label={spec.label}
                    value={spec.value}
                    index={index}
                    highlighted={spec.label === "Quilometragem:"}
                  />
                ))}
              </div>
              {warrantyConditions && (
                <div className="mt-4" data-factory-warranty-footer="specifications">
                  {warrantyConditions}
                </div>
              )}
            </motion.div>

            <VehicleDifferentialHighlights
              modelo={modeloCompleto}
              presentation={highlightPresentation}
              context={buildVehicleEditorialSummary(vehicle)}
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
                      Outros equipamentos
                    </h2>
                  </div>
                </div>

                <div className="grid min-w-0 grid-cols-1 gap-x-6 rounded-2xl border border-[#00283C]/[0.08] bg-white px-4 py-3 sm:grid-cols-2 sm:px-5 lg:grid-cols-3">
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
                      : `Ver todos os ${displayedOptionals.length} equipamentos`}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${showMoreOptionals ? "rotate-180" : ""}`}
                    />
                  </button>
                )}
              </motion.div>
            )}

            {(displayedOptionals.length > 0 ||
              highlightPresentation.highlights.length > 0) && (
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {VEHICLE_EQUIPMENT_NOTICE}
              </p>
            )}
          </div>

          {/* Sticky Sidebar */}
          <div className="order-2 min-w-0 lg:sticky lg:top-24 lg:self-start">
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
