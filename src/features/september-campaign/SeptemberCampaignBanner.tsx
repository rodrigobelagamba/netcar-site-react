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

function CampaignVideo({ placement }: { placement: CampaignPlacement }) {
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
        className="h-full w-full rounded-[1.35rem] bg-black object-cover"
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
      className="group relative h-full w-full overflow-hidden rounded-[1.35rem] bg-black text-left shadow-[0_24px_60px_rgba(0,0,0,0.34)] ring-1 ring-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D0DF94]"
      aria-label="Assistir ao vídeo da campanha Acelerou, Levou"
    >
      <img
        src={SEPTEMBER_CAMPAIGN.assets.videoPoster}
        alt=""
        width={576}
        height={1024}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02] group-hover:brightness-90"
      />
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent px-4 pb-4 pt-16 text-white">
        <span className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#D0DF94] text-[#003D48] shadow-lg transition-transform group-hover:scale-105">
            <Play className="ml-0.5 h-5 w-5 fill-current" aria-hidden="true" />
          </span>
          <span>
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

        <div className="container-main relative grid gap-7 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center lg:gap-9 lg:px-8 lg:py-10 xl:grid-cols-[minmax(0,1fr)_290px] xl:px-12 2xl:px-16">
          <div className="min-w-0">
            <div className="hidden overflow-hidden rounded-[1.5rem] border border-white/15 bg-black/20 shadow-[0_24px_70px_rgba(0,0,0,0.25)] sm:block">
              <img
                src={SEPTEMBER_CAMPAIGN.assets.banner}
                alt=""
                width={1280}
                height={418}
                loading="eager"
                decoding="sync"
                fetchPriority="high"
                className="h-auto w-full"
              />
            </div>

            <div className="rounded-[1.5rem] border border-white/15 bg-white px-4 py-5 text-center shadow-[0_20px_55px_rgba(0,0,0,0.28)] sm:hidden">
              <img
                src={SEPTEMBER_CAMPAIGN.assets.logo}
                alt="Acelerou, Levou. Netcar"
                width={1404}
                height={338}
                loading="eager"
                decoding="sync"
                fetchPriority="high"
                className="mx-auto h-auto w-full max-w-[315px]"
              />
              <p className="mt-3 text-sm font-black uppercase tracking-[0.12em] text-[#003D48]">
                Comece o segundo semestre acelerando
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
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

            <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,390px)_minmax(260px,1fr)] sm:items-end">
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

            <p className="mt-3 text-[10px] leading-relaxed text-white/55 sm:text-xs">
              Válida até 30/09/2026. Benefícios, financiamento e veículos
              participantes sujeitos às condições da campanha, disponibilidade e
              aprovação de crédito. Consulte a equipe.
            </p>
          </div>

          <div className="mx-auto aspect-[9/16] w-full max-w-[220px] lg:max-w-none">
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
      className={`${isVehicle ? "container-main px-4 py-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16" : "mb-5"}`}
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
        <div className="relative grid gap-4 p-4 sm:p-5 lg:grid-cols-[290px_minmax(0,1fr)_300px_auto] lg:items-center lg:gap-5">
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
        <p className="relative border-t border-white/10 px-4 py-2 text-[9px] leading-relaxed text-white/55 sm:px-5 sm:text-[10px]">
          *Até 30/09/2026. Consulte condições, veículos participantes,
          disponibilidade e aprovação de crédito.
        </p>
      </div>
    </section>
  );
}
