import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { mock, test } from "node:test";
import {
  buildEquipmentAudit,
  EQUIPMENT_STOCK_URL,
  fetchEquipmentStock,
  parseStockResponse,
  runEquipmentAudit,
} from "../audit-vehicle-equipment";
import {
  resolveVehicleEquipment,
  unitEquipmentConfirmations,
  type EquipmentVehicle,
} from "../../src/lib/vehicleEquipment";

const fixture: { vehicles: EquipmentVehicle[] } = JSON.parse(
  readFileSync(
    new URL("../fixtures/vehicle-equipment-stock.json", import.meta.url),
    "utf8",
  ),
);
const firstRunAt = "2026-09-28T18:00:00.000Z";
const secondRunAt = "2026-09-29T18:00:00.000Z";

function stockVehicle(id: string): EquipmentVehicle {
  const vehicle = fixture.vehicles.find((item) => String(item.id) === id);
  assert.ok(vehicle, `fixture vehicle ${id} missing`);
  return structuredClone(vehicle);
}

function apiVehicle(vehicle = fixture.vehicles[0]): Record<string, unknown> {
  const { year, anoFabricacao, ...rest } = structuredClone(vehicle);
  return { ...rest, ano: year, ano_fabricacao: anoFabricacao, valor: 100000 };
}

function apiResponse(data: Record<string, unknown>[]) {
  return {
    success: true,
    total_results: data.length,
    limit: 500,
    offset: 0,
    data,
  };
}

async function withStateDirectory(
  callback: (directory: string) => Promise<void>,
) {
  const directory = mkdtempSync(join(tmpdir(), "netcar-equipment-audit-test-"));
  try {
    await callback(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function existingOwner(stateDir: string) {
  const lockPath = join(stateDir, "audit.lock");
  const ownerName = readdirSync(lockPath).find((name) =>
    name.endsWith(".json"),
  );
  assert.ok(ownerName);
  const ownerPath = join(lockPath, ownerName);
  return {
    lockPath,
    ownerPath,
    owner: JSON.parse(readFileSync(ownerPath, "utf8")),
  };
}

function makeExpiredLock(stateDir: string, temporary = false) {
  const lockPath = join(stateDir, "audit.lock");
  mkdirSync(lockPath, { mode: 0o700 });
  const token = randomUUID();
  writeFileSync(
    join(lockPath, `${token}.json`),
    JSON.stringify({
      token,
      pid: process.pid,
      hostname: hostname(),
      startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    }),
    { mode: 0o600 },
  );
  if (temporary)
    writeFileSync(join(lockPath, `${token}.report.tmp`), "interrupted report");
  return lockPath;
}

test("first audit covers every active fixture vehicle using the shared presentation", () => {
  const input = structuredClone(fixture.vehicles);
  const before = structuredClone(input);
  const report = buildEquipmentAudit(input, null, firstRunAt);
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.generatedAt, firstRunAt);
  assert.match(report.catalogFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(report.counts.vehicles, 60);
  assert.equal(report.counts.new, 60);
  assert.equal(report.counts.changed, 0);
  assert.equal(report.counts.unchanged, 0);
  assert.equal(report.vehicles.length, 60);
  assert.equal(new Set(report.vehicles.map((item) => item.id)).size, 60);
  assert.equal(
    report.counts.withAlerts,
    report.vehicles.filter((item) =>
      item.findings.some((finding) => finding.severity !== "info"),
    ).length,
  );
  for (const vehicle of input) {
    const row = report.vehicles.find((item) => item.id === String(vehicle.id));
    assert.ok(row, String(vehicle.id));
    assert.equal(row.change, "new", row.id);
    assert.match(row.reviewKey, /^[a-f0-9]{64}$/, row.id);
    assert.deepEqual(
      row.displayedDescriptions,
      resolveVehicleEquipment(vehicle).items.map((item) => item.description),
      row.id,
    );
    assert.ok(row.researchQuery.includes(String(vehicle.year)), row.id);
    assert.ok(row.researchQuery.includes(vehicle.modelo!), row.id);
  }
  assert.deepEqual(input, before, "auditing must preserve the source fixture");
});

test("repeat audits preserve review keys and mark all vehicles unchanged", () => {
  const previous = buildEquipmentAudit(fixture.vehicles, null, firstRunAt);
  const before = structuredClone(previous);
  const current = buildEquipmentAudit(fixture.vehicles, previous, secondRunAt);
  assert.equal(current.generatedAt, secondRunAt);
  assert.equal(current.counts.new, 0);
  assert.equal(current.counts.changed, 0);
  assert.equal(current.counts.unchanged, 60);
  for (const row of current.vehicles) {
    assert.equal(row.change, "unchanged", row.id);
    assert.equal(
      row.reviewKey,
      previous.vehicles.find((item) => item.id === row.id)?.reviewKey,
      row.id,
    );
  }
  assert.deepEqual(
    previous,
    before,
    "previous report is not a writable ledger",
  );
});

test("reordered stock, reordered optionals and price changes do not reopen review", () => {
  const previous = buildEquipmentAudit(fixture.vehicles, null, firstRunAt);
  const reordered = structuredClone(fixture.vehicles)
    .reverse()
    .map((vehicle) => ({
      ...vehicle,
      valor: 98765,
      price: 12345,
      opcionais: [...(vehicle.opcionais || [])].reverse(),
    }));
  const current = buildEquipmentAudit(reordered, previous, secondRunAt);
  assert.equal(current.counts.unchanged, 60);
  assert.equal(current.counts.changed, 0);
  for (const row of current.vehicles) {
    assert.equal(
      row.reviewKey,
      previous.vehicles.find((item) => item.id === row.id)?.reviewKey,
      row.id,
    );
  }
});

test("changed equipment reopens only the affected unit and keeps unknown equipment visible", () => {
  const input = structuredClone(fixture.vehicles);
  const previous = buildEquipmentAudit(input, null, firstRunAt);
  const changed = input[0];
  changed.opcionais = [
    ...(changed.opcionais || []),
    { tag: "novo_recurso_a_conferir", descricao: "Novo recurso a conferir" },
  ];
  const report = buildEquipmentAudit(input, previous, secondRunAt);
  assert.equal(report.counts.changed, 1);
  assert.equal(report.counts.unchanged, 59);
  assert.equal(report.counts.new, 0);
  const row = report.vehicles.find((item) => item.id === String(changed.id));
  assert.ok(row);
  assert.equal(row.change, "changed");
  assert.notEqual(
    row.reviewKey,
    previous.vehicles.find((item) => item.id === row.id)?.reviewKey,
  );
  assert.ok(row.displayedDescriptions.includes("Novo recurso a conferir"));
  assert.ok(
    row.findings.some(
      (finding) =>
        finding.code === "unknown-equipment" && finding.severity === "medium",
    ),
  );
});

test("a changed model year, version, engine or transmission reopens the unit", () => {
  const vehicle = stockVehicle("20051");
  const previous = buildEquipmentAudit([vehicle], null, firstRunAt);
  const changes: Partial<EquipmentVehicle>[] = [
    { year: Number(vehicle.year) + 1 },
    { modelo: `${vehicle.modelo} PLUS` },
    { marca: "OTHER" },
    { motor: "1.5" },
    { cambio: "MANUAL" },
  ];
  for (const change of changes) {
    const report = buildEquipmentAudit([{ ...vehicle, ...change }], previous);
    assert.equal(report.counts.changed, 1, JSON.stringify(change));
    assert.equal(report.vehicles[0].change, "changed");
    assert.notEqual(
      report.vehicles[0].reviewKey,
      previous.vehicles[0].reviewKey,
    );
    assert.deepEqual(report.vehicles[0].confirmationIds, []);
  }
});

test("a new stock ID requires its own review and never inherits unit confirmations", () => {
  const vehicle = stockVehicle("20051");
  const previous = buildEquipmentAudit([vehicle], null, firstRunAt);
  const report = buildEquipmentAudit([{ ...vehicle, id: "99999" }], previous);
  assert.equal(report.counts.new, 1);
  assert.equal(report.vehicles[0].change, "new");
  assert.notEqual(report.vehicles[0].reviewKey, previous.vehicles[0].reviewKey);
  assert.deepEqual(report.vehicles[0].confirmationIds, []);
  assert.ok(
    report.vehicles[0].displayedDescriptions.some((text) => /teto/i.test(text)),
  );
});

test("incomplete identity warns and cannot inherit a unit confirmation", () => {
  const vehicle = stockVehicle("20051");
  for (const key of ["marca", "modelo", "year", "motor", "cambio"] as const) {
    const report = buildEquipmentAudit([{ ...vehicle, [key]: undefined }]);
    const row = report.vehicles[0];
    assert.ok(
      row.findings.some(
        (finding) =>
          finding.code === "incomplete-identity" && finding.severity === "high",
      ),
      key,
    );
    assert.ok(
      row.findings.some(
        (finding) => finding.code === "confirmation-identity-mismatch",
      ),
      key,
    );
    assert.deepEqual(row.confirmationIds, [], key);
    assert.ok(
      row.displayedDescriptions.some((text) => /teto/i.test(text)),
      key,
    );
  }
});

test("unit source conflicts retain the raw claim and expose the confirmed presentation", () => {
  const report = buildEquipmentAudit([
    stockVehicle("20050"),
    stockVehicle("20051"),
  ]);
  for (const row of report.vehicles) {
    assert.deepEqual(
      row.confirmationIds,
      unitEquipmentConfirmations
        .filter((record) => record.match.vehicleId === row.id)
        .map((record) => record.id),
    );
    assert.ok(
      row.findings.some(
        (finding) =>
          finding.code === "unit-source-conflict" &&
          finding.severity === "high",
      ),
      row.id,
    );
    if (row.id === "20050") {
      assert.ok(
        row.inventoryDescriptions.some((text) => /park assist/i.test(text)),
      );
      assert.ok(
        row.inventoryDescriptions.some((text) => /adaptativo/i.test(text)),
      );
      assert.ok(
        !row.displayedDescriptions.some((text) =>
          /park assist|adaptativo/i.test(text),
        ),
      );
      assert.ok(
        row.displayedDescriptions.includes(
          "Assistência de permanência em faixa",
        ),
      );
    } else {
      assert.ok(row.inventoryDescriptions.some((text) => /teto/i.test(text)));
      assert.ok(!row.displayedDescriptions.some((text) => /teto/i.test(text)));
      assert.ok(
        !row.displayedDescriptions.some((text) =>
          /permanência em faixa/i.test(text),
        ),
      );
    }
    assert.ok(row.displayedDescriptions.includes("Piloto automático"));
    assert.ok(
      row.displayedDescriptions.some((text) =>
        /sensor.*estacionamento/i.test(text),
      ),
    );
  }
});

test("the API parser maps the complete 60-vehicle fixture without changing equipment", () => {
  const raw = fixture.vehicles.map((vehicle) => apiVehicle(vehicle));
  const parsed = parseStockResponse(apiResponse(raw));
  assert.equal(parsed.length, 60);
  for (const expected of fixture.vehicles) {
    const actual = parsed.find(
      (item) => String(item.id) === String(expected.id),
    );
    assert.ok(actual, String(expected.id));
    assert.equal(Number(actual.year), Number(expected.year));
    assert.deepEqual(actual.opcionais, expected.opcionais);
  }
});

test("the API parser filters sold vehicles after validating a complete response", () => {
  const active = apiVehicle();
  const sold = { ...apiVehicle(), id: "99998", valor: 0 };
  assert.equal(parseStockResponse(apiResponse([active, sold])).length, 1);
  assert.throws(() => parseStockResponse(apiResponse([sold])));
});

test("partial or failed API responses cannot become a successful stock snapshot", () => {
  const data = [apiVehicle()];
  for (const response of [
    { ...apiResponse(data), success: false },
    { ...apiResponse(data), total_results: 2 },
    { ...apiResponse(data), total_results: 0 },
    { ...apiResponse(data), total_results: undefined },
    { ...apiResponse(data), offset: 1 },
    { ...apiResponse(data), data: null },
    apiResponse([]),
    null,
  ]) {
    assert.throws(() => parseStockResponse(response));
  }
});

test("duplicate IDs and invalid equipment rows fail instead of silently dropping vehicles", () => {
  const valid = apiVehicle();
  assert.throws(() => parseStockResponse(apiResponse([valid, { ...valid }])));
  for (const invalid of [
    { ...valid, id: "" },
    { ...valid, id: undefined },
    { ...valid, opcionais: undefined },
    { ...valid, opcionais: null },
    { ...valid, opcionais: "air_bag" },
    { ...valid, opcionais: [null] },
    { ...valid, opcionais: [42] },
    { ...valid, opcionais: [{ tag: { nested: true } }] },
    { ...valid, opcionais: [{}] },
    { ...valid, opcionais: [""] },
    { ...valid, opcionais: [{ tag: " ", descricao: " ", nome: " " }] },
    { ...valid, valor: "not-a-price" },
  ]) {
    assert.throws(() => parseStockResponse(apiResponse([invalid])));
  }
  assert.deepEqual(
    parseStockResponse(apiResponse([{ ...valid, opcionais: [] }]))[0].opcionais,
    [],
  );
});

test("private API fields never enter parsed vehicles or the persisted audit", () => {
  const secrets = {
    renavam: "PRIVATE_RENAVAM_SENTINEL",
    placa: "PRIVATE_PLATE_SENTINEL",
    chassi: "PRIVATE_CHASSIS_SENTINEL",
    private: { token: "PRIVATE_TOKEN_SENTINEL" },
    proprietario: "PRIVATE_OWNER_SENTINEL",
  };
  const raw = { ...apiVehicle(stockVehicle("20051")), ...secrets };
  const parsed = parseStockResponse(apiResponse([raw]));
  const report = buildEquipmentAudit(parsed, null, firstRunAt);
  const direct = buildEquipmentAudit([
    { ...stockVehicle("20051"), ...secrets },
  ]);
  for (const result of [parsed, report, direct]) {
    const json = JSON.stringify(result);
    assert.ok(!json.includes("PRIVATE_"));
    for (const key of Object.keys(secrets)) {
      assert.ok(!json.includes(`"${key}":`), key);
    }
  }
});

test("the runner persists a private report and compares the next run with it", async () => {
  await withStateDirectory(async (stateDir) => {
    const loadStock = async () => structuredClone(fixture.vehicles);
    const first = await runEquipmentAudit({ stateDir, loadStock });
    const reportPath = join(stateDir, "report.json");
    assert.deepEqual(JSON.parse(readFileSync(reportPath, "utf8")), first);
    assert.equal(statSync(stateDir).mode & 0o777, 0o700);
    assert.equal(statSync(reportPath).mode & 0o777, 0o600);
    assert.deepEqual(readdirSync(stateDir), ["report.json"]);

    const second = await runEquipmentAudit({ stateDir, loadStock });
    assert.equal(second.counts.new, 0);
    assert.equal(second.counts.changed, 0);
    assert.equal(second.counts.unchanged, 60);
    assert.deepEqual(JSON.parse(readFileSync(reportPath, "utf8")), second);
    assert.deepEqual(readdirSync(stateDir), ["report.json"]);
  });
});

test("failed and partial stock loads preserve the last valid report byte for byte", async () => {
  await withStateDirectory(async (stateDir) => {
    await runEquipmentAudit({
      stateDir,
      loadStock: async () => structuredClone(fixture.vehicles),
    });
    const reportPath = join(stateDir, "report.json");
    const previous = readFileSync(reportPath, "utf8");
    const invalidLoads = [
      async () => {
        throw new Error("Controlled stock loading failure");
      },
      async () =>
        parseStockResponse({
          ...apiResponse([apiVehicle()]),
          total_results: 60,
        }),
      async () => [],
    ];
    for (const loadStock of invalidLoads) {
      await assert.rejects(runEquipmentAudit({ stateDir, loadStock }));
      assert.equal(readFileSync(reportPath, "utf8"), previous);
      assert.deepEqual(readdirSync(stateDir), ["report.json"]);
    }
  });
});

test("an invalid previous report is preserved and prevents a new stock request", async () => {
  await withStateDirectory(async (stateDir) => {
    const reportPath = join(stateDir, "report.json");
    const invalid = '{"schemaVersion": 0, "vehicles": []}\n';
    writeFileSync(reportPath, invalid, { mode: 0o600 });
    let requested = false;
    await assert.rejects(
      runEquipmentAudit({
        stateDir,
        loadStock: async () => {
          requested = true;
          return fixture.vehicles;
        },
      }),
      /Relatório anterior inválido/,
    );
    assert.equal(requested, false);
    assert.equal(readFileSync(reportPath, "utf8"), invalid);
    assert.deepEqual(readdirSync(stateDir), ["report.json"]);
  });
});

test("a second concurrent audit cannot replace the first audit lock or start a stock load", async () => {
  await withStateDirectory(async (stateDir) => {
    let releaseStock!: (vehicles: EquipmentVehicle[]) => void;
    const waitingStock = new Promise<EquipmentVehicle[]>((resolve) => {
      releaseStock = resolve;
    });
    const first = runEquipmentAudit({
      stateDir,
      loadStock: () => waitingStock,
    });
    const { lockPath, ownerPath } = existingOwner(stateDir);
    let secondRequested = false;
    try {
      const initialLock = readFileSync(ownerPath, "utf8");
      assert.equal(statSync(lockPath).mode & 0o777, 0o700);
      assert.equal(statSync(ownerPath).mode & 0o777, 0o600);
      await assert.rejects(
        runEquipmentAudit({
          stateDir,
          loadStock: async () => {
            secondRequested = true;
            return fixture.vehicles;
          },
        }),
        /auditoria em execução/,
      );
      assert.equal(secondRequested, false);
      assert.equal(readFileSync(ownerPath, "utf8"), initialLock);
      assert.equal(existsSync(join(stateDir, "report.json")), false);
    } finally {
      releaseStock(structuredClone(fixture.vehicles));
      await first;
    }
    assert.deepEqual(readdirSync(stateDir), ["report.json"]);
  });
});

test("expired locks recover after PID reuse and remove only that owner's interrupted report", async () => {
  for (const temporary of [false, true]) {
    await withStateDirectory(async (stateDir) => {
      makeExpiredLock(stateDir, temporary);
      const report = await runEquipmentAudit({
        stateDir,
        loadStock: async () => fixture.vehicles,
      });
      assert.equal(report.counts.vehicles, 60);
      assert.deepEqual(readdirSync(stateDir), ["report.json"]);
    });
  }
});

test("only an old empty lock directory can be reclaimed; legacy lock files are preserved", async () => {
  await withStateDirectory(async (stateDir) => {
    const lockPath = join(stateDir, "audit.lock");
    mkdirSync(lockPath);
    await assert.rejects(
      runEquipmentAudit({ stateDir, loadStock: async () => fixture.vehicles }),
    );
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    utimesSync(lockPath, yesterday, yesterday);
    await runEquipmentAudit({
      stateDir,
      loadStock: async () => fixture.vehicles,
    });
    writeFileSync(lockPath, "legacy lock metadata");
    await assert.rejects(
      runEquipmentAudit({ stateDir, loadStock: async () => fixture.vehicles }),
      /Trava antiga ou desconhecida/,
    );
    assert.equal(readFileSync(lockPath, "utf8"), "legacy lock metadata");
  });
});

test("a resumed expired producer cannot overwrite its successor's report", async () => {
  await withStateDirectory(async (stateDir) => {
    let releaseStock!: (vehicles: EquipmentVehicle[]) => void;
    const waitingStock = new Promise<EquipmentVehicle[]>((resolve) => {
      releaseStock = resolve;
    });
    const first = runEquipmentAudit({
      stateDir,
      loadStock: () => waitingStock,
    });
    const { ownerPath, owner } = existingOwner(stateDir);
    writeFileSync(
      ownerPath,
      JSON.stringify({ ...owner, startedAt: "2000-01-01T00:00:00.000Z" }),
    );
    await runEquipmentAudit({
      stateDir,
      loadStock: async () => [stockVehicle("20051")],
    });
    const reportPath = join(stateDir, "report.json");
    const completed = readFileSync(reportPath, "utf8");
    releaseStock(fixture.vehicles);
    await assert.rejects(first, /perdeu a trava/);
    assert.equal(readFileSync(reportPath, "utf8"), completed);
    assert.deepEqual(readdirSync(stateDir), ["report.json"]);
  });
});

test("metadata write failure does not leave an empty permanent lock", async () => {
  await withStateDirectory(async (stateDir) => {
    const originalWrite = fs.writeFileSync;
    const replacement = mock.method(
      fs,
      "writeFileSync",
      (...args: Parameters<typeof writeFileSync>) => {
        if (String(args[0]).includes(`${join(stateDir, "audit.lock")}/`))
          throw Object.assign(new Error("Simulated disk full"), {
            code: "ENOSPC",
          });
        return originalWrite(...args);
      },
    );
    syncBuiltinESMExports();
    try {
      await assert.rejects(
        runEquipmentAudit({
          stateDir,
          loadStock: async () => fixture.vehicles,
        }),
        /Simulated disk full/,
      );
      assert.deepEqual(readdirSync(stateDir), []);
    } finally {
      replacement.mock.restore();
      syncBuiltinESMExports();
    }
    await runEquipmentAudit({
      stateDir,
      loadStock: async () => fixture.vehicles,
    });
    assert.deepEqual(readdirSync(stateDir), ["report.json"]);
  });
});

test("recovery immediately before commit fences out the expired report writer", async () => {
  await withStateDirectory(async (stateDir) => {
    const originalRename = fs.renameSync;
    let successor: ReturnType<typeof runEquipmentAudit> | undefined;
    let intercepted = false;
    const replacement = mock.method(
      fs,
      "renameSync",
      (...args: Parameters<typeof fs.renameSync>) => {
        if (!intercepted && String(args[0]).endsWith(".report.tmp")) {
          intercepted = true;
          const { ownerPath, owner } = existingOwner(stateDir);
          writeFileSync(
            ownerPath,
            JSON.stringify({ ...owner, startedAt: "2000-01-01T00:00:00.000Z" }),
          );
          // Acquisition/reclamation is synchronous up to the pending stock load.
          // The old producer has already checked ownership immediately above us.
          successor = runEquipmentAudit({
            stateDir,
            loadStock: async () => [stockVehicle("20051")],
          });
        }
        return originalRename(...args);
      },
    );
    syncBuiltinESMExports();
    try {
      await assert.rejects(
        runEquipmentAudit({
          stateDir,
          loadStock: async () => fixture.vehicles,
        }),
        (error: unknown) => {
          assert.equal((error as NodeJS.ErrnoException).code, "ENOENT");
          return true;
        },
      );
      assert.ok(successor);
      const report = await successor;
      assert.equal(report.vehicles.length, 1);
      assert.equal(report.vehicles[0].id, "20051");
      assert.deepEqual(
        JSON.parse(readFileSync(join(stateDir, "report.json"), "utf8")),
        report,
      );
      assert.deepEqual(readdirSync(stateDir), ["report.json"]);
    } finally {
      replacement.mock.restore();
      syncBuiltinESMExports();
    }
  });
});

test(
  "simultaneous processes reclaim an orphan without admitting two producers",
  { timeout: 15000 },
  async () => {
    await withStateDirectory(async (stateDir) => {
      makeExpiredLock(stateDir);
      const auditorPath = fileURLToPath(
        new URL("../audit-vehicle-equipment.ts", import.meta.url),
      );
      const source = `
      const { runEquipmentAudit } = await import(process.argv[2]);
      const wait = (kind) => new Promise(resolve => {
        const receive = message => { if (message === kind) { process.off("message", receive); resolve(); } };
        process.on("message", receive);
      });
      const start = wait("start");
      process.send({ kind: "ready" });
      await start;
      try {
        await runEquipmentAudit({ stateDir: process.argv[3], loadStock: async () => {
          const finish = wait("finish");
          process.send({ kind: "loaded" });
          await finish;
          return [{ id: "12345", marca: "TEST", modelo: "VERSION", year: 2025, motor: "1.0", cambio: "AUTOMATICO", opcionais: [] }];
        }});
        process.send({ kind: "completed" });
      } catch (error) { process.send({ kind: "rejected", message: error.message }); }
      process.disconnect();
    `;
      const children = Array.from({ length: 3 }, () => {
        const child = spawn(
          process.execPath,
          [
            "--import",
            "tsx",
            "--input-type=module",
            "-e",
            source,
            "equipment-lock-test",
            auditorPath,
            stateDir,
          ],
          { stdio: ["ignore", "pipe", "pipe", "ipc"] },
        );
        let ready!: () => void;
        let attempted!: (kind: string) => void;
        const readyPromise = new Promise<void>((resolve) => {
          ready = resolve;
        });
        const attemptPromise = new Promise<string>((resolve) => {
          attempted = resolve;
        });
        const exitPromise = new Promise<number | null>((resolve) => {
          child.on("exit", resolve);
        });
        child.on("message", (message: { kind: string }) => {
          if (message.kind === "ready") ready();
          if (["loaded", "rejected"].includes(message.kind))
            attempted(message.kind);
        });
        return { child, readyPromise, attemptPromise, exitPromise };
      });
      try {
        await Promise.all(children.map((item) => item.readyPromise));
        for (const { child } of children) child.send("start");
        const attempts = await Promise.all(
          children.map((item) => item.attemptPromise),
        );
        assert.equal(attempts.filter((kind) => kind === "loaded").length, 1);
        for (let index = 0; index < children.length; index++) {
          if (attempts[index] === "loaded")
            children[index].child.send("finish");
        }
        assert.deepEqual(
          await Promise.all(children.map((item) => item.exitPromise)),
          [0, 0, 0],
        );
        assert.deepEqual(readdirSync(stateDir), ["report.json"]);
      } finally {
        for (const { child } of children)
          if (child.exitCode === null) child.kill("SIGKILL");
        await Promise.all(children.map((item) => item.exitPromise));
      }
    });
  },
);

test("stock fetch uses the fixed public endpoint and rejects redirects", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (url, init) => {
    calls += 1;
    assert.equal(url, EQUIPMENT_STOCK_URL);
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal instanceof AbortSignal);
    return new Response(JSON.stringify(apiResponse([apiVehicle()])), {
      headers: { "Content-Type": "application/json" },
    });
  };
  assert.equal((await fetchEquipmentStock(fetcher)).length, 1);
  assert.equal(calls, 1);
});

test("stock fetch retries are bounded and never return remote failure details", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    throw new Error("PRIVATE_REMOTE_TOKEN_SENTINEL");
  };
  await assert.rejects(fetchEquipmentStock(fetcher), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /3 tentativas/);
    assert.ok(!error.message.includes("PRIVATE_"));
    return true;
  });
  assert.equal(calls, 3);
});
