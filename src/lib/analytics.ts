/**
 * Analytics helpers — dataLayer para GTM/Ads + GA4 direto só em page view.
 * whatsapp_click: objeto com wa_ads_conversion=true dispara Ads.
 * gtag direto envia ao GA4 com wa_ads_conversion=false para não repetir Ads.
 */

import {
  appendWaRefToUrl,
  captureTrafficSource,
  getOrCreateClickCode,
  getTrafficSource,
} from "@/lib/waTracking";

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

export type AnalyticsPageType =
  | "home"
  | "contact"
  | "city_buy"
  | "city_sell"
  | "regional_hub"
  | "brand_landing"
  | "vehicle_detail"
  | "other";

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

export function inferPageType(pagePath: string): AnalyticsPageType {
  const pathname = pagePath.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  if (pathname.startsWith("/veiculo/")) return "vehicle_detail";
  if (
    pathname.includes("regiao-metropolitana") ||
    pathname === "/regioes-atendidas" ||
    pathname.startsWith("/regiao-") ||
    pathname.startsWith("/grande-porto-alegre")
  ) {
    return "regional_hub";
  }
  if (pathname.startsWith("/vender-carro-")) return "city_sell";
  if (pathname.startsWith("/seminovos-") && pathname !== "/seminovos-automaticos") {
    return "city_buy";
  }
  if (pathname.startsWith("/comprar-")) return "brand_landing";
  if (pathname === "/") return "home";
  if (pathname.startsWith("/contato")) return "contact";
  return "other";
}

function getRegionalDimensions(pagePath: string): Record<string, string> {
  const pathname = pagePath.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  const pageType = inferPageType(pathname);

  if (pageType === "city_buy") {
    return { regional_city_slug: pathname.replace("/seminovos-", "") };
  }
  if (pageType === "city_sell") {
    return { regional_city_slug: pathname.replace("/vender-carro-", "") };
  }
  if (pageType === "brand_landing") {
    return { landing_slug: pathname.replace("/comprar-", "") };
  }
  return {};
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

/** Evento GA4: visualização de página de veículo (funil Browse → Detalhe → WA). */
export function trackViewItem(params: {
  vehicleId: string | number;
  vehicleName: string;
  price?: number;
  currency?: string;
}): void {
  pushDataLayer({
    event: "view_item",
    ecommerce: {
      items: [
        {
          item_id: String(params.vehicleId),
          item_name: params.vehicleName,
          price: params.price,
          currency: params.currency ?? "BRL",
        },
      ],
    },
  });
}

/** Evento GA4: usuário aplicou filtro no estoque. */
export function trackStockFilterApply(params: {
  filters: Record<string, string | undefined>;
  resultCount: number;
}): void {
  pushDataLayer({
    event: "stock_filter_apply",
    filters: params.filters,
    result_count: params.resultCount,
  });
}

/** Evento GA4: scroll 50% na Home (engajamento). */
export function trackHomeScrollDepth(depthPercent: number): void {
  pushDataLayer({
    event: "scroll_depth_home",
    scroll_depth_percent: depthPercent,
  });
}

export function trackPageView(path?: string, title?: string): void {
  const pagePath = path ?? getPagePath();
  const pageTitle = title ?? (typeof document !== "undefined" ? document.title : "");
  const pageLocation = typeof window !== "undefined" ? window.location.href : "";
  const pageType = inferPageType(pagePath);
  const regionalDimensions = getRegionalDimensions(pagePath);

  pushDataLayer({
    event: "virtual_page_view",
    page_path: pagePath,
    page_title: pageTitle,
    page_location: pageLocation,
    page_type: pageType,
    ...regionalDimensions,
  });

  if (["city_buy", "city_sell", "regional_hub"].includes(pageType)) {
    pushDataLayer({
      event: "regional_landing_view",
      page_type: pageType,
      page_path: pagePath,
      ...regionalDimensions,
    });
  }

  if (typeof window.gtag === "function") {
    window.gtag("config", GA4_MEASUREMENT_ID, {
      page_path: pagePath,
      page_title: pageTitle,
      page_location: pageLocation,
      page_type: pageType,
      ...regionalDimensions,
    });
  }
}

/** Evento para CTAs de páginas regionais e landings de estoque. */
export function trackRegionalCtaClick(action: string, pagePath = getPagePath()): void {
  const pageType = inferPageType(pagePath);
  if (!["city_buy", "city_sell", "regional_hub", "brand_landing"].includes(pageType)) {
    return;
  }

  pushDataLayer({
    event: "regional_cta_click",
    regional_action: action,
    page_type: pageType,
    page_path: pagePath,
    ...getRegionalDimensions(pagePath),
  });

  if (action.includes("stock") || action.startsWith("city_buy_")) {
    pushDataLayer({
      event: "regional_stock_click",
      regional_action: action,
      page_type: pageType,
      page_path: pagePath,
      ...getRegionalDimensions(pagePath),
    });
  }
}

export function trackTrustSectionView(
  section: string,
  pagePath = getPagePath(),
): void {
  pushDataLayer({
    event: "trust_section_view",
    trust_section: section,
    page_type: inferPageType(pagePath),
    page_path: pagePath,
    ...getRegionalDimensions(pagePath),
  });
}

export function trackSellEvaluation(
  stage: "start" | "completed",
  cityName?: string,
  pagePath = getPagePath(),
): void {
  pushDataLayer({
    event: `sell_evaluation_${stage}`,
    city_name: cityName,
    page_type: inferPageType(pagePath),
    page_path: pagePath,
    ...getRegionalDimensions(pagePath),
  });
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

  const traffic = getTrafficSource();
  const waRef = getOrCreateClickCode();

  pushDataLayer({
    event: "whatsapp_click",
    wa_ads_conversion: true,
    wa_source: params.source,
    wa_intent: params.intent ?? "general",
    wa_vehicle_id: params.vehicleId != null ? String(params.vehicleId) : undefined,
    wa_vehicle_name: params.vehicleName,
    wa_page_type: inferPageType(pagePath),
    wa_ref: waRef,
    traffic_source: traffic.src,
    traffic_campaign: traffic.campaign,
    page_path: pagePath,
    ...getRegionalDimensions(pagePath),
  });

  // Data Layer v2 persiste valores entre eventos. O false explícito é essencial:
  // limpa o estado antes do gtag; sem isso, ele herdaria true e repetiria Ads.
  if (typeof window.gtag === "function") {
    pushDataLayer({ wa_ads_conversion: false });
    window.gtag("event", "whatsapp_click", {
      send_to: GA4_MEASUREMENT_ID,
      wa_ads_conversion: false,
      wa_source: params.source,
      wa_intent: params.intent ?? "general",
      wa_vehicle_id: params.vehicleId != null ? String(params.vehicleId) : undefined,
      wa_vehicle_name: params.vehicleName,
      wa_page_type: inferPageType(pagePath),
      wa_ref: waRef,
      traffic_source: traffic.src,
      traffic_campaign: traffic.campaign,
      page_path: pagePath,
      ...getRegionalDimensions(pagePath),
    });
  }

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
  window.open(appendWaRefToUrl(url), "_blank", "noopener,noreferrer");
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

  captureTrafficSource();

  document.addEventListener(
    "click",
    (event) => {
      const anchor = (event.target as Element | null)?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const regionalAction = anchor.getAttribute("data-regional-action");
      if (regionalAction) {
        trackRegionalCtaClick(regionalAction);
      }
      const href = anchor.href || "";
      if (!/wa\.me|api\.whatsapp\.com/i.test(href)) return;
      // Anexa (M482) no text antes do navegador seguir o link.
      anchor.href = appendWaRefToUrl(href);
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
