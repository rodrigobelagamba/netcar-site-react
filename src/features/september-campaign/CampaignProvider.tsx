import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getSeptemberCampaignCountdown,
  getSeptemberCampaignPhase,
  type CampaignCountdown,
  type SeptemberCampaignPhase,
} from "./campaign";

type CampaignContextValue = {
  phase: SeptemberCampaignPhase;
  isActive: boolean;
  countdown: CampaignCountdown;
};

type CampaignStatusValue = Omit<CampaignContextValue, "countdown">;

const CampaignStatusContext = createContext<CampaignStatusValue | null>(null);
const CampaignCountdownContext = createContext<CampaignCountdown | null>(null);

export function CampaignProvider({ children }: { children: ReactNode }) {
  const [now, setNow] = useState(() => Date.now());
  const phase = getSeptemberCampaignPhase(now);

  useEffect(() => {
    const syncClock = () => setNow(Date.now());

    window.addEventListener("focus", syncClock);
    window.addEventListener("pageshow", syncClock);
    document.addEventListener("visibilitychange", syncClock);

    const timer =
      phase === "ended" ? null : window.setInterval(syncClock, 1000);

    return () => {
      if (timer !== null) window.clearInterval(timer);
      window.removeEventListener("focus", syncClock);
      window.removeEventListener("pageshow", syncClock);
      document.removeEventListener("visibilitychange", syncClock);
    };
  }, [phase]);

  const status = useMemo<CampaignStatusValue>(
    () => ({
      phase,
      isActive: phase === "active",
    }),
    [phase],
  );
  const countdown = useMemo(() => getSeptemberCampaignCountdown(now), [now]);

  return (
    <CampaignStatusContext.Provider value={status}>
      <CampaignCountdownContext.Provider value={countdown}>
        {children}
      </CampaignCountdownContext.Provider>
    </CampaignStatusContext.Provider>
  );
}

export function useSeptemberCampaign(): CampaignContextValue {
  const status = useContext(CampaignStatusContext);
  const countdown = useContext(CampaignCountdownContext);
  if (!status || !countdown) {
    throw new Error(
      "useSeptemberCampaign must be used inside CampaignProvider",
    );
  }
  return { ...status, countdown };
}

/** Assinatura estável: cards só renderizam novamente no início ou no fim. */
export function useSeptemberCampaignActive(): boolean {
  const status = useContext(CampaignStatusContext);
  if (!status) {
    throw new Error(
      "useSeptemberCampaignActive must be used inside CampaignProvider",
    );
  }
  return status.isActive;
}
