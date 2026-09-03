#!/usr/bin/env tsx

/**
 * Contratos de regressão para a atribuição Netcar.
 *
 * O objetivo não é validar apenas que existem strings no código: os fluxos
 * principais são exercitados com um navegador mínimo em memória. Os contratos
 * offline e de segurança também são checados para impedir que uma correção no
 * front termine sem chegar ao relatório de venda.
 */

import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  inferPageType,
  initAnalytics,
  trackCompareInteraction,
  trackConfirmedLead,
  trackContactFormSubmit,
  trackSellEvaluation,
  trackViewItem,
  trackWhatsAppClick,
} from "../src/lib/analytics";
import {
  appendWaRefToUrl,
  captureTrafficSource,
  clearTrafficAttribution,
  createWhatsAppClickIdentity,
  getTrafficSource,
  logWaClick,
} from "../src/lib/waTracking";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

const storage = new Map<string, string>();
const beacons: Array<{ url: string; body: Blob }> = [];
const gtagCalls: unknown[][] = [];
const fbqCalls: unknown[][] = [];
let delegatedClickListener: ((event: { target: unknown }) => void) | undefined;

class FakeHtmlAnchorElement {
  href: string;
  textContent: string;
  private readonly attributes = new Map<string, string>();

  constructor(
    href: string,
    attributes: Record<string, string> = {},
    textContent = "",
  ) {
    this.href = href;
    this.textContent = textContent;
    for (const [key, value] of Object.entries(attributes)) {
      this.attributes.set(key, value);
    }
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  closest(selector: string): FakeHtmlAnchorElement | null {
    if (selector === "a[href]") return this;
    if (
      selector === "[data-wa-source]" &&
      this.attributes.has("data-wa-source")
    ) {
      return this;
    }
    if (
      selector === "[data-wa-conversion]" &&
      this.attributes.has("data-wa-conversion")
    ) {
      return this;
    }
    return null;
  }
}

const fakeWindow = {
  location: {
    pathname: "/veiculo/carro-teste",
    search: "",
    hostname: "www.netcarmultimarcas.com.br",
    href: "https://www.netcarmultimarcas.com.br/veiculo/carro-teste",
  },
  dataLayer: [] as Record<string, unknown>[],
  __netcarDirectGaLoaded: false,
  __netcarPrivacyConsent: "accepted",
  __netcarMetaLoaded: true,
  __netcarAnalyticsInit: false,
  gtag: (...args: unknown[]) => gtagCalls.push(args),
  fbq: (...args: unknown[]) => fbqCalls.push(args),
  open: () => null,
};

Object.defineProperty(globalThis, "window", {
  value: fakeWindow,
  configurable: true,
  writable: true,
});
Object.defineProperty(globalThis, "Element", {
  value: FakeHtmlAnchorElement,
  configurable: true,
  writable: true,
});
Object.defineProperty(globalThis, "HTMLAnchorElement", {
  value: FakeHtmlAnchorElement,
  configurable: true,
  writable: true,
});
Object.defineProperty(globalThis, "document", {
  value: {
    referrer: "",
    title: "Veículo teste",
    addEventListener: (
      name: string,
      listener: (event: { target: unknown }) => void,
    ) => {
      if (name === "click") delegatedClickListener = listener;
    },
  },
  configurable: true,
  writable: true,
});
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, String(value)),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  },
  configurable: true,
  writable: true,
});
Object.defineProperty(globalThis, "navigator", {
  value: {
    sendBeacon: (url: string, body: Blob) => {
      beacons.push({ url, body });
      return true;
    },
  },
  configurable: true,
  writable: true,
});

function resetTelemetry(): void {
  fakeWindow.dataLayer = [];
  fakeWindow.__netcarDirectGaLoaded = false;
  gtagCalls.length = 0;
  fbqCalls.length = 0;
  beacons.length = 0;
}

function dataLayerEvents(name: string): Record<string, unknown>[] {
  return fakeWindow.dataLayer.filter((row) => row.event === name);
}

function gtagEvents(name: string): unknown[][] {
  return gtagCalls.filter((args) => args[0] === "event" && args[1] === name);
}

function testStrongClickIdentity(): void {
  const identities = Array.from({ length: 2_000 }, () =>
    createWhatsAppClickIdentity(),
  );
  const clickIds = new Set(identities.map((identity) => identity.clickId));

  assert(
    clickIds.size === identities.length,
    "click_id repetiu em 2.000 identidades; a chave canônica não é robusta",
  );
  for (const identity of identities) {
    assert(
      /^nc_[a-f0-9]{32}$/.test(identity.clickId),
      `click_id fora do contrato criptográfico: ${identity.clickId}`,
    );
    assert(
      /^[MGODSRU][23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{7}$/.test(identity.waRef),
      `wa_ref deixou de ser curto e legível: ${identity.waRef}`,
    );
  }

  const identity = identities[0];
  const output = appendWaRefToUrl(
    "https://wa.me/5551999999999?text=Tenho%20interesse",
    identity,
  );
  const message = new URL(output).searchParams.get("text") ?? "";
  assert(
    message.includes(`(${identity.waRef})`),
    "a mensagem do WhatsApp não usa o wa_ref da identidade do gesto",
  );
  const refreshed = appendWaRefToUrl(
    "https://wa.me/5551999999999?text=Tenho%20interesse%20-%20(G12345).",
    identities[1],
  );
  const refreshedMessage = new URL(refreshed).searchParams.get("text") ?? "";
  assert(
    refreshedMessage.includes(`(${identities[1].waRef})`) &&
      !refreshedMessage.includes("(G12345)"),
    "href reutilizado preservou wa_ref antigo em vez da identidade do novo gesto",
  );
  const naturalParenthesis = appendWaRefToUrl(
    `https://wa.me/5551999999999?text=${encodeURIComponent("Quero um (CARRO) automático")}`,
    identities[1],
  );
  assert(
    (new URL(naturalParenthesis).searchParams.get("text") ?? "").includes(
      "(CARRO)",
    ),
    "texto comercial entre parênteses foi confundido com wa_ref legado",
  );

  resetTelemetry();
  logWaClick(identity, { wa_source: "vehicle_sidebar", wa_intent: "trade_in" });
  assert(beacons.length === 1, "o clique não foi enviado ao log próprio");
}

async function testClickLogContext(): Promise<void> {
  const payload = JSON.parse(await beacons[0].body.text()) as Record<
    string,
    unknown
  >;
  assert(
    /^nc_[a-f0-9]{32}$/.test(String(payload.click_id ?? "")),
    "o log próprio não recebeu click_id canônico",
  );
  assert(payload.code === payload.wa_ref, "code legado e wa_ref divergiram");
  assert(
    payload.wa_source === "vehicle_sidebar" && payload.wa_intent === "trade_in",
    "o log próprio perdeu o contexto do CTA",
  );
}

async function testDelegatedWhatsAppLinkTransaction(): Promise<void> {
  resetTelemetry();
  fakeWindow.__netcarAnalyticsInit = false;
  delegatedClickListener = undefined;
  initAnalytics();
  assert(
    delegatedClickListener,
    "a delegação global não registrou o handler de clique",
  );

  const anchor = new FakeHtmlAnchorElement(
    "https://wa.me/5551997293118?text=Quero%20mais%20informa%C3%A7%C3%B5es%20sobre%20o%20Kicks.",
    {
      "data-wa-source": "detalhe_sticky",
      "data-wa-intent": "vehicle_inquiry",
      "data-wa-vehicle-id": "19857",
      "data-wa-vehicle-name": "Kicks Sense Turbo",
    },
    "Falar deste carro",
  );
  delegatedClickListener({ target: anchor });

  const message = new URL(anchor.href).searchParams.get("text") ?? "";
  const marker = message.match(
    /\(([MGODSRU][23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{7})\)/,
  )?.[1];
  assert(marker, "o clique delegado saiu do site sem wa_ref na mensagem");
  assert(beacons.length === 1, "o clique delegado não chegou ao log próprio");

  const payload = JSON.parse(await beacons[0].body.text()) as Record<
    string,
    unknown
  >;
  assert(
    payload.wa_ref === marker &&
      /^nc_[a-f0-9]{32}$/.test(String(payload.click_id)),
    "mensagem e log próprio não compartilharam a mesma identidade",
  );
  const [event] = dataLayerEvents("whatsapp_click");
  assert(
    event?.wa_ref === marker && event?.click_id === payload.click_id,
    "mensagem, dataLayer e log próprio divergiram no mesmo gesto",
  );
}

function testSingleWhatsAppEmission(): void {
  resetTelemetry();
  const identity = createWhatsAppClickIdentity();
  trackWhatsAppClick({
    source: "sidebar_action",
    intent: "vehicle_inquiry",
    vehicleId: "19884",
    vehicleName: "Fastback Impetus",
    clickIdentity: identity,
  });
  // Simula o mesmo gesto alcançando também a delegação global.
  trackWhatsAppClick({
    source: "sidebar_action",
    intent: "vehicle_inquiry",
    vehicleId: "19884",
    vehicleName: "Fastback Impetus",
    clickIdentity: identity,
  });

  const events = dataLayerEvents("whatsapp_click");
  assert(
    events.length === 1,
    `GTM recebeu ${events.length} objetos whatsapp_click para um gesto`,
  );
  assert(
    gtagEvents("whatsapp_click").length === 1,
    "GA4 direto não recebeu exatamente um whatsapp_click por gesto",
  );
  assert(
    events[0].wa_ads_conversion === true,
    "conversão Ads comercial ausente",
  );
  assert(events[0].click_id === identity.clickId, "evento perdeu click_id");
  assert(events[0].wa_ref === identity.waRef, "evento perdeu wa_ref");
  assert(
    events[0].wa_source === "vehicle_sidebar" &&
      events[0].wa_intent === "vehicle_inquiry" &&
      events[0].wa_vehicle_id === "19884",
    "evento comercial perdeu contexto de CTA/veículo",
  );
  const directPayload = gtagEvents("whatsapp_click")[0][2] as Record<
    string,
    unknown
  >;
  assert(
    directPayload.wa_ads_conversion === false,
    "emissão GA4 direta foi marcada como conversão Ads",
  );
  assert(
    directPayload.click_id === events[0].click_id &&
      directPayload.wa_event_id === events[0].wa_event_id,
    "GTM e GA4 não compartilham a identidade única do gesto",
  );
  assert(
    fbqCalls.filter((args) => args[0] === "track" && args[1] === "Contact")
      .length === 1,
    "Meta Contact duplicou para o mesmo gesto",
  );
  assert(beacons.length === 1, "log próprio duplicou o mesmo gesto");
}

function testSupportIsNotAConversion(): void {
  resetTelemetry();
  trackWhatsAppClick({
    source: "footer_nethelp",
    intent: "post_sale_support",
    conversion: "support",
    clickIdentity: createWhatsAppClickIdentity(),
  });

  assert(
    dataLayerEvents("whatsapp_click").length === 0,
    "Nethelp/suporte entrou como whatsapp_click comercial",
  );
  const supportEvents = dataLayerEvents("whatsapp_support_click");
  assert(
    supportEvents.length === 1,
    "clique Nethelp deixou de ser observável como suporte",
  );
  assert(
    !supportEvents.some((row) => row.wa_ads_conversion === true),
    "clique Nethelp foi marcado para conversão Google Ads",
  );
  assert(
    !fbqCalls.some(
      (args) =>
        (args[0] === "track" && args[1] === "Contact") ||
        (args[0] === "trackCustom" && args[1] === "WhatsAppClick"),
    ),
    "clique Nethelp disparou conversão comercial no Meta Pixel",
  );
}

async function testPrivacyChoiceClearsAndBlocksAttribution(): Promise<void> {
  resetTelemetry();
  fakeWindow.__netcarPrivacyConsent = "accepted";
  fakeWindow.location.search = "?utm_source=instagram&utm_medium=social";
  captureTrafficSource();
  assert(
    getTrafficSource().src === "META",
    "origem consentida nao foi capturada em memoria",
  );

  fakeWindow.__netcarPrivacyConsent = "essential";
  clearTrafficAttribution();
  assert(
    getTrafficSource().src === "DIR" && !storage.has("nc_traffic_ref"),
    "Somente essenciais preservou origem/clids em memoria ou localStorage",
  );

  // Sem consentimento a origem em memoria pode existir (visita atual), mas o
  // log proprio recebe apenas a referencia do gesto + categoria, sem clids.
  fakeWindow.location.search =
    "?gclid=privacy-gclid&utm_source=google&utm_medium=cpc&utm_campaign=priv&utm_term=kw";
  captureTrafficSource();
  assert(
    !storage.has("nc_traffic_ref"),
    "origem foi persistida em localStorage sem consentimento",
  );
  const essentialIdentity = createWhatsAppClickIdentity();
  assert(
    /^G[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{7}$/.test(essentialIdentity.waRef),
    "wa_ref sem consentimento perdeu a letra da categoria de origem",
  );
  logWaClick(essentialIdentity, { wa_source: "privacy_test" });
  assert(
    beacons.length === 1,
    "clique sem consentimento deixou de chegar ao log proprio",
  );
  const essentialPayload = JSON.parse(await beacons[0].body.text()) as Record<
    string,
    unknown
  >;
  assert(
    essentialPayload.wa_ref === essentialIdentity.waRef &&
      essentialPayload.click_id === essentialIdentity.clickId &&
      essentialPayload.src === "GADS" &&
      essentialPayload.privacy_consent === "essential",
    "log sem consentimento perdeu referencia/categoria do gesto",
  );
  for (const field of [
    "gclid",
    "gbraid",
    "wbraid",
    "fbclid",
    "campaign",
    "utm_source",
    "utm_medium",
    "utm_content",
    "utm_term",
    "landing_page",
    "referrer",
  ]) {
    assert(
      essentialPayload[field] === "",
      `log proprio expôs ${field} sem consentimento de medicao`,
    );
  }
  clearTrafficAttribution();
  resetTelemetry();

  const ignoredIdentity = createWhatsAppClickIdentity();
  trackWhatsAppClick({
    source: "privacy_test",
    intent: "vehicle_inquiry",
    clickIdentity: ignoredIdentity,
  });
  assert(
    beacons.length === 1,
    "clique cookieless nao chegou ao log proprio",
  );
  const anonymousEvent = dataLayerEvents("whatsapp_click")[0];
  assert(anonymousEvent, "clique cookieless deixou de ser observavel");
  for (const field of [
    "click_id",
    "wa_ref",
    "wa_event_id",
    "traffic_source",
    "traffic_campaign",
    "traffic_gclid",
    "traffic_fbclid",
  ]) {
    assert(
      !(field in anonymousEvent),
      `clique cookieless expôs ${field} sem consentimento`,
    );
  }
  const anonymousDirectPayload = gtagEvents("whatsapp_click")[0]?.[2] as
    | Record<string, unknown>
    | undefined;
  assert(
    anonymousDirectPayload &&
      !("click_id" in anonymousDirectPayload) &&
      !("wa_ref" in anonymousDirectPayload),
    "GA4 cookieless recebeu identificadores próprios sem consentimento",
  );
  const originalUrl =
    "https://wa.me/5551999999999?text=Tenho%20interesse%20-%20(G12345).";
  const anonymousUrl = appendWaRefToUrl(originalUrl, ignoredIdentity);
  assert(
    (new URL(anonymousUrl).searchParams.get("text") ?? "").includes(
      `(${ignoredIdentity.waRef})`,
    ),
    "mensagem do WhatsApp perdeu a referência do gesto sem consentimento",
  );

  fakeWindow.__netcarPrivacyConsent = "accepted";
  fakeWindow.location.search = "";
}

function testLeadIntentBoundary(): void {
  resetTelemetry();
  trackContactFormSubmit("/contato");
  const contactNames = fakeWindow.dataLayer.map((row) => row.event);
  assert(
    contactNames.includes("contact_form_submit"),
    "submit de contato ausente",
  );
  assert(
    contactNames.includes("form_submit"),
    "form_submit de contato ausente",
  );
  assert(
    contactNames.includes("lead_intent"),
    "intenção de lead de contato ausente",
  );
  assert(
    !contactNames.includes("generate_lead"),
    "abrir WhatsApp pelo formulário ainda gera lead confirmado",
  );

  resetTelemetry();
  trackSellEvaluation("completed", "Canoas", "direct_purchase", "/compra");
  const saleNames = fakeWindow.dataLayer.map((row) => row.event);
  assert(saleNames.includes("form_submit"), "form_submit de avaliação ausente");
  assert(saleNames.includes("lead_intent"), "intenção de avaliação ausente");
  assert(
    !saleNames.includes("generate_lead"),
    "avaliação que apenas abre WhatsApp ainda gera lead confirmado",
  );

  resetTelemetry();
  trackConfirmedLead({
    leadId: "crm_123",
    leadType: "whatsapp_inbound",
    clickId: "nc_0123456789abcdef0123456789abcdef",
    waRef: "G12345",
  });
  const confirmed = dataLayerEvents("generate_lead");
  assert(
    confirmed.length === 1 && confirmed[0].lead_id === "crm_123",
    "generate_lead não ficou reservado a lead confirmado e identificado",
  );
}

function testPageTypes(): void {
  const cases: Array<[string, string]> = [
    ["/", "home"],
    ["/seminovos", "inventory"],
    ["/seminovos-automaticos", "inventory"],
    ["/veiculo/fastback", "vehicle_detail"],
    ["/laudo/fastback", "vehicle_report"],
    ["/compra", "sell"],
    ["/compramos-seu-usado", "sell"],
    ["/vender-meu-carro", "sell"],
    ["/financiamento", "financing"],
    ["/atendimento-24h", "service"],
    ["/move-brasil", "service"],
    ["/blog", "blog"],
    ["/blog/como-escolher", "blog_post"],
    ["/sobre", "about"],
    ["/privacidade", "legal"],
    ["/contato", "contact"],
    ["/comparar", "comparison"],
    ["/seminovos-canoas", "city_buy"],
    ["/vender-carro-canoas", "city_sell"],
    ["/comprar-suv", "brand_landing"],
  ];
  for (const [route, expected] of cases) {
    assert(
      inferPageType(`${route}?utm_source=teste`) === expected,
      `${route} não foi classificada como ${expected}`,
    );
  }
}

function testEcommerceCleanup(): void {
  resetTelemetry();
  trackViewItem({ vehicleId: "19884", vehicleName: "Fastback", price: 122900 });
  const eventIndex = fakeWindow.dataLayer.findIndex(
    (row) => row.event === "view_item" && row.ecommerce,
  );
  const clearIndex = fakeWindow.dataLayer.findIndex(
    (row) => row.ecommerce === null,
  );
  assert(eventIndex >= 0, "view_item perdeu itens de ecommerce");
  assert(
    clearIndex > eventIndex,
    "estado ecommerce não foi limpo depois de view_item",
  );
}

function testComparisonReadyTransition(): void {
  resetTelemetry();
  const compare = (
    action: "select" | "remove" | "preset" | "view_details" | "preselect",
    ids: string[],
  ) => trackCompareInteraction({ action, vehicleIds: ids });

  compare("select", ["1"]);
  compare("select", ["1", "2"]);
  compare("select", ["1", "2", "3"]);
  compare("view_details", ["1", "2", "3"]);
  compare("remove", ["1", "2"]);
  assert(
    dataLayerEvents("comparison_ready").length === 1,
    "comparison_ready repetiu enquanto o comparador continuava pronto",
  );

  compare("remove", ["1"]);
  compare("preselect", ["1", "3"]);
  assert(
    dataLayerEvents("comparison_ready").length === 2,
    "comparison_ready não voltou a disparar na nova transição <2 → >=2",
  );
}

function walkFiles(directory: string, extension: string): string[] {
  const output: string[] = [];
  for (const name of readdirSync(directory)) {
    const absolute = join(directory, name);
    if (statSync(absolute).isDirectory())
      output.push(...walkFiles(absolute, extension));
    else if (absolute.endsWith(extension)) output.push(absolute);
  }
  return output;
}

function testWhatsAppCtaContext(): void {
  const tsxFiles = walkFiles(join(root, "src"), ".tsx");
  const missing: string[] = [];
  const supportWithoutExclusion: string[] = [];
  const whatsappHref =
    /(?:wa\.me|api\.whatsapp|whatsapp|whatsApp|getIan|ianHref|waHref|tradeInHref|financeHref|heroWhatsAppHref|seminovosWhatsAppHref|comparisonWhatsAppUrl|primaryHref)/i;

  for (const file of tsxFiles) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/<a\b[\s\S]*?>/g)) {
      const tag = match[0];
      const href =
        tag.match(/\bhref\s*=\s*(?:"[^"]*"|'[^']*'|\{[\s\S]*?\})/)?.[0] ?? "";
      if (!whatsappHref.test(href)) continue;
      const where = `${relative(root, file)}:${source.slice(0, match.index).split("\n").length}`;
      if (
        !/\bdata-wa-source\s*=/.test(tag) ||
        !/\bdata-wa-intent\s*=/.test(tag)
      ) {
        missing.push(where);
      }
      if (
        /5551995109169|support|suporte|nethelp/i.test(`${href} ${tag}`) &&
        !/data-wa-conversion\s*=\s*["']support["']/.test(tag)
      ) {
        supportWithoutExclusion.push(where);
      }
    }
  }

  assert(
    missing.length === 0,
    `CTAs de WhatsApp sem source/intent: ${missing.join(", ")}`,
  );
  assert(
    supportWithoutExclusion.length === 0,
    `CTAs de suporte sem exclusão comercial: ${supportWithoutExclusion.join(", ")}`,
  );
}

function testNoHardcodedSecretsOrInsecureEvolution(): void {
  const sensitiveFiles = [
    ...walkFiles(join(root, "scripts"), ".py"),
    ...walkFiles(join(root, "scripts"), ".sh"),
  ]
    .filter((path) => !path.split("/").pop()?.startsWith("validate-"))
    .map((path) => relative(root, path));
  const failures: string[] = [];

  for (const path of sensitiveFiles) {
    const source = read(path);
    if (
      /\b(?:apikey|api_key|token|secret|password)\b\s*=\s*["'][A-Za-z0-9_-]{20,}["']/i.test(
        source,
      )
    ) {
      failures.push(`${path}: segredo literal`);
    }
    if (
      /os\.environ\.get\(\s*["'](?:EVO_API_KEY|WA_LOG_TOKEN)["']\s*,\s*["'][^"']+["']/i.test(
        source,
      )
    ) {
      failures.push(`${path}: segredo como fallback`);
    }
    const evolutionHttp = source.match(/http:\/\/[^\s"']+/gi) ?? [];
    const remoteEvolutionHttp = evolutionHttp.some((url) => {
      try {
        const normalized = url
          .replace(/\$\{[^}]+\}/g, "18080")
          .replace(/\$[A-Za-z_][A-Za-z0-9_]*/g, "18080");
        const host = new URL(normalized).hostname;
        return !["127.0.0.1", "localhost", "::1"].includes(host);
      } catch {
        return true;
      }
    });
    const loopbackWithoutSshGuard =
      evolutionHttp.length > 0 &&
      !remoteEvolutionHttp &&
      (!source.includes("EVO_SSH_TARGET") || !source.includes("ssh_args"));
    if (
      /EVO|evolution/i.test(source) &&
      (remoteEvolutionHttp || loopbackWithoutSshGuard)
    ) {
      failures.push(`${path}: Evolution em HTTP fora de tunel SSH loopback`);
    }
    if (/subprocess[\s\S]{0,1600}(?:apikey|api_key)/i.test(source)) {
      failures.push(`${path}: chave exposta na linha de comando`);
    }
  }

  assert(failures.length === 0, failures.join("; "));
}

function testOfflinePipelineContract(): void {
  const source = read("scripts/atribuicao_enrich.py");
  const evolutionSource = read("scripts/evolution_attribution.py");
  for (const token of [
    "wa_clicks_log.jsonl",
    "ATTRIBUTION_CLICK_LOG_PATH",
    "click_match_method",
    "click_match_confidence",
    "crm_match_method",
    "crm_match_confidence",
    "sale_match_method",
    "sale_match_confidence",
    "match_method",
    "confidence",
  ]) {
    assert(source.includes(token), `pipeline offline não implementa ${token}`);
  }
  assert(
    /click_id[\s\S]{0,500}wa_ref[\s\S]{0,500}(?:code|codigo_site)/.test(source),
    "pipeline não aceita click_id, wa_ref e código legado",
  );
  assert(
    evolutionSource.includes("MGODSRU") &&
      evolutionSource.includes("CROCKFORD_7"),
    "parser Evolution não reconhece todas as fontes da nova wa_ref Base32",
  );
}

function resolvePythonRuntime(): string | null {
  const probeEnv = { ...process.env };
  delete probeEnv.PYTHONHOME;
  delete probeEnv.PYTHONPATH;
  delete probeEnv.PYTHONTZPATH;
  const configured = process.env.ATTRIBUTION_PYTHON?.trim();
  const candidates = [...new Set([configured, "python3", "python"])].filter(
    (candidate): candidate is string => Boolean(candidate),
  );

  for (const candidate of candidates) {
    const probe = spawnSync(
      candidate,
      [
        "-c",
        "import sys; raise SystemExit(0 if sys.version_info >= (3, 9) else 1)",
      ],
      { env: probeEnv, stdio: "ignore" },
    );
    if (probe.status === 0) return candidate;
  }
  return null;
}

function offlineFixtureEnv(fixtureDir: string): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const privatePrefixes = [
    "ATTRIBUTION_",
    "NETCAR_ATTRIBUTION_",
    "EVO_",
    "EVOLUTION_",
    "WA_LOG_",
    "CRM_",
    "ERP_",
    "PG_",
    "MYSQL_",
    "GOOGLE_ADS_",
    "META_",
  ];
  for (const key of Object.keys(env)) {
    if (privatePrefixes.some((prefix) => key.startsWith(prefix))) {
      delete env[key];
    }
  }
  delete env.PYTHONHOME;
  delete env.PYTHONPATH;
  delete env.PYTHONTZPATH;

  return {
    ...env,
    ATTRIBUTION_DATA_DIR: fixtureDir,
    ATTRIBUTION_SOURCE_TIMEZONE: "America/Sao_Paulo",
    NETCAR_ATTRIBUTION_ENV_FILE: join(fixtureDir, "sem-segredos.env"),
  };
}

function testOfflinePipelineRuntime(): void {
  const pythonRuntime = resolvePythonRuntime();
  if (!pythonRuntime) {
    console.warn(
      "Aviso: Python 3.9+ indisponível; fixture runtime da atribuição offline ignorada no build frontend.",
    );
    return;
  }

  const fixtureDir = mkdtempSync(join(tmpdir(), "netcar-attribution-test-"));
  const evolutionCsv = join(fixtureDir, "evolution.csv");
  const clickLog = join(fixtureDir, "wa_clicks_log.jsonl");
  const crmCsv = join(fixtureDir, "crm.csv");
  const salesCsv = join(fixtureDir, "sales.csv");
  const outputCsv = join(fixtureDir, "output.csv");
  const auditJson = join(fixtureDir, "audit.json");
  const conversionsCsv = join(fixtureDir, "confirmed.csv");
  const clickId = `nc_${"a".repeat(32)}`;
  const waRef = "G2345678";

  try {
    writeFileSync(
      evolutionCsv,
      [
        "telefone,jid,primeiro_contato,primeiro_contato_epoch,wa_ref,click_id,origem",
        `51999999999,5551999999999@s.whatsapp.net,2026-08-31T10:00:00Z,,${waRef},${clickId},Google Ads`,
      ].join("\n"),
    );
    writeFileSync(
      clickLog,
      `${JSON.stringify({
        ts: "2026-08-31T09:59:00Z",
        click_id: clickId,
        wa_ref: waRef,
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "estoque-rs",
        utm_content: "fastback",
        gclid: "gclid-fixture",
        fbclid: "",
        landing_page: "/veiculo/fastback",
        vehicle_id: "19884",
        vehicle_name: "Fastback Impetus",
        intent: "vehicle_inquiry",
        source: "vehicle_sidebar",
        store: "loja_1",
        salesperson: "Consultor teste",
      })}\n`,
    );
    writeFileSync(
      crmCsv,
      [
        "id,deal_id,telefone,created_at,click_id,wa_ref,store,salesperson",
        `crm-1,deal-77,51999999999,2026-08-31T10:02:00Z,${clickId},${waRef},loja_1,Consultor teste`,
      ].join("\n"),
    );
    writeFileSync(
      salesCsv,
      [
        "id,deal_id,customer_id,telefone,sold_at,store,salesperson",
        "sale-1,deal-77,customer-9,51999999999,2026-09-01T14:00:00Z,loja_1,Consultor teste",
      ].join("\n"),
    );

    const result = spawnSync(
      pythonRuntime,
      [
        join(root, "scripts/atribuicao_enrich.py"),
        "--evolution-csv",
        evolutionCsv,
        "--click-log",
        clickLog,
        "--crm-csv",
        crmCsv,
        "--sales-csv",
        salesCsv,
        "--output",
        outputCsv,
        "--audit-output",
        auditJson,
        "--confirmed-conversions-output",
        conversionsCsv,
        "--skip-databases",
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: offlineFixtureEnv(fixtureDir),
      },
    );
    const failureDetail = [
      result.error
        ? `${(result.error as NodeJS.ErrnoException).code || "spawn"}: ${result.error.message}`
        : "",
      result.signal ? `sinal ${result.signal}` : "",
      result.stderr?.trim(),
      result.stdout?.trim(),
      result.status === null ? "processo não iniciou" : "",
    ]
      .filter(Boolean)
      .join(" | ");
    assert(
      result.status === 0,
      `pipeline offline falhou com fixtures: ${failureDetail || `status ${result.status}`}`,
    );

    const output = readFileSync(outputCsv, "utf8");
    const header = output.split("\n", 1)[0].split(",");
    for (const field of [
      "click_match_method",
      "click_match_confidence",
      "crm_match_method",
      "crm_match_confidence",
      "sale_match_method",
      "sale_match_confidence",
      "match_method",
      "confidence",
    ]) {
      assert(
        header.includes(field),
        `saída offline não emitiu a coluna ${field}`,
      );
    }
    assert(
      output.includes("click_id_exact") && output.includes("business_id_exact"),
      "pipeline não conciliou click_id/negócio exatos nas fixtures",
    );
    assert(
      output.includes("gclid-fixture") && output.includes("estoque-rs"),
      "pipeline consumiu o log, mas perdeu campanha/gclid na saída",
    );

    const audit = JSON.parse(readFileSync(auditJson, "utf8")) as {
      schema_version?: number;
      input_counts?: Record<string, number>;
      matched_totals?: Record<string, number>;
      identity_coverage?: Record<string, number>;
      freshness?: Record<string, string>;
    };
    assert(
      audit.schema_version === 3 &&
        audit.input_counts?.site_clicks === 1 &&
        audit.matched_totals?.click === 1 &&
        audit.matched_totals?.crm === 1 &&
        audit.matched_totals?.sale === 1 &&
        audit.identity_coverage?.site_clicks_with_strong_click_id === 1 &&
        audit.identity_coverage?.evolution_leads_with_new_wa_ref === 1 &&
        audit.freshness?.latest_evolution_lead_at === "2026-08-31T10:00:00Z",
      "auditoria offline não comprovou o caminho clique → CRM → venda",
    );
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  testStrongClickIdentity();
  await testClickLogContext();
  await testDelegatedWhatsAppLinkTransaction();
  testSingleWhatsAppEmission();
  testSupportIsNotAConversion();
  await testPrivacyChoiceClearsAndBlocksAttribution();
  testLeadIntentBoundary();
  testPageTypes();
  testEcommerceCleanup();
  testComparisonReadyTransition();
  testWhatsAppCtaContext();
  testNoHardcodedSecretsOrInsecureEvolution();
  testOfflinePipelineContract();
  testOfflinePipelineRuntime();

  console.log(
    "Atribuição validada: emissão única, suporte excluído, identidade forte, CTAs contextualizados, funil correto, ecommerce limpo, comparação por transição e pipeline seguro.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
