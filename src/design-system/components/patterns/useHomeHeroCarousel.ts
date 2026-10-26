import { useCallback, useEffect, useRef, useState } from "react";

export const HERO_PHOTO_FADE_MS = 550;
export const HERO_PHOTO_LOAD_TIMEOUT_MS = 10000;

interface HeroPhoto {
  id: string;
  image: string;
}

interface PhotoSwap<T> {
  request: number;
  from: T;
  target: T;
  phase: "loading" | "fading";
}

/** Prepare only the requested photo; keep the current vehicle until it is ready. */
export function useHomeHeroCarousel<T extends HeroPhoto>(vehicles: T[]) {
  const [activeId, setActiveId] = useState(vehicles[0]?.id);
  const [swap, setSwap] = useState<PhotoSwap<T> | null>(null);
  const [hasSwitched, setHasSwitched] = useState(false);
  const active =
    vehicles.find((vehicle) => vehicle.id === activeId) || vehicles[0];
  const latest = useRef({ vehicles, active });
  latest.current = { vehicles, active };
  const requestSequence = useRef(0);
  const pending = useRef<PhotoSwap<T> | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (activeId !== active?.id) setActiveId(active?.id);
  }, [activeId, active?.id]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pending.current = null;
    };
  }, []);

  const clearSwap = useCallback(() => {
    pending.current = null;
    setSwap(null);
  }, []);

  const step = useCallback((direction: number) => {
    const { vehicles: available, active: current } = latest.current;
    if (!mounted.current || pending.current || !current || available.length < 2)
      return;
    const index = available.findIndex((vehicle) => vehicle.id === current.id);
    const target =
      available[(index + direction + available.length) % available.length];
    const request: PhotoSwap<T> = {
      request: ++requestSequence.current,
      from: current,
      target,
      phase: "loading",
    };
    pending.current = request;
    setSwap(request);
  }, []);

  const ready = useCallback(
    (request: number) => {
      const current = pending.current;
      if (
        !mounted.current ||
        !current ||
        current.request !== request ||
        current.phase !== "loading"
      )
        return;
      const { vehicles: available, active: selected } = latest.current;
      const target = available.find(
        (vehicle) => vehicle.id === current.target.id,
      );
      if (
        !target ||
        target.image !== current.target.image ||
        selected?.id !== current.from.id
      ) {
        clearSwap();
        return;
      }
      setActiveId(target.id);
      setHasSwitched(true);
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        clearSwap();
        return;
      }
      const fading: PhotoSwap<T> = { ...current, target, phase: "fading" };
      pending.current = fading;
      setSwap(fading);
    },
    [clearSwap],
  );

  const failed = useCallback(
    (request: number) => {
      if (mounted.current && pending.current?.request === request) clearSwap();
    },
    [clearSwap],
  );

  useEffect(() => {
    if (!swap) return;
    const target = vehicles.find((vehicle) => vehicle.id === swap.target.id);
    if (
      !target ||
      target.image !== swap.target.image ||
      (swap.phase === "loading" && active?.id !== swap.from.id)
    ) {
      clearSwap();
    }
  }, [vehicles, active?.id, swap, clearSwap]);

  useEffect(() => {
    if (!swap) return;
    const timer = window.setTimeout(
      () => failed(swap.request),
      swap.phase === "fading" ? HERO_PHOTO_FADE_MS : HERO_PHOTO_LOAD_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [swap, failed]);

  useEffect(() => {
    if (vehicles.length <= 1 || swap) return;
    const timer = window.setTimeout(() => step(1), 12000);
    return () => window.clearTimeout(timer);
  }, [active?.id, vehicles.length, swap, step]);

  const slides: {
    vehicle: T;
    state: "active" | "pending" | "outgoing";
    request?: number;
  }[] = [];
  const validSwap =
    swap &&
    vehicles.some(
      (candidate) =>
        candidate.id === swap.target.id &&
        candidate.image === swap.target.image,
    ) &&
    active?.id === (swap.phase === "loading" ? swap.from.id : swap.target.id);
  if (validSwap && swap.phase === "fading")
    slides.push({ vehicle: swap.from, state: "outgoing" });
  if (active) slides.push({ vehicle: active, state: "active" });
  if (validSwap && swap.phase === "loading")
    slides.push({
      vehicle: swap.target,
      state: "pending",
      request: swap.request,
    });

  return { active, slides, hasSwitched, step, ready, failed };
}
