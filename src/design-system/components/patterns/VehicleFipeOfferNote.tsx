import type { VehicleFipeOffer } from "@/lib/vehicleFipeOffer";

export function VehicleFipeOfferNote({ offer, compact = false }: { offer?: VehicleFipeOffer; compact?: boolean }) {
  if (!offer) return null;
  return (
    <div data-fipe-offer-id={offer.vehicleId} className={`w-full min-w-0 rounded-lg bg-[#e5f3ec] px-2 py-1.5 text-[#075E54] ${compact ? "text-left" : "text-center"}`}>
      <p aria-label={offer.label} className="leading-snug">
        <span className={`block font-normal ${compact ? "text-[10px]" : "text-xs"}`}>
          {offer.qualifier}
        </span>
        <strong className={`block font-black ${compact ? "text-[clamp(13px,3.8vw,16px)]" : "text-lg sm:text-xl"}`}>
          {offer.headline}
        </strong>
      </p>
      <p className={`mt-0.5 leading-snug ${compact ? "text-[10px]" : "text-xs"}`}>
        Diferença: {offer.savingsLabel}<br />{offer.referenceLabel}
      </p>
    </div>
  );
}
