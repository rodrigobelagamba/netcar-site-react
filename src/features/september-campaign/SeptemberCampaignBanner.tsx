import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarClock,
  Check,
  MessageCircle,
  Play,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import { trackSeptemberCampaignInteraction } from "@/lib/analytics";
import {
  buildWhatsAppUrl,
  DEFAULT_SALES_WHATSAPP,
  siteWhatsAppMessage,
} from "@/lib/whatsappMessages";
import { useSeptemberCampaign } from "./CampaignProvider";
import {
  campaignCountdownLabel,
  SEPTEMBER_CAMPAIGN,
  type CampaignCountdown,
} from "./campaign";

type CampaignPlacement = "home" | "inventory" | "vehicle";

type SeptemberCampaignBannerProps = {
  placement: CampaignPlacement;
  vehicleId?: string | number;
  vehicleLabel?: string;
};

const benefits = [
  "Transferência por conta da Netcar",
  "Tanque cheio",
  "1ª parcela só em novembro",
  "Entrada em até 10x",
];

const mobileBenefits = [
  "Transferência por nossa conta",
  "Tanque cheio",
  "1ª parcela em novembro",
  "Entrada em até 10x*",
];

function Countdown({
  countdown,
  compact = false,
}: {
  countdown: CampaignCountdown;
  compact?: boolean;
}) {
  const units = [
    { label: "dias", value: countdown.days },
    { label: "horas", value: countdown.hours },
    { label: "min", value: countdown.minutes },
    { label: "seg", value: countdown.seconds },
  ];

  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={`A campanha termina em ${campaignCountdownLabel(countdown)}`}
      className="min-w-0"
    >
      <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#D0DF94]">
        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
        Termina em
      </div>
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {units.map((unit) => (
          <div
            key={unit.label}
            className={`rounded-xl border border-white/15 bg-white/10 text-center shadow-inner backdrop-blur-sm ${
              compact ? "px-2 py-2" : "px-2.5 py-2.5 sm:px-3 sm:py-3"
            }`}
          >
            <span
              className={`block font-black tabular-nums leading-none text-white ${
                compact ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"
              }`}
            >
              {String(unit.value).padStart(2, "0")}
            </span>
            <span className="mt-1 block text-[8px] font-bold uppercase tracking-wider text-white/65 sm:text-[9px]">
              {unit.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MobileCountdown({
  countdown,
  showLabel = false,
}: {
  countdown: CampaignCountdown;
  showLabel?: boolean;
}) {
  const shortLabel =
    countdown.days > 0
      ? `${countdown.days}d ${countdown.hours}h restantes`
      : `${countdown.hours}h ${countdown.minutes}min restantes`;

  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={`A campanha termina em ${campaignCountdownLabel(countdown)}`}
      className="flex min-w-0 items-center gap-2"
    >
      <CalendarClock
        className="h-4 w-4 shrink-0 text-[#D0DF94]"
        aria-hidden="true"
      />
      {showLabel && (
        <span className="shrink-0 text-[9px] font-black uppercase tracking-[0.12em] text-white/55">
          Termina em
        </span>
      )}
      <strong className="ml-auto truncate text-xs font-black tabular-nums text-white">
        {shortLabel}
      </strong>
    </div>
  );
}

function CampaignVideo({
  placement,
  compact = false,
  eager = false,
}: {
  placement: CampaignPlacement;
  compact?: boolean;
  eager?: boolean;
}) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <video
        autoPlay
        controls
        playsInline
        preload="metadata"
        poster={SEPTEMBER_CAMPAIGN.assets.videoPoster}
        onEnded={() => setPlaying(false)}
        className={`h-full w-full bg-black object-cover ring-1 ring-white/20 ${compact ? "rounded-[1.4rem] shadow-[0_24px_55px_rgba(0,0,0,0.34)]" : "rounded-[1.35rem]"}`}
        aria-label="Vídeo da campanha Acelerou, Levou"
      >
        <source src={SEPTEMBER_CAMPAIGN.assets.video} type="video/mp4" />
        Seu navegador não oferece suporte a vídeos HTML5.
      </video>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        trackSeptemberCampaignInteraction("play_video", placement);
        setPlaying(true);
      }}
      className={`group relative h-full w-full overflow-hidden bg-black text-left shadow-[0_24px_60px_rgba(0,0,0,0.34)] ring-1 ring-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D0DF94] ${compact ? "rounded-[1.4rem]" : "rounded-[1.35rem]"}`}
      aria-label="Assistir ao vídeo da campanha Acelerou, Levou"
    >
      <img
        src={SEPTEMBER_CAMPAIGN.assets.videoPoster}
        alt=""
        width={576}
        height={1024}
        loading={eager ? "eager" : "lazy"}
        decoding={eager ? "sync" : "async"}
        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02] group-hover:brightness-90"
      />
      <span
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent text-white ${compact ? "px-3 pb-3 pt-14" : "px-4 pb-4 pt-16"}`}
      >
        <span
          className={`flex items-center gap-3 ${compact ? "justify-center" : ""}`}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#D0DF94] text-[#003D48] shadow-lg transition-transform group-hover:scale-105">
            <Play className="ml-0.5 h-5 w-5 fill-current" aria-hidden="true" />
          </span>
          <span className={compact ? "sr-only" : ""}>
            <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#D0DF94]">
              29 segundos
            </span>
            <span className="mt-0.5 block text-sm font-black">
              Assista à campanha
            </span>
          </span>
        </span>
      </span>
    </button>
  );
}

function MobileCampaignVideo() {
  return (
    <div className="sm:hidden">
      <div className="mx-auto aspect-[9/16] w-[min(64vw,232px)]">
        <CampaignVideo placement="home" compact eager />
      </div>
    </div>
  );
}

export function SeptemberCampaignBanner({
  placement,
  vehicleId,
  vehicleLabel,
}: SeptemberCampaignBannerProps) {
  const { isActive, countdown } = useSeptemberCampaign();
  const { data: whatsapp } = useWhatsAppQuery();

  useEffect(() => {
    if (isActive) {
      trackSeptemberCampaignInteraction("view", placement, vehicleId);
    }
  }, [isActive, placement, vehicleId]);

  const whatsappHref = useMemo(() => {
    const message = vehicleLabel
      ? siteWhatsAppMessage(
          `quero aproveitar a campanha Acelerou, Levou no ${vehicleLabel} e conhecer as condições.`,
        )
      : siteWhatsAppMessage(
          "quero aproveitar a campanha Acelerou, Levou e conhecer as condições.",
        );
    return buildWhatsAppUrl(
      whatsapp?.numero || DEFAULT_SALES_WHATSAPP,
      message,
    );
  }, [vehicleLabel, whatsapp?.numero]);

  if (!isActive) return null;

  if (placement === "home") {
    return (
      <section
        aria-labelledby="acelerou-levou-home-title"
        className="relative isolate overflow-hidden bg-[#002F3B] pt-16 text-white md:pt-0"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(circle at 14% 12%, rgba(29,151,159,.28), transparent 35%), radial-gradient(circle at 88% 72%, rgba(208,223,148,.16), transparent 32%), linear-gradient(135deg, #003A47 0%, #001D28 68%, #07151B 100%)",
          }}
        />
        <h1 id="acelerou-levou-home-title" className="sr-only">
          Acelerou, Levou: campanha de setembro da Netcar
        </h1>

        <div className="container-main relative grid gap-0 px-4 py-4 sm:gap-7 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center lg:gap-9 lg:px-8 lg:py-10 xl:grid-cols-[minmax(0,1fr)_290px] xl:px-12 2xl:px-16">
          <div className="min-w-0">
            <div className="hidden overflow-hidden rounded-[1.5rem] border border-white/15 bg-black/20 shadow-[0_24px_70px_rgba(0,0,0,0.25)] sm:block">
              <img
                src={SEPTEMBER_CAMPAIGN.assets.banner}
                alt=""
                width={1280}
                height={418}
                loading="eager"
                decoding="sync"
                className="h-auto w-full"
              />
            </div>

            <MobileCampaignVideo />

            <div className="mt-5 hidden grid-cols-4 gap-2 sm:grid">
              {benefits.map((benefit) => (
                <div
                  key={benefit}
                  className="flex min-h-14 items-center gap-2 rounded-xl border border-white/12 bg-white/[0.07] px-3 py-2.5 text-[11px] font-bold leading-snug text-white/90 backdrop-blur-sm sm:text-xs"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D0DF94] text-[#003D48]">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  {benefit}
                </div>
              ))}
            </div>

            <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/10 p-2 sm:hidden">
              <div className="min-w-0 flex-1 px-1">
                <MobileCountdown countdown={countdown} />
              </div>
              <Link
                to="/seminovos"
                onClick={() =>
                  trackSeptemberCampaignInteraction("view_stock", "home")
                }
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#D0DF94] px-3 text-[11px] font-black text-[#003D48] shadow-[0_10px_24px_rgba(208,223,148,0.16)] transition active:scale-[0.98]"
              >
                Ver ofertas
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>

            <div className="mt-5 hidden gap-4 sm:grid sm:grid-cols-[minmax(0,390px)_minmax(260px,1fr)] sm:items-end">
              <Countdown countdown={countdown} />
              <div className="grid gap-2 sm:grid-cols-2">
                <Link
                  to="/seminovos"
                  onClick={() =>
                    trackSeptemberCampaignInteraction("view_stock", "home")
                  }
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#D0DF94] px-4 py-3 text-sm font-black text-[#003D48] shadow-[0_10px_28px_rgba(208,223,148,0.2)] transition hover:bg-white active:scale-[0.98]"
                >
                  Ver seminovos
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-wa-source="campaign_home"
                  data-wa-intent="acelerou_levou"
                  onClick={() =>
                    trackSeptemberCampaignInteraction("whatsapp", "home")
                  }
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15 active:scale-[0.98]"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  Consultar condições
                </a>
              </div>
            </div>

            <p className="mt-2 px-2 text-center text-[10px] font-medium leading-[1.45] text-white/70 sm:hidden">
              Válida até 30/09. Consulte condições e veículos participantes.
            </p>
            <p className="mt-3 hidden text-xs leading-relaxed text-white/55 sm:block">
              Válida até 30/09/2026. Benefícios, financiamento e veículos
              participantes sujeitos às condições da campanha, disponibilidade e
              aprovação de crédito. Consulte a equipe.
            </p>
          </div>

          <div className="mx-auto hidden aspect-[9/16] w-full max-w-[220px] sm:block lg:max-w-none">
            <CampaignVideo placement="home" />
          </div>
        </div>
      </section>
    );
  }

  const isVehicle = placement === "vehicle";

  return (
    <section
      aria-label="Campanha Acelerou, Levou"
      className={`${isVehicle ? "container-main px-4 py-2 sm:px-6 sm:py-4 lg:px-8 xl:px-12 2xl:px-16" : "mb-3 sm:mb-5"}`}
    >
      <div className="relative overflow-hidden rounded-2xl border border-[#D0DF94]/35 bg-[#003541] text-white shadow-[0_16px_45px_rgba(0,40,60,0.16)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 80% 10%, rgba(208,223,148,.18), transparent 32%), linear-gradient(120deg, rgba(0,91,102,.55), transparent 58%)",
          }}
        />

        <div className="relative p-4 sm:hidden">
          <div className="flex items-center gap-3">
            <div className="w-[92px] shrink-0 rounded-xl bg-white px-2.5 py-2.5 shadow-lg">
              <img
                src={SEPTEMBER_CAMPAIGN.assets.logo}
                alt="Acelerou, Levou. Netcar"
                width={1404}
                height={338}
                loading="eager"
                decoding="async"
                className="h-auto w-full"
              />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#D0DF94]">
                Até 30/09
              </p>
              <h2 className="mt-1 text-base font-black leading-tight">
                {isVehicle ? "Condições neste carro" : "Condições de setembro"}
              </h2>
              <p className="mt-1 text-[10px] leading-snug text-white/65">
                Benefícios para veículos participantes
              </p>
            </div>
          </div>

          <div
            className="mt-4 grid grid-cols-2 overflow-hidden rounded-xl border border-white/10 bg-black/10"
            aria-label="Condições da campanha"
          >
            {mobileBenefits.map((benefit, index) => (
              <div
                key={benefit}
                className={`flex min-h-12 items-center gap-2 px-2.5 py-2.5 text-[10px] font-bold leading-snug text-white/90 ${
                  index % 2 === 0 ? "border-r border-white/10" : ""
                } ${index < 2 ? "border-b border-white/10" : ""}`}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#D0DF94] text-[#003D48]">
                  <Check className="h-3 w-3" aria-hidden="true" />
                </span>
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-t border-white/10 pt-3">
            <div className="flex min-w-0 items-center px-1">
              <MobileCountdown countdown={countdown} />
            </div>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Consultar condições da campanha no WhatsApp"
              data-wa-source={`campaign_${placement}`}
              data-wa-intent="acelerou_levou"
              data-wa-vehicle-id={vehicleId ? String(vehicleId) : undefined}
              data-wa-vehicle-name={vehicleLabel}
              onClick={() =>
                trackSeptemberCampaignInteraction(
                  "whatsapp",
                  placement,
                  vehicleId,
                )
              }
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#D0DF94] px-3.5 text-[11px] font-black text-[#003D48] shadow-md transition active:scale-[0.98]"
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Consultar
            </a>
          </div>
          <p className="mt-2 text-[10px] leading-snug text-white/70">
            *Consulte veículos participantes e disponibilidade. Crédito sujeito
            à aprovação.
          </p>
        </div>

        <div className="relative hidden gap-4 p-5 sm:grid lg:grid-cols-[290px_minmax(0,1fr)_300px_auto] lg:items-center lg:gap-5">
          <div className="hidden overflow-hidden rounded-xl border border-white/10 bg-black/20 lg:block">
            <img
              src={SEPTEMBER_CAMPAIGN.assets.banner}
              alt="Acelerou, Levou"
              width={1280}
              height={418}
              loading={isVehicle ? "eager" : "lazy"}
              decoding="async"
              className="h-auto w-full"
            />
          </div>

          <div className="min-w-0">
            <div className="mb-3 w-full max-w-[245px] rounded-lg bg-white px-3 py-2 lg:hidden">
              <img
                src={SEPTEMBER_CAMPAIGN.assets.logo}
                alt="Acelerou, Levou. Netcar"
                width={1404}
                height={338}
                loading="eager"
                decoding="async"
                className="h-auto w-full"
              />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#D0DF94]">
              Setembro na Netcar
            </p>
            <h2 className="mt-1 text-lg font-black leading-tight sm:text-xl">
              {isVehicle
                ? "Acelere para aproveitar neste carro."
                : "Escolha seu seminovo e aproveite a campanha."}
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-white/70 sm:text-sm">
              Transferência por nossa conta, tanque cheio, 1ª parcela em
              novembro e entrada em até 10x.*
            </p>
          </div>

          <Countdown countdown={countdown} compact />

          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            data-wa-source={`campaign_${placement}`}
            data-wa-intent="acelerou_levou"
            data-wa-vehicle-id={vehicleId ? String(vehicleId) : undefined}
            data-wa-vehicle-name={vehicleLabel}
            onClick={() =>
              trackSeptemberCampaignInteraction(
                "whatsapp",
                placement,
                vehicleId,
              )
            }
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#D0DF94] px-4 py-3 text-sm font-black text-[#003D48] shadow-lg transition hover:bg-white active:scale-[0.98] lg:max-w-[190px]"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Quero aproveitar
          </a>
        </div>
        <p className="relative hidden border-t border-white/10 px-5 py-2 text-[10px] leading-relaxed text-white/55 sm:block">
          *Até 30/09/2026. Consulte condições, veículos participantes,
          disponibilidade e aprovação de crédito.
        </p>
      </div>
    </section>
  );
}
