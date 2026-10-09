import { createHash } from "node:crypto";
import {
  definitionForEquipmentTag,
  definitionForUnitEquipmentTag,
  isReviewedUnitEquipmentDefinition,
  type ReviewedUnitEquipmentDefinition,
  equipmentEvidenceRegistry,
  isApprovedUnitEquipmentConfirmation,
  normalizeEquipmentTag,
  resolveVehicleEquipment,
  type UnitEquipmentConfirmation,
} from "../../src/lib/vehicleEquipment";
import { mapVehicleOptional } from "../../src/catalog/lib/mapVehicleOptional";
import { parseStockResponse, type EquipmentAuditInput } from "../audit-vehicle-equipment";

// Pure review transitions. Filesystem writes and deploy remain explicit operator actions.
const LIMIT = 2000;
const HASH = /^[a-f0-9]{64}$/;
const STATES = ["pending", "confirmed", "rejected", "deferred", "presence_confirmed", "authorized", "excluded", "published"] as const;
export type ReviewStatus = typeof STATES[number];
export interface ReviewMatch {
  brand: string; model: string; modelYear: number; engine: string;
  transmission: string; market: "BR";
}
export interface ReviewIdentity extends ReviewMatch { id: string; manufactureYear?: number }
export interface ReviewCandidate {
  identity: ReviewIdentity;
  item: { key: string; label: string; tag?: string; reviewedDefinition?: ReviewedUnitEquipmentDefinition };
  classification: "standard" | "package" | "accessory" | "inference";
  evidence: {
    url: string; title: string; date: string; locator: string; claim: string;
    match: ReviewMatch; kind: "exact-equipment" | "generic-manual";
  };
}
export interface ReviewInput { schemaVersion: 1; candidates: ReviewCandidate[] }
export interface ReviewStockVehicle {
  id: string; brand: string; model: string; modelYear: number | null;
  manufactureYear: number | null; physicalIdentityKey?: string | null; engine: string; transmission: string;
  market: string | null; seats: string; options: Array<{ tag: string; descricao: string }>;
  // An XML projection may accompany the API; absence is not interpreted as false.
  xml?: { identity: Record<string, string | number | null>; flags: Record<string, boolean> };
}
export interface ReviewSnapshot { schemaVersion: 1; observedAt: string; vehicles: ReviewStockVehicle[] }
export interface ReviewDecision {
  note: string; present: boolean; authorizePublication: boolean; marketConfirmed: boolean;
  sourceIdentityConfirmed: boolean;
  confirmationReference?: string;
  approvedText?: { name: string; description: string };
}
export interface ReviewRevision {
  key: string; candidate: ReviewCandidate; stockFingerprint: string;
  generation: number; unitAbsentSince?: string;
  contextBlockers: string[]; active: boolean; status: ReviewStatus;
  firstSeenAt: string; lastSeenAt: string; askedAt?: string; answeredAt?: string;
  decision?: ReviewDecision; supersededBy?: string;
  invalidatedAt?: string; invalidationReason?: string;
  application?: { proposalSha256: string; beforeSha256: string; afterSha256: string; appliedAt: string };
  publication?: { commit: string; publicUrl: string; verifiedAt: string; evidenceReference: string; reversalReference: string };
}
export interface ReviewEvent {
  key: string; at: string; type: "created" | "asked" | "answered" | "superseded" | "archived" | "reactivated" | "invalidated" | "applied" | "published" | "reopened";
  status?: ReviewStatus; note?: string; decision?: ReviewDecision;
}
export interface ReviewLedger { schemaVersion: 1; revisions: ReviewRevision[]; events: ReviewEvent[]; lastObservedAt?: string; lastObservationFingerprint?: string }
export interface ReviewSelection { key: string; vehicleId: string; itemKey: string }
export interface ReviewAnswer extends ReviewSelection {
  status: "confirmed" | "rejected" | "deferred" | "presence_confirmed" | "authorized" | "excluded"; note: string;
  present?: boolean; authorizePublication?: boolean; marketConfirmed?: boolean;
  sourceIdentityConfirmed?: boolean;
  confirmationReference?: string;
  approvedText?: { name: string; description: string };
}
export interface ReviewProposal {
  schemaVersion: 1; proposalOnly: true; generatedAt: string; snapshotObservedAt: string;
  baseSha256: string; includedKeys: string[];
  decisionSha256: string; proposalSha256: string;
  limitations: string[];
  reviewBindings: Array<{ key: string; identity: ReviewIdentity; stockFingerprint: string; sourceIdentityConfirmed: boolean }>;
  blocked: Array<{ key: string; reasons: string[]; itemDraft?: { key: string; label: string; proposedTag: null; status: "taxonomy_review_required" } }>;
  confirmationDocument: Record<string, unknown> & { records: unknown[] };
}

function fail(code: string): never { throw new Error(`Equipment review: ${code}`); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("invalid_object");
  return value as Record<string, unknown>;
}
function exact(value: unknown, allowed: string[]): Record<string, unknown> {
  const result = object(value);
  if (Object.keys(result).some((key) => !allowed.includes(key))) fail("unexpected_field");
  return result;
}
function str(value: unknown, max = 400): string {
  if (typeof value !== "string" || !value.trim() || value.length > max || [...value].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) fail("invalid_text");
  return value.trim().replace(/\s+/g, " ");
}
function optionalText(value: unknown): string { return value == null || value === "" ? "" : str(value); }
function year(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1900 || value > 2100) fail("invalid_year");
  return value;
}
function nullableYear(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "string" && /^\d{4}$/.test(value) ? Number(value) : value;
  return year(n);
}
function instant(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) fail("invalid_timestamp");
  return new Date(value).toISOString();
}
function date(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail("invalid_date");
  if (instant(`${value}T00:00:00Z`).slice(0, 10) !== value) fail("invalid_date");
  return value;
}
function id(value: unknown): string {
  if (typeof value !== "string" || !/^\d{1,20}$/.test(value)) fail("invalid_vehicle_id");
  return value;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
const digest = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
const norm = normalizeEquipmentTag;
function match(value: unknown, identity = false): ReviewMatch | ReviewIdentity {
  const raw = exact(value, ["brand", "model", "modelYear", "engine", "transmission", "market", ...(identity ? ["id", "manufactureYear"] : [])]);
  if (raw.market !== "BR") fail("document_market_required");
  const result: ReviewMatch = { brand: str(raw.brand), model: str(raw.model), modelYear: year(raw.modelYear), engine: str(raw.engine), transmission: str(raw.transmission), market: "BR" };
  return identity ? { ...result, id: id(raw.id), ...(raw.manufactureYear !== undefined ? { manufactureYear: year(raw.manufactureYear) } : {}) } : result;
}
function candidate(value: unknown): ReviewCandidate {
  const raw = exact(value, ["identity", "item", "classification", "evidence"]);
  const identity = match(raw.identity, true) as ReviewIdentity;
  const item = exact(raw.item, ["key", "label", "tag", "reviewedDefinition"]);
  if (item.reviewedDefinition !== undefined && !isReviewedUnitEquipmentDefinition(item.reviewedDefinition)) fail("invalid_reviewed_definition");
  const key = str(item.key, 150);
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(key)) fail("invalid_item_key");
  const evidence = exact(raw.evidence, ["url", "title", "date", "locator", "claim", "match", "kind"]);
  if (!["standard", "package", "accessory", "inference"].includes(String(raw.classification))) fail("invalid_classification");
  if (!["exact-equipment", "generic-manual"].includes(String(evidence.kind))) fail("invalid_evidence_kind");
  let url: URL;
  try { url = new URL(str(evidence.url, 2048)); } catch { return fail("invalid_source_url"); }
  if (url.protocol !== "https:" || url.username || url.password || [...url.searchParams.keys()].some((k) => /token|secret|password|credential|signature|api.?key/i.test(k))) fail("invalid_source_url");
  return {
    identity, item: { key, label: str(item.label), ...(item.tag !== undefined ? { tag: str(item.tag) } : {}), ...(item.reviewedDefinition ? { reviewedDefinition: structuredClone(item.reviewedDefinition) as ReviewedUnitEquipmentDefinition } : {}) },
    classification: raw.classification as ReviewCandidate["classification"],
    evidence: { url: url.href, title: str(evidence.title), date: date(evidence.date), locator: str(evidence.locator), claim: str(evidence.claim, 2000), match: match(evidence.match) as ReviewMatch, kind: evidence.kind as ReviewCandidate["evidence"]["kind"] },
  };
}
export function parseReviewInput(value: unknown): ReviewInput {
  const raw = exact(value, ["schemaVersion", "candidates"]);
  if (raw.schemaVersion !== 1 || !Array.isArray(raw.candidates) || raw.candidates.length > LIMIT) fail("invalid_candidate_input");
  const candidates = raw.candidates.map(candidate);
  const keys = candidates.map((c) => `${c.identity.id}:${c.item.key}`);
  if (new Set(keys).size !== keys.length) fail("duplicate_candidate");
  const canonicalKeys = candidates.map((c) => `${c.identity.id}:${mapping(c)?.id || `unknown-${c.item.key}`}`);
  if (new Set(canonicalKeys).size !== canonicalKeys.length) fail("duplicate_candidate_item");
  return { schemaVersion: 1, candidates };
}

function normalizedOptions(options: readonly (string | { tag?: string | null; descricao?: string | null; nome?: string | null })[]) {
  return [...new Map(options.map((raw) => {
    const item = mapVehicleOptional(raw);
    const normalized = { tag: norm(item.tag), descricao: norm(item.descricao) };
    return [canonical(normalized), normalized] as const;
  })).values()].sort((a, b) => canonical(a).localeCompare(canonical(b)));
}
export function snapshotFromStock(vehicles: readonly EquipmentAuditInput[], observedAt: string): ReviewSnapshot {
  if (!Array.isArray(vehicles) || !vehicles.length || vehicles.length > 500) fail("invalid_stock");
  const rows: ReviewStockVehicle[] = vehicles.map((vehicle) => ({
    id: id(String(vehicle.id)), brand: optionalText(vehicle.marca), model: optionalText(vehicle.modelo),
    modelYear: nullableYear(vehicle.year), manufactureYear: nullableYear(vehicle.anoFabricacao ?? vehicle.warrantySnapshot?.manufactureYear),
    physicalIdentityKey: vehicle.physicalIdentityKey ?? null,
    engine: optionalText(vehicle.motor), transmission: optionalText(vehicle.cambio), market: vehicle.market ?? null,
    seats: vehicle.lugares == null ? "" : String(vehicle.lugares), options: (vehicle.opcionais || []).map(mapVehicleOptional),
  }));
  if (new Set(rows.map((v) => v.id)).size !== rows.length) fail("duplicate_stock_id");
  return { schemaVersion: 1, observedAt: instant(observedAt), vehicles: rows };
}
/** Explicit allowlist adapters; neither API private fields nor full XML survive. */
export function parseReviewSnapshot(value: unknown, observedAt: string): ReviewSnapshot {
  const raw = object(value);
  if (raw.schemaVersion === 1 && typeof raw.observedAt === "string") {
    exact(raw, ["schemaVersion", "observedAt", "vehicles"]);
    const snapshot = structuredClone(raw) as unknown as ReviewSnapshot;
    validateSnapshot(snapshot);
    return snapshot;
  }
  if (raw.success === true) return snapshotFromStock(parseStockResponse(raw), observedAt);
  if (raw.schemaVersion !== 1 || !Array.isArray(raw.vehicles) || !raw.vehicles.length || raw.vehicles.length > 500) fail("invalid_stock_snapshot");
  const counts = object(raw.counts); const sources = object(raw.sources);
  if ([counts.xmlVehicles, counts.apiVehicles, counts.apiDeclaredCount].some((n) => n !== (raw.vehicles as unknown[]).length) || !Number.isInteger(counts.activeByPositivePrice) || !Array.isArray(counts.idsOnlyInXml) || counts.idsOnlyInXml.length || !Array.isArray(counts.idsOnlyInApi) || counts.idsOnlyInApi.length) fail("incomplete_stock_snapshot");
  for (const type of ["api", "xml"]) {
    const source = object(sources[type]);
    if (source.httpStatus !== 200 || typeof source.sha256 !== "string" || !HASH.test(source.sha256)) fail("unverified_stock_snapshot");
    instant(source.observedAtUtc);
  }
  const vehicles: ReviewStockVehicle[] = [];
  const ids = new Set<string>();
  for (const entry of raw.vehicles) {
    const row = object(entry); const api = object(row.api); const identity = object(api.identity);
    const vehicleId = id(row.id);
    if (ids.has(vehicleId) || identity.id !== vehicleId) fail("duplicate_or_mismatched_stock_id");
    ids.add(vehicleId);
    if (typeof api.activeByPositivePrice !== "boolean" || !Array.isArray(api.equipment) || api.equipment.length > 300) fail("invalid_stock_snapshot");
    const options = api.equipment.map((option) => {
      const item = object(option);
      return { tag: optionalText(item.tag), descricao: optionalText(item.description) };
    });
    const vehicle: ReviewStockVehicle = {
      id: vehicleId, brand: optionalText(identity.brand), model: optionalText(identity.modelVersion),
      modelYear: nullableYear(identity.modelYear), manufactureYear: nullableYear(identity.manufactureYear),
      physicalIdentityKey: typeof identity.physicalIdentityKey === "string" && HASH.test(identity.physicalIdentityKey) ? identity.physicalIdentityKey : null,
      engine: optionalText(identity.engine), transmission: optionalText(identity.transmission), market: null,
      seats: "", options,
    };
    if (row.xml != null) {
      const xml = object(row.xml); const xi = object(xml.identity); const flags = object(xml.optionFlags);
      if (xi.id !== vehicleId) fail("mismatched_xml_id");
      const safeFlags: Record<string, boolean> = {};
      for (const [key, flag] of Object.entries(flags)) {
        if (!/^[a-zA-Z0-9_-]{1,100}$/.test(key) || typeof flag !== "boolean") fail("invalid_xml_flag");
        safeFlags[key] = flag;
      }
      vehicle.xml = { identity: { id: vehicleId, brand: optionalText(xi.brand), model: optionalText(xi.modelVersion), modelYear: nullableYear(xi.modelYear), manufactureYear: nullableYear(xi.manufactureYear), engine: optionalText(xi.engine), transmission: optionalText(xi.transmission) }, flags: safeFlags };
    } else fail("missing_xml_projection");
    if (api.activeByPositivePrice) vehicles.push(vehicle);
  }
  if (!vehicles.length) fail("empty_active_stock");
  if (vehicles.length !== counts.activeByPositivePrice) fail("incomplete_active_stock");
  return { schemaVersion: 1, observedAt: instant(raw.observedAtUtc ?? observedAt), vehicles };
}

function matching(a: ReviewMatch, b: { brand: string; model: string; modelYear: number | null; engine: string; transmission: string }): boolean {
  return a.modelYear === b.modelYear && ["brand", "model", "engine", "transmission"].every((key) => norm(a[key as "brand"]) === norm(b[key as "brand"]));
}
function mapping(c: ReviewCandidate): { id: string; tag: string; description: string; benefit?: string } | null {
  if (!c.item.tag) return null;
  const base = definitionForEquipmentTag(c.item.tag);
  if (base) return base;
  const custom = c.item.reviewedDefinition;
  return custom && isReviewedUnitEquipmentDefinition(custom) && norm(custom.tag) === norm(c.item.tag) ? custom : null;
}
function mappingMatches(c: ReviewCandidate): boolean {
  const definition = mapping(c);
  if (!definition || c.item.key !== definition.id) return false;
  if (c.item.reviewedDefinition) return norm(c.item.label) === norm(definition.description);
  const result = resolveVehicleEquipment({ opcionais: [{ descricao: c.item.label }] }, [], []);
  return result.items.length === 1 && result.items[0].id === definition.id;
}
function officialSource(c: ReviewCandidate): boolean {
  const url = new URL(c.evidence.url); const brand = norm(c.identity.brand);
  if (url.port) return false;
  if (["www.media.stellantis.com", "media.stellantis.com"].includes(url.hostname)) {
    return ["jeep", "fiat", "peugeot", "citroen", "ram"].includes(brand) && url.pathname.startsWith(`/br-pt/${brand}/`);
  }
  const domains: Record<string, string[]> = {
    nissan: ["www.nissan.com.br", "nissan.com.br"],
    volkswagen: ["www.vw.com.br", "vw.com.br"],
    fiat: ["www.fiat.com.br", "fiat.com.br"], jeep: ["www.jeep.com.br", "jeep.com.br"],
    ford: ["www.ford.com.br", "ford.com.br"], honda: ["www.honda.com.br", "honda.com.br"],
    chevrolet: ["www.chevrolet.com.br", "chevrolet.com.br"],
    hyundai: ["www.hyundai.com.br", "hyundai.com.br"],
    chery: ["www.caoachery.com.br", "caoachery.com.br"],
    caoa_chery: ["www.caoachery.com.br", "caoachery.com.br"],
  };
  if (brand === "byd" && ["www.byd.com", "byd.com"].includes(url.hostname)) return /^\/br(?:\/|$)/.test(url.pathname);
  return domains[brand]?.includes(url.hostname) ?? false;
}
function revisionKey(c: ReviewCandidate, stockFingerprint: string, generation: number): string {
  // Never recompute a historical key with today's taxonomy or resolver.
  return digest({ schemaVersion: 1, candidate: c, stockFingerprint, generation });
}
function validateSnapshot(snapshot: ReviewSnapshot): void {
  if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.vehicles) || !snapshot.vehicles.length || snapshot.vehicles.length > 500) fail("invalid_stock_snapshot");
  instant(snapshot.observedAt);
  const ids = new Set<string>();
  for (const v of snapshot.vehicles) {
    exact(v, ["id", "brand", "model", "modelYear", "manufactureYear", "physicalIdentityKey", "engine", "transmission", "market", "seats", "options", "xml"]);
    id(v.id);
    if (ids.has(v.id)) fail("duplicate_stock_id");
    ids.add(v.id);
    if (!Array.isArray(v.options) || v.options.length > 300) fail("invalid_stock_options");
    if (![v.brand, v.model, v.engine, v.transmission, v.seats].every((s) => typeof s === "string")) fail("invalid_stock_identity");
    if (v.modelYear !== null) year(v.modelYear);
    if (v.manufactureYear !== null) year(v.manufactureYear);
    if (v.physicalIdentityKey != null && (typeof v.physicalIdentityKey !== "string" || !HASH.test(v.physicalIdentityKey))) fail("invalid_physical_identity_key");
    if (v.market !== null && (typeof v.market !== "string" || !/^[A-Z]{2}$/.test(v.market))) fail("invalid_stock_market");
    for (const option of v.options) { exact(option, ["tag", "descricao"]); optionalText(option.tag); optionalText(option.descricao); }
    if (v.xml) {
      exact(v.xml, ["identity", "flags"]);
      const identity = exact(v.xml.identity, ["id", "brand", "model", "modelYear", "manufactureYear", "engine", "transmission"]);
      if (identity.id !== v.id) fail("mismatched_xml_id");
      for (const field of ["brand", "model", "engine", "transmission"]) optionalText(identity[field]);
      nullableYear(identity.modelYear); nullableYear(identity.manufactureYear);
      for (const [tag, flag] of Object.entries(object(v.xml.flags))) if (!/^[A-Za-z0-9_-]{1,100}$/.test(tag) || typeof flag !== "boolean") fail("invalid_xml_flag");
    }
  }
}
function context(c: ReviewCandidate, snapshot: ReviewSnapshot) {
  const stock = snapshot.vehicles.find((v) => v.id === c.identity.id);
  const blockers: string[] = [];
  if (!stock) blockers.push("unit_not_active");
  if (stock && (!matching(c.identity, stock) || (c.identity.manufactureYear !== undefined && c.identity.manufactureYear !== stock.manufactureYear))) blockers.push("identity_mismatch");
  if (stock?.market && stock.market !== c.identity.market) blockers.push("market_mismatch");
  if (!matching(c.identity, c.evidence.match)) blockers.push("evidence_identity_mismatch");
  if (stock?.xml) {
    const xi = stock.xml.identity;
    if (xi.modelYear !== stock.modelYear || xi.manufactureYear !== stock.manufactureYear || ["brand", "engine", "transmission"].some((k) => norm(String(xi[k] ?? "")) !== norm(String(stock[k as "brand"])))) blockers.push("xml_api_identity_mismatch");
    if (norm(String(xi.model ?? "")) !== norm(stock.model)) blockers.push("xml_api_model_mismatch");
  }
  const stockFingerprint = digest(stock ? {
    identity: { id: stock.id, physicalIdentityKey: stock.physicalIdentityKey ?? null, brand: norm(stock.brand), model: norm(stock.model), modelYear: stock.modelYear, manufactureYear: stock.manufactureYear, engine: norm(stock.engine), transmission: norm(stock.transmission), market: stock.market, seats: stock.seats },
    options: normalizedOptions(stock.options),
    ...(stock.xml ? { xml: stock.xml } : {}),
    // The approved overlay itself must not reopen its own review after application.
    evidence: equipmentEvidenceRegistry.filter((r) => matching(r.match as ReviewMatch, stock)).map(canonical).sort(),
    mapping: mapping(c),
  } : { missingVehicleId: c.identity.id });
  return { stockFingerprint, blockers };
}
export function emptyReviewLedger(): ReviewLedger { return { schemaVersion: 1, revisions: [], events: [] }; }
export function validateReviewLedger(value: unknown): ReviewLedger {
  const raw = exact(value, ["schemaVersion", "revisions", "events", "lastObservedAt", "lastObservationFingerprint"]);
  if (raw.schemaVersion !== 1 || !Array.isArray(raw.revisions) || !Array.isArray(raw.events) || raw.revisions.length > 10000 || raw.events.length > 50000) fail("invalid_ledger");
  const ledger = structuredClone(raw) as unknown as ReviewLedger;
  if (ledger.lastObservedAt !== undefined) {
    instant(ledger.lastObservedAt);
    if (!ledger.lastObservationFingerprint || !HASH.test(ledger.lastObservationFingerprint)) fail("invalid_observation_watermark");
  } else if (ledger.lastObservationFingerprint !== undefined) fail("invalid_observation_watermark");
  const keys = new Set<string>(); const active = new Set<string>();
  for (const r of ledger.revisions) {
    exact(r, ["key", "candidate", "stockFingerprint", "generation", "unitAbsentSince", "contextBlockers", "active", "status", "firstSeenAt", "lastSeenAt", "askedAt", "answeredAt", "decision", "supersededBy", "invalidatedAt", "invalidationReason", "application", "publication"]);
    const parsed = candidate(r.candidate);
    if (canonical(parsed) !== canonical(r.candidate) || !HASH.test(r.stockFingerprint) || !Number.isSafeInteger(r.generation) || r.generation < 0 || r.key !== revisionKey(parsed, r.stockFingerprint, r.generation) || keys.has(r.key) || !STATES.includes(r.status) || typeof r.active !== "boolean" || !Array.isArray(r.contextBlockers) || r.contextBlockers.some((b) => typeof b !== "string" || !/^[a-z_]+$/.test(b))) fail("invalid_revision");
    keys.add(r.key);
    const unitItem = `${r.candidate.identity.id}:${r.candidate.item.key}`;
    if (r.active && active.has(unitItem)) fail("duplicate_active_revision");
    if (r.active) active.add(unitItem);
    instant(r.firstSeenAt); instant(r.lastSeenAt);
    if (r.askedAt) instant(r.askedAt);
    if (r.answeredAt) instant(r.answeredAt);
    if (r.unitAbsentSince) instant(r.unitAbsentSince);
    if (r.invalidatedAt) { instant(r.invalidatedAt); str(r.invalidationReason); }
    else if (r.invalidationReason) fail("invalid_invalidation");
    if (r.application) {
      exact(r.application, ["proposalSha256", "beforeSha256", "afterSha256", "appliedAt"]);
      if (![r.application.proposalSha256, r.application.beforeSha256, r.application.afterSha256].every(h => HASH.test(h))) fail("invalid_application");
      instant(r.application.appliedAt);
    }
    if (r.publication) {
      exact(r.publication, ["commit", "publicUrl", "verifiedAt", "evidenceReference", "reversalReference"]);
      if (!/^[a-f0-9]{40}$/.test(r.publication.commit) || !r.application) fail("invalid_publication");
      publicVehicleUrl(r.publication.publicUrl, r.candidate.identity.id);
      instant(r.publication.verifiedAt); str(r.publication.evidenceReference, 2000); str(r.publication.reversalReference, 2000);
    }
    if (r.status === "published" && !r.publication) fail("missing_publication");
    if (r.supersededBy && !HASH.test(r.supersededBy)) fail("invalid_successor");
    if (r.status !== "pending") {
      if (!r.answeredAt || !r.decision) fail("missing_decision");
      validateDecision(r.decision);
      if (["confirmed", "authorized", "published"].includes(r.status) && (!r.decision.present || !r.decision.authorizePublication || !r.decision.marketConfirmed)) fail("incomplete_confirmation");
      if (["authorized", "published"].includes(r.status) && (!r.decision.confirmationReference || !r.decision.approvedText)) fail("missing_exact_approval");
      if (r.status === "presence_confirmed" && (!r.decision.present || r.decision.authorizePublication)) fail("invalid_presence_decision");
      if (["excluded", "rejected", "deferred"].includes(r.status) && r.decision.authorizePublication) fail("invalid_nonpublication_decision");
    } else if (r.decision || r.answeredAt) fail("pending_has_decision");
  }
  for (const e of ledger.events) {
    exact(e, ["key", "at", "type", "status", "note", "decision"]);
    if (!keys.has(e.key) || !["created", "asked", "answered", "superseded", "archived", "reactivated", "invalidated", "applied", "published", "reopened"].includes(e.type)) fail("invalid_history_event");
    instant(e.at);
    if (e.status !== undefined && !STATES.includes(e.status)) fail("invalid_history_status");
    if (e.note !== undefined) str(e.note, 2000);
    if (e.decision !== undefined) validateDecision(e.decision);
  }
  return ledger;
}
function observationFingerprint(snapshot: ReviewSnapshot): string {
  return digest(snapshot.vehicles.map((v) => ({ ...v, options: normalizedOptions(v.options) })).sort((a, b) => a.id.localeCompare(b.id)));
}
function assertCurrentObservation(ledger: ReviewLedger, snapshot: ReviewSnapshot, at: string): void {
  const observedAt = instant(snapshot.observedAt);
  if (observedAt > at) fail("future_stock_observation");
  if (ledger.lastObservedAt && observedAt < ledger.lastObservedAt) fail("outdated_stock_observation");
  if (observedAt === ledger.lastObservedAt && ledger.lastObservationFingerprint !== observationFingerprint(snapshot)) fail("conflicting_stock_observation");
}
/** Record a complete stock observation even when preparation produces no export. */
export function observeReviewStock(ledger: ReviewLedger, snapshot: ReviewSnapshot, now: string): ReviewLedger {
  const next = validateReviewLedger(ledger); validateSnapshot(snapshot); const at = instant(now);
  assertCurrentObservation(next, snapshot, at);
  next.lastObservedAt = instant(snapshot.observedAt);
  next.lastObservationFingerprint = observationFingerprint(snapshot);
  const ids = new Set(snapshot.vehicles.map((v) => v.id));
  for (const r of next.revisions) {
    if (!ids.has(r.candidate.identity.id) && !r.unitAbsentSince) {
      r.unitAbsentSince = at;
      r.invalidatedAt = at; r.invalidationReason = "unit_absent_from_complete_stock";
      next.events.push({ key: r.key, at, type: "archived", note: "unit_absent_from_complete_stock" });
    }
    if (ids.has(r.candidate.identity.id) && r.active && !r.invalidatedAt && context(r.candidate, snapshot).stockFingerprint !== r.stockFingerprint) {
      r.invalidatedAt = at; r.invalidationReason = "relevant_stock_or_rules_changed";
      next.events.push({ key: r.key, at, type: "invalidated", note: r.invalidationReason });
    }
  }
  return next;
}
export function syncReviewCandidates(ledger: ReviewLedger, input: ReviewInput, snapshot: ReviewSnapshot, now: string): ReviewLedger {
  const next = observeReviewStock(ledger, snapshot, now); const parsed = parseReviewInput(input); const at = instant(now);
  validateSnapshot(snapshot);
  const wanted = new Set<string>();
  for (const c of parsed.candidates) {
    const { stockFingerprint, blockers } = context(c, snapshot);
    const previous = next.revisions.filter((r) => r.candidate.identity.id === c.identity.id && r.candidate.item.key === c.item.key);
    const reusable = previous.find((r) => !r.supersededBy && !r.unitAbsentSince && !r.invalidatedAt && r.stockFingerprint === stockFingerprint && canonical(r.candidate) === canonical(c));
    const generation = reusable?.generation ?? Math.max(-1, ...previous.map((r) => r.generation)) + 1;
    const key = revisionKey(c, stockFingerprint, generation); wanted.add(key);
    for (const old of next.revisions.filter((r) => r.active && r.candidate.identity.id === c.identity.id && r.candidate.item.key === c.item.key && r.key !== key)) {
      old.active = false; old.supersededBy = key;
      old.invalidatedAt ??= at; old.invalidationReason ??= "candidate_evidence_or_rules_changed";
      next.events.push({ key: old.key, at, type: "superseded" });
    }
    const same = next.revisions.find((r) => r.key === key);
    if (same) {
      if (!same.active) next.events.push({ key, at, type: "reactivated" });
      same.active = true; same.lastSeenAt = at; delete same.supersededBy;
    } else {
      next.revisions.push({ key, candidate: c, stockFingerprint, generation, contextBlockers: blockers, active: true, status: "pending", firstSeenAt: at, lastSeenAt: at });
      next.events.push({ key, at, type: "created" });
    }
  }
  for (const old of next.revisions.filter((r) => r.active && !wanted.has(r.key))) {
    old.active = false; next.events.push({ key: old.key, at, type: "archived" });
  }
  return next;
}
function selection(ledger: ReviewLedger, selected: ReviewSelection): ReviewRevision {
  const r = ledger.revisions.find((v) => v.key === selected.key);
  if (!r?.active || r.invalidatedAt || r.unitAbsentSince || r.candidate.identity.id !== selected.vehicleId || r.candidate.item.key !== selected.itemKey) fail("stale_or_mismatched_selection");
  return r;
}
export function markReviewAsked(ledger: ReviewLedger, selected: ReviewSelection, now: string): ReviewLedger {
  const next = validateReviewLedger(ledger); const r = selection(next, selected); const at = instant(now);
  if (r.status !== "pending") fail("candidate_already_answered");
  if (!r.askedAt) { r.askedAt = at; next.events.push({ key: r.key, at, type: "asked" }); }
  return next;
}
function validateDecision(value: ReviewDecision): void {
  exact(value, ["note", "present", "authorizePublication", "marketConfirmed", "sourceIdentityConfirmed", "confirmationReference", "approvedText"]);
  str(value.note, 2000);
  if ([value.present, value.authorizePublication, value.marketConfirmed, value.sourceIdentityConfirmed].some(v => typeof v !== "boolean")) fail("invalid_decision");
  if (value.confirmationReference !== undefined) str(value.confirmationReference, 2000);
  if (value.approvedText) { exact(value.approvedText, ["name", "description"]); str(value.approvedText.name); str(value.approvedText.description, 2000); }
}
export function reviewLifecycle(r: ReviewRevision): "discovered" | "awaiting_confirmation" | "presence_confirmed" | "inclusion_authorized" | "do_not_include" | "published" | "invalidated" {
  if (r.invalidatedAt || r.unitAbsentSince || r.supersededBy) return "invalidated";
  if (r.status === "published") return "published";
  if (["confirmed", "authorized"].includes(r.status)) return "inclusion_authorized";
  if (["rejected", "excluded"].includes(r.status)) return "do_not_include";
  if (r.status === "presence_confirmed") return "presence_confirmed";
  return r.askedAt || r.status === "deferred" ? "awaiting_confirmation" : "discovered";
}
export function decideReviewCandidate(ledger: ReviewLedger, answer: ReviewAnswer, now: string): ReviewLedger {
  exact(answer, ["key", "vehicleId", "itemKey", "status", "note", "present", "authorizePublication", "marketConfirmed", "sourceIdentityConfirmed", "confirmationReference", "approvedText"]);
  for (const flag of [answer.present, answer.authorizePublication, answer.marketConfirmed, answer.sourceIdentityConfirmed]) if (flag !== undefined && typeof flag !== "boolean") fail("invalid_answer_boolean");
  const next = validateReviewLedger(ledger); const r = selection(next, answer); const at = instant(now);
  if (!["confirmed", "rejected", "deferred", "presence_confirmed", "authorized", "excluded"].includes(answer.status)) fail("invalid_answer_status");
  const decision: ReviewDecision = { note: str(answer.note, 2000), present: answer.present === true, authorizePublication: answer.authorizePublication === true, marketConfirmed: answer.marketConfirmed === true, sourceIdentityConfirmed: answer.sourceIdentityConfirmed === true,
    ...(answer.confirmationReference !== undefined ? { confirmationReference: str(answer.confirmationReference, 2000) } : {}),
    ...(answer.approvedText ? { approvedText: { name: str(answer.approvedText.name), description: str(answer.approvedText.description, 2000) } } : {}),
  };
  validateDecision(decision);
  if (["confirmed", "authorized"].includes(answer.status) && (!decision.present || !decision.authorizePublication || !decision.marketConfirmed)) fail("explicit_unit_presence_publication_market_required");
  if (answer.status === "authorized" && (!decision.confirmationReference || !decision.approvedText)) fail("exact_approval_reference_and_text_required");
  if (answer.status === "presence_confirmed" && (!decision.present || decision.authorizePublication)) fail("presence_confirmation_is_separate_from_publication");
  if (["rejected", "deferred", "excluded"].includes(answer.status) && decision.authorizePublication) fail("nonpublication_decision_cannot_authorize");
  if (["confirmed", "authorized"].includes(answer.status) && mapping(r.candidate) && !mappingMatches(r.candidate)) fail("item_mapping_mismatch");
  if (r.status === answer.status && canonical(r.decision) === canonical(decision)) return next;
  if (r.application || r.publication) fail("applied_item_requires_explicit_reversal_review");
  r.status = answer.status; r.answeredAt = at; r.decision = decision;
  next.events.push({ key: r.key, at, type: "answered", status: r.status, note: decision.note, decision: structuredClone(decision) });
  return next;
}
/** A batch is all-or-nothing and names every item; no generic approval expands scope. */
export function decideReviewCandidates(ledger: ReviewLedger, answers: ReviewAnswer[], now: string): ReviewLedger {
  if (!answers.length || answers.length > LIMIT || new Set(answers.map(a => a.key)).size !== answers.length) fail("invalid_answer_batch");
  return answers.reduce((next, answer) => decideReviewCandidate(next, answer, now), validateReviewLedger(ledger));
}
export function reopenReviewCandidate(ledger: ReviewLedger, selected: ReviewSelection, note: string, now: string): ReviewLedger {
  const next = validateReviewLedger(ledger); const previous = selection(next, selected); const at = instant(now); const reason = str(note, 2000);
  const generation = Math.max(...next.revisions.filter(r => r.candidate.identity.id === selected.vehicleId && r.candidate.item.key === selected.itemKey).map(r => r.generation)) + 1;
  const key = revisionKey(previous.candidate, previous.stockFingerprint, generation);
  previous.active = false; previous.supersededBy = key; previous.invalidatedAt = at; previous.invalidationReason = "owner_requested_review";
  next.revisions.push({ key, candidate: structuredClone(previous.candidate), stockFingerprint: previous.stockFingerprint, contextBlockers: [...previous.contextBlockers], generation, active: true, status: "pending", firstSeenAt: at, lastSeenAt: at });
  next.events.push({ key: previous.key, at, type: "reopened", note: reason }, { key, at, type: "created", note: reason });
  return next;
}
function decisionFingerprint(ledger: ReviewLedger): string {
  return digest(ledger.revisions.map(r => ({ key: r.key, active: r.active, status: r.status, decision: r.decision ?? null, answeredAt: r.answeredAt ?? null, invalidatedAt: r.invalidatedAt ?? null, unitAbsentSince: r.unitAbsentSince ?? null, application: r.application ?? null, publication: r.publication ?? null })));
}
export function reviewProposalDigest(proposal: ReviewProposal): string {
  const contents = { ...proposal } as Partial<ReviewProposal>;
  delete contents.proposalSha256;
  return digest(contents);
}

export function prepareReviewProposal(ledger: ReviewLedger, snapshot: ReviewSnapshot, confirmationDocumentText: string, now: string): ReviewProposal {
  const current = validateReviewLedger(ledger); const at = instant(now);
  validateSnapshot(snapshot);
  assertCurrentObservation(current, snapshot, at);
  if (Date.parse(at) - Date.parse(snapshot.observedAt) > 24 * 60 * 60 * 1000) fail("fresh_stock_observation_required");
  let doc: Record<string, unknown>;
  try { doc = object(JSON.parse(confirmationDocumentText)); } catch { return fail("invalid_confirmation_document"); }
  if (!Array.isArray(doc.records)) fail("invalid_confirmation_document");
  const output = structuredClone(doc) as Record<string, unknown> & { records: unknown[] };
  const proposal: ReviewProposal = { schemaVersion: 1, proposalOnly: true, generatedAt: at, snapshotObservedAt: instant(snapshot.observedAt), baseSha256: createHash("sha256").update(confirmationDocumentText).digest("hex"), decisionSha256: decisionFingerprint(current), proposalSha256: "", includedKeys: [], blocked: [], confirmationDocument: output,
    reviewBindings: [], limitations: ["Private proposal only; no runtime file is changed and this document does not publish equipment.", "Version 2 binds ID plus the supplied plate hash, manufacture year and Brazilian market attestation. A changed or missing plate blocks the overlay even when an ID is reused. Incorrect source data reusing both ID and plate cannot be distinguished without an additional trusted identifier."] };
  for (const r of current.revisions.filter((entry) => entry.active)) {
    const c = r.candidate; const ctx = context(c, snapshot); const definition = mapping(c);
    const physicalIdentityKey = snapshot.vehicles.find(v => v.id === c.identity.id)?.physicalIdentityKey;
    const reasons = ctx.blockers.filter((b) => b !== "xml_api_model_mismatch" || !r.decision?.sourceIdentityConfirmed);
    if (!physicalIdentityKey) reasons.push("physical_identity_key_required");
    if (c.identity.manufactureYear === undefined) reasons.push("manufacture_year_confirmation_required");
    if (r.invalidatedAt) reasons.push("revision_invalidated");
    if (r.unitAbsentSince) reasons.push("unit_reappearance_requires_new_review");
    if (!["confirmed", "authorized"].includes(r.status)) reasons.push(`decision_${r.status}`);
    if (ctx.stockFingerprint !== r.stockFingerprint) reasons.push("stale_snapshot");
    if (c.classification === "inference") reasons.push("inference_not_publishable");
    if (c.evidence.kind === "generic-manual") reasons.push("generic_manual_not_equipment_proof");
    if (!officialSource(c)) reasons.push("official_source_review_required");
    if (c.evidence.date > at.slice(0, 10)) reasons.push("future_evidence_date");
    if (!definition) reasons.push("taxonomy_review_required");
    else if (!mappingMatches(c)) reasons.push("item_mapping_mismatch");
    if (definition && r.decision?.approvedText && (r.decision.approvedText.name !== definition.description || r.decision.approvedText.description !== (definition.benefit ?? definition.description))) reasons.push("approved_text_does_not_match_definition");
    if (!r.decision?.present || !r.decision.authorizePublication || !r.decision.marketConfirmed) reasons.push("explicit_unit_presence_publication_market_required");
    if (!r.decision?.confirmationReference || !r.decision.approvedText) reasons.push("exact_approval_reference_and_text_required");
    const sameUnit = output.records.filter((entry) => {
      const record = object(entry); const m = record.match;
      return m && typeof m === "object" && (m as Record<string, unknown>).vehicleId === c.identity.id;
    });
    if (sameUnit.length > 1) reasons.push("duplicate_confirmation_records");
    const existing = sameUnit[0] as UnitEquipmentConfirmation | undefined;
    if (existing) {
      if (existing.schemaVersion !== 2) reasons.push("legacy_confirmation_physical_binding_review_required");
      if (!isApprovedUnitEquipmentConfirmation(existing)) reasons.push("invalid_existing_confirmation");
      if (!matching(c.identity, existing.match) || (existing.match.manufactureYear !== undefined && existing.match.manufactureYear !== c.identity.manufactureYear) || (existing.match.physicalIdentityKey !== undefined && existing.match.physicalIdentityKey !== physicalIdentityKey)) reasons.push("existing_confirmation_identity_mismatch");
      if (definition && existing.absentTags?.some((tag) => definitionForUnitEquipmentTag(existing, tag)?.id === definition.id)) reasons.push("existing_absence_conflict");
      if (definition && existing.presentTags?.some((tag) => definitionForUnitEquipmentTag(existing, tag)?.id === definition.id)) reasons.push("already_present_in_confirmation");
    }
    if (reasons.length) {
      proposal.blocked.push({ key: r.key, reasons: [...new Set(reasons)], ...(!definition ? { itemDraft: { key: c.item.key, label: c.item.label, proposedTag: null, status: "taxonomy_review_required" as const } } : {}) });
      continue;
    }
    const claim = `Responsável confirmou a presença de ${definition!.description} nesta unidade e autorizou sua publicação em ${r.answeredAt!.slice(0, 10)}; o mercado brasileiro da unidade foi confirmado. Fonte: ${c.evidence.url} (${c.evidence.date}, ${c.evidence.locator}). Texto aprovado: ${r.decision!.approvedText!.name}; ${r.decision!.approvedText!.description}.`;
    const reviewedDefinitions = [...(existing?.reviewedDefinitions ?? [])];
    if (c.item.reviewedDefinition && !reviewedDefinitions.some(d => d.id === c.item.reviewedDefinition!.id)) reviewedDefinitions.push(structuredClone(c.item.reviewedDefinition));
    const identityGate = { schemaVersion: 2 as const, marketSource: "responsible-confirmation" as const,
      match: { vehicleId: c.identity.id, physicalIdentityKey: physicalIdentityKey!, brand: c.identity.brand, model: c.identity.model, modelYear: c.identity.modelYear, manufactureYear: c.identity.manufactureYear!, engine: c.identity.engine, transmission: c.identity.transmission, market: "BR" as const },
      ...(reviewedDefinitions.length ? { reviewedDefinitions } : {}),
    };
    const merged: UnitEquipmentConfirmation = existing ? {
      ...existing, ...identityGate,
      presentTags: [...new Set([...existing.presentTags, definition!.tag])],
      absentTags: [...existing.absentTags],
      claim: `${existing.claim}\n${claim}`,
      confirmedAt: r.answeredAt!.slice(0, 10) > existing.confirmedAt ? r.answeredAt!.slice(0, 10) : existing.confirmedAt,
    } : {
      id: `equipment-review-unit-${c.identity.id}-${at.slice(0, 10)}`,
      approved: true, source: "responsible-confirmation", confirmedAt: r.answeredAt!.slice(0, 10), claim,
      ...identityGate,
      presentTags: [definition!.tag], absentTags: [],
    };
    if (!isApprovedUnitEquipmentConfirmation(merged)) fail("invalid_proposed_confirmation");
    if (existing) output.records[output.records.indexOf(existing)] = merged;
    else output.records.push(merged);
    proposal.includedKeys.push(r.key);
    proposal.reviewBindings.push({ key: r.key, identity: structuredClone(c.identity), stockFingerprint: r.stockFingerprint, sourceIdentityConfirmed: r.decision!.sourceIdentityConfirmed });
  }
  proposal.proposalSha256 = reviewProposalDigest(proposal);
  return proposal;
}

function publicVehicleUrl(value: string, vehicleId: string): string {
  let url: URL;
  try { url = new URL(value); } catch { return fail("invalid_public_verification_url"); }
  if (url.protocol !== "https:" || url.hostname !== "www.netcarmultimarcas.com.br" || url.username || url.password || url.port || url.search || url.hash || url.pathname !== `/veiculo/${vehicleId}`) fail("invalid_public_verification_url");
  return url.href;
}
/** Validate a reviewed proposal against a fresh stock and the exact current base. */
export function applyReviewProposal(ledger: ReviewLedger, snapshot: ReviewSnapshot, baseText: string, proposal: ReviewProposal, expectedProposalSha256: string, now: string): { ledger: ReviewLedger; documentText: string; beforeSha256: string; afterSha256: string; alreadyApplied?: boolean } {
  if (!HASH.test(expectedProposalSha256) || expectedProposalSha256 !== proposal.proposalSha256 || reviewProposalDigest(proposal) !== expectedProposalSha256) fail("proposal_hash_mismatch");
  if (Date.parse(instant(now)) - Date.parse(instant(snapshot.observedAt)) > 15 * 60 * 1000) fail("fresh_stock_observation_required");
  const baseSha256 = createHash("sha256").update(baseText).digest("hex");
  const next = observeReviewStock(ledger, snapshot, now);
  if (baseSha256 !== proposal.baseSha256) {
    const applied = proposal.includedKeys.length > 0 && proposal.includedKeys.every(key => {
      const r = next.revisions.find(entry => entry.key === key);
      return r?.active && !r.invalidatedAt && r.application?.proposalSha256 === expectedProposalSha256 && r.application.afterSha256 === baseSha256;
    });
    if (applied) return { ledger: next, documentText: baseText, beforeSha256: baseSha256, afterSha256: baseSha256, alreadyApplied: true };
    fail("confirmation_base_changed");
  }
  if (decisionFingerprint(next) !== proposal.decisionSha256) fail("review_decisions_changed");
  const rebuilt = prepareReviewProposal(next, snapshot, baseText, now);
  if (!proposal.includedKeys.length || canonical(rebuilt.includedKeys) !== canonical(proposal.includedKeys) || canonical(rebuilt.confirmationDocument) !== canonical(proposal.confirmationDocument) || canonical(rebuilt.reviewBindings) !== canonical(proposal.reviewBindings)) fail("proposal_no_longer_applicable");
  for (const key of proposal.includedKeys) {
    const r = next.revisions.find(entry => entry.key === key)!;
    if (!r.decision?.confirmationReference || !r.decision.approvedText) fail("exact_approval_reference_and_text_required_for_apply");
  }
  const documentText = JSON.stringify(proposal.confirmationDocument, null, 2) + "\n";
  const afterSha256 = createHash("sha256").update(documentText).digest("hex");
  for (const key of proposal.includedKeys) {
    const r = next.revisions.find(entry => entry.key === key)!;
    r.application = { proposalSha256: proposal.proposalSha256, beforeSha256: proposal.baseSha256, afterSha256, appliedAt: instant(now) };
    next.events.push({ key, at: instant(now), type: "applied", note: `proposal:${proposal.proposalSha256}` });
  }
  return { ledger: next, documentText, beforeSha256: proposal.baseSha256, afterSha256 };
}
export function recordReviewPublication(ledger: ReviewLedger, selected: ReviewSelection, proof: NonNullable<ReviewRevision["publication"]>): ReviewLedger {
  const next = validateReviewLedger(ledger); const r = selection(next, selected);
  if (!r.application || !r.decision?.authorizePublication) fail("item_not_applied");
  if (!/^[a-f0-9]{40}$/.test(proof.commit)) fail("invalid_publication_commit");
  const publication = { commit: proof.commit, publicUrl: publicVehicleUrl(proof.publicUrl, selected.vehicleId), verifiedAt: instant(proof.verifiedAt), evidenceReference: str(proof.evidenceReference, 2000), reversalReference: str(proof.reversalReference, 2000) };
  if (publication.verifiedAt < r.application.appliedAt) fail("verification_precedes_application");
  if (r.status === "published" && canonical(r.publication) === canonical(publication)) return next;
  r.publication = publication; r.status = "published";
  next.events.push({ key: r.key, at: publication.verifiedAt, type: "published", note: `${publication.commit}; ${publication.evidenceReference}; reversal: ${publication.reversalReference}` });
  return validateReviewLedger(next);
}
