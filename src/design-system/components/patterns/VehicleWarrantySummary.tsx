import { useFactoryWarrantyStamps } from "@/lib/useFactoryWarrantyStamps";
import {
  FactoryWarrantyBadge,
  FactoryWarrantyNote,
} from "./FactoryWarrantyBadge";

/** The same current-data gate used by stock cards, for custom vehicle cards. */
export function VehicleWarrantySummary({
  vehicle,
  className = "",
  showNote = true,
}: {
  vehicle?: Parameters<typeof useFactoryWarrantyStamps>[0];
  className?: string;
  showNote?: boolean;
}) {
  const { warrantyStamp, tractionBatteryStamp, powertrainStamp } =
    useFactoryWarrantyStamps(vehicle);
  const stamps = [warrantyStamp, powertrainStamp, tractionBatteryStamp].filter(
    (stamp) => stamp !== undefined,
  );
  if (!stamps.length) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-3 ${className}`}
      data-vehicle-warranty-summary={vehicle?.id}
    >
      <div className="flex shrink-0 gap-2">
        {stamps.map((stamp) => (
          <div key={"scope" in stamp ? String(stamp.scope) : "basic-vehicle"} className="w-[60px] sm:w-[72px]">
            <FactoryWarrantyBadge {...stamp} variant="card" />
          </div>
        ))}
      </div>
      {showNote && (
        <div className="min-w-[8rem] flex-1 text-left">
          <FactoryWarrantyNote
            compact
            tractionBattery={!!tractionBatteryStamp}
            powertrain={powertrainStamp}
          />
        </div>
      )}
    </div>
  );
}
