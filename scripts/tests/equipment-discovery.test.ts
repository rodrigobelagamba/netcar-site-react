import assert from "node:assert/strict";
import test from "node:test";
import { parseEquipmentXml, createDiscoveryReport, fetchReviewDiscoverySnapshot, EQUIPMENT_XML_URL, discoveryVehicleFingerprint, expandExactResearchCandidates } from "../lib/equipmentDiscovery";
import type { ReviewInput, ReviewSnapshot } from "../lib/equipmentReview";

const row = `<veiculo><codigo_anuncio_revenda>99</codigo_anuncio_revenda><marca>JEEP</marca><modelo>RENEGADE LONGITUDE</modelo><ano_fabricacao>2023</ano_fabricacao><ano_modelo>2024</ano_modelo><motor>1.3</motor><cambio>AUTOMATICO</cambio><preco>100000</preco><placa>PRIVATE</placa><chassis>PRIVATE</chassis><contato>PRIVATE</contato><opcionais><sensor_de_chuva>1</sensor_de_chuva><camera_de_re>0</camera_de_re></opcionais></veiculo>`;
const xml = `<?xml version="1.0"?><dataroot>${row}</dataroot>`;
const snapshot: ReviewSnapshot = { schemaVersion: 1, observedAt: "2026-10-09T17:00:00Z", vehicles: [{ id: "99", brand: "JEEP", model: "RENEGADE LONGITUDE", manufactureYear: 2023, modelYear: 2024, engine: "1.3", transmission: "AUTOMATICO", market: null, seats: "", options: [], xml: { identity: parseEquipmentXml(xml)[0].identity, flags: parseEquipmentXml(xml)[0].flags } }] };
const input: ReviewInput = { schemaVersion: 1, candidates: [{ identity: { id: "99", brand: "JEEP", model: "RENEGADE LONGITUDE", manufactureYear: 2023, modelYear: 2024, engine: "1.3", transmission: "AUTOMATICO", market: "BR" }, item: { key: "rain-sensor", label: "Sensor de chuva", tag: "sensor_de_chuva" }, classification: "package", evidence: { url: "https://www.jeep.com.br/fixture", title: "Fixture", date: "2023-01-01", locator: "page 1", claim: "Optional package", match: { brand: "JEEP", model: "RENEGADE LONGITUDE", modelYear: 2024, engine: "1.3", transmission: "AUTOMATICO", market: "BR" }, kind: "exact-equipment" } }] };

test("XML allowlist preserves flags and identity without administrative fields", () => {
  const result = parseEquipmentXml(xml);
  assert.equal(result[0].flags.sensor_de_chuva, true);
  assert.equal(result[0].flags.camera_de_re, false);
  assert.equal(result[0].identity.manufactureYear, 2023);
  assert.ok(!JSON.stringify(result).includes("PRIVATE"));
});

test("malformed XML, DTD, unknown entities, duplicate rows, incomplete options fail closed", () => {
  for (const value of [xml.slice(0,-5), '<?xml invalid>'+xml.slice(xml.indexOf('<dataroot>')), '<!-- never closed >'+xml.slice(xml.indexOf('<dataroot>')), xml.replace('<dataroot>', '<dataroot>bad'), xml.replace('<opcionais>', '<opcionais><__proto__>1</__proto__><__proto__>0</__proto__>'), xml.replace("</opcionais>", "</other>"), `<!DOCTYPE x>${xml}`, xml.replace("JEEP", "&unknown;"), `<dataroot>${row}${row}</dataroot>`, xml.replace("<sensor_de_chuva>1</sensor_de_chuva>", "<sensor_de_chuva>maybe</sensor_de_chuva>"), xml.replace("<preco>100000</preco>", "<preco>bad</preco>")]) assert.throws(() => parseEquipmentXml(value));
});

test("three layers distinguish unknown public data, missing presentation, and synonym", () => {
  const noDom = createDiscoveryReport(snapshot, input);
  assert.equal(noDom.vehicles[0].candidates[0].inPublic, null);
  assert.equal(noDom.vehicles[0].publicStatus, "not_verified");
  const observed = { stockFingerprint: discoveryVehicleFingerprint(snapshot.vehicles[0]), vehicleId: "99", url: "https://www.netcarmultimarcas.com.br/veiculo/99", observedAt: "2026-10-09T17:01:00Z", method: "rendered-dom" as const, expanded: true as const, descriptions: ["Sensor de chuva"], evidencePath: "/private/evidence.json" };
  assert.equal(createDiscoveryReport(snapshot, input, undefined, [observed]).vehicles[0].candidates[0].comparison, "already_displayed_or_synonym");
  assert.equal(createDiscoveryReport(snapshot, input, undefined, [{ ...observed, descriptions: [] }]).vehicles[0].candidates[0].comparison, "xml_missing_from_public_review_suppression");
  assert.equal(createDiscoveryReport(snapshot, input, undefined, [{ ...observed, observedAt: "2026-10-01T17:00:00Z" }]).vehicles[0].candidates[0].inPublic, null);
});

test("equipment outside known taxonomy remains a researched candidate, never presence", () => {
  const unknown = structuredClone(input); unknown.candidates[0].item = { key: "synthetic-v2l-power", label: "Saída externa sintética de energia" };
  const report = createDiscoveryReport(snapshot, unknown);
  assert.equal(report.vehicles[0].candidates[0].comparison, "new_taxonomy_candidate");
  assert.equal(report.vehicles[0].candidates[0].inXml, false);
  assert.equal(report.vehicles[0].candidates[0].classification, "package");
  assert.equal(report.vehicles[0].identity.market, null);
  assert.equal(report.counts.withResearchCandidates, 1);
});

test("existing API fetch and XML merge reject incomplete or mismatched active stock", async () => {
  const api = { success: true, total_results: 1, data: [{ id: 99, marca: "JEEP", modelo: "RENEGADE LONGITUDE", ano: 2024, ano_fabricacao: 2023, motor: "1.3", cambio: "AUTOMATICO", valor: 100000, opcionais: [] }] };
  const fetcher = (async (url: unknown) => new Response(String(url) === EQUIPMENT_XML_URL ? xml : JSON.stringify(api), {status: 200})) as typeof fetch;
  const result = await fetchReviewDiscoverySnapshot(fetcher);
  assert.equal(result.vehicles[0].xml?.flags.sensor_de_chuva, true);
  const wrong = (async (url: unknown) => new Response(String(url) === EQUIPMENT_XML_URL ? xml.replace("revenda>99", "revenda>98") : JSON.stringify(api), {status: 200})) as typeof fetch;
  await assert.rejects(fetchReviewDiscoverySnapshot(wrong), /active_ids_differ/);
});

 test("changed identity invalidates old research and public observation", () => {
  const changed = structuredClone(snapshot); changed.vehicles[0].modelYear = 2025;
  const observation = { stockFingerprint: discoveryVehicleFingerprint(snapshot.vehicles[0]), vehicleId: "99", url: "https://www.netcarmultimarcas.com.br/veiculo/99", observedAt: "2026-10-09T17:00:00Z", method: "rendered-dom" as const, expanded: true as const, descriptions: ["Sensor de chuva"], evidencePath: "/private/evidence.json" };
  const report = createDiscoveryReport(changed, input, undefined, [observation]);
  assert.equal(report.vehicles[0].candidates[0].comparison, "identity_mismatch_review_required");
  assert.equal(report.vehicles[0].candidates[0].inPublic, null);
  assert.equal(report.counts.withResearchCandidates, 0);
 });

test("exact library discovery creates independent unit candidates without crossing years", () => {
  const stock = structuredClone(snapshot); stock.vehicles.push({...stock.vehicles[0], id: "100"}); stock.vehicles.push({...stock.vehicles[0], id: "101", modelYear: 2025});
  const expanded = expandExactResearchCandidates(input, stock);
  assert.deepEqual(expanded.candidates.map(c => c.identity.id), ["99", "100"]);
  assert.equal(expanded.candidates[1].classification, "package");
  assert.ok(!("decision" in expanded.candidates[1]));
});

test("an ID with a different physical binding cannot reuse an old public DOM observation", () => {
  const original = structuredClone(snapshot);
  original.vehicles[0].physicalIdentityKey = "a".repeat(64);
  const current = structuredClone(original);
  current.vehicles[0].physicalIdentityKey = "b".repeat(64);
  const observation = { stockFingerprint: discoveryVehicleFingerprint(original.vehicles[0]), vehicleId: "99", url: "https://www.netcarmultimarcas.com.br/veiculo/99", observedAt: snapshot.observedAt, method: "rendered-dom" as const, expanded: true as const, descriptions: ["Sensor de chuva"], evidencePath: "/private/synthetic-dom.json" };
  const report = createDiscoveryReport(current, input, undefined, [observation]);
  assert.equal(report.vehicles[0].candidates[0].inPublic, null);
  assert.equal(report.counts.publicRendered, 0);
  assert.equal(report.vehicles[0].publicStatus, "not_verified");
});


test("a sold unit's retained public observation never blocks the active daily inventory", () => {
  const historical = { stockFingerprint: "a".repeat(64), vehicleId: "100", url: "https://www.netcarmultimarcas.com.br/veiculo/100", observedAt: snapshot.observedAt, method: "rendered-dom" as const, expanded: true as const, descriptions: ["Sensor de chuva"], evidencePath: "/private/historical-synthetic-dom.json" };
  const report = createDiscoveryReport(snapshot, input, undefined, [historical]);
  assert.equal(report.counts.inventoryCompared, 1);
  assert.equal(report.counts.publicRendered, 0);
  assert.equal(report.vehicles[0].id, "99");
  assert.equal(report.vehicles[0].candidates[0].inPublic, null);
});
