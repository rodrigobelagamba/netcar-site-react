import { vehiclePhysicalIdentityKey } from "../../src/lib/vehiclePhysicalIdentity";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs, { chmodSync, closeSync, existsSync, fstatSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, mock, test, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { persistReviewApplication, recoverReviewApplication, runEquipmentReviewCli } from "../review-vehicle-equipment";
import { applyReviewProposal, type ReviewInput, type ReviewLedger, type ReviewProposal, type ReviewSnapshot } from "../lib/equipmentReview";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const originalFetch = globalThis.fetch;
const stateName = "research-review.json";
const proposalName = "research-proposal.json";
const lockName = "research-review.lock";

beforeEach(() => {
  globalThis.fetch = async () => {
    throw new Error("Unexpected network request in equipment review CLI test");
  };
});
afterEach(() => { globalThis.fetch = originalFetch; });

function candidateInput(): ReviewInput {
  const match = {
    brand: "FIAT", model: "EXACT TEST", modelYear: 2025,
    engine: "1.0", transmission: "AUTOMATICO", market: "BR" as const,
  };
  return {
    schemaVersion: 1,
    candidates: [{
      identity: { id: "90001", manufactureYear: 2024, ...match },
      item: { key: "lane-assist", label: "Assistência de permanência em faixa", tag: "assistencia_faixa" },
      classification: "standard",
      evidence: {
        url: "https://www.fiat.com.br/catalogo", title: "Catálogo de teste",
        date: "2026-10-08", locator: "p. 5", claim: "Item da versão exata",
        match, kind: "exact-equipment",
      },
    }],
  };
}

function stockInput() {
  return {
    success: true, total_results: 1, offset: 0, limit: 500,
    data: [{
      id: "90001", placa: "ABC1D23", marca: "FIAT", modelo: "EXACT TEST", ano: 2025,
      ano_fabricacao: 2024, motor: "1.0", cambio: "AUTOMATICO",
      valor: 100000, opcionais: [],
    }],
  };
}

function harness(t: TestContext) {
  // /var is a symlink on macOS; output must genuinely avoid symlink ancestors.
  const directory = mkdtempSync(join(realpathSync(tmpdir()), "netcar-review-cli-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const stateDir = join(directory, ".devops", "equipment");
  const input = join(directory, "candidate input.json");
  const stock = join(directory, "stock snapshot.json");
  writeFileSync(input, JSON.stringify(candidateInput()));
  writeFileSync(stock, JSON.stringify(stockInput()));
  const state = join(stateDir, stateName);
  const proposal = join(stateDir, proposalName);
  const call = (...argv: string[]) => runEquipmentReviewCli([...argv, "--state-dir", stateDir]);
  const sync = () => call("sync", "--input", input, "--stock", stock) as Promise<ReviewLedger>;
  const prepare = () => call("prepare", "--stock", stock) as Promise<{ proposalOnly: true; path: string; proposal: ReviewProposal }>;
  return { directory, stateDir, input, stock, state, proposal, call, sync, prepare };
}

function selection(ledger: ReviewLedger) {
  assert.equal(ledger.revisions.length, 1);
  const revision = ledger.revisions[0];
  return ["--key", revision.key, "--vehicle-id", revision.candidate.identity.id, "--item-key", revision.candidate.item.key];
}

function assertNoTemporaryFiles(stateDir: string) {
  assert.ok(!existsSync(join(stateDir, lockName)), "owned lock must be released");
  assert.deepEqual(readdirSync(stateDir).filter((name) => name.endsWith(".tmp")), []);
}

test("help is read-only and does not initialize a private ledger", async (t) => {
  const h = harness(t);
  for (const argv of [[], ["--help"]]) {
    assert.match((await runEquipmentReviewCli(argv) as { help: string }).help, /Revisão LOCAL/);
  }
  assert.equal(existsSync(h.stateDir), false);
});

test("sync/list preserve private permissions, round-trip data and paths with spaces", async (t) => {
  const h = harness(t);
  mkdirSync(h.stateDir, { recursive: true, mode: 0o755 });
  chmodSync(h.stateDir, 0o755);
  const ledger = await h.sync();
  assert.equal(statSync(h.stateDir).mode & 0o777, 0o700);
  assert.equal(statSync(h.state).mode & 0o777, 0o600);
  assert.deepEqual(JSON.parse(readFileSync(h.state, "utf8")), ledger);
  const before = readFileSync(h.state, "utf8");
  assert.deepEqual(await h.call("list"), ledger);
  assert.equal(readFileSync(h.state, "utf8"), before);
  assert.equal(ledger.revisions[0].askedAt, undefined, "sync must not mark a question as delivered");
  assertNoTemporaryFiles(h.stateDir);
});

test("a successful state update atomically replaces the file instead of mutating an open reader", async (t) => {
  const h = harness(t);
  const ledger = await h.sync();
  const before = readFileSync(h.state, "utf8");
  const descriptor = openSync(h.state, "r");
  try {
    const priorInode = fstatSync(descriptor).ino;
    chmodSync(h.state, 0o644);
    await h.call("mark-asked", ...selection(ledger));
    assert.notEqual(statSync(h.state).ino, priorInode);
    assert.equal(readFileSync(descriptor, "utf8"), before);
    assert.notEqual(readFileSync(h.state, "utf8"), before);
    assert.equal(statSync(h.state).mode & 0o777, 0o600);
    assertNoTemporaryFiles(h.stateDir);
  } finally { closeSync(descriptor); }
});

for (const operation of ["fsyncSync", "renameSync"] as const) {
  test(`${operation} failure preserves committed state and removes only its own temporary files/lock`, async (t) => {
    const h = harness(t);
    const ledger = await h.sync();
    const before = readFileSync(h.state, "utf8");
    const replacement = mock.method(fs, operation, () => { throw new Error("Injected persistence failure"); });
    syncBuiltinESMExports();
    try {
      await assert.rejects(h.call("mark-asked", ...selection(ledger)), /Injected persistence failure/);
      assert.equal(readFileSync(h.state, "utf8"), before);
      assertNoTemporaryFiles(h.stateDir);
    } finally {
      replacement.mock.restore();
      syncBuiltinESMExports();
    }
    await h.call("mark-asked", ...selection(ledger));
    assertNoTemporaryFiles(h.stateDir);
  });
}

test("an existing lock is never replaced, removed or automatically recovered", async (t) => {
  const h = harness(t);
  await h.sync();
  const before = readFileSync(h.state, "utf8");
  const lock = join(h.stateDir, lockName);
  const owner = '{"pid":999999,"createdAt":"2000-01-01T00:00:00Z"}';
  writeFileSync(lock, owner, { mode: 0o600 });
  await assert.rejects(h.sync(), /ocupada|trava anterior/);
  assert.equal(readFileSync(lock, "utf8"), owner);
  assert.equal(readFileSync(h.state, "utf8"), before);
});

test("a lock symlink does not modify or remove another file", async (t) => {
  const h = harness(t);
  await h.sync();
  const victim = join(h.directory, "unrelated-lock-owner.txt");
  writeFileSync(victim, "preserve owner");
  const lock = join(h.stateDir, lockName);
  symlinkSync(victim, lock);
  await assert.rejects(h.call("list"), /ocupada|trava anterior/);
  assert.equal(readFileSync(victim, "utf8"), "preserve owner");
  assert.ok(lstatSync(lock).isSymbolicLink());
});

for (const field of ["input", "stock"] as const) {
  for (const invalid of ["malformed-json", "invalid-schema", "oversized", "symlink"] as const) {
    test(`${field} ${invalid} is rejected without replacing existing state`, async (t) => {
      const h = harness(t);
      await h.sync();
      const before = readFileSync(h.state, "utf8");
      const filename = h[field];
      if (invalid === "symlink") {
        const target = join(h.directory, `${field}-original.json`);
        fs.renameSync(filename, target);
        symlinkSync(target, filename);
      } else {
        writeFileSync(filename, invalid === "malformed-json" ? "{broken" : invalid === "invalid-schema" ? "{}" : " ".repeat(8 * 1024 * 1024 + 1));
      }
      await assert.rejects(h.sync());
      assert.equal(readFileSync(h.state, "utf8"), before);
      assertNoTemporaryFiles(h.stateDir);
    });
  }
}

for (const malformed of ["{broken", '{"schemaVersion":1,"revisions":{},"events":[]}']) {
  test(`invalid persisted ledger is preserved (${malformed.startsWith("{broken") ? "JSON" : "schema"})`, async (t) => {
    const h = harness(t);
    await h.sync();
    writeFileSync(h.state, malformed);
    await assert.rejects(h.call("list"));
    assert.equal(readFileSync(h.state, "utf8"), malformed);
    assertNoTemporaryFiles(h.stateDir);
  });
}

for (const targetExists of [true, false]) {
  test(`ledger symlink is rejected even when its target ${targetExists ? "exists" : "is missing"}`, async (t) => {
    const h = harness(t);
    mkdirSync(h.stateDir, { recursive: true });
    const target = join(h.directory, "outside-ledger.json");
    if (targetExists) writeFileSync(target, '{"schemaVersion":1,"revisions":[],"events":[]}');
    symlinkSync(target, h.state);
    await assert.rejects(h.call("list"), /JSON|simbólico/);
    assert.ok(lstatSync(h.state).isSymbolicLink());
    assert.equal(existsSync(target), targetExists);
    assertNoTemporaryFiles(h.stateDir);
  });

  test(`proposal symlink is rejected even when its target ${targetExists ? "exists" : "is missing"}`, async (t) => {
    const h = harness(t);
    await h.sync();
    const before = readFileSync(h.state, "utf8");
    const target = join(h.directory, "outside-proposal.json");
    if (targetExists) writeFileSync(target, "preserve proposal target");
    symlinkSync(target, h.proposal);
    await assert.rejects(h.prepare(), /simbólico/);
    assert.ok(lstatSync(h.proposal).isSymbolicLink());
    assert.equal(existsSync(target), targetExists);
    if (targetExists) assert.equal(readFileSync(target, "utf8"), "preserve proposal target");
    assert.equal(readFileSync(h.state, "utf8"), before);
    assertNoTemporaryFiles(h.stateDir);
  });
}

test("output path cannot traverse a directory symlink", async (t) => {
  const h = harness(t);
  const target = join(h.directory, "elsewhere");
  mkdirSync(target);
  const linked = join(h.directory, "linked-parent");
  symlinkSync(target, linked, "dir");
  await assert.rejects(runEquipmentReviewCli(["list", "--state-dir", join(linked, ".devops", "equipment")]), /simbólico/);
  assert.deepEqual(readdirSync(target), []);
});

for (const runtime of ["src", "public", "dist"]) {
  test(`state output is forbidden inside ${runtime}, without attempting a runtime write`, async () => {
    const path = join(root, runtime, `equipment-review-test-${randomUUID()}`, ".devops", "equipment");
    const originalMkdir = fs.mkdirSync;
    const replacement = mock.method(fs, "mkdirSync", (...args: Parameters<typeof fs.mkdirSync>) => {
      if (String(args[0]).startsWith(root)) throw new Error("TEST GUARD: attempted runtime directory creation");
      return originalMkdir(...args);
    });
    syncBuiltinESMExports();
    try {
      await assert.rejects(runEquipmentReviewCli(["list", "--state-dir", path]), /privado|checkout/);
      assert.equal(existsSync(path), false);
    } finally {
      replacement.mock.restore();
      syncBuiltinESMExports();
    }
  });
}

test("an arbitrary non-private output directory is rejected", async (t) => {
  const h = harness(t);
  await assert.rejects(runEquipmentReviewCli(["list", "--state-dir", join(h.directory, "output")]), /privado/);
  assert.equal(existsSync(join(h.directory, "output")), false);
});

for (const [label, args] of [
  ["unknown command", ["publish"]],
  ["unknown argument", ["list", "--unknown"]],
  ["positional argument", ["list", "unexpected.json"]],
  ["missing value", ["sync", "--input"]],
  ["missing required input", ["sync", "--stock", "unused.json"]],
  ["duplicate option", ["mark-asked", "--key", "a", "--key", "b"]],
  ["duplicate boolean", ["decide", "--present", "--present"]],
  ["duplicate source-identity flag", ["decide", "--confirm-source-identity", "--confirm-source-identity"]],
  ["boolean passed as value", ["decide", "--present", "true"]],
  ["option for another command", ["list", "--input", "unused.json"]],
  ["source-identity flag for another command", ["list", "--confirm-source-identity"]],
  ["runtime output option", ["prepare", "--output", "src/data/vehicle-equipment-confirmations.json"]],
] as const) {
  test(`argument parsing rejects ${label} without initializing state`, async (t) => {
    const h = harness(t);
    await assert.rejects(h.call(...args), /Comando|Argumento|Informe/);
    assert.equal(existsSync(h.stateDir), false);
  });
}

test("missing selection or invalid decision status preserves the ledger and releases its lock", async (t) => {
  const h = harness(t);
  const ledger = await h.sync();
  const before = readFileSync(h.state, "utf8");
  for (const args of [["mark-asked"], ["decide", ...selection(ledger), "--status", "approved", "--note", "Invalid status"]]) {
    await assert.rejects(h.call(...args), /Informe|Status inválido/);
    assert.equal(readFileSync(h.state, "utf8"), before);
    assertNoTemporaryFiles(h.stateDir);
  }
});

for (const missing of ["--present", "--authorize-publication", "--confirm-market"]) {
  test(`confirmation without ${missing} preserves the ledger`, async (t) => {
    const h = harness(t);
    const ledger = await h.sync();
    const before = readFileSync(h.state, "utf8");
    const flags = ["--present", "--authorize-publication", "--confirm-market", "--confirm-source-identity"].filter((flag) => flag !== missing);
    await assert.rejects(h.call("decide", ...selection(ledger), "--status", "confirmed", "--note", "Incomplete confirmation.", ...flags), /explicit_unit_presence_publication_market_required/);
    assert.equal(readFileSync(h.state, "utf8"), before);
    assertNoTemporaryFiles(h.stateDir);
  });
}

test("confirmed decision flags produce only a private proposal and never change source registries", async (t) => {
  const h = harness(t);
  const runtimeFiles = ["vehicle-equipment-confirmations.json", "vehicle-equipment-evidence.json", "vehicle-equipment-catalog.json"];
  const readRuntime = () => runtimeFiles.map((name) => readFileSync(join(root, "src", "data", name), "utf8"));
  const beforeRuntime = readRuntime();
  const ledger = await h.sync();
  const chosen = selection(ledger);
  await h.call("mark-asked", ...chosen);
  const decided = await h.call("decide", ...chosen, "--status", "confirmed", "--note", "Presença e mercado confirmados na unidade de teste.", "--present", "--authorize-publication", "--confirm-market", "--confirm-source-identity", "--confirmation-reference", "chat:test:90001:lane-assist", "--approved-name", "Assistência de permanência em faixa", "--approved-description", "Auxilia o motorista a manter o carro na faixa.") as ReviewLedger;
  assert.deepEqual(decided.revisions[0].decision, {
    note: "Presença e mercado confirmados na unidade de teste.",
    present: true, authorizePublication: true, marketConfirmed: true, sourceIdentityConfirmed: true,
    confirmationReference: "chat:test:90001:lane-assist", approvedText: { name: "Assistência de permanência em faixa", description: "Auxilia o motorista a manter o carro na faixa." },
  });
  const beforePrepare = JSON.parse(readFileSync(h.state, "utf8")) as ReviewLedger;
  const result = await h.prepare();
  assert.equal(result.proposalOnly, true);
  assert.equal(result.path, h.proposal);
  assert.equal(result.proposal.proposalOnly, true);
  assert.deepEqual(result.proposal.includedKeys, [ledger.revisions[0].key]);
  assert.equal(statSync(h.proposal).mode & 0o777, 0o600);
  assert.equal(statSync(h.stateDir).mode & 0o777, 0o700);
  assert.deepEqual(JSON.parse(readFileSync(h.proposal, "utf8")), result.proposal);
  const afterPrepare = JSON.parse(readFileSync(h.state, "utf8")) as ReviewLedger;
  assert.deepEqual(afterPrepare.revisions, beforePrepare.revisions);
  assert.deepEqual(afterPrepare.events, beforePrepare.events);
  assert.equal(afterPrepare.lastObservationFingerprint, beforePrepare.lastObservationFingerprint);
  assert.ok(afterPrepare.lastObservedAt! >= beforePrepare.lastObservedAt!);
  assert.deepEqual(readRuntime(), beforeRuntime);
  assert.deepEqual(readdirSync(h.stateDir).sort(), [proposalName, stateName].sort());
  assertNoTemporaryFiles(h.stateDir);
});

async function applicationHarness(t: TestContext) {
  const h = harness(t);
  const initial = await h.sync();
  const chosen = selection(initial);
  const ledger = await h.call("decide", ...chosen, "--status", "authorized", "--note", "Autorização sintética específica.", "--present", "--authorize-publication", "--confirm-market", "--confirmation-reference", "chat:test:exact:90001", "--approved-name", "Assistência de permanência em faixa", "--approved-description", "Auxilia o motorista a manter o carro na faixa.") as ReviewLedger;
  const proposal = (await h.prepare()).proposal;
  const stock: ReviewSnapshot = { schemaVersion: 1, observedAt: proposal.snapshotObservedAt, vehicles: [{ id: "90001", physicalIdentityKey: vehiclePhysicalIdentityKey("90001", "ABC1D23"), brand: "FIAT", model: "EXACT TEST", modelYear: 2025, manufactureYear: 2024, engine: "1.0", transmission: "AUTOMATICO", market: null, seats: "", options: [] }] };
  const beforeText = readFileSync(join(root, "src", "data", "vehicle-equipment-confirmations.json"), "utf8");
  const result = applyReviewProposal(ledger, stock, beforeText, proposal, proposal.proposalSha256, new Date().toISOString());
  const registry = join(h.directory, "synthetic-confirmations.json");
  writeFileSync(registry, beforeText, { mode: 0o644 });
  return { ...h, ledger: JSON.parse(readFileSync(h.state, "utf8")) as ReviewLedger, proposalValue: proposal, result, registry, beforeText };
}

test("apply persists only a synthetic registry, receipt and exact recovery bytes", async (t) => {
  const h = await applicationHarness(t);
  persistReviewApplication(h.stateDir, h.ledger, h.result, h.registry);
  assert.equal(readFileSync(h.registry, "utf8"), h.result.documentText);
  const receipt = JSON.parse(readFileSync(join(h.stateDir, `research-application-${h.result.afterSha256}.json`), "utf8"));
  assert.equal(receipt.beforeText, h.beforeText);
  assert.equal(receipt.afterText, h.result.documentText);
  assert.equal(existsSync(join(h.stateDir, "research-application-pending.json")), false);
  assert.equal(statSync(h.registry).mode & 0o777, 0o644);
  assertNoTemporaryFiles(h.stateDir);
});

test("apply refuses a concurrent registry change and preserves both files", async (t) => {
  const h = await applicationHarness(t);
  writeFileSync(h.registry, h.beforeText + " ");
  const previous = readFileSync(h.state, "utf8");
  assert.throws(() => persistReviewApplication(h.stateDir, h.ledger, h.result, h.registry), /alterada/);
  assert.equal(readFileSync(h.registry, "utf8"), h.beforeText + " ");
  assert.equal(readFileSync(h.state, "utf8"), previous);
  assert.equal(existsSync(join(h.stateDir, "research-application-pending.json")), false);
});

test("apply shares a registry lock across state directories and never removes a foreign lock", async (t) => {
  const h = await applicationHarness(t);
  const lock = join(h.directory, ".vehicle-equipment-confirmations.review.lock");
  writeFileSync(lock, "another writer");
  assert.throws(() => persistReviewApplication(h.stateDir, h.ledger, h.result, h.registry), /ocupado/);
  assert.equal(readFileSync(lock, "utf8"), "another writer");
  assert.equal(readFileSync(h.registry, "utf8"), h.beforeText);
});

test("interrupted apply leaves a journal and recovers committed runtime without reapplying", async (t) => {
  const h = await applicationHarness(t);
  const rename = fs.renameSync;
  const replacement = mock.method(fs, "renameSync", (...args: Parameters<typeof fs.renameSync>) => {
    if (String(args[1]) === h.state) throw new Error("Injected state commit interruption");
    return rename(...args);
  });
  syncBuiltinESMExports();
  try { assert.throws(() => persistReviewApplication(h.stateDir, h.ledger, h.result, h.registry), /Injected/); }
  finally { replacement.mock.restore(); syncBuiltinESMExports(); }
  assert.equal(readFileSync(h.registry, "utf8"), h.result.documentText);
  assert.ok(existsSync(join(h.stateDir, "research-application-pending.json")));
  await assert.rejects(h.call("mark-asked", ...selection(h.ledger)), /interrompida/);
  assert.deepEqual(recoverReviewApplication(h.stateDir, h.registry), { recovered: true, appliedLocally: true, published: false });
  assert.deepEqual(JSON.parse(readFileSync(h.state, "utf8")), h.result.ledger);
  assert.equal(existsSync(join(h.stateDir, "research-application-pending.json")), false);
});

test("recovery never overwrites a third-party registry edit after interruption", async (t) => {
  const h = await applicationHarness(t);
  const rename = fs.renameSync;
  const replacement = mock.method(fs, "renameSync", (...args: Parameters<typeof fs.renameSync>) => {
    if (String(args[1]) === h.state) throw new Error("Injected state commit interruption");
    return rename(...args);
  });
  syncBuiltinESMExports();
  try { assert.throws(() => persistReviewApplication(h.stateDir, h.ledger, h.result, h.registry), /Injected/); }
  finally { replacement.mock.restore(); syncBuiltinESMExports(); }
  writeFileSync(h.registry, h.result.documentText + " ");
  assert.throws(() => recoverReviewApplication(h.stateDir, h.registry), /concorrente/);
  assert.equal(readFileSync(h.registry, "utf8"), h.result.documentText + " ");
  assert.ok(existsSync(join(h.stateDir, "research-application-pending.json")));
});
