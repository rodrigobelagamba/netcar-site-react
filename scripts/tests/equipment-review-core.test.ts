import { vehiclePhysicalIdentityKey } from "../../src/lib/vehiclePhysicalIdentity";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyReviewProposal, decideReviewCandidate, decideReviewCandidates, emptyReviewLedger,
  markReviewAsked, observeReviewStock, parseReviewInput, parseReviewSnapshot,
  prepareReviewProposal, recordReviewPublication, reopenReviewCandidate, reviewLifecycle,
  syncReviewCandidates, validateReviewLedger,
  type ReviewAnswer, type ReviewCandidate, type ReviewLedger, type ReviewSnapshot,
} from "../lib/equipmentReview";
import { definitionForEquipmentTag, resolveVehicleEquipment, type UnitEquipmentConfirmation } from "../../src/lib/vehicleEquipment";

const at = "2026-10-09T12:00:00.000Z";
const later = "2026-10-09T12:01:00.000Z";
const base = '{"schemaVersion":1,"records":[]}\n';
function candidate(item = "assistencia_faixa", vehicleId = "99001"): ReviewCandidate {
  const definition = definitionForEquipmentTag(item)!;
  const match = { brand: "FIAT", model: "EXACT SYNTHETIC", modelYear: 2025, engine: "1.0", transmission: "AUTOMATICO", market: "BR" as const };
  return { identity: { id: vehicleId, manufactureYear: 2024, ...match }, item: { key: definition.id, label: definition.description, tag: definition.tag }, classification: "standard", evidence: { url: "https://www.fiat.com.br/catalogo", title: "Catálogo sintético de teste", date: "2025-01-01", locator: "Tabela versão exata", claim: "Item documentado para teste", match, kind: "exact-equipment" } };
}
function snapshot(candidates = [candidate()], observedAt = at): ReviewSnapshot {
  return { schemaVersion: 1, observedAt, vehicles: [...new Map(candidates.map(c => [c.identity.id, { ...c.identity, physicalIdentityKey: vehiclePhysicalIdentityKey(c.identity.id, "ABC1D23"), market: null, seats: "5", options: [] }])).values()] };
}
function setup(candidates = [candidate()]) {
  const stock = snapshot(candidates);
  const input = { schemaVersion: 1 as const, candidates };
  const ledger = syncReviewCandidates(emptyReviewLedger(), input, stock, at);
  return { stock, input, ledger };
}
function answer(ledger: ReviewLedger, index = 0, extra: Partial<ReviewAnswer> = {}): ReviewAnswer {
  const revision = ledger.revisions[index];
  const definition = revision.candidate.item.reviewedDefinition ?? definitionForEquipmentTag(revision.candidate.item.tag!)!;
  return { key: revision.key, vehicleId: revision.candidate.identity.id, itemKey: revision.candidate.item.key, status: "authorized", note: "Ateste sintético, exclusivamente esta unidade e este item.", present: true, authorizePublication: true, marketConfirmed: true, confirmationReference: `chat:test:exact:${revision.key}`, approvedText: { name: definition.description, description: definition.benefit ?? definition.description }, ...extra };
}
function approved(candidates = [candidate()]) {
  const s = setup(candidates);
  const ledger = decideReviewCandidates(s.ledger, s.ledger.revisions.map((_, i) => answer(s.ledger, i)), at);
  const proposal = prepareReviewProposal(ledger, s.stock, base, at);
  return { ...s, ledger, proposal };
}

test("presence, inclusion choice and partial batch decisions remain independent", () => {
  const s = setup([candidate(), candidate("piloto_automatico")]);
  let ledger = decideReviewCandidates(s.ledger, [answer(s.ledger, 0, { status: "presence_confirmed", authorizePublication: false }), answer(s.ledger, 1, { status: "excluded", authorizePublication: false })], at);
  assert.equal(reviewLifecycle(ledger.revisions[0]), "presence_confirmed");
  assert.equal(reviewLifecycle(ledger.revisions[1]), "do_not_include");
  assert.equal(ledger.revisions[1].decision?.present, true, "present but not advertised is valid");
  assert.deepEqual(prepareReviewProposal(ledger, s.stock, base, at).includedKeys, []);
  ledger = decideReviewCandidate(ledger, answer(ledger, 0), later);
  const proposal = prepareReviewProposal(ledger, s.stock, base, later);
  assert.deepEqual(proposal.includedKeys, [ledger.revisions[0].key]);
  const record = proposal.confirmationDocument.records[0] as UnitEquipmentConfirmation;
  assert.deepEqual(record.presentTags, ["assistencia_faixa"]);
  assert.deepEqual(record.absentTags, [], "exclusion never creates a removal");
  assert.equal(ledger.events.filter(e => e.type === "answered").length, 3);
  assert.equal(ledger.events.find(e => e.type === "answered")?.decision?.authorizePublication, false);
});

test("generic legacy OK cannot enter a proposal, and one malformed batch changes nothing", () => {
  const s = setup([candidate(), candidate("piloto_automatico")]);
  const original = structuredClone(s.ledger);
  assert.throws(() => decideReviewCandidates(s.ledger, [answer(s.ledger), { ...answer(s.ledger, 1), vehicleId: "99002" }], at), /mismatched_selection/);
  assert.deepEqual(s.ledger, original);
  const legacy = decideReviewCandidate(s.ledger, { key: s.ledger.revisions[0].key, vehicleId: "99001", itemKey: "lane-assist", status: "confirmed", note: "OK", present: true, authorizePublication: true, marketConfirmed: true }, at);
  assert.ok(prepareReviewProposal(legacy, s.stock, base, at).blocked[0].reasons.includes("exact_approval_reference_and_text_required"));
});

test("new technology starts outside taxonomy and works through reviewed unit definition", () => {
  const unknown = candidate();
  unknown.item = { key: "head-up-display", label: "Head-up display" };
  let s = setup([unknown]);
  assert.equal(prepareReviewProposal(s.ledger, s.stock, base, at).blocked[0].itemDraft?.status, "taxonomy_review_required");
  const reviewed = structuredClone(unknown);
  reviewed.item.tag = "head_up_display";
  reviewed.item.reviewedDefinition = { id: "head-up-display", tag: "head_up_display", sourceDescription: "Head-up display", description: "Head-up display", category: "Conforto", priority: 500, reviewedAt: "2026-10-09", reviewNote: "Definição sintética revisada sem propagar a outra unidade.", aliases: ["HUD"] };
  s = setup([reviewed]);
  const ledger = decideReviewCandidate(s.ledger, answer(s.ledger), at);
  const proposal = prepareReviewProposal(ledger, s.stock, base, at);
  assert.equal(proposal.includedKeys.length, 1);
  const result = applyReviewProposal(ledger, s.stock, base, proposal, proposal.proposalSha256, at);
  const records = JSON.parse(result.documentText).records;
  const raw = { id: "99001", marca: "FIAT", modelo: "EXACT SYNTHETIC", year: 2025, anoFabricacao: 2024, placa: "ABC1D23", motor: "1.0", cambio: "AUTOMATICO", opcionais: [] };
  assert.ok(resolveVehicleEquipment(raw, [], records).items.some(i => i.id === "head-up-display"));
  assert.equal(resolveVehicleEquipment({ ...raw, opcionais: ["HUD"] }, [], records).items.filter(i => i.id === "head-up-display").length, 1, "reimported synonym is deduplicated");
  assert.ok(!resolveVehicleEquipment({ ...raw, id: "99002" }, [], records).items.some(i => i.id === "head-up-display"));
});

for (const [name, mutate, blocker] of [
  ["generic manual", (c: ReviewCandidate) => { c.evidence.kind = "generic-manual"; }, "generic_manual_not_equipment_proof"],
  ["hypothesis", (c: ReviewCandidate) => { c.classification = "inference"; }, "inference_not_publishable"],
  ["wrong edition", (c: ReviewCandidate) => { c.evidence.match.modelYear = 2024; }, "evidence_identity_mismatch"],
  ["third-party ad", (c: ReviewCandidate) => { c.evidence.url = "https://example.com/ad"; }, "official_source_review_required"],
] as const) {
  test(`${name} cannot be applied even after a presence attestation`, () => {
    const c = candidate(); mutate(c);
    const s = approved([c]);
    assert.equal(s.proposal.includedKeys.length, 0);
    assert.ok(s.proposal.blocked[0].reasons.includes(blocker));
    assert.throws(() => applyReviewProposal(s.ledger, s.stock, base, s.proposal, s.proposal.proposalSha256, at), /no_longer_applicable/);
  });
}

test("a documented package still requires the exact unit and no approval transfers to its sibling", () => {
  const first = candidate(); first.classification = "package";
  const second = candidate("assistencia_faixa", "99002"); second.classification = "package";
  const s = setup([first, second]);
  const ledger = decideReviewCandidate(s.ledger, answer(s.ledger), at);
  assert.deepEqual(prepareReviewProposal(ledger, s.stock, base, at).includedKeys, [s.ledger.revisions[0].key]);
});

test("the same question/answer and reordered options are idempotent", () => {
  const s = setup();
  const stock = structuredClone(s.stock); stock.vehicles[0].options = [{ tag: "ar_condicionado", descricao: "Ar condicionado" }, { tag: "vidros_eletricos", descricao: "Vidros elétricos" }];
  let ledger = syncReviewCandidates(emptyReviewLedger(), s.input, stock, at);
  const chosen = answer(ledger, 0, { status: "excluded", authorizePublication: false });
  ledger = markReviewAsked(ledger, chosen, at);
  ledger = markReviewAsked(ledger, chosen, at);
  ledger = decideReviewCandidate(ledger, chosen, at);
  const events = ledger.events.length;
  ledger = decideReviewCandidate(ledger, chosen, later);
  stock.vehicles[0].options.reverse(); stock.observedAt = later;
  ledger = syncReviewCandidates(ledger, s.input, stock, later);
  assert.equal(ledger.revisions.length, 1);
  assert.equal(ledger.events.length, events);
  assert.equal(ledger.revisions[0].status, "excluded");
});

test("model year changes invalidate prior approvals and stale selections", () => {
  const s = approved();
  const changed = structuredClone(s.stock); changed.observedAt = later; changed.vehicles[0].modelYear = 2026;
  const observed = observeReviewStock(s.ledger, changed, later);
  assert.equal(reviewLifecycle(observed.revisions[0]), "invalidated");
  assert.throws(() => decideReviewCandidate(observed, answer(observed), later), /mismatched_selection/);
  const synced = syncReviewCandidates(observed, s.input, changed, later);
  assert.equal(synced.revisions.length, 2);
  assert.equal(synced.revisions[1].status, "pending");
  assert.ok(synced.revisions[1].contextBlockers.includes("identity_mismatch"));
  assert.equal(synced.revisions[0].decision?.authorizePublication, true, "history survives invalidation");
});

test("missing stock identity and explicit foreign market cannot be bypassed by confirmation flags", () => {
  const s = approved();
  for (const patch of [{ engine: "" }, { manufactureYear: null }, { model: "AMBIGUOUS" }, { market: "US" }]) {
    const stock = structuredClone(s.stock); stock.observedAt = later; Object.assign(stock.vehicles[0], patch);
    const prepared = prepareReviewProposal(s.ledger, stock, base, later);
    assert.equal(prepared.includedKeys.length, 0);
  }
});

test("source model alias can be attested, but other XML/API identity disagreements stay blocked", () => {
  const s = setup();
  s.stock.vehicles[0].xml = { identity: { ...s.stock.vehicles[0], model: "EXACT" } as never, flags: {} };
  s.stock.vehicles[0].xml.identity = { id: "99001", brand: "FIAT", model: "EXACT", modelYear: 2025, manufactureYear: 2024, engine: "1.0", transmission: "AUTOMATICO" };
  let ledger = syncReviewCandidates(emptyReviewLedger(), s.input, s.stock, at);
  ledger = decideReviewCandidate(ledger, answer(ledger), at);
  assert.ok(prepareReviewProposal(ledger, s.stock, base, at).blocked[0].reasons.includes("xml_api_model_mismatch"));
  ledger = decideReviewCandidate(ledger, answer(ledger, 0, { sourceIdentityConfirmed: true }), at);
  assert.equal(prepareReviewProposal(ledger, s.stock, base, at).includedKeys.length, 1);
  s.stock.vehicles[0].xml.identity.modelYear = 2024; s.stock.observedAt = later;
  assert.equal(prepareReviewProposal(ledger, s.stock, base, later).includedKeys.length, 0);
});

test("departure followed by an identical ID never revives an authorization", () => {
  const s = approved();
  const missing = snapshot([candidate("assistencia_faixa", "99002")], later);
  const observed = observeReviewStock(s.ledger, missing, later);
  const returned = { ...s.stock, observedAt: "2026-10-09T12:02:00.000Z" };
  const ledger = syncReviewCandidates(observed, s.input, returned, returned.observedAt);
  assert.equal(ledger.revisions.length, 2);
  assert.equal(ledger.revisions[1].status, "pending");
  assert.ok(ledger.revisions[0].unitAbsentSince);
});

test("reopen preserves rejection while creating one new explicit question", () => {
  const s = setup();
  const ledger = decideReviewCandidate(s.ledger, answer(s.ledger, 0, { status: "excluded", authorizePublication: false }), at);
  const reopened = reopenReviewCandidate(ledger, answer(ledger), "Marcelo pediu nova conferência deste item", later);
  assert.equal(reopened.revisions[0].status, "excluded");
  assert.equal(reviewLifecycle(reopened.revisions[0]), "invalidated");
  assert.equal(reopened.revisions[1].status, "pending");
  assert.equal(syncReviewCandidates(reopened, s.input, { ...s.stock, observedAt: later }, later).revisions.length, 2);
});

test("apply checks exact proposal, current base, current decisions, freshness and item text", () => {
  const s = approved();
  assert.throws(() => applyReviewProposal(s.ledger, s.stock, base + " ", s.proposal, s.proposal.proposalSha256, at), /base_changed/);
  const tampered = structuredClone(s.proposal); tampered.confirmationDocument.records = [];
  assert.throws(() => applyReviewProposal(s.ledger, s.stock, base, tampered, s.proposal.proposalSha256, at), /hash_mismatch/);
  const changedDecision = decideReviewCandidate(s.ledger, answer(s.ledger, 0, { status: "excluded", authorizePublication: false }), later);
  assert.throws(() => applyReviewProposal(changedDecision, s.stock, base, s.proposal, s.proposal.proposalSha256, later), /decisions_changed/);
  assert.throws(() => applyReviewProposal(s.ledger, s.stock, base, s.proposal, s.proposal.proposalSha256, "2026-10-09T12:16:00.000Z"), /fresh_stock/);
  assert.throws(() => prepareReviewProposal(s.ledger, s.stock, base, "2026-10-11T12:00:00.000Z"), /fresh_stock/);
  const mismatchedText = decideReviewCandidate(s.ledger, answer(s.ledger, 0, { approvedText: { name: "Piloto totalmente autônomo", description: "Dirige sozinho" } }), later);
  assert.ok(prepareReviewProposal(mismatchedText, s.stock, base, later).blocked[0].reasons.includes("approved_text_does_not_match_definition"));
});

test("apply survives unchanged reimport and records publication only after verified evidence", () => {
  const s = approved();
  const applied = applyReviewProposal(s.ledger, s.stock, base, s.proposal, s.proposal.proposalSha256, at);
  assert.equal(reviewLifecycle(applied.ledger.revisions[0]), "inclusion_authorized", "local application is not publication");
  const repeated = applyReviewProposal(applied.ledger, { ...s.stock, observedAt: later }, applied.documentText, s.proposal, s.proposal.proposalSha256, later);
  assert.equal(repeated.alreadyApplied, true);
  assert.equal(repeated.ledger.events.length, applied.ledger.events.length);
  const records = JSON.parse(applied.documentText).records;
  const vehicle = { id: "99001", marca: "FIAT", modelo: "EXACT SYNTHETIC", year: 2025, anoFabricacao: 2024, placa: "ABC1D23", motor: "1.0", cambio: "AUTOMATICO", opcionais: [] };
  assert.ok(resolveVehicleEquipment(vehicle, [], records).items.some(i => i.id === "lane-assist"));
  assert.ok(resolveVehicleEquipment({ ...vehicle, opcionais: ["ar_condicionado"] }, [], records).items.some(i => i.id === "lane-assist"));
  const published = recordReviewPublication(applied.ledger, answer(applied.ledger), { commit: "a".repeat(40), publicUrl: "https://www.netcarmultimarcas.com.br/veiculo/99001", verifiedAt: later, evidenceReference: "private/synthetic-dom-proof.json", reversalReference: `restore reviewed receipt ${applied.afterSha256}` });
  assert.equal(reviewLifecycle(published.revisions[0]), "published");
  assert.deepEqual(validateReviewLedger(published), published);
  assert.equal(syncReviewCandidates(published, s.input, { ...s.stock, observedAt: later }, later).revisions.length, 1);
});

test("previous absences and manual claims survive a compatible merge; conflicts do not export", () => {
  const s = approved();
  const legacy: UnitEquipmentConfirmation = { schemaVersion: 2, marketSource: "responsible-confirmation", id: "manual-99001", approved: true, source: "responsible-confirmation", confirmedAt: "2025-01-01", claim: "Declaração manual deve ser preservada.", match: { vehicleId: "99001", physicalIdentityKey: vehiclePhysicalIdentityKey("99001", "ABC1D23")!, manufactureYear: 2024, market: "BR", brand: "FIAT", model: "EXACT SYNTHETIC", modelYear: 2025, engine: "1.0", transmission: "AUTOMATICO" }, presentTags: [], absentTags: ["piloto_automatico"] };
  const proposal = prepareReviewProposal(s.ledger, s.stock, JSON.stringify({ records: [legacy] }), at);
  const merged = proposal.confirmationDocument.records[0] as UnitEquipmentConfirmation;
  assert.ok(merged.claim.startsWith(legacy.claim)); assert.deepEqual(merged.absentTags, legacy.absentTags); assert.equal(merged.schemaVersion, 2);
  const conflict = { ...legacy, absentTags: ["assistencia_faixa"] };
  assert.ok(prepareReviewProposal(s.ledger, s.stock, JSON.stringify({ records: [conflict] }), at).blocked[0].reasons.includes("existing_absence_conflict"));
});

test("strict parsers preserve only sanitized stock and reject duplicated canonical items", () => {
  const s = setup();
  assert.deepEqual(parseReviewSnapshot(s.stock, at), s.stock);
  assert.throws(() => parseReviewSnapshot({ ...s.stock, privateContact: "not allowed" }, at), /unexpected_field/);
  assert.throws(() => parseReviewInput({ schemaVersion: 1, candidates: [candidate(), { ...candidate(), item: { key: "another-key", label: "Same lane aid", tag: "assistencia_faixa" } }] }), /duplicate_candidate_item/);
});


test("plate-derived identity blocks reused IDs even when all descriptive fields match", () => {
  const s = approved();
  const changed = structuredClone(s.stock);
  changed.observedAt = later;
  changed.vehicles[0].physicalIdentityKey = vehiclePhysicalIdentityKey("99001", "DEF4G56");
  const invalidated = observeReviewStock(s.ledger, changed, later);
  assert.equal(reviewLifecycle(invalidated.revisions[0]), "invalidated");
  assert.throws(() => applyReviewProposal(s.ledger, changed, base, s.proposal, s.proposal.proposalSha256, later), /decisions_changed/);
  for (const absent of [undefined, null]) {
    const missing = structuredClone(s.stock); missing.vehicles[0].physicalIdentityKey = absent;
    missing.observedAt = later;
    assert.ok(prepareReviewProposal(s.ledger, missing, base, later).blocked[0].reasons.includes("physical_identity_key_required"));
  }
});

test("a legacy manual record is never silently rebound to the current plate", () => {
  const s = approved();
  const record = { id: "manual-99001", approved: true, source: "responsible-confirmation", confirmedAt: "2025-01-01", claim: "Original legacy statement.", match: { vehicleId: "99001", brand: "FIAT", model: "EXACT SYNTHETIC", modelYear: 2025, engine: "1.0", transmission: "AUTOMATICO" }, presentTags: [], absentTags: ["piloto_automatico"] };
  const original = JSON.stringify({ records: [record] });
  const proposal = prepareReviewProposal(s.ledger, s.stock, original, at);
  assert.equal(proposal.includedKeys.length, 0);
  assert.ok(proposal.blocked[0].reasons.includes("legacy_confirmation_physical_binding_review_required"));
  assert.deepEqual(proposal.confirmationDocument, JSON.parse(original));
});
