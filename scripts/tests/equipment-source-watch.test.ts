import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyEquipmentSourceWatch, extractSourceParagraphs, validateEquipmentSourceWatch, watchEquipmentSources } from "../lib/equipmentSourceWatch";
import type { ReviewInput } from "../lib/equipmentReview";
const at = "2026-10-09T12:00:00.000Z";
const match = { brand: "FIAT", model: "SYNTHETIC EXACT", modelYear: 2025, engine: "1.0", transmission: "AUTOMATICO", market: "BR" as const };
function input(url = "https://www.fiat.com.br/catalogo"): ReviewInput { return { schemaVersion: 1, candidates: [{ identity: { id: "99001", manufactureYear: 2024, ...match }, item: { key: "unknown-tech", label: "Nova função ainda sem taxonomia" }, classification: "inference", evidence: { url, title: "Catálogo sintético", date: "2025-01-01", locator: "Tabela versão exata", claim: "Informação requer conferência", match, kind: "exact-equipment" } }] }; }
const initial = "Sistema sintético de projeção luminosa Aurora Quantum, exclusivo da versão desta edição.";
const newTech = "Nova tecnologia Janela Cristal Térmica, ainda inexistente na lista conhecida de equipamentos.";
const html = (text: string) => `<html><head><script>do not execute</script></head><body><nav>Menu de compra e navegação não representa equipamento da unidade.</nav><article><h1>Versão brasileira ano-modelo 2025</h1><p>${text}</p></article><footer>Rodapé extenso sem relevância para o equipamento aqui descrito.</footer></body></html>`;
const fetcher = (text: string): typeof fetch => async (_url, init) => { assert.equal(init?.redirect, "error"); assert.ok(init?.signal); return new Response(html(text), { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }); };

test("baseline and changed unknown technology are review excerpts, never approvals or taxonomy", async () => {
  const source = input(); const before = structuredClone(source);
  const first = await watchEquipmentSources(source, emptyEquipmentSourceWatch(), fetcher(initial), at);
  assert.equal(first.updates.length, 1); assert.equal(first.updates[0].kind, "baseline-excerpt");
  const next = await watchEquipmentSources(source, first.ledger, fetcher(`${initial}</p><p>${newTech}`), at);
  assert.equal(next.updates.length, 1); assert.equal(next.updates[0].text, newTech); assert.equal(next.updates[0].status, "source-change-needs-review");
  assert.equal(next.updates[0].classification, "information-insufficient");
  assert.deepEqual(next.updates[0].match, match); assert.deepEqual(source, before);
  assert.equal(next.ledger.history.length, 2);
});

test("unchanged paragraphs are not repeated, even if HTML chrome changes", async () => {
  const first = await watchEquipmentSources(input(), emptyEquipmentSourceWatch(), fetcher(initial), at);
  const repeated = await watchEquipmentSources(input(), first.ledger, fetcher(initial), at);
  assert.deepEqual(repeated.updates, []); assert.equal(repeated.ledger.history.length, 1);
  assert.deepEqual(extractSourceParagraphs(html(initial)), first.ledger.sources[0].paragraphs);
  const cosmetic = await watchEquipmentSources(input(), repeated.ledger, async () => new Response(html(initial).replace("<article>", '<article class="fresh-layout">'), { headers: { "content-type": "text/html" } }), at);
  assert.deepEqual(cosmetic.updates, [], "HTML cosmetic changes do not repeat a question");
});

test("fetch failure preserves last successful source and never saves arbitrary error text", async () => {
  const first = await watchEquipmentSources(input(), emptyEquipmentSourceWatch(), fetcher(initial), at);
  const failed = await watchEquipmentSources(input(), first.ledger, async () => { throw new Error("private-token-here"); }, at);
  assert.equal(failed.checks[0].status, "failed"); assert.deepEqual(failed.ledger.sources[0].paragraphs, first.ledger.sources[0].paragraphs);
  assert.equal(failed.ledger.sources[0].contentSha256, first.ledger.sources[0].contentSha256);
  assert.ok(!JSON.stringify(failed).includes("private-token-here"));
  const sameFailure = await watchEquipmentSources(input(), failed.ledger, async () => { throw new Error("another failure"); }, at);
  assert.equal(sameFailure.ledger.history.length, failed.ledger.history.length);
});

test("nonofficial hosts and insecure or credential URLs are never fetched", async () => {
  for (const url of ["http://www.fiat.com.br/catalogo", "https://www.fiat.com.br.attacker.test/", "https://www.fiat.com.br:8443/", "https://u:p@www.fiat.com.br/", "https://www.fiat.com.br/?token=secret"]) {
    let requests = 0;
    // Unsupported sources are isolated; unsafe URLs and credentials are never persisted.
    const result = await watchEquipmentSources(input(url), emptyEquipmentSourceWatch(), async () => { requests++; return new Response("no"); }, at);
    assert.equal(result.checks[0].status, "failed");
    assert.deepEqual(result.ledger.sources, []);
    assert.ok(!JSON.stringify(result).includes(url));
    assert.equal(requests, 0);
  }
});

test("PDFs and oversize documents never become inferred equipment", async () => {
  const pdf = await watchEquipmentSources(input(), emptyEquipmentSourceWatch(), async () => new Response("%PDF-1.7 synthetic", { headers: { "content-type": "application/pdf" } }), at);
  assert.equal(pdf.checks[0].status, "manual_pdf_review_required"); assert.equal(pdf.ledger.sources[0].paragraphs.length, 0); assert.equal(pdf.updates[0].classification, "information-insufficient");
  const oversized = await watchEquipmentSources(input(), emptyEquipmentSourceWatch(), async () => new Response("small actual body", { headers: { "content-type": "text/html", "content-length": String(3 * 1024 * 1024) } }), at);
  assert.equal(oversized.checks[0].status, "failed"); assert.deepEqual(oversized.updates, []);
});

test("ledger corruption or history limits fail without discarding prior history", () => {
  const ledger = emptyEquipmentSourceWatch();
  assert.throws(() => validateEquipmentSourceWatch({ ...ledger, history: Array(1201).fill({}) }), /invalid_source_history/);
  assert.deepEqual(ledger, emptyEquipmentSourceWatch());
});


test("source A to B to A does not re-ask any previously recorded excerpt", async () => {
  const first = await watchEquipmentSources(input(), emptyEquipmentSourceWatch(), fetcher(initial), at);
  const changed = await watchEquipmentSources(input(), first.ledger, fetcher(newTech), at);
  const restored = await watchEquipmentSources(input(), changed.ledger, fetcher(initial), at);
  assert.equal(changed.updates.length, 1);
  assert.deepEqual(restored.updates, []);
  assert.equal(restored.ledger.sources[0].paragraphs[0].text, initial);
});

test("one unsupported source cannot prevent another official document from being checked", async () => {
  const mixed = input();
  mixed.candidates.push({ ...input("https://example.com/unverified").candidates[0], item: { key: "unverified", label: "Fonte ainda em revisão" } });
  const result = await watchEquipmentSources(mixed, emptyEquipmentSourceWatch(), fetcher(initial), at);
  assert.equal(result.checks.length, 2);
  assert.equal(result.checks.filter(check => check.status === "ok").length, 1);
  assert.equal(result.checks.filter(check => check.status === "failed").length, 1);
  assert.equal(result.ledger.sources.length, 1);
  assert.equal(result.updates.length, 1);
});
