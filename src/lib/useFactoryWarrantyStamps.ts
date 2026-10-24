import { useCallback, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { factoryWarrantyToday, type FactoryWarrantyMatrix, type WarrantyCatalogVehicle } from "./factoryWarranty";
import { parsePublishedWarrantyRegistry } from "./factoryWarrantyRegistryShape";
import {
  factoryWarrantyVehicleFor,
  factoryWarrantyStampFor,
  factoryPowertrainStampFor,
  factoryTractionBatteryStampFor,
} from "./factoryWarrantyStamp";

export const WARRANTY_REFRESH_MS = 60_000;
// Leave one clock tick of margin: an active tab hides stale badges within 5min.
export const WARRANTY_MAX_AGE_MS = 5 * WARRANTY_REFRESH_MS - 15_000;

// A single safety tick also expires stamps when every request fails. Consumers
// observe freshness/day changes, not the timestamp of each tick.
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
function updateClock() {
  listeners.forEach((notify) => notify());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    timer = setInterval(updateClock, 15_000);
    if (typeof window !== "undefined") window.addEventListener("focus", updateClock);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", updateClock);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = undefined;
      if (typeof window !== "undefined") window.removeEventListener("focus", updateClock);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", updateClock);
    }
  };
}

const noop = () => {};
const subscribeWithoutClock = () => noop;
const getServerDay = () => null;
let cachedMinute: number | undefined;
let cachedDay: string;
function warrantyDay(now: number) {
  // The Sao Paulo civil day changes on a minute boundary. Share formatting
  // across all cards, including multiple snapshot reads in the same render.
  const minute = Math.floor(now / 60_000);
  if (minute !== cachedMinute) {
    cachedDay = factoryWarrantyToday(new Date(now));
    cachedMinute = minute;
  }
  return cachedDay;
}

export function warrantySnapshotIsFresh(observedAt: unknown, now = Date.now()) {
  return typeof observedAt === "number" && Number.isFinite(observedAt) &&
    observedAt <= now && now - observedAt < WARRANTY_MAX_AGE_MS;
}

export async function fetchPublishedWarrantyRegistry(signal?: AbortSignal): Promise<FactoryWarrantyMatrix> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 15_000);
  try {
    const response = await fetch(`/seo/factory-warranty-registry.json?v=${Math.floor(Date.now() / WARRANTY_REFRESH_MS)}`, {
      cache: "no-store", signal: controller.signal,
    });
    if (!response.ok) throw new Error("Registro de garantias indisponível");
    const body = await response.text();
    if (body.length > 1_000_000) throw new Error("Registro de garantias fora do limite");
    return parsePublishedWarrantyRegistry(JSON.parse(body));
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

/** Both current stock and published rules must be fresh before any badge. */
export function useFactoryWarrantyStamps(vehicle?: WarrantyCatalogVehicle & {
  factoryWarrantyVehicle?: WarrantyCatalogVehicle | null;
}) {
  const query = useQuery({
    queryKey: ["factory-warranty-registry"],
    queryFn: ({ signal }) => fetchPublishedWarrantyRegistry(signal),
    staleTime: WARRANTY_REFRESH_MS,
    refetchInterval: WARRANTY_REFRESH_MS,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    retry: 1,
  });
  const original = vehicle && factoryWarrantyVehicleFor(vehicle);
  const observedAt = original?.observedAt;
  const hasRegistry = Boolean(query.data);
  const registryUpdatedAt = query.dataUpdatedAt;
  const getDaySnapshot = useCallback(() => {
    const now = Date.now();
    if (!hasRegistry ||
      !warrantySnapshotIsFresh(observedAt, now) ||
      !warrantySnapshotIsFresh(registryUpdatedAt, now)) return null;
    return warrantyDay(now);
  }, [observedAt, hasRegistry, registryUpdatedAt]);
  const today = useSyncExternalStore(
    original && hasRegistry ? subscribe : subscribeWithoutClock,
    getDaySnapshot,
    getServerDay,
  );
  if (!original || !query.data || !today) return {};
  return {
    warrantyStamp: factoryWarrantyStampFor(vehicle!, query.data, today),
    powertrainStamp: factoryPowertrainStampFor(vehicle!, query.data, today),
    tractionBatteryStamp: factoryTractionBatteryStampFor(vehicle!, query.data, today),
  };
}
