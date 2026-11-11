import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";
import {
  BLACK_FRIDAY_CONFIG_URL,
  BLACK_FRIDAY_END,
  BLACK_FRIDAY_START,
  fetchBlackFridayConfig,
  getBlackFridayBoundaryDelay,
  isBlackFridayActive,
  parseBlackFridayConfig,
} from "../../src/features/black-friday/campaign";
import {
  BlackFridayCampaignProvider,
  useBlackFridayCampaign,
} from "../../src/features/black-friday/CampaignProvider";

const source = JSON.parse(readFileSync(
  new URL("../../public/campaigns/black-friday-2026.json", import.meta.url), "utf8",
));
const enabled = { ...source, enabled: true };
const start = Date.parse(BLACK_FRIDAY_START);
const end = Date.parse(BLACK_FRIDAY_END);

test("public configuration is valid and has the approved November window", () => {
  assert.ok(parseBlackFridayConfig(source));
  assert.equal(start, Date.parse("2026-11-11T03:00:00Z"));
  assert.equal(end, Date.parse("2026-12-01T03:00:00Z"));
});

test("campaign begins inclusively and ends at midnight in São Paulo", () => {
  const config = parseBlackFridayConfig(enabled);
  assert.equal(isBlackFridayActive(config, start - 1), false);
  assert.equal(isBlackFridayActive(config, start), true);
  assert.equal(isBlackFridayActive(config, end - 1), true);
  assert.equal(isBlackFridayActive(config, end), false);
  assert.equal(isBlackFridayActive(config, end + 86_400_000), false);
});

test("rollback hides the campaign for the full date window", () => {
  const disabled = parseBlackFridayConfig({ ...enabled, enabled: false });
  assert.ok(disabled);
  for (const time of [start, start + 1, end - 1, end]) {
    assert.equal(isBlackFridayActive(disabled, time), false);
  }
});

test("missing, invalid and extended configurations fail closed", () => {
  const invalid = [
    null, undefined, [], {}, "enabled", { ...enabled, enabled: "true" },
    { ...enabled, id: "acelerou-levou" },
    { ...enabled, startsAt: "2026-11-10T00:00:00-03:00" },
    { ...enabled, endsAt: "2026-12-31T00:00:00-03:00" },
    { ...enabled, endsAt: "bad date" },
  ];
  for (const value of invalid) {
    assert.equal(parseBlackFridayConfig(value), null);
    assert.equal(isBlackFridayActive(parseBlackFridayConfig(value), start), false);
  }
  assert.equal(isBlackFridayActive(parseBlackFridayConfig(enabled), NaN), false);
});

test("next timer boundary covers open tabs and avoids browser timer overflow", () => {
  assert.equal(getBlackFridayBoundaryDelay(start - 1), 1);
  assert.equal(getBlackFridayBoundaryDelay(end - 1), 1);
  assert.equal(getBlackFridayBoundaryDelay(end), null);
  assert.equal(getBlackFridayBoundaryDelay(NaN), null);
  assert.equal(getBlackFridayBoundaryDelay(0), 2_147_483_647);
});

test("runtime fetch bypasses browser cache and accepts a disabled config", async () => {
  const controller = new AbortController();
  const result = await fetchBlackFridayConfig(async (url, options) => {
    assert.equal(url, BLACK_FRIDAY_CONFIG_URL);
    assert.equal(options.cache, "no-store");
    assert.equal(options.credentials, "same-origin");
    assert.equal(options.signal, controller.signal);
    return { ok: true, json: async () => ({ ...enabled, enabled: false }) };
  }, controller.signal);
  assert.equal(result?.enabled, false);
});

test("HTTP, JSON, network and missing-file HTML failures fail closed", async () => {
  assert.equal(await fetchBlackFridayConfig(async () => ({ ok: false, json: async () => enabled })), null);
  assert.equal(await fetchBlackFridayConfig(async () => ({ ok: true, json: async () => null })), null);
  assert.equal(await fetchBlackFridayConfig(async () => ({ ok: true, json: async () => { throw new SyntaxError("HTML fallback"); } })), null);
  assert.equal(await fetchBlackFridayConfig(async () => { throw new Error("offline"); }), null);
});

test("mounted provider expires without navigation and refreshes rollback/failure", async (t) => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  t.mock.timers.enable({ apis: ["Date", "setTimeout", "setInterval"], now: end - 1_000 });
  const browser = Object.assign(new EventTarget(), {
    setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
    clearTimeout: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer),
    setInterval: (callback: () => void, delay: number) => setInterval(callback, delay),
    clearInterval: (timer: ReturnType<typeof setInterval>) => clearInterval(timer),
  });
  const document = Object.assign(new EventTarget(), { visibilityState: "visible" });
  Object.defineProperty(globalThis, "window", { configurable: true, value: browser });
  Object.defineProperty(globalThis, "document", { configurable: true, value: document });
  let response: unknown = enabled;
  let fail = false;
  t.mock.method(globalThis, "fetch", async () => {
    if (fail) throw new Error("offline");
    return { ok: true, json: async () => response };
  });
  let observed = false;
  function Consumer() {
    observed = useBlackFridayCampaign().active;
    return null;
  }
  let renderer: TestRenderer.ReactTestRenderer;
  t.after(() => {
    act(() => renderer?.unmount());
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument);
    else Reflect.deleteProperty(globalThis, "document");
  });
  await act(async () => {
    renderer = TestRenderer.create(createElement(BlackFridayCampaignProvider, {
      children: createElement(Consumer),
    }));
  });
  assert.equal(observed, true);

  response = { ...enabled, enabled: false };
  await act(async () => { browser.dispatchEvent(new Event("focus")); });
  assert.equal(observed, false, "manual rollback affects an already-open tab");

  response = enabled;
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
  assert.equal(observed, true);
  fail = true;
  await act(async () => { browser.dispatchEvent(new Event("focus")); });
  assert.equal(observed, false, "a failed refresh cannot retain an offer");

  fail = false;
  await act(async () => { browser.dispatchEvent(new Event("focus")); });
  assert.equal(observed, true);
  await act(async () => { t.mock.timers.tick(1_000); });
  assert.equal(observed, false, "expiry applies without a route change or reload");
});
