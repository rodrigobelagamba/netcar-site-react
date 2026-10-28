import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cacheDir = mkdtempSync(resolve(tmpdir(), "warranty-query-vite-"));
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalFetch = globalThis.fetch;
const originalSetInterval = globalThis.setInterval;
const originalClearInterval = globalThis.clearInterval;
const pollCallbacks = new Map();
let server;
let QueryClient;
let QueryClientProvider;
let useVehiclesQuery;
let useVehicleQuery;
let client;
let renderer;
let result;
let requests;
let payload;
let respond;

const vehicle = (changes = {}) => ({
  id: "42",
  marca: "TEST",
  modelo: "VERSION A",
  ano: 2025,
  ano_fabricacao: 2024,
  valor: 100_000,
  km: 12_345,
  motor: "1.0 TURBO",
  cambio: "AUTOMÁTICO",
  placa: "ABC1D23",
  chassi: "9BWZZZ377VT004251",
  opcionais: [],
  diferenciais: [{ tag: "garantia_fabrica", descricao: "" }],
  imagens: { thumb: [], full: [] },
  ...changes,
});

before(async () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      setTimeout,
      clearTimeout,
      addEventListener() {},
      removeEventListener() {},
    },
  });
  globalThis.setInterval = (callback, delay, ...args) => {
    if (delay !== 60_000) return originalSetInterval(callback, delay, ...args);
    const handle = {};
    pollCallbacks.set(handle, () => callback(...args));
    return handle;
  };
  globalThis.clearInterval = (handle) => {
    if (!pollCallbacks.delete(handle)) originalClearInterval(handle);
  };
  globalThis.fetch = async (_url, options) => {
    requests.push(options);
    return respond();
  };
  ({ QueryClient, QueryClientProvider } =
    await import("@tanstack/react-query"));
  server = await createServer({
    root,
    cacheDir,
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    logLevel: "silent",
    resolve: { alias: { "@": resolve(root, "src") } },
  });
  ({ useVehiclesQuery } = await server.ssrLoadModule(
    "/src/catalog/queries/useVehiclesQuery.ts",
  ));
  ({ useVehicleQuery } = await server.ssrLoadModule(
    "/src/catalog/queries/useVehicleQuery.ts",
  ));
});

beforeEach(() => {
  requests = [];
  result = undefined;
  payload = { success: true, data: [vehicle()], total_results: 1 };
  respond = async () => new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  delete window.__NETCAR_STOCK__;
});

afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  client.clear();
  pollCallbacks.clear();
});

after(async () => {
  await server?.close();
  rmSync(cacheDir, { recursive: true, force: true });
  globalThis.fetch = originalFetch;
  globalThis.setInterval = originalSetInterval;
  globalThis.clearInterval = originalClearInterval;
  if (originalWindow)
    Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

async function settle(predicate) {
  for (let attempt = 0; attempt < 50; attempt++) {
    await act(async () => {
      await new Promise((done) => setTimeout(done, 5));
    });
    if (predicate()) return;
  }
  assert.fail(
    `Query did not reach its expected state: ${JSON.stringify({
      status: result?.status,
      fetchStatus: result?.fetchStatus,
      error: result?.error?.message,
      requests: requests.length,
    })}`,
  );
}

async function mount(kind) {
  function output(queryResult) {
    result = queryResult;
    return React.createElement(
      "output",
      {
        "data-status": result.status,
        "data-fetching": result.isFetching,
      },
      JSON.stringify(result.data),
    );
  }
  function StockObserver() {
    return output(useVehiclesQuery({ fetchAll: true }));
  }
  function DetailObserver() {
    return output(useVehicleQuery("42"));
  }
  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(kind === "stock" ? StockObserver : DetailObserver),
      ),
    );
  });
  await settle(() => result?.isSuccess && !result.isFetching);
}

async function poll() {
  const callbacks = [...pollCallbacks.values()];
  assert.ok(
    callbacks.length > 0,
    "A mounted catalog observer must schedule the 60-second poll",
  );
  await act(async () => {
    callbacks.forEach((callback) => callback());
  });
}

function DefaultStockObserver({ enabled }) {
  result = useVehiclesQuery(undefined, { enabled });
  return React.createElement("output", {
    "data-status": result.status,
    "data-fetching": result.isFetching,
  }, JSON.stringify(result.data));
}

async function renderDefaultStock({ enabled = true, copies = 1 } = {}) {
  await act(async () => {
    const element = React.createElement(
      QueryClientProvider,
      { client },
      Array.from({ length: copies }, (_, index) =>
        React.createElement(DefaultStockObserver, { key: index, enabled }),
      ),
    );
    if (renderer) renderer.update(element);
    else renderer = TestRenderer.create(element);
  });
}

function seedOldBootstrap() {
  const observedAt = Date.now() - 600_000;
  window.__NETCAR_STOCK__ = {
    generatedAt: new Date().toISOString(),
    scope: "available",
    vehicles: [{
      id: "42",
      name: "TEST VERSION A",
      marca: "TEST",
      modelo: "VERSION A",
      year: 2025,
      anoFabricacao: 2024,
      km: 12_345,
      price: 100_000,
      images: [],
      factoryWarrantyVehicle: { id: "42", observedAt },
    }],
  };
  return observedAt;
}

test("default stock revalidates bootstrap immediately without renewing warranty evidence while loading", async () => {
  const oldObservation = seedOldBootstrap();
  let release;
  const response = respond;
  respond = () => new Promise((resolveResponse) => { release = resolveResponse; });

  await renderDefaultStock();
  assert.equal(requests.length, 1, "The first mount must request the API without a delay");
  assert.equal(result.isFetching, true);
  assert.equal(result.dataUpdatedAt, 0);
  assert.equal(result.data[0].factoryWarrantyVehicle.observedAt, oldObservation);

  await act(async () => release(await response()));
  await settle(() => !result.isFetching && result.dataUpdatedAt > 0);
  assert.ok(result.data[0].factoryWarrantyVehicle.observedAt > oldObservation);
  assert.equal(window.__NETCAR_STOCK__.vehicles[0].factoryWarrantyVehicle.observedAt, oldObservation);
  assert.equal(requests.length, 1);
});

test("default stock observers share the initial request and do not refetch fresh API data on later mounts", async () => {
  seedOldBootstrap();
  await renderDefaultStock({ copies: 2 });
  await settle(() => result.isSuccess && !result.isFetching);
  assert.equal(requests.length, 1);

  await renderDefaultStock({ copies: 3 });
  assert.equal(requests.length, 1, "A new card surface must reuse the fresh catalog query");
});

test("disabled default stock keeps bootstrap untouched until activated", async () => {
  const oldObservation = seedOldBootstrap();
  await renderDefaultStock({ enabled: false });
  assert.equal(requests.length, 0);
  assert.equal(result.data[0].factoryWarrantyVehicle.observedAt, oldObservation);

  await renderDefaultStock({ enabled: true });
  await settle(() => result.isSuccess && !result.isFetching);
  assert.equal(requests.length, 1);
  assert.ok(result.data[0].factoryWarrantyVehicle.observedAt > oldObservation);
});

test("failed initial bootstrap refresh preserves stale warranty evidence", async () => {
  const oldObservation = seedOldBootstrap();
  payload = { success: false, data: [] };
  await renderDefaultStock();
  await settle(() => result.isError && !result.isFetching);
  assert.equal(requests.length, 1);
  assert.equal(result.dataUpdatedAt, 0);
  assert.equal(result.data[0].factoryWarrantyVehicle.observedAt, oldObservation);
});

for (const kind of ["stock", "detail"]) {
  test(`${kind}: the 60-second poll revalidates current flag while query data is fresh`, async () => {
    await mount(kind);
    const initialRequests = requests.length;
    const current = () => (kind === "stock" ? result.data[0] : result.data);
    assert.equal(current().factoryWarrantyVehicle.diferenciais.length, 1);
    payload = {
      success: true,
      data: [vehicle({ diferenciais: [] })],
      total_results: 1,
    };
    await poll();
    await settle(
      () =>
        current().factoryWarrantyVehicle.diferenciais.length === 0 &&
        !result.isFetching,
    );
    assert.ok(requests.length > initialRequests);
    assert.ok(requests.every((options) => options.cache === "no-store"));
  });
}

test("failed stock polling retains its last observation instead of issuing fresh warranty evidence", async () => {
  await mount("stock");
  const previous = result.data;
  const observedAt = previous[0].factoryWarrantyVehicle.observedAt;
  payload = { success: false, data: [] };
  await poll();
  await settle(() => result.isError && !result.isFetching);
  assert.equal(result.data, previous);
  assert.equal(result.data[0].factoryWarrantyVehicle.observedAt, observedAt);
});

test("detail mounting revalidates a complete cached gallery without renewing its old observation", async () => {
  const oldObservation = Date.now() - 600_000;
  client.setQueryData(["vehicle", "42"], {
    id: "42",
    year: 2025,
    km: 12_345,
    price: 100_000,
    images: [],
    fullImages: ["https://example.test/car.jpg"],
    factoryWarrantyVehicle: { id: "42", observedAt: oldObservation },
  });
  await mount("detail");
  assert.ok(requests.length > 0);
  assert.ok(result.data.factoryWarrantyVehicle.observedAt > oldObservation);
});
