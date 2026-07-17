import { useEffect, useRef, type RefObject } from "react";
import type { VehicleFocusPayload } from "@/design-system/components/patterns/VehicleCard";

const FOCUS_MIN_RATIO = 0.35;
/** Ignora troca se o ponteiro está na faixa do sticky (caminho do clique). */
const BOTTOM_DEADZONE_PX = 160;
const SETTLE_MS = 350;
const SWITCH_COOLDOWN_MS = 1800;

type CardScore = {
  el: HTMLElement;
  centerDist: number;
};

export type VehicleFocusSource = "scroll" | "click";

export type VehicleFocusHandler = (
  vehicle: VehicleFocusPayload,
  source: VehicleFocusSource,
) => void;

/** Um observer pra vários cards — escolhe o mais perto do centro do viewport. */
export function useStockFocusObserver(
  rootRef: RefObject<HTMLElement | null>,
  onVehicleFocus: VehicleFocusHandler | undefined,
  /** Muda quando a lista de cards muda (ex.: array de veículos). */
  observeKey?: unknown,
  /** true = não atualiza por scroll (ex.: ponteiro no sticky). */
  scrollFocusPaused = false,
) {
  const ratiosRef = useRef<Map<Element, number>>(new Map());
  const lastFocusedIdRef = useRef<string | null>(null);
  const lastSwitchAtRef = useRef(0);
  const settleTimerRef = useRef<number | null>(null);
  const pausedRef = useRef(scrollFocusPaused);
  const pointerYRef = useRef<number | null>(null);

  useEffect(() => {
    pausedRef.current = scrollFocusPaused;
  }, [scrollFocusPaused]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointerYRef.current = e.clientY;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useEffect(() => {
    if (!onVehicleFocus) return;
    const root = rootRef.current;
    if (!root) return;

    const pickBest = () => {
      if (pausedRef.current) return;

      const ptrY = pointerYRef.current;
      if (ptrY != null && window.innerHeight - ptrY < BOTTOM_DEADZONE_PX) {
        return;
      }
      if (Date.now() - lastSwitchAtRef.current < SWITCH_COOLDOWN_MS) {
        return;
      }

      const viewportCenter = window.innerHeight / 2;
      const candidates: CardScore[] = [];

      ratiosRef.current.forEach((ratio, el) => {
        if (ratio < FOCUS_MIN_RATIO) return;
        const rect = (el as HTMLElement).getBoundingClientRect();
        const cardCenter = rect.top + rect.height / 2;
        candidates.push({
          el: el as HTMLElement,
          centerDist: Math.abs(cardCenter - viewportCenter),
        });
      });

      if (candidates.length === 0) return;

      candidates.sort((a, b) => {
        if (a.centerDist !== b.centerDist) return a.centerDist - b.centerDist;
        return a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1;
      });

      const bestEl = candidates[0].el;
      const id = bestEl.dataset.vehicleId;
      if (!id || id === lastFocusedIdRef.current) return;

      const label = bestEl.dataset.vehicleLabel?.trim();
      const priceLabel = bestEl.dataset.vehiclePrice?.trim();
      const image = bestEl.dataset.vehicleImage?.trim();
      if (!label || !priceLabel || !image) return;

      lastFocusedIdRef.current = id;
      lastSwitchAtRef.current = Date.now();
      onVehicleFocus({ id, label, priceLabel, image }, "scroll");
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
        settleTimerRef.current = window.setTimeout(pickBest, SETTLE_MS);
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
