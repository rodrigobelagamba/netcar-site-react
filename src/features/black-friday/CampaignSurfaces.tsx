import { ArrowRight, CalendarDays, CreditCard, FileCheck2, Fuel, MessageCircle } from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import { buildWhatsAppUrl, DEFAULT_SALES_WHATSAPP, siteWhatsAppMessage, withVehicleRef, type VehicleWhatsAppRef } from "@/lib/whatsappMessages";
import { emptySeminovosSearch } from "@/lib/seminovos-search";
import { useBlackFridayCampaign } from "./CampaignProvider";
import "./black-friday.css";

const MEDIA = "/images/campaigns/black-friday-2026";

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
  return <p className="bf-terms">Os quatro benefícios valem juntos para todo o estoque até 30/11/2026. Entrada em até 10x sem juros no cartão, sem limite adicional de valor. Financiamento sujeito à análise de crédito.</p>;
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

export function BlackFridayHomeHero({ onViewStock }: { onViewStock: () => void }) {
  const { active } = useBlackFridayCampaign();
  const [videoError, setVideoError] = useState(false);
  if (!active) return null;
  return (
    <section className="bf-home-hero" aria-labelledby="bf-home-title" data-black-friday-surface="home">
      <div className="bf-home-inner">
        <div className="bf-home-copy">
          <p className="bf-eyebrow"><span /> Só até 30 de novembro de 2026</p>
          <h1 id="bf-home-title"><img className="bf-title-image" src={`${MEDIA}/title.png`} width="529" height="150" alt="Black Friday Netcar" fetchPriority="high" /></h1>
          <h2 className="bf-home-headline">Condições especiais para<br className="bf-desktop-break" /> acelerar sua escolha.</h2>
          <p className="bf-home-lead">Seu próximo carro com <strong>quatro benefícios juntos.</strong><br />Em todo o estoque. Por tempo limitado.</p>
          <CampaignBenefits />
          <div className="bf-actions">
            <button type="button" className="bf-button bf-button--primary" onClick={onViewStock}>Confira o estoque <ArrowRight size={20} aria-hidden="true" /></button>
            <CampaignContact />
          </div>
          <CampaignTerms />
        </div>
        <div className="bf-home-film">
          <div className="bf-film-label"><span>É hora de atualizar a garagem.</span><span>▶ 19 s</span></div>
          <div className="bf-video-frame">
            <video controls playsInline preload="none" poster={`${MEDIA}/poster.jpg`} width="720" height="1280"
              aria-label="Vídeo da campanha Black Friday Netcar com os quatro benefícios" onError={() => setVideoError(true)}>
              <source src={`${MEDIA}/black-friday-netcar-2026.mp4`} type="video/mp4" />
              <track kind="captions" src={`${MEDIA}/black-friday-pt-BR.vtt`} srcLang="pt-BR" label="Português" />
              Seu navegador não reproduz este vídeo. Os quatro benefícios estão descritos nesta página.
            </video>
          </div>
          <p className="bf-video-caption">{videoError ? <a href={`${MEDIA}/black-friday-netcar-2026.mp4`}>Abrir o vídeo da campanha</a> : "Dê o play e conheça a campanha."}</p>
        </div>
      </div>
      <img className="bf-hero-ribbon" src={`${MEDIA}/ribbon-turquoise.png`} alt="" width="1080" height="410" aria-hidden="true" />
    </section>
  );
}

export function BlackFridayStockIntro() {
  const { active } = useBlackFridayCampaign();
  const conditionsRef = useRef<HTMLDetailsElement>(null);
  if (!active) return null;
  return (
    <section className="bf-stock-intro" aria-labelledby="bf-stock-title" data-black-friday-surface="stock">
      <div className="bf-wide-inner">
        <div className="bf-stock-campaign-heading">
          <h2 id="bf-stock-title"><img src={`${MEDIA}/title.png`} width="529" height="150" alt="Black Friday Netcar" /></h2>
          <div className="bf-stock-campaign-promise"><strong>Escolha seu carro.<br />Leve os quatro benefícios.</strong><span>Juntos, em todo o estoque.</span></div>
          <div className="bf-stock-campaign-deadline"><span>É só até</span><strong>30/11</strong><span>Por tempo limitado</span></div>
        </div>
        <CampaignBenefits compact />
        <div className="bf-stock-bottom"><span>Seu próximo carro está aqui.</span><a href="#bf-stock-conditions" onClick={() => { if (conditionsRef.current) conditionsRef.current.open = true; }}>Ver condições <ArrowRight size={14} aria-hidden="true" /></a></div>
        <details id="bf-stock-conditions" ref={conditionsRef}><summary>Condições da campanha</summary><CampaignTerms /></details>
      </div>
      <div className="bf-stock-campaign-strip" aria-hidden="true"><span>Black Friday</span><b>4 benefícios em todo o estoque</b><span>Só até 30/11</span></div>
    </section>
  );
}

export function BlackFridayVehicleOffer({ vehicleLabel, vehicleId, waRef }: { vehicleLabel: string; vehicleId: string | number; waRef?: VehicleWhatsAppRef }) {
  const { active } = useBlackFridayCampaign();
  if (!active) return null;
  return (
    <section id="black-friday-beneficios" className="bf-vehicle-offer" aria-labelledby="bf-vehicle-title" data-black-friday-surface="vehicle">
      <div className="bf-wide-inner">
        <div className="bf-stock-heading"><div><p className="bf-kicker">Black Friday Netcar</p><h2 id="bf-vehicle-title">Este carro vem com quatro benefícios.</h2></div><span className="bf-deadline">Só até 30/11</span></div>
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
        <div><p className="bf-kicker">Black Friday Netcar · Até 30/11</p><strong>A hora de trocar de carro é agora.</strong><p>Quatro benefícios juntos em todo o estoque.</p></div>
        <Link to="/seminovos" search={emptySeminovosSearch} className="bf-button bf-button--primary">Confira o estoque <ArrowRight size={20} aria-hidden="true" /></Link>
      </div>
    </aside>
  );
}
