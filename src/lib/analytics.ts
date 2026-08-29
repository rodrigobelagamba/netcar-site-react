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
  | "comparison"
  | "selection_process"
  | "vehicle_detail"
  | "other";

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    __netcarAnalyticsInit?: boolean;
    __netcarMetaLastPagePath?: string;
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
  if (
    pathname.startsWith("/seminovos-") &&
    pathname !== "/seminovos-automaticos"
  ) {
    return "city_buy";
  }
  if (pathname.startsWith("/comprar-")) return "brand_landing";
  if (pathname === "/comparar") return "comparison";
  if (pathname === "/como-selecionamos-nossos-carros") {
    return "selection_process";
  }
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
    const landingSlug = pathname.replace("/comprar-", "");
    const landingType =
      landingSlug === "hibridos"
        ? "hybrid"
        : /^(carros-|automaticos-|suv-ate-)/.test(landingSlug)
          ? "price"
          : /^(jeep-compass|honda-hr-v|volkswagen-t-cross|chevrolet-tracker|volkswagen-nivus|hyundai-creta|nissan-kicks|jeep-renegade)$/.test(
                landingSlug,
              )
            ? "model"
            : "brand_or_category";
    return { landing_slug: landingSlug, landing_type: landingType };
  }
  return {};
}

function getTrafficDimensions(): Record<string, string> {
  const traffic = getTrafficSource();
  const campaign = traffic.campaign ?? "";
  const content = traffic.utmContent ?? "";
  let gbpProfile = "";

  if (/^gbp(?:-|$)/.test(campaign)) {
    if (/(?:^|[_-])loja[_-]?1(?:[_-]|$)/i.test(content)) {
      gbpProfile = "loja_1";
    } else if (/(?:^|[_-])loja[_-]?2(?:[_-]|$)/i.test(content)) {
      gbpProfile = "loja_2";
    }
  }

  return {
    traffic_source: traffic.src,
    traffic_campaign: campaign,
    traffic_utm_source: traffic.utmSource ?? "",
    traffic_medium: traffic.utmMedium ?? "",
    traffic_content: content,
    gbp_profile: gbpProfile,
  };
}

const WA_CLICK_DEDUP_MS = 400;
let lastWhatsAppTrackKey = "";
let lastWhatsAppTrackAt = 0;

function shouldSkipDuplicateWhatsAppTrack(key: string): boolean {
  const now = Date.now();
  if (
    key === lastWhatsAppTrackKey &&
    now - lastWhatsAppTrackAt < WA_CLICK_DEDUP_MS
  ) {
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

/**
 * Mantém o evento disponível no Data Layer e também o envia ao GA4.
 * O container atual não encaminha automaticamente os eventos comerciais
 * personalizados; sem este envio eles existem no site, mas não nos relatórios.
 */
function trackBusinessEvent(
  eventName: string,
  payload: Record<string, unknown>,
): void {
  pushDataLayer({ event: eventName, ...payload });

  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", eventName, {
      send_to: GA4_MEASUREMENT_ID,
      ...payload,
    });
  }
}

/** Evento GA4: visualização de página de veículo (funil Browse → Detalhe → WA). */
export function trackViewItem(params: {
  vehicleId: string | number;
  vehicleName: string;
  price?: number;
  currency?: string;
}): void {
  trackBusinessEvent("view_item", {
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
  trackBusinessEvent("stock_filter_apply", {
    filters: params.filters,
    result_count: params.resultCount,
  });
}

/** Interações do comparador são sinais de consideração, nunca conversões Ads. */
export function trackCompareInteraction(params: {
  action:
    | "select"
    | "remove"
    | "preset"
    | "view_details"
    | "whatsapp"
    | "from_vehicle"
    | "preselect";
  vehicleIds: Array<string | number>;
  vehicleNames?: string[];
  preset?: string;
}): void {
  trackBusinessEvent(`compare_vehicle_${params.action}`, {
    compare_action: params.action,
    vehicle_ids: params.vehicleIds.map(String),
    vehicle_names: params.vehicleNames,
    comparison_preset: params.preset,
    compare_count: params.vehicleIds.length,
  });

  if (params.vehicleIds.length >= 2) {
    trackBusinessEvent("comparison_ready", {
      vehicle_ids: params.vehicleIds.map(String),
      vehicle_names: params.vehicleNames,
      compare_count: params.vehicleIds.length,
    });
  }
}

/** Evento GA4: scroll 50% na Home (engajamento). */
export function trackHomeScrollDepth(depthPercent: number): void {
  trackBusinessEvent("scroll_depth_home", {
    scroll_depth_percent: depthPercent,
  });
}

export function trackPageView(path?: string, title?: string): void {
  const pagePath = path ?? getPagePath();
  const pageTitle =
    title ?? (typeof document !== "undefined" ? document.title : "");
  const pageLocation =
    typeof window !== "undefined" ? window.location.href : "";
  const pageType = inferPageType(pagePath);
  const regionalDimensions = getRegionalDimensions(pagePath);
  const trafficDimensions = getTrafficDimensions();

  pushDataLayer({
    event: "virtual_page_view",
    page_path: pagePath,
    page_title: pageTitle,
    page_location: pageLocation,
    page_type: pageType,
    ...regionalDimensions,
    ...trafficDimensions,
  });

  if (["city_buy", "city_sell", "regional_hub"].includes(pageType)) {
    trackBusinessEvent("regional_landing_view", {
      page_type: pageType,
      page_path: pagePath,
      ...regionalDimensions,
      ...trafficDimensions,
    });
  }

  if (typeof window.gtag === "function") {
    window.gtag("config", GA4_MEASUREMENT_ID, {
      page_path: pagePath,
      page_title: pageTitle,
      page_location: pageLocation,
      page_type: pageType,
      ...regionalDimensions,
      ...trafficDimensions,
    });
  }

  // O Pixel base registra a Home no HTML. Em navegação SPA, registra só a rota nova.
  if (
    typeof window.fbq === "function" &&
    window.__netcarMetaLastPagePath !== pagePath
  ) {
    window.fbq("track", "PageView");
    window.__netcarMetaLastPagePath = pagePath;
  }
}

/** Evento para CTAs de páginas regionais e landings de estoque. */
export function trackRegionalCtaClick(
  action: string,
  pagePath = getPagePath(),
): void {
  const pageType = inferPageType(pagePath);
  if (
    !["city_buy", "city_sell", "regional_hub", "brand_landing"].includes(
      pageType,
    )
  ) {
    return;
  }

  trackBusinessEvent("regional_cta_click", {
    regional_action: action,
    page_type: pageType,
    page_path: pagePath,
    ...getRegionalDimensions(pagePath),
    ...getTrafficDimensions(),
  });

  if (action.includes("stock") || action.startsWith("city_buy_")) {
    trackBusinessEvent("regional_stock_click", {
      regional_action: action,
      page_type: pageType,
      page_path: pagePath,
      ...getRegionalDimensions(pagePath),
      ...getTrafficDimensions(),
    });
  }
}

export function trackTrustSectionView(
  section: string,
  pagePath = getPagePath(),
): void {
  trackBusinessEvent("trust_section_view", {
    trust_section: section,
    page_type: inferPageType(pagePath),
    page_path: pagePath,
    ...getRegionalDimensions(pagePath),
    ...getTrafficDimensions(),
  });
}

/** Mede se a nova proposta de confiança leva o cliente ao estoque ou contato. */
export function trackSelectionCampaignCta(
  action: "learn_process" | "view_stock" | "whatsapp",
  placement: "home" | "campaign_hero" | "campaign_final",
  pagePath = getPagePath(),
): void {
  trackBusinessEvent("selection_campaign_cta", {
    selection_action: action,
    selection_placement: placement,
    page_type: inferPageType(pagePath),
    page_path: pagePath,
    ...getTrafficDimensions(),
  });
}

export function trackSellEvaluation(
  stage: "start" | "completed",
  cityName?: string,
  evaluationType?: "direct_purchase" | "trade_in",
  pagePath = getPagePath(),
): void {
  trackBusinessEvent(`sell_evaluation_${stage}`, {
    city_name: cityName,
    evaluation_type: evaluationType,
    page_type: inferPageType(pagePath),
    page_path: pagePath,
    ...getRegionalDimensions(pagePath),
    ...getTrafficDimensions(),
  });

  if (stage === "completed") {
    trackBusinessEvent("generate_lead", {
      lead_type: "sell_evaluation",
      city_name: cityName,
      evaluation_type: evaluationType,
      page_path: pagePath,
      ...getRegionalDimensions(pagePath),
      ...getTrafficDimensions(),
    });
  }
}

export function trackPhoneClick(params: {
  phoneNumber: string;
  source?: string;
  pagePath?: string;
}): void {
  const pagePath = params.pagePath ?? getPagePath();
  trackBusinessEvent("phone_click", {
    phone_number: params.phoneNumber,
    phone_source: params.source ?? "link",
    page_type: inferPageType(pagePath),
    page_path: pagePath,
    ...getRegionalDimensions(pagePath),
    ...getTrafficDimensions(),
  });
  if (typeof window.fbq === "function") {
    window.fbq("track", "Contact", { content_name: "phone_call" });
  }
}

export function trackContactFormSubmit(pagePath = getPagePath()): void {
  trackBusinessEvent("contact_form_submit", {
    form_destination: "whatsapp",
    page_type: inferPageType(pagePath),
    page_path: pagePath,
    ...getTrafficDimensions(),
  });
  trackBusinessEvent("generate_lead", {
    lead_type: "contact_form",
    page_path: pagePath,
    ...getTrafficDimensions(),
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

  const waRef = getOrCreateClickCode();

  pushDataLayer({
    event: "whatsapp_click",
    wa_ads_conversion: true,
    wa_event_id: `wa_${waRef}`,
    wa_source: params.source,
    wa_intent: params.intent ?? "general",
    wa_vehicle_id:
      params.vehicleId != null ? String(params.vehicleId) : undefined,
    wa_vehicle_name: params.vehicleName,
    wa_page_type: inferPageType(pagePath),
    wa_ref: waRef,
    page_path: pagePath,
    ...getRegionalDimensions(pagePath),
    ...getTrafficDimensions(),
  });

  // Data Layer v2 persiste valores entre eventos. O false explícito é essencial:
  // limpa o estado antes do gtag; sem isso, ele herdaria true e repetiria Ads.
  if (typeof window.gtag === "function") {
    pushDataLayer({ wa_ads_conversion: false });
    window.gtag("event", "whatsapp_click", {
      send_to: GA4_MEASUREMENT_ID,
      wa_ads_conversion: false,
      wa_event_id: `wa_${waRef}`,
      wa_source: params.source,
      wa_intent: params.intent ?? "general",
      wa_vehicle_id:
        params.vehicleId != null ? String(params.vehicleId) : undefined,
      wa_vehicle_name: params.vehicleName,
      wa_page_type: inferPageType(pagePath),
      wa_ref: waRef,
      page_path: pagePath,
      ...getRegionalDimensions(pagePath),
      ...getTrafficDimensions(),
    });
  }

  if (typeof window.fbq === "function") {
    const metaParams = {
      content_name: "whatsapp",
      content_category: params.intent ?? "general",
      content_ids:
        params.vehicleId != null ? [String(params.vehicleId)] : undefined,
      content_type: params.vehicleId != null ? "vehicle" : undefined,
      source: params.source,
      wa_ref: waRef,
    };
    window.fbq("track", "Contact", metaParams, { eventID: `wa_${waRef}` });
    window.fbq("trackCustom", "WhatsAppClick", {
      source: params.source,
      intent: params.intent ?? "general",
      vehicle_id:
        params.vehicleId != null ? String(params.vehicleId) : undefined,
      wa_ref: waRef,
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
    return (
      (tagged.getAttribute("data-wa-source") as WhatsAppClickSource) || "link"
    );
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
      if (href.startsWith("tel:")) {
        trackPhoneClick({
          phoneNumber: href.replace(/^tel:/, ""),
          source:
            anchor.getAttribute("data-phone-source") ??
            (anchor.closest("header")
              ? "header"
              : anchor.closest("footer")
                ? "footer"
                : "content"),
        });
        return;
      }
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
