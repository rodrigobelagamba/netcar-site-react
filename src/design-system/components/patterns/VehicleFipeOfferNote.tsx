import { useEffect, useState } from "react";
import reviewedOffers from "@/data/vehicle-fipe-offers.json";
import { factoryWarrantyToday } from "@/lib/factoryWarranty";
import type { ReviewedFipeOffer, VehicleFipeOffer } from "@/lib/vehicleFipeOffer";

export function VehicleFipeOfferNote({ offer, compact = false }: { offer?: VehicleFipeOffer; compact?: boolean }) {
  if (!offer) return null;
  return (
    <div data-fipe-offer-id={offer.vehicleId} className={`flex w-full min-w-0 justify-center ${compact ? "py-1" : "py-3"}`}>
      <div
        role="img"
        aria-label={offer.label}
        className={`relative isolate flex max-w-full flex-col items-center justify-center rounded-[50%] border border-[#CCB67B] bg-[#003F3B] text-center text-[#F8EBC9] shadow-[0_5px_14px_rgba(0,40,60,0.13)] ${compact ? "aspect-[7/5] w-[140px] px-3 py-3" : "aspect-[7/5] w-[210px] px-5 py-5"}`}
      >
        <span aria-hidden="true" className={`pointer-events-none absolute rounded-[50%] border border-[#E1CA92]/50 ${compact ? "inset-[4px]" : "inset-[6px]"}`} />
        <div aria-hidden="true" className="relative flex flex-col items-center">
          <span className={`font-normal leading-none text-[#F8EBC9] ${compact ? "text-[9px]" : "text-[11px]"}`}>
            {offer.qualifier}
          </span>
          <strong className={`mt-1 flex items-baseline justify-center gap-1 font-black leading-none tracking-[-0.055em] text-[#F3DEAA] ${compact ? "text-[36px]" : "text-[54px]"}`}>
            <span className={`font-semibold tracking-normal ${compact ? "text-[13px]" : "text-lg"}`}>R$</span>
            <span>10</span>
            <span className={`font-semibold tracking-[-0.035em] ${compact ? "text-[23px]" : "text-[34px]"}`}>mil</span>
          </strong>
          <span className={`mt-1.5 border-t border-[#E1CA92]/40 pt-1.5 font-bold uppercase leading-none tracking-[0.08em] ${compact ? "text-[10px]" : "text-[13px]"}`}>
            Abaixo da FIPE
          </span>
        </div>
      </div>
    </div>
  );
}

const money = (value: number) => `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
const referenceMonths = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Audit context belongs in the existing informational footer, not in the seal.
 * This records the reviewed comparison; it never asserts a live asking price. */
export function VehicleFipeReference({ records = reviewedOffers.offers, now }: { records?: readonly ReviewedFipeOffer[]; now?: number } = {}) {
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (now !== undefined) return;
    const update = () => setClock(Date.now());
    const timer = setInterval(update, 60_000);
    window.addEventListener("focus", update);
    return () => { clearInterval(timer); window.removeEventListener("focus", update); };
  }, [now]);
  const currentTime = now ?? clock;
  if (!Number.isFinite(currentTime)) return null;
  const today = factoryWarrantyToday(new Date(currentTime));
  const references = records.filter((record) => {
    if (record.vehicleId !== "20138" || record.status !== "approved" || !record.claim ||
      record.claim.kind !== "approximately" || record.claim.amount !== 10000 || record.claim.approvedOn > today ||
      record.reference.month !== today.slice(0, 7) || record.reference.modelYear !== record.identity.modelYear ||
      !Number.isSafeInteger(record.expectedPrice) || record.expectedPrice <= 0 ||
      record.approvedSavings !== 9452 ||
      record.reference.value - record.expectedPrice !== record.approvedSavings) return false;
    const consultedAt = Date.parse(record.reference.consultedAt);
    if (!Number.isFinite(consultedAt) || consultedAt > currentTime || factoryWarrantyToday(new Date(consultedAt)).slice(0, 7) !== record.reference.month) return false;
    try {
      const source = new URL(record.reference.sourceUrl);
      return source.origin === "https://veiculos.fipe.org.br" && !source.username && !source.password;
    } catch { return false; }
  });
  if (!references.length) return null;
  return (
    <details className="border-t border-border" data-fipe-reference-footer>
      <summary className="cursor-pointer py-3.5 text-xs font-semibold text-fg hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
        Referência FIPE
      </summary>
      <div className="space-y-3 pb-4 text-xs leading-relaxed text-muted-foreground">
        {references.map((record) => (
          <p key={record.vehicleId} data-fipe-reference-id={record.vehicleId}>
            <strong>{record.reference.model}, {record.identity.manufactureYear}/{record.identity.modelYear} (ID {record.vehicleId}).</strong>{" "}
            Referência FIPE de {referenceMonths[Number(record.reference.month.slice(5)) - 1]}/{record.reference.month.slice(0, 4)}: {money(record.reference.value)}.{" "}
            Na comparação registrada, o preço considerado foi {money(record.expectedPrice)}, com diferença exata de {money(record.approvedSavings)}.{" "}
            A expressão “aproximadamente R$ 10 mil abaixo da FIPE” arredonda essa diferença e se aplica somente a esta unidade enquanto o selo estiver exibido.{" "}
            <a href={record.reference.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#00616A] underline underline-offset-2 hover:text-primary">
              Consulta oficial FIPE · código {record.reference.code}
            </a>
          </p>
        ))}
      </div>
    </details>
  );
}
