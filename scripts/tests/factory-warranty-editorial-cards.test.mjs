import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cacheDir = mkdtempSync(resolve(tmpdir(), "warranty-editorial-"));
const inventory = JSON.parse(readFileSync(resolve(root,
  "docs/audits/factory-warranty-reconciliation-2026-10-09.json"), "utf8")).publicVehicles;
const registry = JSON.parse(readFileSync(resolve(root,
  "src/data/factoryWarrantyMatrix.json"), "utf8"));
const originalFetch = globalThis.fetch;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const OriginalDate = globalThis.Date;
const fixedNow = OriginalDate.parse("2026-10-14T15:00:00Z");
class FixedDate extends OriginalDate {
  constructor(...args) { super(...(args.length ? args : [fixedNow])); }
  static now() { return fixedNow; }
}
let server;
let BlogVehicleWarranty;
let VehicleWhatsAppCard;
let renderer;
let client;
let apiResponse;
let apiRequests;

const currentVehicle = (id = "20019", changes = {}) => ({
  ...structuredClone(inventory.find((vehicle) => vehicle.id === id)),
  observedAt: fixedNow,
  ...changes,
});
const apiVehicle = (vehicle) => ({
  id: vehicle.id,
  marca: vehicle.marca,
  modelo: vehicle.modelo,
  motor: vehicle.motor,
  cambio: vehicle.cambio,
  ano: vehicle.year,
  ano_fabricacao: vehicle.anoFabricacao,
  valor: vehicle.price,
  km: vehicle.km,
  diferenciais: vehicle.diferenciais,
  factoryWarrantyVehicle: vehicle,
  imagens: { thumb: [], full: [] },
});
const response = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json" },
});

before(async () => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {},
  } });
  server = await createServer({
    root, cacheDir, configFile: false, envFile: false, appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    logLevel: "error",
    resolve: { alias: { "@": resolve(root, "src") } },
    define: {
      "import.meta.env.DEV": "false",
      "import.meta.env.VITE_WARRANTY_PREVIEW": JSON.stringify("0"),
      "import.meta.env.VITE_API_BASE_URL": JSON.stringify("https://catalog.test/api/v1"),
    },
  });
  ({ BlogVehicleWarranty } = await server.ssrLoadModule(
    "/src/modules/blog/components/BlogVehicleWarranty.tsx"));
  ({ VehicleWhatsAppCard } = await server.ssrLoadModule(
    "/src/design-system/components/patterns/VehicleWhatsAppCard.tsx"));
});
beforeEach(() => {
  globalThis.Date = FixedDate;
  apiRequests = [];
  apiResponse = () => response({ success: true, data: [apiVehicle(currentVehicle())] });
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  client.setQueryData(["factory-warranty-registry"], registry);
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.startsWith("/seo/factory-warranty-registry.json")) return response(registry);
    assert.match(url, /^https:\/\/catalog\.test\/api\/v1\/veiculos\/id\/\d+$/);
    apiRequests.push(url);
    return apiResponse();
  };
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  client.clear();
  globalThis.Date = OriginalDate;
});
after(async () => {
  await server?.close();
  rmSync(cacheDir, { recursive: true, force: true });
  globalThis.fetch = originalFetch;
  globalThis.Date = OriginalDate;
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});
async function mount(component, props) {
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(QueryClientProvider,
      { client }, React.createElement(component, props)));
  });
  for (let i = 0; i < 50 && client.isFetching(); i += 1) {
    await act(async () => new Promise((done) => setTimeout(done, 5)));
  }
  assert.equal(client.isFetching(), 0, "Fixture queries must settle before checking cards");
  await act(async () => new Promise((done) => setTimeout(done, 5)));
}
function stamps() {
  return renderer.root.findAll((node) =>
    node.type === "div" && node.props["data-factory-warranty-badge"] === "card");
}
const editorialHref = "/veiculo/nissan-kicks-sense-turbo-20019";

test("editorial car resolves the current unit and renders its approved warranty", async () => {
  await mount(BlogVehicleWarranty, { href: editorialHref });
  assert.equal(apiRequests.length, 1);
  assert.equal(stamps().length, 1);
  assert.match(stamps()[0].findByType("svg").props["aria-label"], /2028/);
});

for (const [label, changes] of [
  ["sold", { price: 0 }],
  ["flag removed", { diferenciais: [] }],
  ["stale snapshot", { observedAt: fixedNow - 6 * 60_000 }],
]) {
  test(`editorial car with ${label} cannot use its historical warranty`, async () => {
    apiResponse = () => response({ success: true,
      data: [apiVehicle(currentVehicle("20019", changes))] });
    await mount(BlogVehicleWarranty, { href: editorialHref });
    assert.equal(stamps().length, 0);
  });
}

test("editorial external or non-vehicle URL cannot resolve a stock stamp", async () => {
  await mount(BlogVehicleWarranty, { href: "https://other.example/veiculo/20019" });
  assert.equal(apiRequests.length, 0);
  assert.equal(stamps().length, 0);
});

test("editorial 404 removes the stamp even with a fresh cached approved vehicle", async () => {
  const current = currentVehicle();
  client.setQueryData(["vehicle", "nissan-kicks-sense-turbo-20019"], {
    ...current, factoryWarrantyVehicle: current, fullImages: ["/car.jpg"],
  });
  apiResponse = () => response({ success: false }, 404);
  await mount(BlogVehicleWarranty, { href: editorialHref });
  assert.equal(stamps().length, 0);
});

for (const [label, warrantyVehicle, expected] of [
  ["approved current unit", currentVehicle(), 1],
  ["missing original vehicle", undefined, 0],
  ["different card ID", currentVehicle("20066"), 0],
  ["sold unit", currentVehicle("20019", { price: 0 }), 0],
  ["stale unit", currentVehicle("20019", { observedAt: fixedNow - 6 * 60_000 }), 0],
]) {
  test(`sticky vehicle card: ${label}`, async () => {
    await mount(VehicleWhatsAppCard, {
      vehicle: { id: "20019", label: "Kicks", priceLabel: "R$ 149.900", image: "/car.jpg" },
      warrantyVehicle, href: "https://wa.me/1", source: "detalhe_sticky",
    });
    assert.equal(stamps().length, expected);
  });
}
