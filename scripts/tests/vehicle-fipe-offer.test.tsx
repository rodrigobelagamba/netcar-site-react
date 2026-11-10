import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer, type ViteDevServer } from "vite";
import type { FipeOfferVehicle, ReviewedFipeOffer, resolveVehicleFipeOffer as Resolver, VehicleFipeOffer } from "../../src/lib/vehicleFipeOffer";
import type { useVehicleFipeOffer as Hook } from "../../src/lib/useVehicleFipeOffer";
import type { CardsHero as Cards } from "../../src/design-system/components/patterns/CardsHero";
import type { VehicleFipeOfferNote as Note } from "../../src/design-system/components/patterns/VehicleFipeOfferNote";
import type { VehicleCardStatic as Card } from "../../src/design-system/components/patterns/VehicleCard";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cacheDir = mkdtempSync(resolve(tmpdir(), "vehicle-fipe-vite-"));
const records: ReviewedFipeOffer[] = JSON.parse(readFileSync(resolve(root, "src/data/vehicle-fipe-offers.json"), "utf8")).offers;
const now = Date.parse("2026-11-10T21:00:00Z");
let server: ViteDevServer;
let resolveOffer: typeof Resolver;
let useOffer: typeof Hook;
let CardsHero: typeof Cards;
let VehicleFipeOfferNote: typeof Note;
let VehicleCardStatic: typeof Card;

before(async () => {
  server = await createServer({
    root, cacheDir, configFile: false, envFile: false, appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    logLevel: "error", resolve: { alias: { "@": resolve(root, "src"), "@tanstack/react-router": "\0vehicle-fipe-router" } },
    plugins: [{ name: "fipe-test-router", resolveId: (id) => id === "\0vehicle-fipe-router" ? id : undefined,
      load: (id) => id === "\0vehicle-fipe-router" ? "export const useNavigate = () => () => { throw new Error('Unexpected navigation'); };" : undefined }],
    define: { "import.meta.env.DEV": "false", "import.meta.env.VITE_WARRANTY_PREVIEW": JSON.stringify("0") },
  });
  ({ resolveVehicleFipeOffer: resolveOffer } = await server.ssrLoadModule("/src/lib/vehicleFipeOffer.ts"));
  ({ useVehicleFipeOffer: useOffer } = await server.ssrLoadModule("/src/lib/useVehicleFipeOffer.ts"));
  ({ CardsHero } = await server.ssrLoadModule("/src/design-system/components/patterns/CardsHero.tsx"));
  ({ VehicleFipeOfferNote } = await server.ssrLoadModule("/src/design-system/components/patterns/VehicleFipeOfferNote.tsx"));
  ({ VehicleCardStatic } = await server.ssrLoadModule("/src/design-system/components/patterns/VehicleCard.tsx"));
});
after(async () => { await server?.close(); rmSync(cacheDir, { recursive: true, force: true }); });

function vehicle(at = now): FipeOfferVehicle {
  const original = {
    id: "20138", marca: "CHEVROLET", modelo: "TRACKER PREMIER TURBO",
    anoFabricacao: 2026, year: 2027, motor: "1.2", cambio: "AUTOMATICO",
    unitKey: records[0].identity.unitKey, price: 154900, km: 1200,
    observedAt: at, diferenciais: [],
  };
  return { ...original, combustivel: "FLEX", factoryWarrantyVehicle: { ...original } };
}

test("approved approximate statement retains the exact savings and official month/value", () => {
  const result = resolveOffer(vehicle(), records, now);
  assert.ok(result);
  assert.equal(result.label, "Aproximadamente R$ 10 mil abaixo da FIPE");
  assert.equal(result.compactLabel, "Aprox. R$ 10 mil abaixo da FIPE");
  assert.equal(result.savingsLabel, "R$ 9.452");
  assert.equal(result.referenceLabel, "FIPE nov/2026: R$ 164.352");
  assert.equal(vehicle().price, 154900);
  assert.equal(resolveOffer(vehicle(), records, now)?.sourceUrl.startsWith("https://veiculos.fipe.org.br/"), true);
});

test("missing, conflicting or reused physical/model identity never transfers the statement", () => {
  const patches: Partial<FipeOfferVehicle>[] = [
    { id: "20139" }, { unitKey: `plate-sha256:${"a".repeat(64)}` },
    { marca: "HYUNDAI" }, { modelo: "TRACKER LT TURBO" },
    { year: 2026 }, { anoFabricacao: 2025 }, { motor: "1.4" },
    { cambio: "MANUAL" }, { combustivel: "GASOLINA" }, { combustivel: undefined },
  ];
  for (const patch of patches) {
    assert.equal(resolveOffer({ ...vehicle(), ...patch }, records, now), undefined, JSON.stringify(patch));
  }
  for (const unitKey of [undefined, `plate-sha256:${"b".repeat(64)}`]) {
    const candidate = vehicle();
    candidate.factoryWarrantyVehicle!.unitKey = unitKey;
    assert.equal(resolveOffer(candidate, records, now), undefined);
  }
  const incorrectEngine = vehicle();
  incorrectEngine.motor = incorrectEngine.factoryWarrantyVehicle!.motor = "1.4";
  assert.equal(resolveOffer(incorrectEngine, records, now), undefined, "the uncorrected API must remain gated");
});

test("price changes and conflicting catalog envelopes hide, rather than rewrite, the approved offer", () => {
  for (const price of [0, -1, NaN, Infinity, 154899, 154901, 164352]) {
    const candidate = vehicle();
    candidate.price = candidate.factoryWarrantyVehicle!.price = price;
    assert.equal(resolveOffer(candidate, records, now), undefined, String(price));
  }
  const mismatched = vehicle();
  mismatched.factoryWarrantyVehicle!.price = 144900;
  assert.equal(resolveOffer(mismatched, records, now), undefined);
  for (const original of [null, undefined]) {
    assert.equal(resolveOffer({ ...vehicle(), factoryWarrantyVehicle: original }, records, now), undefined);
  }
});

test("only the preserved live observation establishes freshness", () => {
  for (const observedAt of [undefined, now + 1, now - 285000, NaN]) {
    const candidate = vehicle();
    candidate.factoryWarrantyVehicle!.observedAt = observedAt;
    candidate.observedAt = now;
    assert.equal(resolveOffer(candidate, records, now), undefined, String(observedAt));
  }
  assert.ok(resolveOffer(vehicle(now - 284999), records, now));
});

test("FIPE reference expires at the Sao Paulo month boundary", () => {
  const lastNovember = Date.parse("2026-12-01T02:59:59Z");
  const firstDecember = Date.parse("2026-12-01T03:00:00Z");
  assert.ok(resolveOffer(vehicle(lastNovember), records, lastNovember));
  assert.equal(resolveOffer(vehicle(firstDecember), records, firstDecember), undefined);
  for (const patch of [
    { month: "2026-10" }, { month: "2026-13" }, { consultedAt: "2026-11-11T00:00:00Z" },
    { consultedAt: "invalid" }, { modelYear: 2026 }, { value: 164900 },
    { sourceUrl: "https://example.com/fipe" }, { sourceUrl: "http://veiculos.fipe.org.br" },
  ]) {
    const edited = structuredClone(records);
    Object.assign(edited[0].reference, patch);
    assert.equal(resolveOffer(vehicle(), edited, now), undefined, JSON.stringify(patch));
  }
});

test("pending/revoked/unapproved claims never show even with matching inventory", () => {
  for (const status of ["pending", "revoked"]) {
    const edited = structuredClone(records);
    edited[0].status = status;
    assert.equal(resolveOffer(vehicle(), edited, now), undefined);
  }
  const edited = structuredClone(records);
  edited[0].claim = null;
  assert.equal(resolveOffer(vehicle(), edited, now), undefined);
  assert.equal(resolveOffer(vehicle(), [], now), undefined);
});

test("compact card and full note both display the exact difference; sold cards omit the note", () => {
  const offer = resolveOffer(vehicle(), records, now)!;
  const props = { vehicleId: "20138", image: "/images/vehicle-placeholder.webp", brand: "CHEVROLET", model: "TRACKER PREMIER TURBO", year: "2027", fuel: "FLEX", transmission: "AUTOMATICO", mileage: "1.200 km", price: "R$ 154.900", fipeOffer: offer };
  for (const compact of [true, false]) {
    const card = renderToStaticMarkup(<CardsHero {...props} compact={compact} />);
    assert.match(card, /aria-label="Aproximadamente R\$ 10 mil abaixo da FIPE"/);
    assert.match(card, /<span class="block font-normal text-\[10px\]">Aproximadamente<\/span>/);
    assert.match(card, /<strong class="block font-black[^>]+>R\$ 10 mil abaixo da FIPE<\/strong>/);
    assert.match(card, /R\$ 9\.452/);
    assert.match(card, /FIPE nov\/2026: R\$ 164\.352/);
    assert.match(card, /R\$ 154\.900/);
  }
  const detail = renderToStaticMarkup(<VehicleFipeOfferNote offer={offer} />);
  assert.match(detail, /Aproximadamente R\$ 10 mil abaixo da FIPE/);
  assert.match(detail, /R\$ 9\.452/);
  assert.doesNotMatch(renderToStaticMarkup(<CardsHero {...props} isSold />), /data-fipe-offer-id/);
  assert.equal(renderToStaticMarkup(<VehicleFipeOfferNote />), "");
});

test("an open page removes the offer when the preserved observation ages, without a fetch", async () => {
  const originalNow = Date.now;
  const originalInterval = globalThis.setInterval;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalFetch = globalThis.fetch;
  let clock = now;
  let safetyTick: (() => void) | undefined;
  let result: VehicleFipeOffer | undefined;
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  Date.now = () => clock;
  globalThis.fetch = async () => { throw new Error("FIPE guard must not collect stock"); };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { addEventListener() {}, removeEventListener() {} } });
  globalThis.setInterval = ((callback: () => void, delay: number) => {
    safetyTick = callback;
    return originalInterval(callback, delay);
  }) as typeof setInterval;
  function Probe({ current }: { current?: FipeOfferVehicle }) {
    result = useOffer(current);
    return <VehicleFipeOfferNote offer={result} />;
  }
  try {
    await act(async () => { renderer = TestRenderer.create(<Probe current={vehicle()} />); });
    assert.ok(result);
    assert.ok(safetyTick);
    clock = now + 285000;
    await act(async () => { safetyTick!(); });
    assert.equal(result, undefined);
    clock = now;
    await act(async () => { renderer!.update(<Probe current={vehicle()} />); });
    assert.ok(result);
    await act(async () => { renderer!.update(<Probe />); });
    assert.equal(result, undefined, "placeholder/404 callers omit the current vehicle");
  } finally {
    await act(async () => { renderer?.unmount(); });
    Date.now = originalNow;
    globalThis.setInterval = originalInterval;
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("the actual stock card validates displayed fields and formats the same canonical price used for FIPE", async () => {
  const originalNow = Date.now;
  const originalFetch = globalThis.fetch;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const registry = JSON.parse(readFileSync(resolve(root, "src/data/factoryWarrantyMatrix.json"), "utf8"));
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  Date.now = () => now;
  globalThis.fetch = async () => new Response(JSON.stringify(registry), { status: 200, headers: { "Content-Type": "application/json" } });
  const current = vehicle();
  const props = { ...current, warrantyVehicle: current, name: current.modelo!, images: ["/images/vehicle-placeholder.webp"], valor_formatado: "R$ 1,00", compact: true };
  const card = (changes: Partial<typeof props> = {}) => <QueryClientProvider client={client}><VehicleCardStatic {...props} {...changes} /></QueryClientProvider>;
  try {
    await act(async () => { renderer = TestRenderer.create(card()); });
    const rendered = renderer!.root.findByType(CardsHero).props;
    assert.equal(rendered.fipeOffer?.vehicleId, "20138");
    assert.match(rendered.price, /154\.900/);
    assert.notEqual(rendered.price, props.valor_formatado);
    // The brand/model hubs pass warrantyVehicle but omit the optional fuel and
    // transmission display props. Preserve their actual canonical fields.
    for (const compact of [true, false]) {
      await act(async () => { renderer!.update(card({ combustivel: undefined, cambio: undefined, compact })); });
      assert.equal(renderer!.root.findByType(CardsHero).props.fipeOffer?.vehicleId, "20138");
      assert.equal(renderer!.root.findAllByProps({ "data-fipe-offer-id": "20138" }).length, 1);
    }
    const missingCanonicalFuel = { ...current, combustivel: undefined };
    await act(async () => { renderer!.update(card({ warrantyVehicle: missingCanonicalFuel, combustivel: undefined, cambio: undefined })); });
    assert.equal(renderer!.root.findByType(CardsHero).props.fipeOffer, undefined, "missing source fuel must still fail closed");
    await act(async () => { renderer!.update(card({ price: 154901 })); });
    assert.equal(renderer!.root.findByType(CardsHero).props.fipeOffer, undefined);
    await act(async () => { renderer!.update(card({ combustivel: "GASOLINA" })); });
    assert.equal(renderer!.root.findByType(CardsHero).props.fipeOffer, undefined);
    await act(async () => { renderer!.update(card({ price: 0 })); });
    assert.equal(renderer!.root.findByType(CardsHero).props.fipeOffer, undefined);
  } finally {
    await act(async () => { renderer?.unmount(); });
    client.clear();
    Date.now = originalNow;
    globalThis.fetch = originalFetch;
  }
});
