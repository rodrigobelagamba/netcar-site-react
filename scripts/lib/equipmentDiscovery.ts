import { createHash } from "node:crypto";
import { fetchEquipmentStock, configureEquipmentAuditNetwork } from "../audit-vehicle-equipment";
import { normalizeEquipmentTag, resolveVehicleEquipment } from "../../src/lib/vehicleEquipment";
import { parseReviewInput, snapshotFromStock, type ReviewInput, type ReviewLedger, type ReviewSnapshot, type ReviewStockVehicle } from "./equipmentReview";

export const EQUIPMENT_XML_URL = "https://www.netcarmultimarcas.com.br/automacar/xml.xml";
const MAX_BYTES = 10 * 1024 * 1024;
const fail = (code: string): never => { throw new Error(`Equipment discovery: ${code}`); };
interface XmlNode { name: string; text: string; children: XmlNode[] }
const decode = (text: string): string => text.replace(/&([^;\s]+);/g, (_, entity: string) => {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  if (named[entity]) return named[entity];
  if (/^#(?:[0-9]+|x[0-9a-fA-F]+)$/.test(entity)) {
    const n = entity[1] === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    if (n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff)) return String.fromCodePoint(n);
  }
  return fail("unsupported_xml_entity");
});

/** Restricted parser for the existing feed. No DTD, entities, external fetches,
 * processing instructions, recovery from malformed XML or arbitrary code. */
function xmlTree(xml: string): XmlNode {
  if (Buffer.byteLength(xml) > MAX_BYTES || /<!DOCTYPE|<!ENTITY/i.test(xml)) fail("unsafe_xml");
  const root: XmlNode = { name: "document", text: "", children: [] };
  const stack = [root]; let count = 0; let offset = 0;
  const tokens = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?xml\s[^?]*\?>|<[^>]*>|[^<]+/g;
  for (const token of xml.matchAll(tokens)) {
    if (token.index !== offset) fail("malformed_xml");
    const value = token[0]; offset += value.length;
    if (value.startsWith("<!--")) { if (!/^<!--[\s\S]*-->$/.test(value) || value.slice(4,-3).includes("--")) fail("malformed_xml"); continue; }
    if (value.startsWith("<?xml")) { if (!/^<\?xml\s[^?]*\?>$/.test(value) || root.children.length || stack.length !== 1) fail("malformed_xml"); continue; }
    if (value.startsWith("<![CDATA[")) { stack.at(-1)!.text += value.slice(9, -3); continue; }
    if (!value.startsWith("<")) {
      if (/&(?![a-zA-Z]+;|#[0-9]+;|#x[0-9a-fA-F]+;)/.test(value)) fail("malformed_xml_entity");
      stack.at(-1)!.text += decode(value); continue;
    }
    const close = /^<\/([A-Za-z_][\w:.-]*)\s*>$/.exec(value);
    if (close) { if (stack.length < 2 || stack.pop()!.name !== close[1]) fail("malformed_xml"); continue; }
    const open = /^<([A-Za-z_][\w:.-]*)(?:\s+[A-Za-z_][\w:.-]*\s*=\s*(?:"[^"]*"|'[^']*'))*\s*(\/?)>$/.exec(value);
    if (!open || ++count > 200000 || stack.length > 8) fail("malformed_xml");
    const node: XmlNode = { name: open[1], text: "", children: [] };
    stack.at(-1)!.children.push(node); if (!open[2]) stack.push(node);
  }
  if (offset !== xml.length || stack.length !== 1 || root.children.length !== 1 || root.text.trim()) fail("malformed_xml");
  return root.children[0];
}

export function parseEquipmentXml(xml: string) {
  const root = xmlTree(xml);
  if (root.name !== "dataroot" || root.text.trim() || !root.children.length || root.children.length > 500 || root.children.some(v => v.name !== "veiculo" || v.text.trim())) fail("incomplete_xml");
  const seen = new Set<string>();
  return root.children.map(row => {
    const fields = new Map<string, XmlNode>();
    for (const n of row.children) { if (fields.has(n.name)) fail("duplicate_xml_field"); fields.set(n.name, n); }
    const value = (name: string) => {
      const node = fields.get(name);
      if (node?.children.length || (node?.text.length ?? 0) > 400) fail("invalid_xml_identity");
      return node?.text.trim().replace(/\s+/g, " ") ?? "";
    };
    const number = (name: string) => { const n = value(name); if (!n) return null; if (!/^\d{4}$/.test(n)) fail("invalid_xml_year"); return Number(n); };
    const id = value("codigo_anuncio_revenda");
    if (!/^\d{1,20}$/.test(id) || seen.has(id)) fail("duplicate_or_missing_xml_id"); seen.add(id);
    const options = fields.get("opcionais"); if (!options || !options.children.length || options.children.length > 300 || options.text.trim()) fail("invalid_xml_options");
    const flags: Record<string, boolean> = Object.create(null);
    for (const child of options.children) {
      if (child.children.length || !/^[a-zA-Z][a-zA-Z0-9_-]{0,99}$/.test(child.name) || ["constructor", "prototype"].includes(child.name) || !/^[01]$/.test(child.text.trim()) || Object.hasOwn(flags, child.name)) fail("invalid_xml_flag");
      flags[child.name] = child.text.trim() === "1";
    }
    const price = value("preco"); if (!/^\d+(?:[.,]\d+)?$/.test(price)) fail("invalid_xml_price");
    // Deliberate allowlist: plates, VINs, contacts and descriptions never leave this adapter.
    return { id, active: Number(price.replace(",", ".")) > 0, identity: { id, brand: value("marca"), model: value("modelo"), manufactureYear: number("ano_fabricacao"), modelYear: number("ano_modelo"), engine: value("motor"), transmission: value("cambio") }, flags };
  });
}

async function fetchXml(fetcher: typeof fetch): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetcher(EQUIPMENT_XML_URL, { redirect: "error", signal: AbortSignal.timeout(20000), headers: { Accept: "application/xml,text/xml", "Cache-Control": "no-cache" } });
      if (!response.ok || !response.body || Number(response.headers.get("content-length")) > MAX_BYTES) fail("xml_http_failure");
      const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
      try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > MAX_BYTES) fail("xml_size_limit"); chunks.push(value); } }
      finally { await reader.cancel(); }
      return Buffer.concat(chunks).toString("utf8");
    } catch { if (attempt === 2) fail("xml_fetch_failed_previous_state_preserved"); }
  }
  return fail("xml_fetch_failed");
}

/** Called by the existing review command; no extra scheduler or importer. */
export async function fetchReviewDiscoverySnapshot(fetcher: typeof fetch = fetch): Promise<ReviewSnapshot> {
  configureEquipmentAuditNetwork();
  const [stock, xmlText] = await Promise.all([fetchEquipmentStock(fetcher), fetchXml(fetcher)]);
  const snapshot = snapshotFromStock(stock, new Date().toISOString());
  const xml = parseEquipmentXml(xmlText);
  const apiIds = snapshot.vehicles.map(v => v.id).sort();
  if (JSON.stringify(apiIds) !== JSON.stringify(xml.filter(v => v.active).map(v => v.id).sort())) fail("xml_api_active_ids_differ");
  for (const vehicle of snapshot.vehicles) { const source = xml.find(v => v.id === vehicle.id)!; vehicle.xml = { identity: source.identity, flags: source.flags }; }
  return snapshot;
}

/** Documentation is reusable only for the exact BR version/MY/powertrain.
 * Each generated candidate starts a separate unit review; no decision is copied. */
export function expandExactResearchCandidates(input: ReviewInput, snapshot: ReviewSnapshot): ReviewInput {
  const templates = parseReviewInput(input).candidates;
  const candidates: ReviewInput["candidates"] = [];
  const seen = new Set<string>();
  for (const vehicle of snapshot.vehicles) {
    if (vehicle.modelYear === null || vehicle.manufactureYear === null || (vehicle.market !== null && vehicle.market !== "BR")) continue;
    for (const template of templates) {
      const match = template.evidence.match;
      if (match.market !== "BR" || match.modelYear !== vehicle.modelYear || !["brand", "model", "engine", "transmission"].every(k => normalizeEquipmentTag(match[k as "brand"]) === normalizeEquipmentTag(vehicle[k as "brand"]))) continue;
      // A documentary identity mismatch is never converted into a rule.
      if (match.modelYear !== template.identity.modelYear || !["brand", "model", "engine", "transmission", "market"].every(k => normalizeEquipmentTag(match[k as "brand"]) === normalizeEquipmentTag(template.identity[k as "brand"]))) continue;
      const key = `${vehicle.id}:${template.item.key}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ ...structuredClone(template), identity: { id: vehicle.id, brand: vehicle.brand, model: vehicle.model, manufactureYear: vehicle.manufactureYear, modelYear: vehicle.modelYear, engine: vehicle.engine, transmission: vehicle.transmission, market: "BR" } });
    }
  }
  return parseReviewInput({ schemaVersion: 1, candidates });
}

export interface PublicEquipmentObservation {
  vehicleId: string; url: string; observedAt: string; method: "rendered-dom";
  expanded: true; descriptions: string[]; evidencePath: string; stockFingerprint: string;
}
const normalized = normalizeEquipmentTag;
const canonical = (label: string) => resolveVehicleEquipment({ opcionais: [{ descricao: label }] }, [], []).items[0]?.id ?? `text-${normalized(label)}`;
const isPresent = (values: string[], key: string, label: string) => values.some(v => canonical(v) === key || normalized(v) === normalized(label));

export function discoveryVehicleFingerprint(vehicle: ReviewStockVehicle): string {
  const fields = [vehicle.id, vehicle.physicalIdentityKey ?? "", vehicle.brand, vehicle.model, vehicle.manufactureYear, vehicle.modelYear, vehicle.engine, vehicle.transmission].map(v => normalized(String(v ?? "")));
  const options = [...new Set(vehicle.options.map(v => JSON.stringify([normalized(v.tag), normalized(v.descricao)])))].sort();
  return createHash("sha256").update(JSON.stringify([fields, options])).digest("hex");
}
export interface EquipmentResearchProgress {
  vehicleId: string; stockFingerprint: string; reviewedAt: string;
  status: "source-found" | "no-compatible-source" | "ambiguous";
  note: string; sourceUrls: string[];
}
export function createDiscoveryReport(snapshot: ReviewSnapshot, input: ReviewInput, ledger?: ReviewLedger, observations: PublicEquipmentObservation[] = [], progress: EquipmentResearchProgress[] = []) {
  if (new Set(observations.map(o => o.vehicleId)).size !== observations.length) fail("duplicate_public_observation");
  for (const p of progress) {
    if (!/^\d+$/.test(p.vehicleId) || !/^[a-f0-9]{64}$/.test(p.stockFingerprint) || !["source-found", "no-compatible-source", "ambiguous"].includes(p.status) || !Number.isFinite(Date.parse(p.reviewedAt)) || Date.parse(p.reviewedAt) > Date.now() + 60000 || typeof p.note !== "string" || !p.note.trim() || p.note.length > 2000 || !Array.isArray(p.sourceUrls) || p.sourceUrls.some(url => { try { const u = new URL(url); return u.protocol !== "https:" || !!u.username || !!u.password; } catch { return true; } })) fail("invalid_research_progress");
  }
  for (const observation of observations) {
    if (!/^[0-9]{1,20}$/.test(observation.vehicleId) || observation.method !== "rendered-dom" || observation.expanded !== true || observation.url !== `https://www.netcarmultimarcas.com.br/veiculo/${observation.vehicleId}` || !Number.isFinite(Date.parse(observation.observedAt)) || !observation.evidencePath || !/^[a-f0-9]{64}$/.test(observation.stockFingerprint) || !Array.isArray(observation.descriptions) || observation.descriptions.some(v => typeof v !== "string" || !v.trim() || v.length > 400)) fail("invalid_public_observation");
  }
  const vehicles = snapshot.vehicles.map(vehicle => {
    const candidates = input.candidates.filter(c => c.identity.id === vehicle.id);
    const observation = observations.find(o => o.vehicleId === vehicle.id);
    // Observations from a prior day must be refreshed before calling something missing.
    const fingerprint = discoveryVehicleFingerprint(vehicle);
    const publicObservation = observation && observation.stockFingerprint === fingerprint && Math.abs(Date.parse(snapshot.observedAt) - Date.parse(observation.observedAt)) <= 86400000 ? observation : undefined;
    const xmlDescriptions = Object.entries(vehicle.xml?.flags ?? {}).filter(([,value]) => value).map(([tag]) => resolveVehicleEquipment({ opcionais: [tag] }, [], []).items[0]?.description ?? tag);
    const apiDescriptions = vehicle.options.map(v => v.descricao || v.tag);
    const revision = ledger?.revisions.filter(r => r.active && r.candidate.identity.id === vehicle.id);
    const hasHistory = ledger?.revisions.some(r => r.candidate.identity.id === vehicle.id);
    const researchHistory = progress.filter(p => p.vehicleId === vehicle.id).sort((a, b) => Date.parse(b.reviewedAt) - Date.parse(a.reviewedAt));
    const lastResearch = researchHistory.find(p => p.stockFingerprint === fingerprint);
    const details = candidates.map(c => {
      const identityCompatible = c.identity.modelYear === vehicle.modelYear && c.identity.manufactureYear === vehicle.manufactureYear && ["brand", "model", "engine", "transmission"].every(k => normalized(c.identity[k as "brand"]) === normalized(vehicle[k as "brand"])) && (vehicle.market === null || vehicle.market === c.identity.market);
      const sourceCompatible = c.evidence.match.modelYear === c.identity.modelYear && ["brand", "model", "engine", "transmission", "market"].every(k => normalized(c.evidence.match[k as "brand"]) === normalized(c.identity[k as "brand"]));
      const known = resolveVehicleEquipment({ opcionais: [{ descricao: c.item.label, tag: c.item.tag }] }, [], []).items[0];
      const inXml = vehicle.xml ? isPresent(xmlDescriptions, c.item.key, c.item.label) : null;
      const inApi = isPresent(apiDescriptions, c.item.key, c.item.label);
      const inPublic = publicObservation ? isPresent(publicObservation.descriptions, c.item.key, c.item.label) : null;
      const proposed = c.item.reviewedDefinition ?? known;
      return { itemKey: c.item.key, label: c.item.label, classification: c.classification, identityCompatible, sourceCompatible, inXml, inApi, inPublic,
        suggestedSiteText: { name: proposed?.description ?? c.item.label, description: proposed?.benefit ?? proposed?.description ?? c.item.label },
        comparison: !identityCompatible || !sourceCompatible ? "identity_mismatch_review_required" : inPublic ? "already_displayed_or_synonym" : inXml && inPublic === false ? "xml_missing_from_public_review_suppression" : !known || known.id.startsWith("other-") ? "new_taxonomy_candidate" : "documented_candidate",
        source: c.evidence, publicEvidence: publicObservation ?? null,
        missingConfirmation: ["Confirmar presença e configuração nesta unidade", "Autorizar separadamente o texto para exibição", ...(c.classification === "package" ? ["Conferir pacote opcional desta unidade"] : []), ...(vehicle.market === null ? ["Confirmar mercado brasileiro da unidade"] : [])] };
    });
    const compatible = candidates.some((c,i) => details[i].identityCompatible && details[i].sourceCompatible && c.classification !== "inference" && c.evidence.kind === "exact-equipment");
    return { id: vehicle.id, stockFingerprint: fingerprint, url: `https://www.netcarmultimarcas.com.br/veiculo/${vehicle.id}`, identity: { brand: vehicle.brand, model: vehicle.model, manufactureYear: vehicle.manufactureYear, modelYear: vehicle.modelYear, engine: vehicle.engine, transmission: vehicle.transmission, market: vehicle.market }, priority: !lastResearch && researchHistory.length ? "changed" : !hasHistory && !lastResearch ? "new" : revision?.some(r => r.generation > 0) && !lastResearch ? "changed" : "continuing", lastResearch: lastResearch ?? null, sourceStatus: lastResearch?.status === "ambiguous" ? "ambiguous" : compatible ? "research_candidates_recorded" : candidates.length ? "ambiguous" : lastResearch?.status ?? "not_researched", publicStatus: publicObservation ? "rendered_observed" : "not_verified", candidates: details };
  }).sort((a, b) => (a.priority === "changed" ? -1 : a.priority === "new" ? 0 : 1) - (b.priority === "changed" ? -1 : b.priority === "new" ? 0 : 1) || (a.lastResearch && b.lastResearch ? Date.parse(a.lastResearch.reviewedAt) - Date.parse(b.lastResearch.reviewedAt) : 0) || (b.identity.modelYear ?? 0) - (a.identity.modelYear ?? 0) || Number(b.id) - Number(a.id));
  return { schemaVersion: 1, observedAt: snapshot.observedAt, snapshotSha256: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"), counts: { inventoryCompared: vehicles.length, withResearchCandidates: vehicles.filter(v => v.candidates.some(c => c.identityCompatible && c.sourceCompatible)).length, withCompatibleEvidence: vehicles.filter(v => ["research_candidates_recorded", "source-found"].includes(v.sourceStatus)).length, researchedWithoutCompatibleSource: vehicles.filter(v => v.sourceStatus === "no-compatible-source").length, ambiguous: vehicles.filter(v => v.sourceStatus === "ambiguous").length, notResearched: vehicles.filter(v => v.sourceStatus === "not_researched").length, publicRendered: vehicles.filter(v => v.publicStatus === "rendered_observed").length, candidates: vehicles.reduce((sum, v) => sum + v.candidates.length, 0) }, researchHistory: progress, limits: ["Inventário comparado não significa pesquisa documental completa.", "Ausência de fonte registrada não prova inexistência de documentação.", "Ficha pública só é afirmada quando há observação renderizada completa, datada e vinculada ao mesmo cadastro.", "Novas confirmações vinculam ID e hash da placa fornecida; placa ausente ou diferente bloqueia a aplicação. Um cadastro incorreto que reutilize simultaneamente ID e placa ainda exige revisão do responsável."], vehicles };
}
