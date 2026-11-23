import { ArrowLeft, ArrowRight, CalendarDays, Clock, CreditCard, FileCheck2, Fuel, MessageCircle, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import { buildWhatsAppUrl, DEFAULT_SALES_WHATSAPP, siteWhatsAppMessage, withVehicleRef, type VehicleWhatsAppRef } from "@/lib/whatsappMessages";
import { emptySeminovosSearch } from "@/lib/seminovos-search";
import { useBlackFridayCampaign } from "./CampaignProvider";
import { BLACK_FRIDAY_END_LABEL, BLACK_FRIDAY_END_SHORT_LABEL } from "./campaign";
import {
  getBlackFridayCountdownSnapshot,
  resolveBlackFridayClosingTarget,
  type BlackFridayClosingTarget,
  type BlackFridayCountdownSnapshot,
} from "./countdown";
import "./black-friday.css";

const MEDIA = "/images/campaigns/black-friday-2026";
const CLOSING_TARGET = resolveBlackFridayClosingTarget();

export const BLACK_FRIDAY_BENEFITS = [
  { icon: FileCheck2, title: "Transferência", detail: "por nossa conta" },
  { icon: CreditCard, title: "Entrada em até 10x", detail: "sem juros no cartão" },
  { icon: Fuel, title: "Tanque cheio", detail: "para sair de carro novo" },
  { icon: CalendarDays, title: "1ª parcela em janeiro", detail: "de 2027 no financiamento" },
];

function CampaignBenefits({ compact = false }: { compact?: boolean }) {
  return (
    <ul className={`bf-benefits${compact ? " bf-benefits--compact" : ""}`} aria-label="Os quatro benefícios da Black Friday">
      {BLACK_FRIDAY_BENEFITS.map(({ icon: Icon, title, detail }) => (
        <li key={title}>
          <Icon size={23} strokeWidth={1.6} aria-hidden="true" />
          <div><strong>{title}</strong><span>{detail}</span></div>
        </li>
      ))}
    </ul>
  );
}

function CampaignTerms() {
  return <p className="bf-terms">Os quatro benefícios valem juntos para todo o estoque até {BLACK_FRIDAY_END_LABEL}. Entrada em até 10x sem juros no cartão, sem limite adicional de valor. Financiamento sujeito à análise de crédito.</p>;
}

function CampaignContact({ vehicleLabel, vehicleId, waRef, source = "black_friday_home" }: {
  vehicleLabel?: string;
  vehicleId?: string | number;
  waRef?: VehicleWhatsAppRef;
  source?: string;
}) {
  const { data: whatsapp } = useWhatsAppQuery();
  const message = withVehicleRef(siteWhatsAppMessage(vehicleLabel
    ? `quero aproveitar os quatro benefícios da Black Friday no ${vehicleLabel}.`
    : "quero aproveitar os quatro benefícios da Black Friday e escolher meu próximo carro."), waRef);
  return (
    <a className="bf-button bf-button--outline" href={buildWhatsAppUrl(whatsapp?.numero || DEFAULT_SALES_WHATSAPP, message)}
      target="_blank" rel="noopener noreferrer" data-wa-source={source}
      data-wa-intent={vehicleId ? "vehicle_inquiry" : "stock_help"}
      data-wa-vehicle-id={vehicleId} data-wa-vehicle-name={vehicleLabel}>
      <MessageCircle size={19} aria-hidden="true" />
      {vehicleLabel ? "Quero os benefícios neste carro" : "Falar sobre a Black Friday"}
    </a>
  );
}

function CountdownUnit({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className={`bf-countdown-unit${accent ? " bf-countdown-unit--accent" : ""}`}>
      <div className="bf-countdown-plate" aria-hidden="true">
        <span key={value} className="bf-countdown-digit">{value}</span>
      </div>
      <span className="bf-countdown-unit-label">{label}</span>
    </div>
  );
}

function BlackFridayCountdownStage({
  target,
  snapshot,
  viewMode,
  videoError,
  onOpenVideo,
  onCloseVideo,
  onVideoError,
}: {
  target: BlackFridayClosingTarget;
  snapshot: BlackFridayCountdownSnapshot;
  viewMode: "countdown" | "video";
  videoError: boolean;
  onOpenVideo: () => void;
  onCloseVideo: () => void;
  onVideoError: () => void;
}) {
  const statusLabel = snapshot.expired
    ? "Campanha encerrada"
    : snapshot.isFinalHours
      ? "Últimas horas"
      : snapshot.isLastDay
        ? "Último dia · encerra hoje"
        : "Contagem regressiva";

  if (viewMode === "video") {
    return (
      <div className="bf-home-film bf-home-stage" data-bf-stage-mode="video">
        <div className="bf-video-topbar">
          <div className="bf-video-mini-timer" aria-label={snapshot.accessibleSummary}>
            <span className="bf-live-dot" aria-hidden="true" />
            <span className="bf-video-mini-digits">
              {snapshot.daysText}d · {snapshot.hoursText}h · {snapshot.minutesText}m · {snapshot.secondsText}s
            </span>
          </div>
          <button type="button" className="bf-video-back" data-bf-action="close-video" onClick={onCloseVideo}>
            <ArrowLeft size={14} aria-hidden="true" />
            Contador
          </button>
        </div>
        <div className="bf-video-frame">
          <video controls playsInline autoPlay preload="none" poster={`${MEDIA}/poster-v2.webp`} width="720" height="1280"
            aria-label="Vídeo da campanha Black Friday Netcar com os quatro benefícios" onError={onVideoError}>
            <source src={`${MEDIA}/black-friday-netcar-2026.mp4`} type="video/mp4" />
            <track kind="captions" src={`${MEDIA}/black-friday-pt-BR.vtt`} srcLang="pt-BR" label="Português" />
            Seu navegador não reproduz este vídeo. Os quatro benefícios estão descritos nesta página.
          </video>
        </div>
        <p className="bf-video-caption">
          {videoError
            ? <a href={`${MEDIA}/black-friday-netcar-2026.mp4`}>Abrir o vídeo da campanha</a>
            : "Vídeo oficial · 19 s com legendas em português."}
        </p>
      </div>
    );
  }

  return (
    <div className="bf-home-film bf-home-stage" data-bf-stage-mode="countdown">
      <div
        className={`bf-countdown-panel${snapshot.isLastDay ? " bf-countdown-panel--urgent" : ""}${snapshot.expired ? " bf-countdown-panel--expired" : ""}`}
        role="region"
        aria-label="Contagem regressiva da Black Friday Netcar"
      >
        <img
          className="bf-countdown-ribbon-top"
          src={`${MEDIA}/ribbon-turquoise-v2.webp`}
          alt=""
          width="1080"
          height="410"
          aria-hidden="true"
        />
        <img
          className="bf-countdown-ribbon-base"
          src={`${MEDIA}/ribbon-black.png`}
          alt=""
          width="1080"
          height="410"
          aria-hidden="true"
        />

        <div className="bf-countdown-content">
          <div className="bf-countdown-header">
            <span className="bf-countdown-status">
              <span className="bf-live-dot" aria-hidden="true" />
              {statusLabel}
            </span>
            <span className="bf-countdown-badge">
              Até {target.dateLabel} · {target.timeLabel}
            </span>
          </div>

          <div className="bf-countdown-heading">
            <p className="bf-countdown-kicker">Reta final da campanha</p>
            <p className="bf-countdown-title">
              {snapshot.expired ? "Encerramento atingido" : "Falta pouco para acabar"}
            </p>
          </div>

          <p className="bf-sr-only" role="status" aria-live="off">{snapshot.accessibleSummary}</p>

          <div className="bf-countdown-grid" aria-label={snapshot.accessibleSummary}>
            <CountdownUnit value={snapshot.daysText} label={snapshot.days === 1 ? "Dia" : "Dias"} />
            <CountdownUnit value={snapshot.hoursText} label={snapshot.hours === 1 ? "Hora" : "Horas"} />
            <CountdownUnit value={snapshot.minutesText} label={snapshot.minutes === 1 ? "Minuto" : "Minutos"} />
            <CountdownUnit value={snapshot.secondsText} label={snapshot.seconds === 1 ? "Segundo" : "Segundos"} accent />
          </div>

          <div className="bf-countdown-schedule">
            <div className="bf-countdown-progress" aria-hidden="true">
              <span className="bf-countdown-progress-fill" style={{ width: `${snapshot.progressPercent}%` }} />
            </div>
            <div className="bf-countdown-closing">
              <Clock size={15} aria-hidden="true" />
              <div>
                <strong>Encerra {target.closingSummary}</strong>
                <span>Último dia aberto · fechamento das lojas (Brasília)</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="bf-video-dock"
            data-bf-action="open-video"
            onClick={onOpenVideo}
          >
            <span className="bf-video-dock-thumb" aria-hidden="true">
              <img src={`${MEDIA}/poster-v2.webp`} alt="" width="112" height="112" loading="lazy" />
              <span className="bf-video-dock-play">
                <Play size={14} fill="currentColor" />
              </span>
            </span>
            <span className="bf-video-dock-copy">
              <strong>Assistir vídeo da campanha</strong>
              <span>É hora de atualizar a garagem · 19 s</span>
            </span>
            <span className="bf-video-dock-cta" aria-hidden="true">Ver</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function useBlackFridayCountdown(active: boolean) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  const target = CLOSING_TARGET;

  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  const snapshot = useMemo(
    () => getBlackFridayCountdownSnapshot(nowMs, target),
    [nowMs, target],
  );

  return { target, snapshot };
}

export function BlackFridayHomeHero({ onViewStock }: { onViewStock: () => void }) {
  const { active } = useBlackFridayCampaign();
  const [viewMode, setViewMode] = useState<"countdown" | "video">("countdown");
  const [videoError, setVideoError] = useState(false);
  const { target, snapshot } = useBlackFridayCountdown(active);

  useEffect(() => {
    if (viewMode !== "video" || typeof window === "undefined") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewMode("countdown");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewMode]);

  if (!active) return null;

  return (
    <section className="bf-home-hero" aria-labelledby="bf-home-title" data-black-friday-surface="home">
      <div className="bf-home-inner">
        <div className="bf-home-copy">
          <p className="bf-eyebrow"><span /> Só até {target.fullDateLabel} às {target.timeLabel} · Horário de Brasília</p>
          <h1 id="bf-home-title"><img className="bf-title-image" src={`${MEDIA}/title-v2.webp`} width="529" height="150" alt="Black Friday Netcar" fetchPriority="high" /></h1>
          <h2 className="bf-home-headline">Condições especiais para<br className="bf-desktop-break" /> acelerar sua escolha.</h2>
          <p className="bf-home-lead">Seu próximo carro com <strong>quatro benefícios juntos.</strong><br />Em todo o estoque. Por tempo limitado.</p>
          <CampaignBenefits />
          <div className="bf-actions">
            <button type="button" className="bf-button bf-button--primary" onClick={onViewStock}>Confira o estoque <ArrowRight size={20} aria-hidden="true" /></button>
            <CampaignContact />
          </div>
          <CampaignTerms />
        </div>
        <BlackFridayCountdownStage
          target={target}
          snapshot={snapshot}
          viewMode={viewMode}
          videoError={videoError}
          onOpenVideo={() => { setVideoError(false); setViewMode("video"); }}
          onCloseVideo={() => setViewMode("countdown")}
          onVideoError={() => setVideoError(true)}
        />
      </div>
      <img className="bf-hero-ribbon" src={`${MEDIA}/ribbon-turquoise-v2.webp`} alt="" width="1080" height="410" aria-hidden="true" />
    </section>
  );
}

export function BlackFridayStockIntro() {
  const { active } = useBlackFridayCampaign();
  const { target, snapshot } = useBlackFridayCountdown(active);
  const conditionsRef = useRef<HTMLDetailsElement>(null);
  if (!active) return null;
  return (
    <section className="bf-stock-intro" aria-labelledby="bf-stock-title" data-black-friday-surface="stock">
      <div className="bf-wide-inner">
        <div className="bf-stock-campaign-bar">
          <div className="bf-stock-campaign-brand">
            <h2 id="bf-stock-title">
              <img src={`${MEDIA}/title-v2.webp`} width="529" height="150" alt="Black Friday Netcar" />
            </h2>
            <span className="bf-stock-countdown-pill" aria-label={snapshot.accessibleSummary} data-bf-stock-countdown="pill">
              <span className="bf-live-dot" aria-hidden="true" />
              <span className="bf-stock-countdown-pill-digits">
                {snapshot.daysText}d · {snapshot.hoursText}h · {snapshot.minutesText}m · {snapshot.secondsText}s
              </span>
            </span>
          </div>
          <CampaignBenefits compact />
          <div className="bf-stock-campaign-meta">
            <div
              className={`bf-stock-countdown${snapshot.isLastDay ? " bf-stock-countdown--urgent" : ""}${snapshot.expired ? " bf-stock-countdown--expired" : ""}`}
              role="region"
              aria-label="Contagem regressiva da Black Friday Netcar"
              data-bf-stock-countdown="true"
            >
              <div className="bf-stock-countdown-head">
                <span className="bf-countdown-status">
                  <span className="bf-live-dot" aria-hidden="true" />
                  {snapshot.expired ? "Encerrada" : snapshot.isLastDay ? "Último dia" : "Acaba em"}
                </span>
                <span className="bf-stock-countdown-closing">
                  Até {target.dateLabel} · {target.timeLabel}
                </span>
              </div>
              <p className="bf-sr-only" role="status" aria-live="off">{snapshot.accessibleSummary}</p>
              <div className="bf-stock-countdown-grid" aria-label={snapshot.accessibleSummary}>
                <CountdownUnit value={snapshot.daysText} label={snapshot.days === 1 ? "Dia" : "Dias"} />
                <CountdownUnit value={snapshot.hoursText} label="Hrs" />
                <CountdownUnit value={snapshot.minutesText} label="Min" />
                <CountdownUnit value={snapshot.secondsText} label="Seg" accent />
              </div>
            </div>
            <div className="bf-stock-meta-footer">
              <span className="bf-stock-mobile-closing">Encerra {target.closingSummary}</span>
              <details id="bf-stock-conditions" ref={conditionsRef}>
                <summary>Condições da campanha</summary>
                <CampaignTerms />
              </details>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function BlackFridayVehicleRibbon() {
  const { active } = useBlackFridayCampaign();
  const { target, snapshot } = useBlackFridayCountdown(active);
  if (!active) return null;
  return (
    <a className="bf-vehicle-ribbon" href="#black-friday-beneficios" data-black-friday-surface="vehicle-ribbon">
      <strong>Black Friday Netcar</strong>
      <span>4 benefícios neste carro <span aria-hidden="true">↗</span></span>
      <span className="bf-vehicle-ribbon-timer" aria-label={snapshot.accessibleSummary}>
        <span className="bf-live-dot" aria-hidden="true" />
        <span className="bf-vehicle-ribbon-digits">
          {snapshot.daysText}d · {snapshot.hoursText}h · {snapshot.minutesText}m · {snapshot.secondsText}s
        </span>
      </span>
      <b>Até {target.dateLabel} · {target.timeLabel}</b>
    </a>
  );
}

export function BlackFridayVehicleOffer({ vehicleLabel, vehicleId, waRef }: { vehicleLabel: string; vehicleId: string | number; waRef?: VehicleWhatsAppRef }) {
  const { active } = useBlackFridayCampaign();
  const { target, snapshot } = useBlackFridayCountdown(active);
  if (!active) return null;

  const statusLabel = snapshot.expired
    ? "Campanha encerrada"
    : snapshot.isFinalHours
      ? "Últimas horas"
      : snapshot.isLastDay
        ? "Último dia · encerra hoje"
        : "Contagem regressiva";

  return (
    <section id="black-friday-beneficios" className="bf-vehicle-offer" aria-labelledby="bf-vehicle-title" data-black-friday-surface="vehicle">
      <img
        className="bf-vehicle-offer-ribbon"
        src={`${MEDIA}/ribbon-turquoise-v2.webp`}
        alt=""
        width="1080"
        height="410"
        aria-hidden="true"
      />
      <div className="bf-wide-inner">
        <div className="bf-vehicle-offer-top">
          <div className="bf-vehicle-offer-copy">
            <p className="bf-kicker">Black Friday Netcar · Até {target.fullDateLabel} às {target.timeLabel}</p>
            <h2 id="bf-vehicle-title">Este carro vem com quatro benefícios.</h2>
          </div>

          <div
            className={`bf-vehicle-countdown${snapshot.isLastDay ? " bf-vehicle-countdown--urgent" : ""}${snapshot.expired ? " bf-vehicle-countdown--expired" : ""}`}
            role="region"
            aria-label="Contagem regressiva da Black Friday Netcar"
            data-bf-vehicle-countdown="true"
          >
            <div className="bf-vehicle-countdown-head">
              <span className="bf-countdown-status">
                <span className="bf-live-dot" aria-hidden="true" />
                {statusLabel}
              </span>
              <span className="bf-vehicle-countdown-closing">
                <Clock size={12} aria-hidden="true" />
                Encerra {target.closingSummary}
              </span>
            </div>
            <p className="bf-sr-only" role="status" aria-live="off">{snapshot.accessibleSummary}</p>
            <div className="bf-vehicle-countdown-grid" aria-label={snapshot.accessibleSummary}>
              <CountdownUnit value={snapshot.daysText} label={snapshot.days === 1 ? "Dia" : "Dias"} />
              <CountdownUnit value={snapshot.hoursText} label={snapshot.hours === 1 ? "Hora" : "Horas"} />
              <CountdownUnit value={snapshot.minutesText} label={snapshot.minutes === 1 ? "Min" : "Min"} />
              <CountdownUnit value={snapshot.secondsText} label="Seg" accent />
            </div>
          </div>
        </div>

        <CampaignBenefits compact />
        <div className="bf-offer-bottom"><CampaignTerms /><CampaignContact vehicleLabel={vehicleLabel} vehicleId={vehicleId} waRef={waRef} source="black_friday_vehicle" /></div>
      </div>
    </section>
  );
}

export function BlackFridayFooterBanner() {
  const { active } = useBlackFridayCampaign();
  if (!active) return null;
  return (
    <aside className="bf-footer-banner" aria-label="Black Friday Netcar" data-black-friday-surface="footer">
      <div className="bf-wide-inner">
        <div><p className="bf-kicker">Black Friday Netcar · Até {BLACK_FRIDAY_END_SHORT_LABEL}</p><strong>A hora de trocar de carro é agora.</strong><p>Quatro benefícios juntos em todo o estoque.</p></div>
        <Link to="/seminovos" search={emptySeminovosSearch} className="bf-button bf-button--primary">Confira o estoque <ArrowRight size={20} aria-hidden="true" /></Link>
      </div>
    </aside>
  );
}
