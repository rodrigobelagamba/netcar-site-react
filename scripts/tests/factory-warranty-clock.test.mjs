import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../../", import.meta.url));
const cacheDir = mkdtempSync(resolve(tmpdir(), "warranty-clock-vite-"));
const matrix = JSON.parse(readFileSync(resolve(root, "src/data/factoryWarrantyMatrix.json"), "utf8"));
const observed = JSON.parse(readFileSync(resolve(root, "docs/audits/factory-warranty-reconciliation-2026-10-09.json"), "utf8")).publicVehicles;
const reviewedVehicle = observed.find((vehicle) => vehicle.id === "19587");
assert.ok(reviewedVehicle, "The real reviewed Tera fixture must exist");

const OriginalDate = globalThis.Date;
const originalFetch = globalThis.fetch;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
const nativeSetTimeout = globalThis.setTimeout;
const nativeClearTimeout = globalThis.clearTimeout;
const nativeSetInterval = globalThis.setInterval;
const nativeClearInterval = globalThis.clearInterval;
const START = OriginalDate.parse("2026-10-23T12:00:00.000Z");
const KEY = ["factory-warranty-registry"];
const TICK = 15_000;
let now = START;
let server, useFactoryWarrantyStamps, factoryWarrantyReviewFingerprint, maxAge;
let client, renderer, windowTarget, documentTarget;
let calls, renders, results, timers, timerSequence;

class FixedDate extends OriginalDate {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
}

function eventTarget(extra = {}) {
  const listeners = new Map();
  return {
    ...extra,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    dispatch(type) {
      for (const listener of [...(listeners.get(type) || [])]) listener({ type });
    },
    listenerCount(type) {
      return type ? (listeners.get(type)?.size || 0)
        : [...listeners.values()].reduce((count, group) => count + group.size, 0);
    },
  };
}

function schedule(callback, delay, repeat, args) {
  // React Query's asynchronous notification queue is allowed to settle normally;
  // long-lived freshness, retry and request-timeout timers use the virtual clock.
  if (!repeat && Number(delay || 0) <= 0) return nativeSetTimeout(callback, 0, ...args);
  const handle = { id: ++timerSequence, unref() { return this; } };
  timers.set(handle, {
    callback, args, delay: Number(delay), due: now + Number(delay), repeat,
  });
  return handle;
}

function clearScheduled(handle, nativeClear) {
  if (!timers.delete(handle)) nativeClear(handle);
}

function clockTimers() {
  // React Query is imported in Node before the browser event targets exist, so
  // its polling is disabled. Request aborts/retries use one-shot timeouts; every
  // interval here belongs to the hook's shared freshness clock.
  return [...timers.values()].filter((timer) => timer.repeat && timer.delay === TICK);
}

async function flush() {
  await act(async () => { await new Promise((done) => nativeSetTimeout(done, 0)); });
}

async function advance(ms) {
  const target = now + ms;
  let turns = 0;
  while (true) {
    const next = [...timers.entries()].filter(([, timer]) => timer.due <= target)
      .sort((a, b) => a[1].due - b[1].due)[0];
    if (!next) break;
    assert.ok(++turns < 10_000, "Virtual timers must not enter a busy loop");
    const [handle, timer] = next;
    now = Math.max(now, timer.due);
    if (timer.repeat) timer.due += timer.delay;
    else timers.delete(handle);
    await act(async () => { timer.callback(...timer.args); });
    await flush();
  }
  now = target;
  await flush();
}

function vehicle(observedAt = now) {
  return { ...structuredClone(reviewedVehicle), observedAt };
}

function Probe({ current, slot }) {
  renders[slot] = (renders[slot] || 0) + 1;
  results[slot] = useFactoryWarrantyStamps(current);
  return null;
}

async function render(current, copies = 1) {
  await act(async () => {
    const element = React.createElement(QueryClientProvider, { client },
      Array.from({ length: copies }, (_, slot) =>
        React.createElement(Probe, { key: slot, slot, current })));
    if (renderer) renderer.update(element);
    else renderer = TestRenderer.create(element);
  });
  await flush();
}

async function unmount() {
  await act(async () => { renderer?.unmount(); });
  renderer = undefined;
  await flush();
}

before(async () => {
  server = await createServer({
    root, cacheDir, configFile: false, envFile: false, appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    logLevel: "error", resolve: { alias: { "@": resolve(root, "src") } },
    optimizeDeps: { noDiscovery: true, include: [] },
    define: { "import.meta.env.DEV": "false", "import.meta.env.VITE_WARRANTY_PREVIEW": JSON.stringify("0") },
  });
  ({ useFactoryWarrantyStamps, WARRANTY_MAX_AGE_MS: maxAge } =
    await server.ssrLoadModule("/src/lib/useFactoryWarrantyStamps.ts"));
  ({ factoryWarrantyReviewFingerprint } =
    await server.ssrLoadModule("/src/lib/factoryWarranty.ts"));
});

beforeEach(() => {
  now = START;
  calls = 0;
  renders = [];
  results = [];
  timers = new Map();
  timerSequence = 0;
  globalThis.Date = FixedDate;
  globalThis.setTimeout = (fn, delay, ...args) => schedule(fn, delay, false, args);
  globalThis.setInterval = (fn, delay, ...args) => schedule(fn, delay, true, args);
  globalThis.clearTimeout = (handle) => clearScheduled(handle, nativeClearTimeout);
  globalThis.clearInterval = (handle) => clearScheduled(handle, nativeClearInterval);
  windowTarget = eventTarget({ setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout });
  documentTarget = eventTarget({ visibilityState: "visible" });
  Object.defineProperty(globalThis, "window", { configurable: true, value: windowTarget });
  Object.defineProperty(globalThis, "document", { configurable: true, value: documentTarget });
  globalThis.fetch = async () => { calls += 1; throw new Error("Intentional offline warranty-clock fixture"); };
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  client.setQueryData(KEY, matrix, { updatedAt: now });
});

afterEach(async () => {
  await unmount();
  client.clear();
  timers.clear();
  globalThis.Date = OriginalDate;
  globalThis.fetch = originalFetch;
  globalThis.setTimeout = nativeSetTimeout;
  globalThis.clearTimeout = nativeClearTimeout;
  globalThis.setInterval = nativeSetInterval;
  globalThis.clearInterval = nativeClearInterval;
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
  else Reflect.deleteProperty(globalThis, "document");
});

after(async () => {
  await server?.close();
  rmSync(cacheDir, { recursive: true, force: true });
});

test("76 hooks without an original vehicle neither subscribe to the clock nor rerender every 15 seconds", async () => {
  await render(undefined, 76);
  const initial = [...renders];
  assert.equal(clockTimers().length, 0);
  assert.equal(windowTarget.listenerCount("focus"), 0);
  assert.equal(documentTarget.listenerCount("visibilitychange"), 0);
  await advance(4 * TICK);
  assert.deepEqual(renders, initial);
  assert.ok(results.every((result) => Object.keys(result).length === 0));
});

test("76 eligible hooks share one clock and do not rerender while their semantic state stays fresh", async () => {
  await render(vehicle(), 76);
  assert.ok(results.every((result) => result.warrantyStamp?.estimatedEndYear === 2028));
  assert.equal(clockTimers().length, 1);
  assert.equal(windowTarget.listenerCount("focus"), 1);
  assert.equal(documentTarget.listenerCount("visibilitychange"), 1);
  const initial = [...renders];
  await advance(4 * TICK);
  assert.deepEqual(renders, initial, "Unchanged time ticks must not execute 76 component renders");
  assert.equal(clockTimers().length, 1);
  assert.ok(calls > 0, "The offline query path is exercised, never replaced by successful network data");
});

test("missing registry data keeps the clock inactive even with a valid original vehicle", async () => {
  client.removeQueries({ queryKey: KEY });
  await render(vehicle(), 76);
  assert.equal(clockTimers().length, 0);
  assert.ok(results.every((result) => Object.keys(result).length === 0));
});

test("stock freshness expires at the 285-second bound with no click or successful request", async () => {
  assert.equal(maxAge, 285_000, "Preserve the approved five-minute limit minus one safety tick");
  const original = vehicle();
  await render(original);
  const initial = renders[0];
  await advance(maxAge - 1);
  assert.ok(results[0].warrantyStamp);
  assert.equal(renders[0], initial);
  // Refresh only the registry; the stale original stock must still hide its badge.
  await act(async () => { client.setQueryData(KEY, matrix, { updatedAt: now }); });
  await flush();
  const beforeExpiry = renders[0];
  await advance(1);
  assert.deepEqual(results[0], {});
  assert.equal(renders[0], beforeExpiry + 1);
  assert.equal(client.getQueryData(KEY), matrix, "Stale display does not erase the last registry");
  await advance(2 * TICK);
  assert.equal(renders[0], beforeExpiry + 1, "Already stale hooks must remain idle");
});

test("registry freshness independently expires and recovers only after fresh query data", async () => {
  await render(vehicle());
  await advance(maxAge - TICK);
  await render(vehicle());
  assert.ok(results[0].warrantyStamp);
  await advance(TICK);
  assert.deepEqual(results[0], {}, "Fresh stock cannot renew an expired registry");
  await act(async () => { client.setQueryData(KEY, matrix, { updatedAt: now }); });
  await flush();
  assert.equal(results[0].warrantyStamp?.estimatedEndYear, 2028);
});

test("off-grid freshness expires on the next shared tick, always within five minutes", async () => {
  const collectedAt = now - 7_000;
  await render(vehicle(collectedAt));
  await advance(maxAge - 7_000 - 1);
  assert.ok(results[0].warrantyStamp);
  await advance(TICK);
  assert.deepEqual(results[0], {});
  assert.ok(now - collectedAt < 300_000, "The safety tick must preserve the public five-minute bound");
});

test("updated registry revocation applies immediately on the same day without a clock tick", async () => {
  await render(vehicle());
  assert.ok(results[0].warrantyStamp);
  const revoked = structuredClone(matrix);
  revoked.records.find((record) => record.vehicle.vehicleId === "19587").status = "pending";
  await act(async () => { client.setQueryData(KEY, revoked, { updatedAt: now }); });
  await flush();
  assert.equal(results[0].warrantyStamp, undefined, "An unchanged day must not memoize an obsolete approval");
  assert.equal(now, START, "Revocation must not wait for the next tick");
});

test("fresh registry alone does not revive stale stock; fresh original input restores the stamp", async () => {
  const original = vehicle();
  await render(original);
  await advance(maxAge);
  assert.deepEqual(results[0], {});
  await act(async () => { client.setQueryData(KEY, matrix, { updatedAt: now }); });
  await flush();
  assert.deepEqual(results[0], {});
  await render(vehicle());
  assert.equal(results[0].warrantyStamp?.estimatedEndYear, 2028);
});

for (const event of ["focus", "visibilitychange"]) {
  test(`${event} rechecks expiry after suspended timers, without a periodic tick`, async () => {
    await render(vehicle());
    const initial = renders[0];
    // Simulate a background/frozen tab: wall time advances, timers do not run.
    now += maxAge + TICK;
    await act(async () => { (event === "focus" ? windowTarget : documentTarget).dispatch(event); });
    await flush();
    assert.deepEqual(results[0], {});
    assert.equal(renders[0], initial + 1);
  });
}

test("a future stock timestamp fails closed, then becomes valid when the shared clock catches up", async () => {
  await render(vehicle(now + TICK));
  assert.deepEqual(results[0], {});
  await advance(TICK - 1);
  assert.deepEqual(results[0], {});
  await advance(1);
  assert.equal(results[0].warrantyStamp?.estimatedEndYear, 2028);
});

test("UTC midnight does not rerender cards before the Sao Paulo civil day changes", async () => {
  now = OriginalDate.parse("2026-10-24T00:00:00.000Z") - TICK;
  client.setQueryData(KEY, matrix, { updatedAt: now });
  await render(vehicle(), 76);
  const initial = [...renders];
  await advance(TICK);
  assert.deepEqual(renders, initial);
  assert.ok(results.every((result) => result.warrantyStamp?.estimatedEndYear === 2028));
});

test("Sao Paulo midnight reevaluates still-fresh stamps exactly once", async () => {
  now = OriginalDate.parse("2026-10-24T03:00:00.000Z") - TICK;
  client.setQueryData(KEY, matrix, { updatedAt: now });
  await render(vehicle(), 76);
  const initial = [...renders];
  await advance(TICK);
  assert.deepEqual(renders, initial.map((count) => count + 1));
  const midnight = [...renders];
  await advance(TICK);
  assert.deepEqual(renders, midnight, "The next unchanged tick must not rerender again");
});

test("Sao Paulo midnight removes coverage that expired even while both data snapshots stay fresh", async () => {
  now = OriginalDate.parse("2026-10-24T03:00:00.000Z") - TICK;
  const expiring = structuredClone(matrix);
  const record = expiring.records.find((entry) => entry.vehicle.vehicleId === "19587");
  record.confirmedExpiryDate = "2026-10-23";
  record.approvedFingerprint = factoryWarrantyReviewFingerprint(record);
  client.setQueryData(KEY, expiring, { updatedAt: now });
  await render(vehicle());
  assert.ok(results[0].warrantyStamp, "The approved coverage is still valid before local midnight");
  await advance(TICK);
  assert.equal(results[0].warrantyStamp, undefined, "A new local day must use the actual expiry rule, not merely trigger a render");
  assert.ok(now - client.getQueryState(KEY).dataUpdatedAt < maxAge, "The removal is not caused by stale registry data");
});

test("the last eligible subscriber releases the shared timer and resume listeners", async () => {
  await render(vehicle(), 76);
  assert.equal(clockTimers().length, 1);
  await render(undefined, 76);
  assert.equal(clockTimers().length, 0, "Switching all originals off releases the clock without unmounting cards");
  assert.equal(windowTarget.listenerCount("focus"), 0);
  assert.equal(documentTarget.listenerCount("visibilitychange"), 0);
  await render(vehicle(), 76);
  assert.equal(clockTimers().length, 1);
  await unmount();
  assert.equal(clockTimers().length, 0);
  assert.equal(windowTarget.listenerCount(), 0);
  assert.equal(documentTarget.listenerCount(), 0);
});
