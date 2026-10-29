import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { buildCarclickWarrantyManifest } from "../generate-carclick-warranty";
import {
  factoryWarrantyReviewFingerprint,
  factoryTractionBatteryReviewFingerprint,
  type FactoryWarrantyMatrix,
  type FactoryWarrantyRecord,
} from "../../src/lib/factoryWarranty";

const authority = JSON.parse(readFileSync(new URL("../../src/data/factoryWarrantyMatrix.json", import.meta.url), "utf8")) as FactoryWarrantyMatrix;
const unitKey = `plate-sha256:${createHash("sha256").update("ABC1234").digest("hex")}`;
function fixture(id = "20038") {
  const record = structuredClone(authority.records.find((entry) => entry.vehicle.vehicleId === id)!) as FactoryWarrantyRecord;
  record.vehicle.vehicleId = "999000";
  record.unitBinding!.unitKey = unitKey;
  record.approvedFingerprint = factoryWarrantyReviewFingerprint(record);
  for (const coverage of record.supplementalCoverages || []) coverage.approvedFingerprint = factoryTractionBatteryReviewFingerprint(record, coverage);
  const vehicle = {
    id: record.vehicle.vehicleId, marca: record.vehicle.brand, modelo: record.vehicle.modelVersion,
    ano: record.vehicle.modelYear, ano_fabricacao: record.vehicle.manufactureYear,
    motor: record.unitBinding!.engine, cambio: record.unitBinding!.transmission,
    placa: "ABC1234", km: record.reviewedMileageKm, valor: 100000,
    diferenciais: [{ tag: "garantia_fabrica", descricao: "" }],
  };
  const matrix: FactoryWarrantyMatrix = { schemaVersion: 2, enabled: true, requireUnitBinding: true, records: [record] };
  return { record, matrix, vehicle };
}
const generate = (matrix: FactoryWarrantyMatrix, vehicles: unknown[]) => buildCarclickWarrantyManifest(JSON.stringify(matrix), vehicles, [], "2026-10-29");

test("only the canonical approved unit produces a scope claim, no raw identifiers", () => {
  const { matrix, vehicle } = fixture();
  const output = generate(matrix, [vehicle]);
  assert.equal(output.claims.length, 1);
  assert.equal(output.claims[0].coverages[0].scope, "basic-vehicle");
  assert.doesNotMatch(JSON.stringify(output), /ABC1234|renavam|chassi|preco|price/);
  assert.equal(output.authoritySha256, createHash("sha256").update(JSON.stringify(matrix)).digest("hex"));
});

test("revoked, disabled, changed approval and duplicate IDs never produce claims", () => {
  for (const mutate of [
    (m: FactoryWarrantyMatrix) => { m.enabled = false; },
    (m: FactoryWarrantyMatrix) => { m.records[0].status = "revoked"; },
    (m: FactoryWarrantyMatrix) => { m.records[0].termYears += 1; },
    (m: FactoryWarrantyMatrix) => { m.records.push(structuredClone(m.records[0])); },
  ]) {
    const { matrix, vehicle } = fixture(); mutate(matrix);
    assert.equal(generate(matrix, [vehicle]).claims.length, 0);
  }
  const { matrix, vehicle } = fixture();
  assert.equal(generate(matrix, [vehicle, vehicle]).claims.length, 0);
});

test("missing flag, missing identity, sold unit and unreviewed new unit fail closed", () => {
  const { matrix, vehicle } = fixture();
  for (const patch of [{ diferenciais: [] }, { placa: "" }, { valor: 0 }, { id: "888000" }, { modelo: "OTHER VERSION" }]) {
    assert.equal(generate(matrix, [{ ...vehicle, ...patch }]).claims.length, 0);
  }
});

test("estimated final year is an exclusion boundary, never an actual advertised expiry", () => {
  const { matrix, vehicle, record } = fixture();
  const year = record.vehicle.manufactureYear + record.termYears;
  assert.equal(generate(matrix, [vehicle]).claims[0].coverages[0].validBefore, `${year}-01-01`);
  assert.equal(generate(matrix, [vehicle]).claims[0].coverages[0].advertisedExpiryMonth, undefined);
  assert.equal(buildCarclickWarrantyManifest(JSON.stringify(matrix), [vehicle], [], `${year}-01-01`).claims.length, 0);
});

test("confirmed expiry month blocks from the first day without inventing a last day", () => {
  const { matrix, vehicle, record } = fixture();
  record.confirmedExpiryMonth = "2026-12";
  record.approvedFingerprint = factoryWarrantyReviewFingerprint(record);
  assert.equal(generate(matrix, [vehicle]).claims[0].coverages[0].validBefore, "2026-12-01");
  assert.equal(generate(matrix, [vehicle]).claims[0].coverages[0].advertisedExpiryMonth, "2026-12");
});

test("only a confirmed effective date produces advertised month/year", () => {
  const { matrix, vehicle, record } = fixture();
  record.confirmedExpiryDate = "2027-06-14";
  record.approvedFingerprint = factoryWarrantyReviewFingerprint(record);
  const coverage = generate(matrix, [vehicle]).claims[0].coverages[0];
  assert.equal(coverage.validBefore, "2027-06-15");
  assert.equal(coverage.advertisedExpiryMonth, "2027-06");
});

test("XML/API aliases are exact and bound to the reviewed physical unit", () => {
  const { matrix, vehicle } = fixture();
  const aliases = [{ vehicleId: vehicle.id, unitKey, canonicalModel: vehicle.modelo, rawModel: "RAW REVIEWED VERSION" }];
  const build = (input: typeof aliases) => buildCarclickWarrantyManifest(JSON.stringify(matrix), [vehicle], input, "2026-10-29");
  assert.equal(build(aliases).claims[0].rawModel, "RAW REVIEWED VERSION");
  assert.equal(build([{ ...aliases[0], unitKey: `plate-sha256:${"f".repeat(64)}` }]).claims[0].rawModel, vehicle.modelo);
  assert.equal(build([...aliases, ...aliases]).claims.length, 0);
});

test("unknown mileage policy remains current-unit motor/transmission only", () => {
  const { matrix, vehicle } = fixture("20100");
  const claim = generate(matrix, [vehicle]).claims[0];
  assert.equal(claim.coverages.length, 1);
  assert.equal(claim.coverages[0].scope, "powertrain");
  assert.equal(claim.coverages[0].mileage.kind, "unknown");
  assert.equal(claim.coverages[0].exactMileageKm, vehicle.km);
  assert.equal(generate(matrix, [{ ...vehicle, km: vehicle.km + 1 }]).claims.length, 0);
});

test("battery remains a separate scope and never lengthens general coverage", () => {
  const { matrix, vehicle } = fixture("20067");
  const claim = generate(matrix, [vehicle]).claims[0];
  assert.deepEqual(claim.coverages.map((entry) => entry.scope), ["basic-vehicle", "traction-battery"]);
  assert.ok(claim.coverages[0].validBefore < claim.coverages[1].validBefore);
});

test("PHP7 runtime guards reject divergent or expired live data", (context) => {
  const php = process.env.PHP_BINARY || "php";
  const probe = spawnSync(php, ["-v"], { encoding: "utf8" });
  if (probe.error) return context.skip("PHP is unavailable locally; CI executes the runtime guards");
  const result = spawnSync(php, [new URL("./carclick-warranty.test.php", import.meta.url).pathname], { encoding: "utf8" });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /carclick warranty runtime: \d+ checks passed/);
});
