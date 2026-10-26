import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";
import { resolveVehicleEquipment } from "../../src/lib/vehicleEquipment";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cacheDir = mkdtempSync(resolve(tmpdir(), "netcar-equipment-market-"));
let server: ViteDevServer;
let endpoints: typeof import("../../src/catalog/endpoints/vehicles");
let payload: Record<string, unknown>;

before(async () => {
  // Vite runs the production adapters with their real aliases/import.meta.env.
  server = await createServer({
    root,
    cacheDir,
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
    logLevel: "silent",
    resolve: { alias: { "@": resolve(root, "src") } },
    define: {
      "import.meta.env.VITE_API_BASE_URL": JSON.stringify("https://catalog.test/api/v1"),
    },
  });
  const { axiosInstance } = await server.ssrLoadModule("/src/catalog/axios-instance.ts");
  axiosInstance.get = async () => ({ data: payload, status: 200, statusText: "OK" });
  endpoints = await server.ssrLoadModule("/src/catalog/endpoints/vehicles.ts");
});

after(async () => {
  await server?.close();
  rmSync(cacheDir, { recursive: true, force: true });
});

for (const market of ["US", "BR", undefined, 123]) {
  test(`list and detail preserve source market before equipment gating: ${market}`, async () => {
    payload = {
      success: true,
      total_results: 1,
      data: [{
        id: "99999", marca: "HONDA", modelo: "HRV EX", ano: 2018,
        ano_fabricacao: 2017, motor: "1.8", cambio: "AUTOMATICO", valor: 89900,
        km: 50000, link: "99999", imagens: { thumb: [], full: [] },
        opcionais: ["android", "piloto_automatico"],
        ...(market === undefined ? {} : { market }),
      }],
    };
    const [listed] = await endpoints.fetchVehicles();
    const detailed = await endpoints.fetchVehicleById("99999");
    for (const vehicle of [listed, detailed]) {
      assert.equal(vehicle.market, typeof market === "string" ? market : undefined);
      const equipment = resolveVehicleEquipment(vehicle);
      assert.equal(equipment.items.some((item) => item.id === "android-auto"), market === "US");
      assert.equal(equipment.items.some((item) => item.id === "cruise-control"), true);
      assert.equal(
        equipment.suppressed.some((item) => item.reason === "factory-configuration-conflict"),
        market !== "US",
      );
    }
  });
}
