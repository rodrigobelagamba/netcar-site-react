import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalFetch = globalThis.fetch;
const windowTimers = new Set();
let scheduledDelays;
let server;
let useVehiclesQuery;
let QueryClient;
let QueryClientProvider;
let client;
let renderer;
let result;
let requests;
let respond;

const sport = apiVehicle("19974", "RENEGADE SPORT TURBO", 99_900, "BRANCA");
const longitude = apiVehicle(
  "20040",
  "RENEGADE LONGITUDE T270 TURBO",
  99_900,
  "CINZA",
);
const sold = apiVehicle("20022", "RENEGADE T270 TURBO", 0, "CINZA");

function apiVehicle(id, modelo, valor = 79_900, cor = "PRATA") {
  return {
    id,
    marca: "JEEP",
    modelo,
    ano: 2024,
    valor,
    cor,
    km: 12_000,
    link: id,
    imagens: { thumb: [], full: [] },
  };
}

function bootstrapVehicle(vehicle) {
  return {
    id: vehicle.id,
    name: `${vehicle.marca} ${vehicle.modelo}`,
    slug: vehicle.link,
    marca: vehicle.marca,
    modelo: vehicle.modelo,
    year: vehicle.ano,
    price: vehicle.valor,
    cor: vehicle.cor,
    km: vehicle.km,
    images: [],
  };
}

function apiResponse(vehicles, offset = 0) {
  return new Response(
    JSON.stringify({
      success: true,
      data: vehicles,
      // This API reports the current page size, not the full inventory size.
      total_results: vehicles.length,
      limit: 500,
      offset,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// Use the production hook and endpoint through Vite so aliases and
// import.meta.env receive the same transformation as the application.
before(async () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener() {},
      removeEventListener() {},
      setTimeout(callback, delay, ...args) {
        scheduledDelays?.push(delay);
        const timer = setTimeout(() => {
          windowTimers.delete(timer);
          callback(...args);
        }, delay);
        windowTimers.add(timer);
        return timer;
      },
      clearTimeout(timer) {
        windowTimers.delete(timer);
        clearTimeout(timer);
      },
    },
  });
  ({ QueryClient, QueryClientProvider } = await import("@tanstack/react-query"));
  server = await createServer({
    root,
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true },
    logLevel: "error",
    resolve: { alias: { "@": resolve(root, "src") } },
    define: {
      "import.meta.env.VITE_API_BASE_URL": JSON.stringify(
        "https://catalog.test/api/v1",
      ),
    },
  });
  ({ useVehiclesQuery } = await server.ssrLoadModule(
    "/src/catalog/queries/useVehiclesQuery.ts",
  ));
});

beforeEach(() => {
  scheduledDelays = [];
  requests = [];
  result = undefined;
  renderer = undefined;
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, refetchOnWindowFocus: false },
    },
  });
  window.__NETCAR_STOCK__ = {
    generatedAt: "2026-01-01T00:00:00.000Z",
    scope: "available",
    vehicles: [bootstrapVehicle(sport)],
  };
  respond = async () => apiResponse([sport, longitude, sold]);
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://catalog.test", "Unexpected network request");
    assert.equal(url.pathname, "/api/v1/veiculos.php");
    requests.push(url);
    return respond(url, options);
  };
});

afterEach(async () => {
  await act(async () => renderer?.unmount());
  client?.clear();
  for (const timer of windowTimers) clearTimeout(timer);
  windowTimers.clear();
});

after(async () => {
  await server?.close();
  globalThis.fetch = originalFetch;
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

function SearchProbe({ enabled = false, term = "" }) {
  result = useVehiclesQuery(
    { fetchAll: true },
    { enabled, refreshImmediately: true },
  );
  // term causes the same unrelated rerenders as typing in Header. Searching
  // must not change the inventory query or start another API request.
  return React.createElement(
    "output",
    {
      "data-fetching": result.isFetching,
      "data-error": result.isError,
      "data-refetch-error": result.isRefetchError,
    },
    `${term}: ${result.data?.map((vehicle) => vehicle.id).join(",") ?? ""}`,
  );
}

async function renderSearch(props) {
  await act(async () => {
    const element = React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(SearchProbe, props),
    );
    if (renderer) renderer.update(element);
    else renderer = TestRenderer.create(element);
  });
}

async function waitForResult(predicate) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate(result)) return;
    await act(async () => {
      await new Promise((resolveTick) => setTimeout(resolveTick, 2));
    });
  }
  assert.fail("The inventory query did not reach the expected state");
}

const ids = () => result.data.map((vehicle) => vehicle.id);

test("both search entry points request the full available catalog when activated", () => {
  for (const [file, activation] of [
    ["src/design-system/components/layout/Header.tsx", /isSearchOpen\s*\|\|\s*isMobileMenuOpen/],
    ["src/design-system/components/patterns/SearchBar.tsx", /isFocused/],
  ]) {
    const source = readFileSync(resolve(root, file), "utf8");
    const call = source.match(/useVehiclesQuery\(\s*\{\s*fetchAll:\s*true\s*\},\s*\{([^}]+)\}/);
    assert.ok(call, `${file} no longer requests the full inventory`);
    assert.match(call[1], /refreshImmediately:\s*true/);
    assert.match(call[1], new RegExp(`enabled:\\s*(?:${activation.source})`));
    assert.doesNotMatch(call[0], /includeSold:\s*true/);
  }
});

test("opening search immediately replaces the old bootstrap with all available matches", async () => {
  await renderSearch({ enabled: false });
  assert.deepEqual(ids(), [sport.id]);
  assert.equal(requests.length, 0, "Closed search must not request inventory");

  await renderSearch({ enabled: true, term: "Rene" });
  await waitForResult((query) => !query.isFetching && query.data.length === 2);

  assert.deepEqual(ids(), [sport.id, longitude.id]);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].searchParams.get("limit"), "500");
  assert.equal(requests[0].searchParams.get("offset"), "0");
  assert.ok(!scheduledDelays.includes(15_000), "Immediate refresh kept the delay timer");
});

test("typing keeps the current query and reopening refreshes even a fresh cache", async () => {
  await renderSearch({ enabled: true });
  await waitForResult((query) => !query.isFetching && query.data.length === 2);
  assert.equal(requests.length, 1, "Mount and immediate effect duplicated the request");

  for (const term of ["Re", "Rene", "Jeep", "2024", "Cinza", ""]) {
    await renderSearch({ enabled: true, term });
  }
  assert.equal(requests.length, 1, "Typing caused an inventory refetch");

  await renderSearch({ enabled: false });
  assert.equal(requests.length, 1);
  respond = async () => apiResponse([longitude, sold]);
  await renderSearch({ enabled: true, term: "Rene" });
  await waitForResult((query) => !query.isFetching && query.data.length === 1);

  assert.equal(requests.length, 2);
  assert.deepEqual(ids(), [longitude.id]);
  assert.ok(!scheduledDelays.includes(15_000));
});

test("reopening during a request reuses it and preserves bootstrap while loading", async () => {
  let resolveResponse;
  const pendingResponse = new Promise((resolvePending) => {
    resolveResponse = resolvePending;
  });
  respond = () => pendingResponse;

  await renderSearch({ enabled: true });
  assert.equal(requests.length, 1);
  assert.deepEqual(ids(), [sport.id]);
  assert.equal(result.isFetching, true);

  await renderSearch({ enabled: false });
  await renderSearch({ enabled: true, term: "Rene" });
  await renderSearch({ enabled: true, term: "Renegade" });
  assert.equal(requests.length, 1, "The pending inventory request was restarted");

  await act(async () => resolveResponse(apiResponse([sport, longitude, sold])));
  await waitForResult((query) => !query.isFetching && query.data.length === 2);
  assert.deepEqual(ids(), [sport.id, longitude.id]);
});

test("API failure preserves the latest inventory and reopening can recover", async (context) => {
  context.mock.method(console, "error", () => {});
  await renderSearch({ enabled: true });
  await waitForResult((query) => !query.isFetching && query.data.length === 2);

  respond = async () => new Response("Service unavailable", { status: 503 });
  await renderSearch({ enabled: false });
  await renderSearch({ enabled: true, term: "Rene" });
  await waitForResult((query) => !query.isFetching && query.isRefetchError);

  assert.equal(requests.length, 2);
  assert.deepEqual(ids(), [sport.id, longitude.id], "Failure erased the last successful data");

  respond = async () => apiResponse([longitude]);
  await renderSearch({ enabled: false });
  await renderSearch({ enabled: true });
  await waitForResult((query) => !query.isFetching && !query.isError);

  assert.equal(requests.length, 3);
  assert.deepEqual(ids(), [longitude.id]);
});

test("sold vehicles stay excluded from both showroom bootstrap and live results", async () => {
  window.__NETCAR_STOCK__.scope = "showroom";
  window.__NETCAR_STOCK__.vehicles.push(bootstrapVehicle(sold));

  await renderSearch({ enabled: false });
  assert.deepEqual(ids(), [sport.id]);
  await renderSearch({ enabled: true });
  await waitForResult((query) => !query.isFetching && query.data.length === 2);
  assert.deepEqual(ids(), [sport.id, longitude.id]);
});

test("fetchAll includes matches after 100 records and follows full pages without duplicate IDs", async () => {
  const firstPage = Array.from({ length: 500 }, (_, index) =>
    apiVehicle(String(10_000 + index), `MODELO ${index}`),
  );
  firstPage[0] = sport;
  firstPage[150] = longitude;
  const laterVehicle = apiVehicle("30000", "RENEGADE LONGITUDE", 89_900);
  respond = async (url) => {
    const offset = Number(url.searchParams.get("offset"));
    assert.equal(url.searchParams.get("limit"), "500");
    if (offset === 0) return apiResponse(firstPage);
    assert.equal(offset, 500);
    return apiResponse([sport, laterVehicle, sold], offset);
  };

  await renderSearch({ enabled: false });
  await renderSearch({ enabled: true });
  await waitForResult((query) => !query.isFetching && query.data.length === 501);

  assert.deepEqual(requests.map((url) => url.searchParams.get("offset")), ["0", "500"]);
  assert.ok(ids().includes(longitude.id), "Inventory was truncated to the first 100 records");
  assert.ok(ids().includes(laterVehicle.id), "The second page was not included");
  assert.equal(new Set(ids()).size, ids().length, "Repeated page IDs were duplicated");
  assert.ok(!ids().includes(sold.id));
});

test("a failed later page keeps the bootstrap instead of showing a partial catalog", async (context) => {
  context.mock.method(console, "error", () => {});
  const firstPage = Array.from({ length: 500 }, (_, index) =>
    apiVehicle(String(10_000 + index), `MODELO ${index}`),
  );
  respond = async (url) =>
    url.searchParams.get("offset") === "0"
      ? apiResponse(firstPage)
      : new Response("Service unavailable", { status: 503 });

  await renderSearch({ enabled: true });
  await waitForResult((query) => !query.isFetching && query.isRefetchError);

  assert.equal(requests.length, 2);
  assert.deepEqual(ids(), [sport.id]);
});
