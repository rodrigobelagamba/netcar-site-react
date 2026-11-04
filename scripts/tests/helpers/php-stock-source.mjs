import { writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Isolate route/preload tests at the live-reader boundary. The real pagination
 * and failure behavior are covered by landing/showcase-stock-routing tests.
 * Do not put this payload in the legacy build snapshot: index must ask the
 * current source even when rendering its initial bootstrap and preload.
 */
export function writePhpStockSource(directory, payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
  writeFileSync(join(directory, "seo/landing-stock.php"), `<?php
function netcar_fixture_stock() { return json_decode(base64_decode('${encoded}'), true); }
function netcar_landing_bootstrap() { return netcar_fixture_stock(); }
function netcar_landing_live_stock() { $value = netcar_fixture_stock(); return $value['showroomVehicles'] ?? $value['vehicles']; }
function netcar_landing_bootstrap_vehicle($vehicle) { return $vehicle; }
`);
}
