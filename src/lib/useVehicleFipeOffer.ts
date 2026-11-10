import { useCallback, useSyncExternalStore } from "react";
import { factoryWarrantyToday } from "./factoryWarranty";
import { warrantySnapshotIsFresh } from "./useFactoryWarrantyStamps";
import { resolveVehicleFipeOffer, type FipeOfferVehicle } from "./vehicleFipeOffer";

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
const update = () => listeners.forEach((listener) => listener());
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    timer = setInterval(update, 15_000);
    if (typeof window !== "undefined") window.addEventListener("focus", update);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", update);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = undefined;
      if (typeof window !== "undefined") window.removeEventListener("focus", update);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", update);
    }
  };
}
const noop = () => {};
const subscribeWithoutClock = () => noop;
const serverSnapshot = () => null;

/** Expire an open page even when every stock refetch fails. No extra fetch. */
export function useVehicleFipeOffer(vehicle?: FipeOfferVehicle | null) {
  const observedAt = vehicle?.factoryWarrantyVehicle?.observedAt;
  const getSnapshot = useCallback(() => {
    const now = Date.now();
    return warrantySnapshotIsFresh(observedAt, now)
      ? factoryWarrantyToday(new Date(now)).slice(0, 7)
      : null;
  }, [observedAt]);
  const month = useSyncExternalStore(
    vehicle?.id === "20138" ? subscribe : subscribeWithoutClock,
    getSnapshot,
    serverSnapshot,
  );
  return month ? resolveVehicleFipeOffer(vehicle) : undefined;
}
