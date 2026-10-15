import assert from "node:assert/strict";
import { test } from "node:test";
import { compareInventory, inspectOffers, inventoryMap, parseBrl, validateSnapshot, vehicleIdFromHref } from "../validate-offer-consistency.mjs";

const active = new Map([["20019", 149900], ["20030", 75900]]);
const header = '<link rel="canonical" href="https://www.netcarmultimarcas.com.br/blog/test">';
const card = (id, price) => `<a class="blog-car" href="/veiculo/modelo-2026-xxx-xx00-${id}"><span><b>Modelo</b><strong>${price}</strong></span></a>`;
const page = (...cards) => `${header}<div class="blog-cars">${cards.join("")}</div>`;
const snapshot = () => ({ source: "api-complete", createdAt: new Date().toISOString(), sourceAgeMs: 0, vehicles: [{ id: "20019", valor: 149900 }, { id: "20030", valor: 0 }] });

test("Brazilian prices support grouping, cents and HTML entities without accepting malformed amounts", () => {
  assert.equal(parseBrl("R$ 149.900,00"), 149900);
  assert.equal(parseBrl("R$&nbsp;149.900"), 149900);
  assert.equal(parseBrl("R$ 75.900,25"), 75900.25);
  assert.equal(parseBrl("R$ 149,900"), null);
  assert.equal(parseBrl("149.900"), null);
});

test("only exact terminal IDs on the Netcar vehicle route identify vehicles", () => {
  assert.equal(vehicleIdFromHref("/veiculo/kicks-advance-20019?ref=seo#price"), "20019");
  assert.equal(vehicleIdFromHref("https://other.test/veiculo/kicks-20019"), null);
  assert.equal(vehicleIdFromHref("/veiculo/kicks-20019-extra"), "invalid");
  assert.equal(vehicleIdFromHref("/comprar-nissan-kicks"), null);
});

test("price changes, sold vehicles and missing IDs are all rejected", () => {
  assert.equal(inspectOffers(page(card("20019", "R$ 149.900")), active).errors.length, 0);
  assert.equal(inspectOffers(page(card("20019", "R$ 150.000")), active).errors[0].code, "offer_price_mismatch");
  const sold = inventoryMap([{ id: "20019", valor: 0 }, { id: "20030", valor: 75900 }]);
  assert.equal(inspectOffers(page(card("20019", "R$ 149.900")), sold).errors[0].code, "vehicle_not_active");
  assert.equal(inspectOffers(page(card("99999", "R$ 10.000")), active).errors[0].code, "vehicle_not_active");
});

test("duplicate feed IDs and duplicate cards fail while separate references are allowed", () => {
  assert.throws(() => inventoryMap([{ id: "20019", valor: 1 }, { id: 20019, valor: 1 }]), /duplicate_id/);
  assert.ok(inspectOffers(page(card("20019", "R$ 149.900"), card("20019", "R$ 149.900")), active).errors.some((error) => error.code === "duplicate_offer_in_group"));
  assert.equal(inspectOffers(`${page(card("20019", "R$ 149.900"))}<a href='/veiculo/kicks-20019'>Ver ficha</a>`, active).errors.length, 0);
});

test("validated snapshots fail closed for stale, incomplete, empty and invalid inventories", () => {
  assert.equal(validateSnapshot(snapshot()).active.size, 1);
  assert.throws(() => validateSnapshot({ ...snapshot(), source: "versioned-bootstrap" }), /not_api_complete/);
  assert.throws(() => validateSnapshot({ ...snapshot(), createdAt: "2000-01-01" }), /stale_or_invalid/);
  assert.throws(() => validateSnapshot({ ...snapshot(), vehicles: [] }), /inventory_empty/);
  assert.throws(() => inventoryMap([{ id: "1", valor: "invalid" }]), /invalid_price/);
  assert.throws(() => inventoryMap([{ id: "1", valor: "0x10" }]), /invalid_price/);
  assert.throws(() => inventoryMap([{ id: "1", valor: 0 }]), /no_active/);
  assert.throws(() => inventoryMap([{ id: "1", valor: 10, available: false }]), /no_active/);
});

test("historical detail pages may retain sold records, but available bootstrap may not", () => {
  assert.equal(inspectOffers('<link rel="canonical" href="https://www.netcarmultimarcas.com.br/veiculo/kicks-20019">Vendido', new Map()).skippedDetail, true);
  assert.throws(() => inventoryMap([{ id: "1", price: 0 }], { activeOnly: true }), /bootstrap_inactive/);
  assert.deepEqual(compareInventory(new Map([["20019", 140000]]), active).map((error) => error.code), ["bootstrap_price_mismatch", "bootstrap_missing_active_id"]);
});

test("comparison table prices follow exact vehicle IDs", () => {
  const html = `${header}<section data-comparison-stock="complete"><article data-comparison-vehicle="20019"><a href="/veiculo/a-20019">A</a></article><article data-comparison-vehicle="20030"><a href="/veiculo/b-20030">B</a></article><table><tr><th>Preço anunciado</th><td>R$ 149.900</td><td>R$ 75.900</td></tr></table></section>`;
  assert.equal(inspectOffers(html, active).errors.length, 0);
  assert.ok(inspectOffers(html.replace("R$ 75.900", "R$ 76.900"), active).errors.some((error) => error.code === "offer_price_mismatch" && error.id === "20030"));
});

test("JSON-LD offers and non-card links also reject sold references; scripts are not anchors", () => {
  const html = `${header}<a href="/veiculo/a-99999">Ficha</a><script>const template='<a href="/veiculo/unused-123">';</script><script type="application/ld+json">{"@type":"Product","url":"/veiculo/a-20019","offers":{"price":1}}</script>`;
  const result = inspectOffers(html, active);
  assert.deepEqual(result.links, ["99999"]);
  assert.ok(result.errors.some((error) => error.context === "schema" && error.code === "offer_price_mismatch"));
});

test("second audit is deterministic and does not mutate the provided inventory", () => {
  const html = page(card("20019", "R$ 149.900"));
  const before = [...active];
  assert.deepEqual(inspectOffers(html, active), inspectOffers(html, active));
  assert.deepEqual([...active], before);
});
