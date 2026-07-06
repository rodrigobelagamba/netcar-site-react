/**
 * Analytics helpers — dataLayer para GTM/Ads + GA4 direto só em page view.
 * whatsapp_click: um único push no dataLayer (GTM dispara conversão).
 * Não usar gtag("event") aqui: gtag() também escreve no dataLayer e duplicava hit Ads.
 */

export const GA4_MEASUREMENT_ID = "G-MGPNBDNQ9G";

export type WhatsAppClickSource =
  | "hero"
  | "sidebar_primary"
  | "sidebar_action"
  | "ian_floater"
  | "header"
  | "footer"
  | "form"
  | "service"
  | "landing"
  | "contato"
  | "link"
  | "other";

export interface WhatsAppClickParams {
  source: WhatsAppClickSource;
  intent?: string;
  vehicleId?: string | number;
  vehicleName?: string;
  pagePath?: string;
}

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    __netcarAnalyticsInit?: boolean;
  }
}

function getPagePath(): string {
  return typeof window !== "undefined"
    ? `${window.location.pathname}${window.location.search}`
    : "/";
}

function inferPageType(pagePath: string): string {
  if (pagePath.startsWith("/veiculo/")) return "vehicle_detail";
  if (pagePath === "/") return "home";
  if (pagePath.startsWith("/contato")) return "contact";
  return "other";
}

const WA_CLICK_DEDUP_MS = 400;
let lastWhatsAppTrackKey = "";
let lastWhatsAppTrackAt = 0;

function shouldSkipDuplicateWhatsAppTrack(key: string): boolean {
  const now = Date.now();
  if (key === lastWhatsAppTrackKey && now - lastWhatsAppTrackAt < WA_CLICK_DEDUP_MS) {
    return true;
  }
  lastWhatsAppTrackKey = key;
  lastWhatsAppTrackAt = now;
  return false;
}

export function pushDataLayer(payload: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
}

export function trackPageView(path?: string, title?: string): void {
  const pagePath = path ?? getPagePath();
  const pageTitle = title ?? (typeof document !== "undefined" ? document.title : "");
  const pageLocation = typeof window !== "undefined" ? window.location.href : "";

  pushDataLayer({
    event: "virtual_page_view",
    page_path: pagePath,
    page_title: pageTitle,
    page_location: pageLocation,
  });

  if (typeof window.gtag === "function") {
    window.gtag("config", GA4_MEASUREMENT_ID, {
      page_path: pagePath,
      page_title: pageTitle,
      page_location: pageLocation,
    });
  }
}

export function trackWhatsAppClick(params: WhatsAppClickParams): void {
  const pagePath = params.pagePath ?? getPagePath();
  const dedupKey = [
    pagePath,
    params.source,
    params.intent ?? "general",
    params.vehicleId ?? "",
  ].join("|");

  if (shouldSkipDuplicateWhatsAppTrack(dedupKey)) return;

  pushDataLayer({
    event: "whatsapp_click",
    wa_source: params.source,
    wa_intent: params.intent ?? "general",
    wa_vehicle_id: params.vehicleId != null ? String(params.vehicleId) : undefined,
    wa_vehicle_name: params.vehicleName,
    wa_page_type: inferPageType(pagePath),
    page_path: pagePath,
  });

  if (typeof window.fbq === "function") {
    window.fbq("trackCustom", "WhatsAppClick", {
      source: params.source,
      intent: params.intent ?? "general",
    });
  }
}

export function openWhatsApp(url: string, params: WhatsAppClickParams): void {
  if (!url || url === "#") return;
  trackWhatsAppClick(params);
  window.open(url, "_blank", "noopener,noreferrer");
}

function inferSourceFromElement(el: HTMLElement): WhatsAppClickSource {
  const tagged = el.closest("[data-wa-source]");
  if (tagged) {
    return (tagged.getAttribute("data-wa-source") as WhatsAppClickSource) || "link";
  }
  if (el.closest("header")) return "header";
  if (el.closest("footer")) return "footer";
  if (el.closest("#conteudo-principal")) return "link";
  return "link";
}

/** Delegação global: captura cliques em links wa.me (GTM link trigger falha no SPA). */
export function initAnalytics(): void {
  if (typeof window === "undefined" || window.__netcarAnalyticsInit) return;
  window.__netcarAnalyticsInit = true;

  document.addEventListener(
    "click",
    (event) => {
      const anchor = (event.target as Element | null)?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const href = anchor.href || "";
      if (!/wa\.me|api\.whatsapp\.com/i.test(href)) return;
      trackWhatsAppClick({
        source: inferSourceFromElement(anchor),
        intent: anchor.getAttribute("data-wa-intent") ?? "link_click",
        vehicleId: anchor.getAttribute("data-wa-vehicle-id") ?? undefined,
        vehicleName: anchor.getAttribute("data-wa-vehicle-name") ?? undefined,
      });
    },
    true,
  );
}
