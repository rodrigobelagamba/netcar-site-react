import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const root = fileURLToPath(new URL("../../", import.meta.url));
const cacheDir = mkdtempSync(resolve(tmpdir(), "warranty-published-vite-"));
const matrix = JSON.parse(readFileSync(resolve(root, "src/data/factoryWarrantyMatrix.json"), "utf8"));
const observed = JSON.parse(readFileSync(resolve(root, "docs/audits/factory-warranty-reconciliation-2026-10-09.json"), "utf8")).publicVehicles;
const originalFetch = globalThis.fetch;
let server, fetchPublishedWarrantyRegistry, warrantySnapshotIsFresh, useFactoryWarrantyStamps;
let factoryWarrantyReviewFingerprint, resolveFactoryWarranty;
let client, renderer, stamps;
const response = (value = matrix) => new Response(JSON.stringify(value), { status: 200 });
const vehicle = () => ({ ...observed.find((v) => v.id === "19587"), observedAt: Date.now() });

before(async () => {
  server = await createServer({ root, cacheDir, configFile: false, envFile: false,
    appType: "custom", server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    logLevel: "error", resolve: { alias: { "@": resolve(root, "src") } },
    define: { "import.meta.env.DEV": "false", "import.meta.env.VITE_WARRANTY_PREVIEW": JSON.stringify("0") } });
  ({ fetchPublishedWarrantyRegistry, warrantySnapshotIsFresh, useFactoryWarrantyStamps } =
    await server.ssrLoadModule("/src/lib/useFactoryWarrantyStamps.ts"));
  ({ factoryWarrantyReviewFingerprint, resolveFactoryWarranty } =
    await server.ssrLoadModule("/src/lib/factoryWarranty.ts"));
});
beforeEach(() => {
  globalThis.fetch = async () => response();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  client.setQueryData(["factory-warranty-registry"], matrix);
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  client.clear();
  globalThis.fetch = originalFetch;
});
after(async () => { await server?.close(); rmSync(cacheDir, { recursive: true, force: true }); });
function Probe({ current }) { stamps = useFactoryWarrantyStamps(current); return null; }
async function render(current) {
  await act(async () => {
    const element = React.createElement(QueryClientProvider, { client }, React.createElement(Probe, { current }));
    if (renderer) renderer.update(element); else renderer = TestRenderer.create(element);
  });
}

test("published mirror exactly matches the single canonical registry", () => {
  assert.deepEqual(JSON.parse(readFileSync(resolve(root, "public/seo/factory-warranty-registry.json"), "utf8")), matrix);
});
test("registry request bypasses HTTP cache and bounds the accepted schema", async () => {
  globalThis.fetch = async (url, options) => {
    assert.match(url, /^\/seo\/factory-warranty-registry\.json\?v=\d+$/);
    assert.equal(options.cache, "no-store");
    assert.ok(options.signal);
    return response();
  };
  assert.deepEqual(await fetchPublishedWarrantyRegistry(), matrix);
});
test("month precision persists through the published JSON read without manufacturing a date or approval", async () => {
  const changed = structuredClone(matrix);
  const record = changed.records.find((entry) => entry.vehicle.vehicleId === "19587");
  record.confirmedExpiryMonth = "2028-12";
  record.approvedFingerprint = factoryWarrantyReviewFingerprint(record);
  const serialized = JSON.stringify(changed);
  globalThis.fetch = async () => new Response(serialized, { status: 200 });
  const restored = await fetchPublishedWarrantyRegistry();
  assert.deepEqual(restored, changed);
  const persisted = restored.records.find((entry) => entry.vehicle.vehicleId === "19587");
  assert.equal(persisted.confirmedExpiryMonth, "2028-12");
  assert.equal(Object.hasOwn(persisted, "confirmedExpiryDate"), false);
  assert.equal(persisted.approvedFingerprint, record.approvedFingerprint);
  assert.equal(resolveFactoryWarranty(vehicle(), restored, "2028-11-30")?.estimatedEndYear, 2028);
  assert.equal(resolveFactoryWarranty(vehicle(), restored, "2028-12-01"), undefined);

  persisted.status = "pending";
  persisted.notes = "Reviewed: owner confirmed December 2028.";
  globalThis.fetch = async () => response(restored);
  const pending = await fetchPublishedWarrantyRegistry();
  assert.equal(pending.records.find((entry) => entry.vehicle.vehicleId === "19587").status, "pending");
  assert.equal(resolveFactoryWarranty(vehicle(), pending, "2028-11-30"), undefined);
});
for (const [label, invalid] of [["legacy registry", { ...matrix, requireUnitBinding: false }], ["missing records", { schemaVersion: 2 }], ["wrong schema", { ...matrix, schemaVersion: 3 }]]) {
  test(label + " is rejected instead of renewing the cached approval", async () => {
    globalThis.fetch = async () => response(invalid);
    await assert.rejects(fetchPublishedWarrantyRegistry(), /incompatível/);
  });
}
for (const [label, corrupt] of [
  ["missing mileage", (m) => { delete m.records[0].mileage; }],
  ["non-array supplements", (m) => { m.records[0].supplementalCoverages = {}; }],
  ["invalid policy branch", (m) => { m.records.find((r) => r.commonPolicy).commonPolicy.branches = [null]; }],
  ["invalid rule match", (m) => { m.automation.rules[0].match = null; }],
]) {
  test("partial record download: " + label + " is a failed read", async () => {
    const changed = structuredClone(matrix);
    corrupt(changed);
    globalThis.fetch = async () => response(changed);
    await assert.rejects(fetchPublishedWarrantyRegistry(), /incompatível/);
  });
}
test("network/HTTP failure is a failed read, never an empty successful registry", async () => {
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });
  await assert.rejects(fetchPublishedWarrantyRegistry(), /indisponível/);
});
test("data has a bounded grace period and unknown/future timestamps fail closed", () => {
  const now = Date.now();
  assert.equal(warrantySnapshotIsFresh(now, now), true);
  assert.equal(warrantySnapshotIsFresh(now - 60_000, now), true);
  for (const time of [undefined, null, NaN, now + 1, now - 300_000])
    assert.equal(warrantySnapshotIsFresh(time, now), false);
});
test("fresh original unit and live registry show the general stamp", async () => {
  await render(vehicle());
  assert.equal(stamps.warrantyStamp?.estimatedEndYear, 2028);
});
test("a bootstrap without original collection time never announces warranty", async () => {
  await render({ ...vehicle(), observedAt: undefined });
  assert.equal(stamps.warrantyStamp, undefined);
});
test("failed read preserves recent display but old stock loses only its badge", async () => {
  globalThis.fetch = async () => { throw new Error("Temporary read failure"); };
  const current = vehicle();
  await render(current);
  assert.equal(stamps.warrantyStamp?.estimatedEndYear, 2028);
  await render({ ...current, observedAt: Date.now() - 301_000 });
  assert.deepEqual(stamps, {});
  assert.equal(client.getQueryData(["factory-warranty-registry"]), matrix);
});
test("an expired cached registry cannot retain a badge during a failed read", async () => {
  globalThis.fetch = async () => { throw new Error("Temporary read failure"); };
  client.setQueryData(["factory-warranty-registry"], matrix, { updatedAt: Date.now() - 301_000 });
  await render(vehicle());
  assert.deepEqual(stamps, {});
});
test("flag removal and mechanical change remove the live badge immediately", async () => {
  const current = vehicle();
  await render(current);
  assert.ok(stamps.warrantyStamp);
  await render({ ...current, diferenciais: [] });
  assert.equal(stamps.warrantyStamp, undefined);
  await render({ ...current, motor: "1.6" });
  assert.equal(stamps.warrantyStamp, undefined);
});
