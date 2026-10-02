/**
 * Offline regressions for event context and the direct GA4 ecommerce payload.
 * Runs real tracking helpers and React effects; never loads a Google tag,
 * performs a network request, or changes the owner of page_view collection.
 * Run: npx tsx scripts/validate-analytics-context.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  GA4_MEASUREMENT_ID,
  resetComparisonTracking,
  trackBlogDiscoveryClick,
  trackCompareInteraction,
  trackHomeScrollDepth,
  trackPageView,
  trackVehicleCardOpen,
  trackVehicleDiscoveryClick,
  trackViewItem,
} from "../src/lib/analytics";
import {
  captureTrafficSource,
  clearTrafficAttribution,
  getTrafficSource,
} from "../src/lib/waTracking";

// The deploy process inherits NODE_ENV=production, where React disables act.
// Select the test runtime before importing React or any hook that imports it.
// This affects only this validator process, not the subsequent production build.
process.env.NODE_ENV = "test";
const { default: React, useEffect } = await import("react");
const { default: TestRenderer, act } = await import("react-test-renderer");
const { useMetaTags } = await import("../src/hooks/useMetaTags");

type Payload = Record<string, any>;
type GtagCall = [string, string, Payload?];
const origin = "https://www.netcarmultimarcas.com.br";
const calls: GtagCall[] = [];
const storage = new Map<string, string>();
const originals = new Map<string, PropertyDescriptor | undefined>();
let fakeWindow: {
  location: URL;
  dataLayer: Payload[];
  __netcarPrivacyConsent: string;
  gtag: (...args: GtagCall) => void;
};
let fakeDocument: {
  title: string;
  referrer: string;
  querySelector: () => null;
  createElement: () => { setAttribute: () => void };
  head: { appendChild: () => void };
};
let renderer: ReturnType<typeof TestRenderer.create> | undefined;

function replaceGlobal(name: string, value: unknown): void {
  originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
  });
}

function setPage(path: string, title: string): void {
  fakeWindow.location = new URL(path, origin);
  fakeDocument.title = title;
}

function gaEvents(name?: string): GtagCall[] {
  return calls.filter(
    ([command, event]) => command === "event" && (!name || event === name),
  );
}

function layerEvents(name?: string): Payload[] {
  return fakeWindow.dataLayer.filter(
    (row) => typeof row.event === "string" && (!name || row.event === name),
  );
}

function assertContext(
  payload: Payload,
  path: string,
  title: string,
  pageType: string,
): void {
  assert.equal(payload.page_path, path);
  assert.equal(payload.page_location, new URL(path, origin).href);
  assert.equal(payload.page_title, title);
  assert.equal(payload.page_type, pageType);
}

function assertNoNewPageMeasurement(configCount: number): void {
  assert.equal(
    calls.filter(([command]) => command === "config").length,
    configCount,
  );
  assert.equal(gaEvents("page_view").length, 0);
  assert.equal(layerEvents("page_view").length, 0);
}

describe(
  "analytics event context without browser or network",
  { concurrency: false },
  () => {
    beforeEach(() => {
      calls.length = 0;
      storage.clear();
      fakeWindow = {
        location: new URL("/seminovos", origin),
        dataLayer: [],
        __netcarPrivacyConsent: "accepted",
        gtag: (...args: GtagCall) => {
          calls.push(args);
        },
      };
      fakeDocument = {
        title: "Estoque",
        referrer: "https://www.google.com/",
        querySelector: () => null,
        createElement: () => ({ setAttribute() {} }),
        head: { appendChild() {} },
      };
      replaceGlobal("window", fakeWindow);
      replaceGlobal("document", fakeDocument);
      replaceGlobal("localStorage", {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) =>
          storage.set(key, String(value)),
        removeItem: (key: string) => storage.delete(key),
      });
      replaceGlobal("fetch", () => {
        throw new Error(
          "This regression suite must not perform network requests",
        );
      });
      // Reset real module-level attribution without retaining reset telemetry.
      clearTrafficAttribution();
      resetComparisonTracking();
      calls.length = 0;
      fakeWindow.dataLayer.length = 0;
    });

    afterEach(() => {
      if (renderer) act(() => renderer?.unmount());
      renderer = undefined;
      for (const [name, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
      originals.clear();
    });

    it("child effect carries complete page context before the parent config", () => {
      const path = "/veiculo/carro-teste-123";
      const title = "Carro teste | Netcar";
      setPage(path, "Título da página anterior");
      captureTrafficSource();

      function DetailEffect() {
        useMetaTags({ title, url: new URL(path, origin).href });
        useEffect(() => {
          trackViewItem({
            vehicleId: "123",
            vehicleName: "Carro teste",
            price: 99_900,
          });
        }, []);
        return null;
      }
      function ParentRouteEffect() {
        useEffect(() => {
          trackPageView(path);
        }, []);
        return React.createElement(DetailEffect);
      }
      act(() => {
        renderer = TestRenderer.create(React.createElement(ParentRouteEffect));
      });

      // Reproduce React's child-before-parent passive effects, rather than
      // arranging calls manually in the already-correct initialization order.
      assert.deepEqual(
        calls.map(([command, name]) => [command, name]),
        [
          ["event", "view_item"],
          ["config", GA4_MEASUREMENT_ID],
        ],
      );
      assert.equal(gaEvents("view_item").length, 1);
      assert.equal(layerEvents("view_item").length, 1);
      assert.equal(layerEvents("virtual_page_view").length, 1);
      assertContext(
        gaEvents("view_item")[0][2]!,
        path,
        title,
        "vehicle_detail",
      );
      assertContext(layerEvents("view_item")[0], path, title, "vehicle_detail");
      assert.equal(gaEvents("view_item")[0][2]!.traffic_source, "GORG");
      assertNoNewPageMeasurement(1);
    });

    it("the actual vehicle page updates metatags before its view_item effect", () => {
      const source = readFileSync(
        new URL(
          "../src/modules/detalhes/pages/DetalhesPage.tsx",
          import.meta.url,
        ),
        "utf8",
      );
      const componentStart = source.indexOf("export function DetalhesPage");
      assert.ok(componentStart >= 0, "vehicle page component must be found");
      const component = source.slice(componentStart);
      const metadataHook = component.indexOf("useMetaTags(");
      const trackingCall = component.indexOf("trackViewItem({");
      assert.ok(metadataHook >= 0, "vehicle metatags hook must be found");
      assert.ok(
        trackingCall > metadataHook,
        "view_item must follow useMetaTags to avoid the previous DOM title",
      );
    });

    it("an event on the next SPA screen does not inherit the previous page location", () => {
      captureTrafficSource();
      trackPageView("/seminovos");
      const path = "/veiculo/segundo-carro-456";
      setPage(path, "Segundo carro");
      trackVehicleDiscoveryClick({
        source: "breadcrumb",
        targetType: "inventory",
        targetSlug: "seminovos",
        targetName: "Estoque",
        vehicleId: "456",
        vehicleName: "Segundo carro",
      });

      assert.equal(gaEvents().length, 1);
      assertContext(gaEvents()[0][2]!, path, "Segundo carro", "vehicle_detail");
      assertContext(
        layerEvents("vehicle_discovery_click")[0],
        path,
        "Segundo carro",
        "vehicle_detail",
      );
      assert.equal(layerEvents("virtual_page_view").length, 1);
      assertNoNewPageMeasurement(1);
    });

    it("unset, acceptance and revocation on one route use the current consent and traffic", () => {
      setPage("/comparar", "Comparar carros");
      fakeWindow.__netcarPrivacyConsent = "";
      captureTrafficSource();
      trackPageView("/comparar");
      trackCompareInteraction({ action: "select", vehicleIds: ["123"] });

      fakeWindow.__netcarPrivacyConsent = "accepted";
      fakeWindow.gtag("consent", "update", { analytics_storage: "granted" });
      trackCompareInteraction({ action: "select", vehicleIds: ["456"] });
      assert.equal(getTrafficSource().src, "GORG");

      fakeWindow.__netcarPrivacyConsent = "essential";
      fakeWindow.gtag("consent", "update", { analytics_storage: "denied" });
      clearTrafficAttribution();
      trackCompareInteraction({ action: "select", vehicleIds: ["789"] });

      const events = gaEvents("compare_vehicle_select");
      assert.equal(events.length, 3);
      assert.equal(layerEvents("compare_vehicle_select").length, 3);
      for (const [index, [consent, source]] of [
        ["unset", "DIR"],
        ["accepted", "GORG"],
        ["essential", "DIR"],
      ].entries()) {
        const direct = events[index][2]!;
        const layer = layerEvents("compare_vehicle_select")[index];
        for (const payload of [direct, layer]) {
          assert.equal(payload.privacy_consent, consent);
          assert.equal(payload.traffic_source, source);
          assertContext(payload, "/comparar", "Comparar carros", "comparison");
          assert.equal(
            payload.traffic_referrer,
            consent === "accepted" ? "https://www.google.com/" : "",
          );
          assert.equal(payload.traffic_utm_source, "");
          assert.equal(payload.traffic_gclid, "");
        }
      }
      assert.equal(gaEvents().length, 3);
      assert.equal(layerEvents("virtual_page_view").length, 1);
      // Existing revocation behavior updates defaults once; enrichment must not
      // add another config or page view when any of these events is dispatched.
      assertNoNewPageMeasurement(2);
      assert.equal(storage.has("nc_traffic_ref"), false);
    });

    it("scroll enrichment adds context without creating configs or page views", () => {
      setPage("/", "Netcar");
      captureTrafficSource();
      trackHomeScrollDepth(50);
      assert.equal(calls.length, 1);
      assert.equal(layerEvents().length, 1);
      assert.equal(
        gaEvents("scroll_depth_home")[0][2]!.scroll_depth_percent,
        50,
      );
      assertContext(gaEvents()[0][2]!, "/", "Netcar", "home");
      assert.equal(gaEvents()[0][2]!.privacy_consent, "accepted");
      assert.equal(gaEvents()[0][2]!.traffic_source, "GORG");
      assertNoNewPageMeasurement(0);
    });

    it("new default context excludes personal URL parameters and fragments without consent", () => {
      setPage(
        "/comparar?email=private-person%40example.test&telefone=51999998888#nome=PrivatePerson",
        "Comparar carros",
      );
      fakeWindow.__netcarPrivacyConsent = "";
      // Do not capture attribution: this reproduces a business event before
      // initialization or an explicit consent choice on a sensitive URL.
      trackCompareInteraction({ action: "select", vehicleIds: ["123"] });
      assert.equal(gaEvents().length, 1);
      assert.equal(layerEvents().length, 1);
      for (const payload of [gaEvents()[0][2]!, layerEvents()[0]]) {
        assertContext(payload, "/comparar", "Comparar carros", "comparison");
        assert.equal(payload.privacy_consent, "unset");
        assert.equal(payload.traffic_source, "DIR");
        assert.equal(payload.traffic_referrer, "");
        assert.equal(payload.traffic_utm_source, "");
        assert.equal(payload.traffic_gclid, "");
      }
      assert.doesNotMatch(
        JSON.stringify({ calls, dataLayer: fakeWindow.dataLayer }),
        /private-person|example\.test|51999998888|PrivatePerson|email=|telefone=|nome=/i,
      );
      assert.equal(storage.has("nc_traffic_ref"), false);
      assertNoNewPageMeasurement(0);
    });

    it("direct view_item uses root items while GTM retains ecommerce and its reset", () => {
      setPage("/veiculo/carro-teste-123", "Carro teste");
      trackViewItem({
        vehicleId: "123",
        vehicleName: "Carro teste",
        price: 99_900,
        currency: "BRL",
      });
      const direct = gaEvents("view_item")[0][2]!;
      const layer = layerEvents("view_item")[0];
      assert.equal(gaEvents().length, 1);
      assert.equal(layerEvents().length, 1);
      assert.equal(direct.send_to, GA4_MEASUREMENT_ID);
      assert.ok(
        Array.isArray(direct.items),
        "gtag view_item requires items at the event root",
      );
      assert.equal(Object.hasOwn(direct, "ecommerce"), false);
      assert.equal(direct.currency, "BRL");
      assert.equal(direct.value, 99_900);
      assert.equal(layer.ecommerce.currency, "BRL");
      assert.equal(layer.ecommerce.value, 99_900);
      assert.deepEqual(direct.items, layer.ecommerce.items);
      assert.equal(direct.items[0].item_id, "123");
      assert.equal(direct.items[0].item_name, "Carro teste");
      assert.equal(direct.items[0].price, 99_900);
      assert.equal(direct.items[0].currency, "BRL");
      assert.equal(direct.items[0].quantity, 1);
      assert.equal(Object.hasOwn(layer, "items"), false);
      assert.deepEqual(fakeWindow.dataLayer[fakeWindow.dataLayer.length - 1], {
        ecommerce: null,
      });
      assertNoNewPageMeasurement(0);
    });

    it("editorial event overrides keep their article source and one event per gesture", () => {
      const currentPath =
        "/blog/carro-para-familia?utm_source=google&utm_medium=organic";
      setPage(currentPath, "Carro para família");
      captureTrafficSource();
      trackBlogDiscoveryClick({
        articleSlug: "carro-para-familia",
        placement: "article_cta",
        targetHref: "/seminovos?categoria=SUV#estoque",
      });
      trackVehicleCardOpen({
        via: "card",
        source: "blog_article",
        vehicleId: "123",
        vehicleName: "Carro teste",
        articleContext: {
          articleSlug: "carro-para-familia",
          placement: "vehicle_card",
          targetPath: "/veiculo/carro-teste-123",
        },
      });
      assert.equal(gaEvents().length, 2);
      assert.equal(layerEvents().length, 2);
      for (const name of ["blog_discovery_click", "vehicle_card_open"]) {
        assert.equal(gaEvents(name).length, 1);
        assert.equal(layerEvents(name).length, 1);
        const payload = gaEvents(name)[0][2]!;
        // Article context deliberately strips the query from page_path. Its
        // explicit source must win over the generic current-route context.
        assert.equal(payload.page_path, "/blog/carro-para-familia");
        assert.equal(
          payload.page_location,
          new URL("/blog/carro-para-familia", origin).href,
        );
        assert.equal(payload.page_title, "Carro para família");
        assert.equal(payload.page_type, "blog_post");
        assert.equal(payload.article_slug, "carro-para-familia");
        assert.equal(payload.traffic_source, "GORG");
        assert.equal(payload.privacy_consent, "accepted");
      }
      assert.equal(
        gaEvents("blog_discovery_click")[0][2]!.article_placement,
        "article_cta",
      );
      assert.equal(
        gaEvents("blog_discovery_click")[0][2]!.target_path,
        "/seminovos",
      );
      assert.equal(
        gaEvents("vehicle_card_open")[0][2]!.article_placement,
        "vehicle_card",
      );
      assert.equal(
        gaEvents("vehicle_card_open")[0][2]!.target_path,
        "/veiculo/carro-teste-123",
      );
      assertNoNewPageMeasurement(0);
    });
  },
);
