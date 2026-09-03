/**
 * Analytics helpers — dataLayer alimenta GTM/Ads e eventos comerciais também
 * seguem diretamente ao GA4 quando o container publicado não possui tag GA4.
 */

import {
  appendWaRefToUrl,
  captureTrafficSource,
  createWhatsAppClickIdentity,
  getTrafficSource,
  getPrivacyConsentState,
  logWaClick,
  type WhatsAppClickIdentity,
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
  | "other"
  | string;

export interface WhatsAppClickParams {
  source: WhatsAppClickSource;
  intent?: string;
  vehicleId?: string | number;
  vehicleName?: string;
  pagePath?: string;
  /** `support` nunca é conversão comercial, Ads ou Meta Contact. */
  conversion?: "commercial" | "support";
  /** Uso interno para manter a identidade única no mesmo gesto. */
  clickIdentity?: WhatsAppClickIdentity;
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
  | "vehicle_report"
  | "inventory"
  | "sell"
  | "financing"
  | "service"
  | "blog"
  | "blog_post"
  | "about"
  | "legal"
  | "other";

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    __netcarAnalyticsInit?: boolean;
    __netcarMetaLastPagePath?: string;
    __netcarDirectGaLoaded?: boolean;
    __netcarPrivacyConsent?: string;
    __netcarMetaLoaded?: boolean;
  }
}

function getPagePath(): string {
  return typeof window !== "undefined"
    ? `${window.location.pathname}${window.location.search}`
    : "/";
}

/** Meta não possui o Consent Mode nativo do Google. Só enviamos após opt-in e
 * depois de o loader marcar o Pixel como pronto, evitando eventos na fila. */
function canSendMetaEvent(): boolean {
  return (
    typeof window !== "undefined" &&
    window.__netcarPrivacyConsent === "accepted" &&
    window.__netcarMetaLoaded === true
  );
}

export function inferPageType(pagePath: string): AnalyticsPageType {
  const pathname = pagePath.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  if (pathname.startsWith("/veiculo/")) return "vehicle_detail";
  if (pathname.startsWith("/laudo/")) return "vehicle_report";
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
  if (pathname === "/seminovos" || pathname === "/seminovos-automaticos") {
    return "inventory";
  }
  if (
    ["/compra", "/compramos-seu-usado", "/vender-meu-carro"].includes(pathname)
  ) {
    return "sell";
  }
  if (pathname === "/financiamento") return "financing";
  if (["/atendimento-24h", "/move-brasil"].includes(pathname)) {
    return "service";
  }
  if (pathname === "/blog") return "blog";
  if (pathname.startsWith("/blog/")) return "blog_post";
  if (pathname.startsWith("/sobre")) return "about";
  if (pathname === "/privacidade") return "legal";
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

export function getTrafficDimensions(): Record<string, string> {
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
    traffic_utm_term: traffic.utmTerm ?? "",
    traffic_landing_page: traffic.landingPage ?? "",
    traffic_referrer: traffic.referrer ?? "",
    traffic_gclid: traffic.gclid ?? "",
    traffic_gbraid: traffic.gbraid ?? "",
    traffic_wbraid: traffic.wbraid ?? "",
    traffic_fbclid: traffic.fbclid ?? "",
    privacy_consent: getPrivacyConsentState(),
    gbp_profile: gbpProfile,
  };
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
  // O dataLayer v2 mantém valores entre pushes. Limpar só depois do evento
  // permite que a tag de view_item leia os itens, sem vazá-los ao próximo CTA.
  pushDataLayer({ ecommerce: null });
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

/** Caminhos usados para continuar a pesquisa a partir da ficha do carro. */
export function trackVehicleDiscoveryClick(params: {
  source: "comparison_block" | "breadcrumb";
  targetType:
    | "inventory"
    | "marca"
    | "modelo"
    | "categoria"
    | "faixa"
    | "combustivel";
  targetSlug: string;
  targetName: string;
  vehicleId: string | number;
  vehicleName: string;
}): void {
  trackBusinessEvent("vehicle_discovery_click", {
    discovery_source: params.source,
    discovery_target_type: params.targetType,
    discovery_target_slug: params.targetSlug,
    discovery_target_name: params.targetName,
    vehicle_id: String(params.vehicleId),
    vehicle_name: params.vehicleName,
  });
}

/** Abertura da ficha a partir do card: botão "Ver carro" vs clique na foto/card. */
export function trackVehicleCardOpen(params: {
  via: "button" | "card";
  vehicleId: string | number;
  vehicleName: string;
  source: string;
}): void {
  trackBusinessEvent("vehicle_card_open", {
    open_via: params.via,
    card_source: params.source,
    vehicle_id: String(params.vehicleId),
    vehicle_name: params.vehicleName,
  });
}

let comparisonIsReady = false;

/** Reinicia o marco quando uma nova tela do comparador e aberta. */
export function resetComparisonTracking(): void {
  comparisonIsReady = false;
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

  // "Pronto" é um marco de funil, não cada interação após haver dois carros.
  // Só ações que alteram a seleção podem mudar esse estado.
  if (["select", "remove", "preset", "preselect"].includes(params.action)) {
    const isReady = params.vehicleIds.length >= 2;
    if (isReady && !comparisonIsReady) {
      trackBusinessEvent("comparison_ready", {
        vehicle_ids: params.vehicleIds.map(String),
        vehicle_names: params.vehicleNames,
        compare_count: params.vehicleIds.length,
      });
    }
    comparisonIsReady = isReady;
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
    canSendMetaEvent() &&
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

/** Mede a campanha comercial temporária sem misturá-la à campanha de procedência. */
export function trackSeptemberCampaignInteraction(
  action: "view" | "view_stock" | "whatsapp" | "play_video",
  placement: "home" | "inventory" | "vehicle",
  vehicleId?: string | number,
  pagePath = getPagePath(),
): void {
  trackBusinessEvent("promotional_campaign_interaction", {
    campaign_id: "acelerou-levou-2026-09",
    campaign_action: action,
    campaign_placement: placement,
    page_type: inferPageType(pagePath),
    page_path: pagePath,
    ...(vehicleId !== undefined ? { vehicle_id: String(vehicleId) } : {}),
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
    trackBusinessEvent("form_submit", {
      form_name: "sell_evaluation",
      form_destination: "whatsapp",
      city_name: cityName,
      evaluation_type: evaluationType,
      page_type: inferPageType(pagePath),
      page_path: pagePath,
      ...getRegionalDimensions(pagePath),
      ...getTrafficDimensions(),
    });
    trackBusinessEvent("lead_intent", {
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
  if (canSendMetaEvent() && typeof window.fbq === "function") {
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
  trackBusinessEvent("form_submit", {
    form_name: "contact",
    form_destination: "whatsapp",
    page_type: inferPageType(pagePath),
    page_path: pagePath,
    ...getTrafficDimensions(),
  });
  trackBusinessEvent("lead_intent", {
    lead_type: "contact_form",
    form_destination: "whatsapp",
    page_type: inferPageType(pagePath),
    page_path: pagePath,
    ...getTrafficDimensions(),
  });
}

/**
 * `generate_lead` é reservado a um lead confirmado pelo CRM/backend. O
 * front-end não deve inferi-lo apenas porque abriu uma conversa no WhatsApp.
 */
export function trackConfirmedLead(params: {
  leadId: string;
  leadType: string;
  pagePath?: string;
  clickId?: string;
  waRef?: string;
}): void {
  const pagePath = params.pagePath ?? getPagePath();
  trackBusinessEvent("generate_lead", {
    lead_id: params.leadId,
    lead_type: params.leadType,
    click_id: params.clickId,
    wa_ref: params.waRef,
    page_type: inferPageType(pagePath),
    page_path: pagePath,
    ...getRegionalDimensions(pagePath),
    ...getTrafficDimensions(),
  });
}

function normalizeAnalyticsToken(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

function normalizeWhatsAppSource(source: string): string {
  const raw = normalizeAnalyticsToken(source, "content_link");
  if (raw === "hero") return "vehicle_hero";
  if (raw.startsWith("detalhe_vendido")) return "vehicle_unavailable";
  if (raw.startsWith("detalhe_trade")) return "vehicle_trade";
  if (raw.startsWith("sidebar_")) return "vehicle_sidebar";
  if (raw.startsWith("seminovos_")) return "inventory";
  if (raw === "link") return "content_link";
  return raw;
}

function getWhatsAppPayload(
  params: WhatsAppClickParams,
  identity: WhatsAppClickIdentity | undefined,
  conversion: "commercial" | "support",
): Record<string, unknown> {
  const pagePath = params.pagePath ?? getPagePath();
  const sourceRaw = params.source || "link";
  const intentRaw = params.intent ?? "general";
  return {
    ...(identity
      ? {
          click_id: identity.clickId,
          wa_ref: identity.waRef,
          wa_event_id: `wa_${identity.clickId}`,
        }
      : {}),
    wa_source: normalizeWhatsAppSource(sourceRaw),
    wa_source_raw: sourceRaw,
    wa_intent: normalizeAnalyticsToken(intentRaw, "general"),
    wa_intent_raw: intentRaw,
    wa_conversion: conversion,
    wa_vehicle_id:
      params.vehicleId != null ? String(params.vehicleId) : undefined,
    wa_vehicle_name: params.vehicleName,
    wa_page_type: inferPageType(pagePath),
    page_path: pagePath,
    ...getRegionalDimensions(pagePath),
    ...(identity
      ? getTrafficDimensions()
      : { privacy_consent: getPrivacyConsentState() }),
  };
}

const emittedClickIds = new Set<string>();

/**
 * Um mesmo handler pode passar pelo componente e pela delegação global. A
 * identidade pertence ao gesto, então deduplicamos apenas o mesmo click_id no
 * mesmo turno de execução — nunca cliques distintos por janela de tempo.
 */
function reserveClickIdentity(clickId: string): boolean {
  if (emittedClickIds.has(clickId)) return false;
  emittedClickIds.add(clickId);
  const release = () => emittedClickIds.delete(clickId);
  if (typeof queueMicrotask === "function") queueMicrotask(release);
  else setTimeout(release, 0);
  return true;
}

/**
 * Mede uma abertura de WhatsApp. O dataLayer comercial mantém o contrato do
 * Google Ads/GTM; a chamada direta de GA4 conserva a medição quando o container
 * não tiver tag de evento GA4. Ambos compartilham o mesmo event_id/click_id.
 */
export function trackWhatsAppClick(params: WhatsAppClickParams): void {
  const hasMeasurementConsent = getPrivacyConsentState() === "accepted";
  const clickIdentity = params.clickIdentity ?? createWhatsAppClickIdentity();
  if (!reserveClickIdentity(clickIdentity.clickId)) return;
  // Sem consentimento, GA4/GTM/Meta ficam anônimos (Consent Mode). O log
  // próprio recebe só a referência do gesto para ligar a conversa ao carro.
  const identity = hasMeasurementConsent ? clickIdentity : undefined;
  const conversion = params.conversion ?? "commercial";
  const payload = getWhatsAppPayload(params, identity, conversion);

  logWaClick(clickIdentity, {
    event_name:
      conversion === "support" ? "whatsapp_support_click" : "whatsapp_click",
    ...payload,
  });

  if (conversion === "support") {
    pushDataLayer({ event: "whatsapp_support_click", ...payload });
    if (typeof window.gtag === "function") {
      window.gtag("event", "whatsapp_support_click", {
        send_to: GA4_MEASUREMENT_ID,
        ...payload,
      });
    }
    return;
  }

  pushDataLayer({
    event: "whatsapp_click",
    ...payload,
    wa_ads_conversion: true,
  });
  // Evita que o flag de conversão Ads vaze para o próximo evento GTM.
  pushDataLayer({ wa_ads_conversion: false });

  if (typeof window.gtag === "function") {
    window.gtag("event", "whatsapp_click", {
      send_to: GA4_MEASUREMENT_ID,
      ...payload,
      wa_ads_conversion: false,
    });
  }

  if (identity && canSendMetaEvent() && typeof window.fbq === "function") {
    const metaParams = {
      content_name: "whatsapp",
      content_category: payload.wa_intent,
      content_ids:
        params.vehicleId != null ? [String(params.vehicleId)] : undefined,
      content_type: params.vehicleId != null ? "vehicle" : undefined,
      source: payload.wa_source,
      wa_ref: identity.waRef,
      click_id: identity.clickId,
    };
    window.fbq("track", "Contact", metaParams, {
      eventID: `wa_${identity.clickId}`,
    });
    window.fbq("trackCustom", "WhatsAppClick", {
      source: payload.wa_source,
      intent: payload.wa_intent,
      vehicle_id:
        params.vehicleId != null ? String(params.vehicleId) : undefined,
      wa_ref: identity.waRef,
      click_id: identity.clickId,
    });
  }
}

export function openWhatsApp(url: string, params: WhatsAppClickParams): void {
  if (!url || url === "#") return;
  const clickIdentity = createWhatsAppClickIdentity();
  trackWhatsAppClick({ ...params, clickIdentity });
  window.open(
    appendWaRefToUrl(url, clickIdentity),
    "_blank",
    "noopener,noreferrer",
  );
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

/**
 * Contrato para CTAs não comerciais: `data-wa-conversion="support"`.
 * Também protege o Nethelp existente até que seus componentes recebam o
 * atributo. Esses cliques continuam observáveis, mas nunca chegam a Ads ou
 * Meta Contact.
 */
function inferWhatsAppConversionFromElement(
  el: HTMLAnchorElement,
): "commercial" | "support" {
  const explicit = el
    .closest("[data-wa-conversion]")
    ?.getAttribute("data-wa-conversion")
    ?.trim()
    .toLowerCase();
  if (["support", "non_commercial", "false", "0"].includes(explicit ?? "")) {
    return "support";
  }

  const href = el.href || "";
  const intent = el.getAttribute("data-wa-intent") ?? "";
  const label = el.textContent ?? "";
  if (
    /5551995109169/.test(href.replace(/\D/g, "")) ||
    /support|suporte|nethelp/i.test(`${intent} ${label}`)
  ) {
    return "support";
  }
  return "commercial";
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
      const clickIdentity = createWhatsAppClickIdentity();
      trackWhatsAppClick({
        source: inferSourceFromElement(anchor),
        intent: anchor.getAttribute("data-wa-intent") ?? "link_click",
        vehicleId: anchor.getAttribute("data-wa-vehicle-id") ?? undefined,
        vehicleName: anchor.getAttribute("data-wa-vehicle-name") ?? undefined,
        conversion: inferWhatsAppConversionFromElement(anchor),
        clickIdentity,
      });
      // Anexa a referência curta da mesma identidade antes da navegação.
      anchor.href = appendWaRefToUrl(href, clickIdentity);
    },
    true,
  );
}
