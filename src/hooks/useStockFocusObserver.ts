import { useEffect, useRef, type RefObject } from "react";
import type { VehicleFocusPayload } from "@/design-system/components/patterns/VehicleCard";

const FOCUS_MIN_RATIO = 0.35;

/** Um observer pra vários cards — escolhe o mais visível. Também usado com hover (callback direto). */
export function useStockFocusObserver(
  rootRef: RefObject<HTMLElement | null>,
  onVehicleFocus: ((vehicle: VehicleFocusPayload) => void) | undefined,
  /** Muda quando a lista de cards muda (ex.: array de veículos). */
  observeKey?: unknown,
) {
  const ratiosRef = useRef<Map<Element, number>>(new Map());
  const lastFocusedIdRef = useRef<string | null>(null);
  const settleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!onVehicleFocus) return;
    const root = rootRef.current;
    if (!root) return;

    const pickBest = () => {
      let bestEl: Element | null = null;
      let bestRatio = FOCUS_MIN_RATIO;

      ratiosRef.current.forEach((ratio, el) => {
        if (ratio >= bestRatio) {
          bestRatio = ratio;
          bestEl = el;
        }
      });

      if (!bestEl) return;

      const el = bestEl as HTMLElement;
      const id = el.dataset.vehicleId;
      if (!id || id === lastFocusedIdRef.current) return;

      const label = el.dataset.vehicleLabel?.trim();
      const priceLabel = el.dataset.vehiclePrice?.trim();
      const image = el.dataset.vehicleImage?.trim();
      if (!label || !priceLabel || !image) return;

      lastFocusedIdRef.current = id;
      onVehicleFocus({ id, label, priceLabel, image });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            ratiosRef.current.set(entry.target, entry.intersectionRatio);
          } else {
            ratiosRef.current.delete(entry.target);
          }
        }

        if (settleTimerRef.current) {
          window.clearTimeout(settleTimerRef.current);
        }
        settleTimerRef.current = window.setTimeout(pickBest, 200);
      },
      {
        threshold: [0, 0.25, 0.35, 0.5, 0.65, 0.8],
        rootMargin: "0px 0px -18% 0px",
      },
    );

    const cards = root.querySelectorAll("[data-stock-focus-card]");
    cards.forEach((card) => observer.observe(card));

    return () => {
      observer.disconnect();
      ratiosRef.current.clear();
      if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current);
    };
  }, [onVehicleFocus, rootRef, observeKey]);
}
