import { useEffect, useState } from "react";
import reviewedOffers from "@/data/vehicle-fipe-offers.json";
import { factoryWarrantyToday } from "@/lib/factoryWarranty";
import type { ReviewedFipeOffer, VehicleFipeOffer } from "@/lib/vehicleFipeOffer";

export function VehicleFipeOfferNote({ offer, compact = false }: { offer?: VehicleFipeOffer; compact?: boolean }) {
  if (!offer) return null;
  return (
    <div data-fipe-offer-id={offer.vehicleId} className={`flex w-full min-w-0 justify-center ${compact ? "py-1" : "py-2"}`}>
      <div
        role="img"
        aria-label={offer.label}
        className={`relative isolate flex max-w-full items-center justify-center rounded-xl border border-[#C8DBCF] bg-[#EAF3ED] text-[#164B3B] ${compact ? "w-[220px] flex-col px-2 py-2" : "w-[280px] gap-4 px-5 py-3"}`}
      >
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-[#377B54]" />
        <div aria-hidden="true" className={`flex shrink-0 flex-col ${compact ? "items-center" : "items-start"}`}>
          <span className="text-[10px] font-medium leading-tight tracking-[0.01em] text-[#446653]">
            {offer.qualifier}
          </span>
          <strong className={`mt-0.5 flex items-baseline gap-1 font-extrabold leading-none tracking-[-0.04em] ${compact ? "text-[30px]" : "text-[42px]"}`}>
            <span className={`mr-0.5 font-semibold tracking-normal ${compact ? "text-xs" : "text-sm"}`}>R$</span>
            <span>10</span>
            <span className={`font-semibold tracking-[-0.02em] ${compact ? "text-xl" : "text-2xl"}`}>mil</span>
          </strong>
        </div>
        <div aria-hidden="true" className={`flex shrink-0 ${compact ? "mt-1 items-baseline gap-1" : "flex-col items-start border-l border-[#BBD2C3] py-1.5 pl-4"}`}>
          <span className={`font-medium leading-tight text-[#446653] ${compact ? "text-[11px]" : "text-xs"}`}>
            Abaixo da
          </span>
          <span className={`font-bold leading-tight tracking-[0.025em] ${compact ? "text-[11px]" : "text-[21px]"}`}>FIPE</span>
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
