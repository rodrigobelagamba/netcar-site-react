import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  applyOfferReconciliation,
  offerVehicleId,
  planOfferReconciliation,
  reconcileOfferDocuments,
  rollbackOfferReconciliation,
  withOfferReconciliationLock,
} from "../lib/offer-reconciliation.js";
import { writeSeoBuildStockSnapshot } from "../lib/seo-stock-cache.js";
import { runOfferReconciliation } from "../reconcile-offers.mjs";
import { acquireSitePublishLock } from "../lib/site-publish-lock.mjs";

function card(id, extra = {}) {
  return { modelo: "Mesmo modelo", preco: "R$ 75.900,00", url: `https://www.netcarmultimarcas.com.br/veiculo/modelo-2026-tqr-xx49-${id}`, img: "image.jpg", ...extra };
}
function document(cars) {
  return [{ slug: "editorial", title: "Título preservado", publishedAt: "2026-07-13", updatedAt: "2026-10-05", sections: [{ type: "p", text: "Texto editorial preservado." }, { type: "cars", cars }] }];
}
function snapshot(vehicles) {
  return { source: "api-complete", vehicles };
}
function stock(id, valor) {
  return { id, valor, marca: "MARCA", modelo: "Modelo" };
}
function fixture(t, documents = { "blog-auto.json": document([card("20019")]) }) {
  const root = mkdtempSync(join(tmpdir(), "netcar-offer-test-"));
  const source = join(root, "src/data/seo");
  mkdirSync(source, { recursive: true });
  for (const [name, contents] of Object.entries(documents)) {
    const path = join(source, name);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, `${JSON.stringify(contents, null, 2)}\n`);
  }
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, source, path: join(source, "blog-auto.json") };
}

test("price change reconciles every exact-ID offer and preserves prose, dates and other units", () => {
  const before = document([card("20019"), card("200190"), card("20019")]);
  const result = reconcileOfferDocuments({ blog: before }, snapshot([stock("20019", 149900), stock("200190", 75900)]));
  const expected = structuredClone(before);
  expected[0].sections[1].cars[0].preco = "R$ 149.900,00";
  expected[0].sections[1].cars[2].preco = "R$ 149.900,00";
  assert.deepEqual(result.documents.blog, expected);
  assert.deepEqual(before[0].sections[1].cars[0], card("20019"));
  assert.equal(result.summary.pricesChanged, 2);
  assert.equal(result.summary.offers, 3);
  assert.equal(result.summary.uniqueVehicleIds, 2);
});

test("sold and missing exact IDs become unavailable without deleting history or historical prices", () => {
  const before = document([card("20019"), card("20030"), card("20065")]);
  const result = reconcileOfferDocuments({ blog: before }, snapshot([stock("20019", 0), stock("20065", 75900)]));
  const cars = result.documents.blog[0].sections[1].cars;
  assert.equal(cars.length, 3);
  assert.deepEqual(cars[0], { ...card("20019"), available: false });
  assert.deepEqual(cars[1], { ...card("20030"), available: false });
  assert.deepEqual(cars[2], card("20065"));
  assert.equal(result.summary.soldOffers, 1);
  assert.equal(result.summary.missingOffers, 1);
});

test("an unavailable unit returning to stock is reactivated with its current price", () => {
  const result = reconcileOfferDocuments({ blog: document([card("20019", { available: false })]) }, snapshot([stock("20019", 150000)]));
  assert.deepEqual(result.documents.blog[0].sections[1].cars[0], card("20019", { preco: "R$ 150.000,00" }));
  assert.equal(result.summary.reactivated, 1);
});

test("offer objects outside cars sections are reconciled, including nested price fields", () => {
  const result = reconcileOfferDocuments({ selection: { offers: [{ href: "/veiculo/20019", price: 1 }, { link: "/veiculo/modelo-20019", valor: 2 }] } }, snapshot([stock("20019", 159900)]));
  assert.deepEqual(result.documents.selection.offers, [{ href: "/veiculo/20019", price: 159900 }, { link: "/veiculo/modelo-20019", valor: 159900 }]);
});

test("incomplete/fallback, empty, invalid-price and duplicate-ID stock all fail closed", () => {
  const documents = { blog: document([card("20019")]) };
  for (const invalid of [
    { source: "runtime-cache", vehicles: [stock("20019", 149900)] },
    { source: "api", vehicles: [stock("20019", 149900)] },
    snapshot([]), snapshot([stock("20019", 0)]),
    snapshot([stock("20019", NaN)]), snapshot([stock("20019", null)]),
    snapshot([stock("20019", -1)]), snapshot([stock("20019", "")]),
    snapshot([stock("20019", 149900), stock("20019", 149900)]),
  ]) assert.throws(() => reconcileOfferDocuments(documents, invalid));
  assert.deepEqual(documents.blog, document([card("20019")]));
});

test("malformed vehicle IDs and external vehicle links cannot be matched by model", () => {
  assert.equal(offerVehicleId("/veiculo/modelo-2026-tqr-xx49-20019?ref=blog"), "20019");
  assert.equal(offerVehicleId("/seminovos"), null);
  for (const url of ["/veiculo/modelo-20019x", "/veiculo/modelo-020019", "/veiculo/modelo", "https://other.example/veiculo/modelo-20019"]) {
    assert.throws(() => reconcileOfferDocuments({ blog: document([card("20019", { url })]) }, snapshot([stock("20019", 149900)])));
  }
  assert.throws(() => reconcileOfferDocuments({ blog: document([{ modelo: "Modelo", preco: "R$ 1" }]) }, snapshot([stock("20019", 149900)])));
});

test("dry-run is the CLI default and does not write source files or backup content", async (t) => {
  const f = fixture(t);
  const before = readFileSync(f.path, "utf8");
  const report = await runOfferReconciliation({ rootDir: f.root, fetchStock: async () => snapshot([stock("20019", 149900)]) });
  assert.equal(report.mode, "dry-run");
  assert.equal(report.changed, true);
  assert.deepEqual(report.changedFiles, ["src/data/seo/blog-auto.json"]);
  assert.equal(readFileSync(f.path, "utf8"), before);
  assert.deepEqual(readdirSync(join(f.root, ".devops/offer-reconciliation")), []);
});

test("apply is idempotent: second execution changes no source bytes, mtime, or backup", async (t) => {
  const f = fixture(t, { "blog-auto.json": document([card("20019"), card("20030")]), "nested/offers.json": { offer: card("20019") }, "cities.json": [{ title: "Sem ofertas" }] });
  const options = { rootDir: f.root, apply: true, fetchStock: async () => snapshot([stock("20019", 149900), stock("20030", 0)]) };
  const first = await runOfferReconciliation(options);
  assert.equal(first.changed, true);
  assert.deepEqual(first.changedFiles, ["src/data/seo/blog-auto.json", "src/data/seo/nested/offers.json"]);
  const content = readFileSync(f.path, "utf8");
  const mtime = statSync(f.path).mtimeMs;
  const second = await runOfferReconciliation(options);
  assert.equal(second.changed, false);
  assert.deepEqual(second.changedFiles, []);
  assert.equal(second.backupId, undefined);
  assert.equal(readFileSync(f.path, "utf8"), content);
  assert.equal(statSync(f.path).mtimeMs, mtime);
  assert.deepEqual(readdirSync(join(f.root, ".devops/offer-reconciliation/backups")), [first.backupId]);
});

test("rollback restores original bytes and refuses to overwrite later changes", async (t) => {
  const f = fixture(t);
  const before = readFileSync(f.path, "utf8");
  const applied = await runOfferReconciliation({ rootDir: f.root, apply: true, fetchStock: async () => snapshot([stock("20019", 149900)]) });
  const after = readFileSync(f.path, "utf8");
  writeFileSync(f.path, `${after}\n`);
  assert.throws(() => rollbackOfferReconciliation(f.root, applied.backupId), /offer_rollback_conflict/);
  assert.equal(readFileSync(f.path, "utf8"), `${after}\n`);
  writeFileSync(f.path, after);
  const restored = await runOfferReconciliation({ rootDir: f.root, rollback: applied.backupId });
  assert.equal(restored.changed, true);
  assert.equal(readFileSync(f.path, "utf8"), before);
  assert.equal(rollbackOfferReconciliation(f.root, applied.backupId).changed, false);
});

test("a concurrent source edit invalidates the plan before any file is changed", (t) => {
  const f = fixture(t);
  const plan = planOfferReconciliation(f.root, snapshot([stock("20019", 149900)]));
  const content = `${readFileSync(f.path, "utf8")}\n`;
  writeFileSync(f.path, content);
  assert.throws(() => applyOfferReconciliation(f.root, plan), /offer_source_changed_since_plan/);
  assert.equal(readFileSync(f.path, "utf8"), content);
});

test("build snapshot requires api-complete provenance; fallback cannot remove offers", async (t) => {
  const f = fixture(t);
  const before = readFileSync(f.path, "utf8");
  writeSeoBuildStockSnapshot(f.root, [stock("20065", 99000)], { source: "versioned-bootstrap" });
  await assert.rejects(runOfferReconciliation({ rootDir: f.root, apply: true, snapshotFromBuild: true }), /complete_stock_required/);
  assert.equal(readFileSync(f.path, "utf8"), before);
  writeSeoBuildStockSnapshot(f.root, [stock("20065", 99000), stock("20019", 0)], { source: "api-complete" });
  const applied = await runOfferReconciliation({ rootDir: f.root, apply: true, snapshotFromBuild: true });
  assert.equal(applied.summary.soldOffers, 1);
});

test("feed failure leaves all sources untouched and releases both locks", async (t) => {
  const f = fixture(t);
  const before = readFileSync(f.path, "utf8");
  await assert.rejects(runOfferReconciliation({ rootDir: f.root, apply: true, fetchStock: async () => { throw new Error("incomplete_feed"); } }), /incomplete_feed/);
  assert.equal(readFileSync(f.path, "utf8"), before);
  const next = await runOfferReconciliation({ rootDir: f.root, fetchStock: async () => snapshot([stock("20019", 75900)]) });
  assert.equal(next.changed, false);
});

test("concurrency lock refuses simultaneous reconciliation and honors the shared publishing lock", async (t) => {
  const f = fixture(t);
  await withOfferReconciliationLock(f.root, async () => {
    assert.throws(() => withOfferReconciliationLock(f.root, () => {}), /offer_reconciliation_locked/);
  });
  const foreignEnv = {};
  const release = acquireSitePublishLock(f.root, foreignEnv);
  try {
    await assert.rejects(runOfferReconciliation({ rootDir: f.root }), /NETCAR_SITE_PUBLISH_BUSY/);
  } finally { release(); }
});
