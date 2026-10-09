import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { vehiclePhysicalIdentityKey } from "../../src/lib/vehiclePhysicalIdentity";
import { parseStockResponse } from "../audit-vehicle-equipment";
import { snapshotFromStock } from "../lib/equipmentReview";

const plate = "ABC1D23"; // Synthetic, never a real inventory identifier.
const expected = createHash("sha256").update("netcar-physical-unit-v1\0" + "99999\0" + plate).digest("hex");

test("the shared hash is deterministic, domain separated and normalized conservatively", () => {
  assert.equal(vehiclePhysicalIdentityKey("99999", plate), expected);
  assert.equal(vehiclePhysicalIdentityKey(99999, "abc-1d23"), expected);
  assert.equal(vehiclePhysicalIdentityKey(" 99999\t", " ABC-1D23\n"), expected);
  assert.notEqual(vehiclePhysicalIdentityKey("99998", plate), expected);
  assert.notEqual(vehiclePhysicalIdentityKey("99999", "DEF4G56"), expected);
  assert.equal(expected.length, 64);
});

test("missing, masked, malformed and non-ASCII identifiers fail closed", () => {
  for (const raw of [undefined, null, "", "ABC****", "ABC1D2", "ABC1D234", "ABC1D23!", "\u00a0ABC1D23", "ＡＢＣ1D23", "ÁBC1D23", 1234567]) assert.equal(vehiclePhysicalIdentityKey("99999", raw), null);
  for (const id of [undefined, null, "", "-1", -1, 1.5, "99999\0", "\u00a099999", "x99999"]) assert.equal(vehiclePhysicalIdentityKey(id, plate), null);
});

test("stock projections retain the key but never copy raw plate, VIN or registration fields", () => {
  const payload = { success: true, total_results: 1, offset: 0, data: [{ id: "99999", marca: "FIAT", modelo: "SYNTHETIC", ano: 2025, ano_fabricacao: 2024, motor: "1.0", cambio: "AUTOMATICO", valor: 1, opcionais: [], placa: plate, chassi: "SYNTHETIC-DO-NOT-COPY", renavam: "SYNTHETIC-DO-NOT-COPY" }] };
  const stock = parseStockResponse(payload);
  assert.equal(stock[0].physicalIdentityKey, expected);
  const snapshot = snapshotFromStock(stock, "2026-10-09T12:00:00Z");
  assert.equal(snapshot.vehicles[0].physicalIdentityKey, expected);
  const serialized = JSON.stringify({ stock, snapshot });
  assert.ok(!serialized.includes(plate));
  assert.ok(!serialized.includes("SYNTHETIC-DO-NOT-COPY"));
  assert.ok(!Object.hasOwn(stock[0], "placa"));
});


test("an explicit foreign market survives the API adapter while a missing market stays unknown", () => {
  const vehicle = { id: "99999", marca: "FIAT", modelo: "SYNTHETIC", ano: 2025, ano_fabricacao: 2024, motor: "1.0", cambio: "AUTOMATICO", valor: 1, opcionais: [], placa: plate };
  const payload = (raw: Record<string, unknown>) => ({ success: true, total_results: 1, offset: 0, data: [raw] });
  const foreign = parseStockResponse(payload({ ...vehicle, market: "US" }));
  assert.equal(foreign[0].market, "US");
  assert.equal(snapshotFromStock(foreign, "2026-10-09T12:00:00Z").vehicles[0].market, "US");
  const unknown = parseStockResponse(payload(vehicle));
  assert.equal(snapshotFromStock(unknown, "2026-10-09T12:00:00Z").vehicles[0].market, null);
  assert.throws(() => parseStockResponse(payload({ ...vehicle, market: "invalid-market" })), /Mercado explícito inválido/);
});
