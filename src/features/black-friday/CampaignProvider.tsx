import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  BLACK_FRIDAY_REFRESH_MS,
  fetchBlackFridayConfig,
  getBlackFridayBoundaryDelay,
  isBlackFridayActive,
  type BlackFridayCampaignConfig,
} from "./campaign";

interface CampaignState {
  active: boolean;
  config: BlackFridayCampaignConfig | null;
}

const CampaignContext = createContext<CampaignState>({ active: false, config: null });

export function BlackFridayCampaignProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<BlackFridayCampaignConfig | null>(null);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    let mounted = true;
    let currentRequest: AbortController | null = null;

    const refresh = async () => {
      setNow(Date.now());
      currentRequest?.abort();
      const request = new AbortController();
      currentRequest = request;
      const timeout = window.setTimeout(() => request.abort(), 10_000);
      const nextConfig = await fetchBlackFridayConfig(fetch, request.signal);
      window.clearTimeout(timeout);
      // A superseded request must never turn a newer response back on or off.
      if (mounted && currentRequest === request) {
        setConfig(nextConfig);
        setNow(Date.now());
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };

    void refresh();
    const interval = window.setInterval(() => void refresh(), BLACK_FRIDAY_REFRESH_MS);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      mounted = false;
      currentRequest?.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    const delay = getBlackFridayBoundaryDelay(now);
    if (delay === null) return;
    const timeout = window.setTimeout(() => setNow(Date.now()), delay);
    return () => window.clearTimeout(timeout);
  }, [now]);

  return (
    <CampaignContext.Provider value={{ active: isBlackFridayActive(config, now), config }}>
      {children}
    </CampaignContext.Provider>
  );
}

export function useBlackFridayCampaign(): CampaignState {
  return useContext(CampaignContext);
}
