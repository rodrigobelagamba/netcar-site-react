#!/usr/bin/env tsx

import assert from "node:assert/strict";
import { captureTrafficSource, getTrafficSource } from "../src/lib/waTracking";
import {
  trackPageView,
  trackRegionalCtaClick,
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

console.log(
  "Atribuição GBP validada: cidade, campanha e Loja 1/Loja 2 seguem até os eventos regionais e de WhatsApp.",
);
