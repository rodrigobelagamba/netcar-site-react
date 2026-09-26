#!/usr/bin/env tsx

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  captureTrafficSource,
  clearTrafficAttribution,
  getTrafficSource,
} from "../src/lib/waTracking";
import {
  trackPageView,
  trackCompareInteraction,
  trackRegionalCtaClick,
  trackStockFilterApply,
  trackVehicleCardOpen,
  trackViewItem,
  trackWhatsAppClick,
} from "../src/lib/analytics";

const storage = new Map<string, string>();
const dataLayer: Record<string, unknown>[] = [];
const gtagCalls: unknown[][] = [];
const location = {
  pathname: "/seminovos-canoas",
  search:
    "?utm_source=google&utm_medium=organic&utm_campaign=gbp_canoas&utm_content=loja_1_post",
  href: "https://www.netcarmultimarcas.com.br/seminovos-canoas?utm_source=google&utm_medium=organic&utm_campaign=gbp_canoas&utm_content=loja_1_post",
};

Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  },
  document: {
    referrer: "",
    title: "Seminovos em Canoas",
  },
  window: {
    dataLayer,
    location,
    __netcarPrivacyConsent: "accepted",
    gtag: (...args: unknown[]) => gtagCalls.push(args),
  },
});

captureTrafficSource();

assert.deepEqual(getTrafficSource(), {
  src: "GORG",
  campaign: "gbp-canoas",
  utmSource: "google",
  utmMedium: "organic",
  utmContent: "loja_1_post",
  utmTerm: undefined,
  landingPage: "/seminovos-canoas",
});

const canoasPath = `${location.pathname}${location.search}`;
trackPageView(canoasPath);
assert.deepEqual(
  gtagCalls.map((call) => call.slice(0, 2)),
  [
    ["config", "G-MGPNBDNQ9G"],
    ["event", "regional_landing_view"],
  ],
  "configuração da página deve preceder o evento regional, sem duplicação",
);
const initialPageConfig = gtagCalls[0][2] as Record<string, unknown>;
assert.equal(initialPageConfig.page_path, canoasPath);
assert.equal(initialPageConfig.page_location, location.href);
assert.equal(initialPageConfig.traffic_utm_source, "google");
assert.equal(initialPageConfig.traffic_medium, "organic");
assert.equal(initialPageConfig.privacy_consent, "accepted");
assert.equal(
  Object.hasOwn(initialPageConfig, "send_page_view"),
  false,
  "a ordem não deve alterar a política existente de page_view",
);
trackRegionalCtaClick("whatsapp", canoasPath);
trackWhatsAppClick({
  source: "landing",
  intent: "regional_help",
  pagePath: canoasPath,
});

for (const eventName of [
  "virtual_page_view",
  "regional_landing_view",
  "regional_cta_click",
  "whatsapp_click",
]) {
  const event = dataLayer.find((item) => item.event === eventName);
  assert(event, `${eventName} não foi enviado`);
  assert.equal(event.regional_city_slug, "canoas");
  assert.equal(event.traffic_source, "GORG");
  assert.equal(event.traffic_campaign, "gbp-canoas");
  assert.equal(event.traffic_utm_source, "google");
  assert.equal(event.traffic_medium, "organic");
  assert.equal(event.traffic_content, "loja_1_post");
  assert.equal(event.gbp_profile, "loja_1");
}

for (const eventName of ["regional_landing_view", "regional_cta_click"]) {
  assert(
    gtagCalls.some((call) => call[0] === "event" && call[1] === eventName),
    `${eventName} não chegou à fila direta do GA4`,
  );
}

assert.equal(
  dataLayer.filter((item) => item.event === "whatsapp_click").length,
  1,
  "whatsapp_click regional deve entrar uma única vez no GTM",
);
assert.equal(
  gtagCalls.filter(
    (call) => call[0] === "event" && call[1] === "whatsapp_click",
  ).length,
  1,
  "whatsapp_click regional não chegou uma única vez ao GA4 direto",
);

const regionalWaDataLayer = dataLayer.find(
  (item) => item.event === "whatsapp_click",
);
const regionalWaGtag = gtagCalls.find(
  (call) => call[0] === "event" && call[1] === "whatsapp_click",
)?.[2] as Record<string, unknown> | undefined;
assert(
  regionalWaDataLayer && regionalWaGtag,
  "identidade WhatsApp regional ausente",
);
assert.equal(regionalWaDataLayer.click_id, regionalWaGtag.click_id);
assert.equal(regionalWaDataLayer.wa_event_id, regionalWaGtag.wa_event_id);
assert.equal(regionalWaDataLayer.wa_ads_conversion, true);
assert.equal(regionalWaGtag.wa_ads_conversion, false);

const regionalCtaEvent = dataLayer.find(
  (item) => item.event === "regional_cta_click",
);
assert(regionalCtaEvent, "regional_cta_click não foi enviado");
assert.equal(regionalCtaEvent.regional_action, "whatsapp");

location.pathname = "/seminovos-sapucaia-do-sul";
location.search =
  "?utm_source=google&utm_medium=organic&utm_campaign=gbp_sapucaia&utm_content=loja_2_post";
location.href = `https://www.netcarmultimarcas.com.br${location.pathname}${location.search}`;
captureTrafficSource();

assert.equal(getTrafficSource().campaign, "gbp-sapucaia");
assert.equal(getTrafficSource().utmContent, "loja_2_post");

trackPageView(`${location.pathname}${location.search}`);
const sapucaiaEvent = [...dataLayer]
  .reverse()
  .find((item) => item.event === "regional_landing_view");

assert(sapucaiaEvent, "regional_landing_view de Sapucaia não foi enviado");
assert.equal(sapucaiaEvent.regional_city_slug, "sapucaia-do-sul");
assert.equal(sapucaiaEvent.gbp_profile, "loja_2");
assert.equal(sapucaiaEvent.traffic_content, "loja_2_post");

dataLayer.length = 0;
trackPageView("/expointer-esteio");
trackRegionalCtaClick("expointer_view_stock", "/expointer-esteio");
trackRegionalCtaClick("expointer_route_loja_1", "/expointer-esteio");
trackRegionalCtaClick("expointer_route_loja_2", "/expointer-esteio");
assert.equal(
  dataLayer.filter((row) => row.event === "regional_landing_view").length,
  1,
);
assert.equal(
  dataLayer.filter((row) => row.event === "regional_cta_click").length,
  3,
);
assert.equal(
  dataLayer.filter((row) => row.event === "regional_stock_click").length,
  1,
);
for (const row of dataLayer.filter(
  (item) => item.event === "regional_cta_click",
)) {
  assert.equal(row.page_type, "event_landing");
  assert.equal(row.regional_city_slug, "esteio");
  assert.equal(row.landing_slug, "expointer-esteio");
}

function navigate(pathname: string, search = "") {
  location.pathname = pathname;
  location.search = search;
  location.href = `https://www.netcarmultimarcas.com.br${pathname}${search}`;
  trackPageView(`${pathname}${search}`);
}

function latestEvent(name: string) {
  const event = [...dataLayer].reverse().find((row) => row.event === name);
  assert(event, `Evento ausente: ${name}`);
  return event;
}

function effectiveGa4Event(name: string) {
  let defaults: Record<string, unknown> = {};
  let result: Record<string, unknown> | undefined;
  for (const call of gtagCalls) {
    if (call[0] === "config") {
      defaults = { ...defaults, ...(call[2] as Record<string, unknown>) };
    } else if (call[0] === "event" && call[1] === name) {
      result = { ...defaults, ...(call[2] as Record<string, unknown>) };
    }
  }
  assert(result, `Evento GA4 ausente: ${name}`);
  return result;
}

function effectiveDataLayerEvent(name: string) {
  let defaults: Record<string, unknown> = {};
  let result: Record<string, unknown> | undefined;
  for (const row of dataLayer) {
    defaults = { ...defaults, ...row };
    if (row.event === name) result = { ...defaults };
  }
  assert(result, `Evento Data Layer ausente: ${name}`);
  return result;
}

clearTrafficAttribution();
dataLayer.length = 0;
gtagCalls.length = 0;
navigate(
  "/seminovos-canoas",
  "?utm_source=google&utm_medium=organic&utm_campaign=gbp_canoas",
);
captureTrafficSource();
trackRegionalCtaClick("view_stock");
navigate("/seminovos");
trackStockFilterApply({ filters: { cambio: "AUTOMATICO" }, resultCount: 6 });
trackVehicleCardOpen({
  via: "button",
  vehicleId: "123",
  vehicleName: "Carro teste",
  source: "inventory",
});
navigate("/veiculo/carro-teste-123");
trackViewItem({ vehicleId: "123", vehicleName: "Carro teste" });
trackWhatsAppClick({ source: "hero", vehicleId: "123" });

for (const name of [
  "regional_stock_click",
  "stock_filter_apply",
  "vehicle_card_open",
  "view_item",
  "whatsapp_click",
]) {
  const rows = dataLayer.filter((row) => row.event === name);
  assert.equal(rows.length, 1, `${name}: um gesto deve emitir um evento`);
  assert.equal(rows[0].regional_city_slug, "canoas");
  assert.equal(rows[0].regional_origin_path, "/seminovos-canoas");
  assert.equal(rows[0].traffic_landing_page, "/seminovos-canoas");
  const direct = gtagCalls.filter(
    (call) => call[0] === "event" && call[1] === name,
  );
  assert.equal(direct.length, 1, `${name}: envio direto duplicado/ausente`);
  const payload = direct[0][2] as Record<string, unknown>;
  assert.equal(payload.regional_city_slug, rows[0].regional_city_slug);
  assert.equal(payload.regional_origin_path, rows[0].regional_origin_path);
}
assert.equal(latestEvent("vehicle_card_open").page_path, "/seminovos");
assert.equal(latestEvent("view_item").page_path, "/veiculo/carro-teste-123");
assert.equal(latestEvent("whatsapp_click").wa_page_type, "vehicle_detail");
assert.equal(
  dataLayer.some((row) => ["generate_lead", "purchase"].includes(String(row.event))),
  false,
  "navegação/WhatsApp não pode virar lead confirmado ou venda",
);

// Cidade consultada pode mudar sem reescrever a origem de aquisição.
navigate("/seminovos-sapucaia-do-sul");
navigate("/veiculo/carro-teste-123");
trackWhatsAppClick({ source: "hero", vehicleId: "123" });
assert.equal(latestEvent("whatsapp_click").regional_city_slug, "sapucaia-do-sul");
assert.equal(
  latestEvent("whatsapp_click").regional_origin_path,
  "/seminovos-sapucaia-do-sul",
);
assert.equal(latestEvent("whatsapp_click").traffic_landing_page, "/seminovos-canoas");

// Mesma rota, sem page_view entre a revogação e um evento sem contexto próprio.
navigate("/comparar");
const privacySource = readFileSync(
  new URL("../src/components/PrivacyConsent.tsx", import.meta.url), "utf8",
);
assert.ok(
  privacySource.indexOf("window.netcarSetPrivacyConsent?.(choice)") <
    privacySource.indexOf('if (choice === "essential") clearTrafficAttribution()'),
  "a UI precisa aplicar a escolha antes de limpar os defaults de medição",
);
window.__netcarPrivacyConsent = "essential";
const callsBeforeRevocation = gtagCalls.length;
clearTrafficAttribution();
const revocationCalls = gtagCalls.slice(callsBeforeRevocation);
assert.equal(revocationCalls.length, 1);
assert.equal(revocationCalls[0][0], "config");
assert.equal(
  (revocationCalls[0][2] as Record<string, unknown>).update,
  true,
  "revogação precisa atualizar os defaults sem page_view adicional",
);
trackCompareInteraction({ action: "select", vehicleIds: ["123"] });
for (const event of [
  effectiveGa4Event("compare_vehicle_select"),
  effectiveDataLayerEvent("compare_vehicle_select"),
]) {
  assert.equal(event.regional_city_slug, "", "defaults herdaram a cidade revogada");
  assert.equal(event.regional_origin_path, "", "defaults herdaram a página regional");
  assert.equal(event.privacy_consent, "essential", "defaults mantiveram o aceite antigo");
  assert.equal(event.traffic_source, "DIR");
  for (const key of [
    "traffic_campaign", "traffic_utm_source", "traffic_medium", "traffic_content",
    "traffic_utm_term", "traffic_landing_page", "traffic_referrer", "traffic_gclid",
    "traffic_gbraid", "traffic_wbraid", "traffic_fbclid", "gbp_profile",
  ]) {
    assert.equal(event[key], "", `default ${key} não foi apagado`);
  }
}

// A jornada também não deve voltar ao navegar ou aceitar novamente.
navigate("/seminovos");
trackVehicleCardOpen({
  via: "card",
  vehicleId: "123",
  vehicleName: "Carro teste",
  source: "inventory",
});
trackWhatsAppClick({ source: "hero", vehicleId: "123" });
for (const name of ["virtual_page_view", "vehicle_card_open", "whatsapp_click"]) {
  const event = latestEvent(name);
  assert.equal(event.regional_city_slug, "", `${name}: vazou cidade anterior`);
  assert.equal(event.regional_origin_path, "", `${name}: vazou jornada anterior`);
}
assert.equal(latestEvent("vehicle_card_open").traffic_landing_page, "");
const essentialPageConfig = [...gtagCalls].reverse().find((call) => call[0] === "config");
assert.equal((essentialPageConfig?.[2] as Record<string, unknown>).regional_city_slug, "");

// Sem aceite permanece só a cidade da página atual, sem carregar essa história.
navigate("/seminovos-canoas");
assert.equal(latestEvent("regional_landing_view").regional_city_slug, "canoas");
assert.equal(latestEvent("regional_landing_view").regional_origin_path, "");
navigate("/seminovos");
window.__netcarPrivacyConsent = "accepted";
trackWhatsAppClick({ source: "inventory" });
assert.equal(latestEvent("whatsapp_click").regional_city_slug, "");
assert.equal(latestEvent("whatsapp_click").regional_origin_path, "");
assert.equal(storage.has("nc_traffic_ref"), false);

// Interesse direto funciona sem Google/UTM, e o aceite não cria novo storage.
navigate("/seminovos-nova-santa-rita");
trackVehicleCardOpen({
  via: "card",
  vehicleId: "123",
  vehicleName: "Carro teste",
  source: "regional_stock",
});
assert.equal(latestEvent("vehicle_card_open").regional_city_slug, "nova-santa-rita");
assert.equal(latestEvent("vehicle_card_open").page_path, "/seminovos-nova-santa-rita");
navigate("/veiculo/carro-teste-123");
trackWhatsAppClick({ source: "hero", vehicleId: "123" });
assert.equal(latestEvent("whatsapp_click").regional_city_slug, "nova-santa-rita");
assert.equal(latestEvent("whatsapp_click").traffic_landing_page, "");
assert.equal(storage.size, 0, "interesse regional não deve persistir no navegador");

// Ainda sem decisão de cookies também não há memória regional entre páginas.
window.__netcarPrivacyConsent = undefined;
navigate("/seminovos-canoas");
navigate("/veiculo/carro-teste-123");
trackViewItem({ vehicleId: "123", vehicleName: "Carro teste" });
assert.equal(latestEvent("view_item").regional_city_slug, "");
assert.equal(latestEvent("view_item").regional_origin_path, "");
assert.equal(storage.size, 0);

console.log(
  "Atribuição GBP e jornada regional validadas: origem preservada, cidade de interesse até a ficha/WhatsApp, sem duplicação ou persistência extra e com revogação respeitada.",
);
