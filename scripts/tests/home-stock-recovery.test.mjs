import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;
const timers = new Set();
let server;
let useVehiclesQuery;
let HomeStockGrid;
let QueryClient;
let QueryClientProvider;
let client;
let renderer;
let result;
let respond;
let requests;
let stockVisits;

const car = {
  id: "19946", marca: "FIAT", modelo: "TORO ENDURANCE TURBO", ano: 2024,
  valor: 116900, km: 61000, link: "19946", imagens: { thumb: [], full: [] },
  imagens_site: { tem_fotos: 1, capa: "/imagens/fixtureCAPA.png", galeria: [] },
};
const response = (cars) => new Response(JSON.stringify({
  success: true, data: cars, total_results: cars.length,
}), { status: 200, headers: { "Content-Type": "application/json" } });

before(async () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener() {}, removeEventListener() {},
      setTimeout(callback, delay, ...args) {
        const timer = setTimeout(() => { timers.delete(timer); callback(...args); }, delay);
        timers.add(timer);
        return timer;
      },
      clearTimeout(timer) { timers.delete(timer); clearTimeout(timer); },
    },
  });
  ({ QueryClient, QueryClientProvider } = await import("@tanstack/react-query"));
  server = await createServer({
    root, configFile: false, appType: "custom",
    server: { middlewareMode: true }, logLevel: "error",
    resolve: { alias: { "@": resolve(root, "src") } },
    define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("https://catalog.test/api/v1") },
    plugins: [{
      name: "observe-home-card-presentation",
      enforce: "pre",
      load(id) {
        // Keep the real recovery component, inventory hook, HTTP client and
        // React Query lifecycle. Only the unrelated card UI is replaced.
        if (!id.endsWith("/design-system/components/patterns/ProductList.tsx")) return;
        return `import React from "react";
          export function ProductList({vehicles, isLoading = false}) {
            return React.createElement("output", {"data-loading": isLoading},
              vehicles.map(car => React.createElement("span", {key: car.id, "data-car-id": car.id}, car.name)));
          }`;
      },
    }],
  });
  ({ useVehiclesQuery } = await server.ssrLoadModule("/src/catalog/queries/useVehiclesQuery.ts"));
  ({ HomeStockGrid } = await server.ssrLoadModule("/src/modules/home/components/HomeStockGrid.tsx"));
});

beforeEach(() => {
  client = new QueryClient({ defaultOptions: {
    queries: { retry: false, gcTime: Infinity, refetchOnWindowFocus: false },
  } });
  renderer = undefined;
  result = undefined;
  requests = 0;
  stockVisits = 0;
  delete window.__NETCAR_STOCK__;
  console.error = () => {};
  respond = async () => response([car]);
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://catalog.test");
    assert.equal(url.pathname, "/api/v1/veiculos.php");
    requests += 1;
    return respond(url);
  };
});

afterEach(async () => {
  await act(async () => renderer?.unmount());
  client?.clear();
  for (const timer of timers) clearTimeout(timer);
  timers.clear();
  console.error = originalConsoleError;
});

after(async () => {
  await server?.close();
  globalThis.fetch = originalFetch;
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

function HomeStockProbe({ visible = true }) {
  result = useVehiclesQuery();
  // HomePage observes these fields before its deferred grid becomes visible.
  const { data, isLoading, isFetching, isError, refetch } = result;
  if (!visible) return null;
  return React.createElement(HomeStockGrid, {
    vehicles: data || [],
    isLoading,
    isFetching,
    isError,
    onRetry: () => { void refetch(); },
    onViewStock: () => { stockVisits += 1; },
  });
}

async function renderHome(visible = true) {
  await act(async () => {
    const element = React.createElement(
      QueryClientProvider, { client }, React.createElement(HomeStockProbe, { visible }),
    );
    if (renderer) renderer.update(element);
    else renderer = TestRenderer.create(element);
  });
}

async function waitFor(predicate) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await act(async () => { await new Promise(resolveTick => setTimeout(resolveTick, 2)); });
  }
  assert.fail("Home stock did not reach the expected state");
}

const text = () => JSON.stringify(renderer.toJSON());
const button = (label) => renderer.root.findAllByType("button")
  .find(node => node.children.join("") === label);
const cards = () => renderer.root.findAll(node => Boolean(node.props["data-car-id"]));

test("a request that failed offscreen recovers when the home grid mounts", async () => {
  respond = async () => requests === 1
    ? new Response("Unavailable", { status: 503 })
    : response([car]);
  await renderHome(false);
  await waitFor(() => result.isError && !result.isFetching);
  assert.equal(requests, 1);
  await renderHome(true);
  await waitFor(() => result.isSuccess && !result.isFetching);
  assert.equal(requests, 2);
  assert.equal(cards().length, 1);
  assert.match(text(), /TORO ENDURANCE TURBO/);
});

test("persistent failure bounds automatic recovery and manual retry can recover the cars", async () => {
  respond = async () => new Response("Unavailable", { status: 503 });
  await renderHome();
  await waitFor(() => requests === 2 && result.isError && !result.isFetching);
  await act(async () => { await new Promise(resolveTick => setTimeout(resolveTick, 25)); });
  assert.equal(requests, 2, "Persistent errors must not start an automatic retry loop");
  assert.match(text(), /Não foi possível carregar os carros/);
  assert.doesNotMatch(text(), /Nenhum veículo encontrado|Limpar Filtros/);
  assert.ok(button("Tentar novamente"));

  let resolveRetry;
  respond = () => new Promise(resolveResponse => { resolveRetry = resolveResponse; });
  await act(async () => button("Tentar novamente").props.onClick());
  await waitFor(() => result.isFetching);
  assert.equal(renderer.root.findByType("output").props["data-loading"], true);
  assert.match(text(), /Carregando carros do estoque/);
  assert.equal(button("Tentar novamente"), undefined);

  await act(async () => resolveRetry(response([car])));
  await waitFor(() => result.isSuccess && !result.isFetching);
  assert.equal(requests, 3);
  assert.equal(cards().length, 1);
  assert.match(text(), /TORO ENDURANCE TURBO/);
  assert.doesNotMatch(text(), /Não foi possível|Limpar Filtros/);
});

test("a failed background refresh retains the last successful cars", async () => {
  await renderHome();
  await waitFor(() => result.isSuccess && !result.isFetching);
  assert.equal(cards().length, 1);
  let rejectRefresh;
  respond = () => new Promise(resolveResponse => { rejectRefresh = resolveResponse; });
  await act(async () => { void result.refetch(); });
  await waitFor(() => result.isFetching);
  assert.equal(cards().length, 1);
  assert.equal(renderer.root.findByType("output").props["data-loading"], false);

  await act(async () => rejectRefresh(new Response("Unavailable", { status: 503 })));
  await waitFor(() => result.isRefetchError && !result.isFetching);
  assert.equal(cards().length, 1);
  assert.doesNotMatch(text(), /Não foi possível|Nenhum veículo|Limpar Filtros/);
});

test("an empty home selection offers working stock navigation instead of fake filters", async () => {
  respond = async () => response([]);
  await renderHome();
  await waitFor(() => result.isSuccess && !result.isFetching);
  assert.match(text(), /Explore o estoque completo/);
  assert.doesNotMatch(text(), /Nenhum veículo|Limpar Filtros|Tentar novamente/);
  await act(async () => button("Explorar seminovos").props.onClick());
  assert.equal(stockVisits, 1);
});
