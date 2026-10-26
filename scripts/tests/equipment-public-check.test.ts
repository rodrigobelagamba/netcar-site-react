import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  fetchPublicCheckApi,
  runPublicEquipmentCheck,
  type PublicCheckApi,
} from "../audit-equipment-public";
import {
  changedPublicVehicleIds,
  comparePublicEquipment,
  expectedPublicEquipment,
  publicCheckDue,
  publicCheckPeriod,
  xmlApiDifferences,
  type PublicCheckState,
  type PublicEquipmentObservation,
} from "../lib/equipmentPublicCheck";
import type {
  ReviewSnapshot,
  ReviewStockVehicle,
} from "../lib/equipmentReview";

const fixture = JSON.parse(
  readFileSync(
    new URL(
      "../fixtures/vehicle-equipment-description-stock.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const instant = "2026-10-13T20:00:00.000Z";
function vehicle(id = "19687"): ReviewStockVehicle {
  const row = fixture.vehicles.find((v: { id: string }) => v.id === id);
  assert.ok(row);
  return {
    id: row.id,
    brand: row.marca,
    model: row.modelo,
    manufactureYear: row.anoFabricacao,
    modelYear: row.year,
    physicalIdentityKey: row.physicalIdentityKey ?? null,
    engine: row.motor,
    transmission: row.cambio,
    market: null,
    seats: "",
    options: row.opcionais.map((o: { tag: string; descricao: string }) => ({
      tag: o.tag,
      descricao: o.descricao,
    })),
    xml: {
      identity: {
        id: row.id,
        brand: row.marca,
        model: row.modelo,
        manufactureYear: row.anoFabricacao,
        modelYear: row.year,
        engine: row.motor,
        transmission: row.cambio,
      },
      flags: Object.fromEntries(
        row.opcionais.map((o: { tag: string }) => [o.tag, true]),
      ),
    },
  };
}
function stock(v = vehicle()): ReviewSnapshot {
  return { schemaVersion: 1, observedAt: instant, vehicles: [v] };
}
function observation(v = vehicle(), fuel = "FLEX"): PublicEquipmentObservation {
  const expected = expectedPublicEquipment(v, fuel);
  return {
    ...expected,
    observedAt: instant,
    descriptionText: `Descrição do veículo\n${expected.descriptionText}\nLer menos`,
    highlights: expected.highlights.map((h) => ({
      ...h,
      category: h.category.toUpperCase(),
    })),
    servedAssets: ["/assets/DetalhesPage-test.js"],
  };
}
function previousState(): PublicCheckState {
  return {
    schemaVersion: 1,
    lastAttempt: "2026-10-05T12:00:00.000Z",
    lastSuccess: "2026-10-05T12:02:00.000Z",
    period: "2026-10-05",
    status: "succeeded",
    error: null,
    nextRun: "2026-10-12T12:00:00.000Z",
  };
}
function setup() {
  const stateDir = mkdtempSync(join(tmpdir(), "netcar-public-audit-test-"));
  const snapshot = stock();
  const api: PublicCheckApi = { snapshot, fuels: { "19687": "FLEX" } };
  let closed = 0;
  return {
    stateDir,
    snapshot,
    api,
    closed: () => closed,
    options: {
      stateDir,
      now: () => new Date(instant),
      loadBaseline: () => structuredClone(snapshot),
      loadSnapshot: async () => structuredClone(snapshot),
      loadApi: async () => structuredClone(api),
      createBrowser: async () => ({
        observe: async () => observation(),
        close: async () => {
          closed++;
        },
      }),
    },
    cleanup: () => rmSync(stateDir, { recursive: true, force: true }),
  };
}

test("weekly period begins Monday 09:00 São Paulo, catches up later, and avoids daily restart duplication", () => {
  assert.deepEqual(publicCheckPeriod(new Date("2026-10-12T11:59:59Z")), {
    period: "2026-10-05",
    nextRun: "2026-10-12T12:00:00.000Z",
  });
  assert.equal(
    publicCheckDue(previousState(), new Date("2026-10-12T11:59:59Z")),
    false,
  );
  assert.equal(
    publicCheckDue(previousState(), new Date("2026-10-12T12:00:00Z")),
    true,
  );
  assert.equal(
    publicCheckPeriod(new Date("2026-10-18T23:59:59Z")).period,
    "2026-10-12",
  );
  assert.equal(
    publicCheckPeriod(new Date("2026-10-19T12:00:00Z")).period,
    "2026-10-19",
  );
  const crashed = {
    ...previousState(),
    period: "2026-10-12",
    status: "running" as const,
  };
  assert.equal(publicCheckDue(crashed, new Date(instant)), false);
  assert.equal(publicCheckDue(crashed, new Date(instant), true), true);
});

test("matching equipment alone cannot hide renewed unsupported announcement prose", () => {
  const current = observation();
  assert.equal(
    comparePublicEquipment(vehicle(), "FLEX", current).status,
    "passed",
  );
  current.descriptionText +=
    " Suspensão independente e câmbio manual de cinco marchas.";
  const result = comparePublicEquipment(vehicle(), "FLEX", current);
  assert.equal(result.status, "divergent");
  assert.deepEqual(result.differences, [
    "Descrição pública difere dos campos do cadastro e dos equipamentos revisados.",
  ]);
});

test("a matching public page confirms source consistency, never physical equipment or factory configuration", () => {
  const candidate: ReviewStockVehicle = {
    id: "99997", brand: "HONDA", model: "HRV EX", manufactureYear: 2017,
    modelYear: 2017, physicalIdentityKey: null, engine: "1.8", transmission: "AUTOMATICO",
    market: "BR", seats: "", options: [{ tag: "chave_inteligente", descricao: "Chave Inteligente Keyless" }],
  };
  const addXml = (v: ReviewStockVehicle) => {
    v.xml = { identity: { id: v.id, brand: v.brand, model: v.model,
      manufactureYear: v.manufactureYear, modelYear: v.modelYear, engine: v.engine, transmission: v.transmission },
      flags: { chave_inteligente: true } };
  };
  addXml(candidate);
  const unknown = comparePublicEquipment(candidate, "FLEX", observation(candidate));
  assert.equal(unknown.status, "passed");
  assert.equal(unknown.verification?.factoryConflicts, 0);
  assert.equal(unknown.verification?.sensitiveReviewRequired, 1);
  const held = { ...candidate, id: "19739", modelYear: 2018, manufactureYear: 2018, inventoryStatus: "sold" as const };
  addXml(held);
  const checked = comparePublicEquipment(held, "FLEX", observation(held));
  assert.equal(checked.status, "passed", "DOM must reflect the resolver's suppression");
  assert.equal(checked.inventoryStatus, "sold");
  assert.equal(checked.verification?.factoryConflicts, 1, "A hidden claim remains a review finding");
});

test("a sold unit still receives a rendered public check without entering active research", async () => {
  const env = setup();
  try {
    env.snapshot.vehicles[0].inventoryStatus = "sold";
    const result = await runPublicEquipmentCheck({
      ...env.options,
      createBrowser: async () => ({
        observe: async (id) => { assert.equal(id, "19687"); return observation(env.snapshot.vehicles[0]); },
        close: async () => {},
      }),
    });
    assert.equal(result.report?.scope, "public-source-consistency");
    assert.equal(result.report?.vehicles[0].inventoryStatus, "sold");
    assert.equal(result.report?.counts.passed, 1);
  } finally { env.cleanup(); }
});

test("published unit confirmations, Park Assist exclusion and Nivus correction remain authoritative", () => {
  for (const id of ["20075", "19788"]) {
    const v = vehicle(id);
    const expected = expectedPublicEquipment(v, "FLEX");
    assert.equal(
      comparePublicEquipment(v, "FLEX", observation(v)).status,
      "passed",
    );
    assert.ok(
      expected.descriptionText.includes("Câmbio automático de 6 velocidades"),
    );
    if (id === "20075") {
      assert.ok(
        expected.equipmentNames.includes("Assistente de partida em rampa"),
      );
      assert.ok(expected.equipmentNames.includes("Indicador de fadiga"));
      assert.ok(!expected.equipmentNames.includes("Park Assist"));
      const rebound = { ...v, physicalIdentityKey: "0".repeat(64) };
      assert.equal(
        comparePublicEquipment(rebound, "FLEX", observation(v)).status,
        "divergent",
      );
    }
  }
});

test("card benefits, duplicate labels and XML/API contradictions are independently checked", () => {
  const current = observation(vehicle("20075"));
  current.highlights[0].benefit += " Inventado.";
  current.equipmentNames.push(current.equipmentNames[0]);
  const result = comparePublicEquipment(vehicle("20075"), "FLEX", current);
  assert.equal(result.status, "divergent");
  assert.ok(result.differences.some((v) => v.includes("repetido")));
  assert.ok(result.differences.some((v) => v.includes("benefício")));
  const contradicted = vehicle();
  contradicted.xml!.flags.ar_condicionado = false;
  assert.ok(
    xmlApiDifferences(contradicted).some((v) =>
      v.includes("sem marcação positiva"),
    ),
  );
  contradicted.xml!.flags.manual_chave_reserva = true;
  assert.ok(
    !xmlApiDifferences(contradicted).some((v) => /manual|chave/i.test(v)),
  );
});

test("fuel and physical identity changes invalidate stale proof even with identical optional labels", () => {
  const before = stock();
  const after = structuredClone(before);
  assert.deepEqual(
    [
      ...changedPublicVehicleIds(before, { "19687": "FLEX" }, after, {
        "19687": "GASOLINA",
      }),
    ],
    ["19687"],
  );
  after.vehicles[0].physicalIdentityKey = "f".repeat(64);
  assert.deepEqual(
    [...changedPublicVehicleIds(before, {}, after, {})],
    ["19687"],
  );
  const sold = structuredClone(before);
  sold.vehicles[0].inventoryStatus = "sold";
  assert.deepEqual([...changedPublicVehicleIds(before, {}, sold, {})], ["19687"]);
});

test("the API model TURBO suffix is equivalent only with its explicit positive XML flag", () => {
  const current = vehicle();
  current.model += " TURBO";
  current.xml!.flags.motor_turbo = true;
  current.options.push({ tag: "motor_turbo", descricao: "Motor Turbo" });
  assert.deepEqual(xmlApiDifferences(current), []);
  current.xml!.flags.motor_turbo = false;
  assert.ok(xmlApiDifferences(current).some((v) => v.includes("Campo modelo")));
  current.xml!.flags.motor_turbo = true;
  current.model += " PLUS";
  assert.ok(xmlApiDifferences(current).some((v) => v.includes("Campo modelo")));
});

test("complete result is private and weekly deduplication skips all network/browser work unless forced", async () => {
  const env = setup();
  try {
    const first = await runPublicEquipmentCheck(env.options);
    assert.equal(first.state?.status, "succeeded");
    assert.equal(first.report?.counts.passed, 1);
    assert.equal(env.closed(), 1);
    assert.equal(statSync(env.stateDir).mode & 0o777, 0o700);
    assert.equal(
      statSync(join(env.stateDir, "public-check-report.json")).mode & 0o777,
      0o600,
    );
    const skipped = await runPublicEquipmentCheck({
      ...env.options,
      loadBaseline: () => {
        throw new Error("must not read");
      },
    });
    assert.equal(skipped.skipped, true);
    const forced = await runPublicEquipmentCheck({
      ...env.options,
      force: true,
    });
    assert.equal(forced.skipped, false);
    assert.equal(env.closed(), 2);
  } finally {
    env.cleanup();
  }
});

test("source change during DOM inspection is inconclusive and preserves last complete report", async () => {
  const env = setup();
  try {
    await runPublicEquipmentCheck(env.options);
    const before = readFileSync(
      join(env.stateDir, "public-check-report.json"),
      "utf8",
    );
    const final = structuredClone(env.snapshot);
    final.vehicles[0].xml!.flags.ar_condicionado = false;
    const result = await runPublicEquipmentCheck({
      ...env.options,
      force: true,
      loadSnapshot: async () => final,
    });
    assert.equal(result.state?.status, "failed");
    assert.equal(result.report?.counts.inconclusive, 1);
    assert.equal(
      readFileSync(join(env.stateDir, "public-check-report.json"), "utf8"),
      before,
    );
    assert.equal(result.state?.lastSuccess, instant);
    assert.ok(
      readFileSync(
        join(env.stateDir, "public-check-partial.json"),
        "utf8",
      ).includes("mudou durante"),
    );
  } finally {
    env.cleanup();
  }
});

test("new or sold inventory is not mislabeled as absent physical equipment", async () => {
  const env = setup();
  try {
    const final = stock(vehicle("19653"));
    const result = await runPublicEquipmentCheck({
      ...env.options,
      loadSnapshot: async () => final,
    });
    assert.equal(result.report?.counts.inconclusive, 2);
    assert.deepEqual(result.report?.vehicles.map((v) => v.vehicleId).sort(), [
      "19653",
      "19687",
    ]);
    assert.ok(
      result.report?.vehicles.every((v) => v.status === "inconclusive"),
    );
  } finally {
    env.cleanup();
  }
});

test("browser/network failures never overwrite last complete report or expose exception contents", async () => {
  const env = setup();
  try {
    writeFileSync(
      join(env.stateDir, "public-check-report.json"),
      "existing-proof",
      { mode: 0o600 },
    );
    await assert.rejects(
      runPublicEquipmentCheck({
        ...env.options,
        createBrowser: async () => {
          throw new Error("PRIVATE unexpected secret");
        },
      }),
      /não concluída/,
    );
    assert.equal(
      readFileSync(join(env.stateDir, "public-check-report.json"), "utf8"),
      "existing-proof",
    );
    const state = JSON.parse(
      readFileSync(join(env.stateDir, "public-check-state.json"), "utf8"),
    );
    assert.equal(state.status, "failed");
    assert.equal(state.lastSuccess, null);
    assert.ok(!JSON.stringify(state).includes("PRIVATE"));
    assert.equal((await runPublicEquipmentCheck(env.options)).skipped, true);
  } finally {
    env.cleanup();
  }
});

test("a vehicle appearing only in the final supplementary API remains inconclusive in coverage", async () => {
  const env = setup();
  let apiReads = 0;
  try {
    const result = await runPublicEquipmentCheck({
      ...env.options,
      loadApi: async () => {
        const api = structuredClone(env.api);
        if (++apiReads > 1) {
          api.snapshot.vehicles.push(vehicle("19653"));
          api.fuels["19653"] = "FLEX";
        }
        return api;
      },
    });
    assert.equal(result.report?.counts.vehicles, 2);
    assert.equal(result.report?.counts.inconclusive, 1);
    assert.equal(
      result.report?.vehicles.find((v) => v.vehicleId === "19653")?.status,
      "inconclusive",
    );
  } finally {
    env.cleanup();
  }
});

test("concurrent CLI attempts cannot acquire a running owner's state lock", async () => {
  const env = setup();
  let finish: (value: PublicEquipmentObservation) => void;
  let started: () => void;
  const observed = new Promise<void>((resolve) => {
    started = resolve;
  });
  const pending = new Promise<PublicEquipmentObservation>((resolve) => {
    finish = resolve;
  });
  const first = runPublicEquipmentCheck({
    ...env.options,
    createBrowser: async () => ({
      observe: async () => {
        started!();
        return pending;
      },
      close: async () => undefined,
    }),
  });
  try {
    await observed;
    await assert.rejects(
      runPublicEquipmentCheck({ ...env.options, force: true }),
      /Já existe conferência pública/,
    );
    finish!(observation());
    assert.equal((await first).state?.status, "succeeded");
  } finally {
    finish!(observation());
    await first;
    env.cleanup();
  }
});

test("seats or market changing only in the final supplementary API invalidate the result", async () => {
  for (const change of [{ seats: "7" }, { market: "BR" }]) {
    const env = setup();
    let apiReads = 0;
    try {
      await runPublicEquipmentCheck(env.options);
      const complete = readFileSync(
        join(env.stateDir, "public-check-report.json"),
        "utf8",
      );
      const result = await runPublicEquipmentCheck({
        ...env.options,
        force: true,
        loadApi: async () => {
          const api = structuredClone(env.api);
          // This last API response follows the unchanged final XML/API pair.
          if (++apiReads > 1) Object.assign(api.snapshot.vehicles[0], change);
          return api;
        },
      });
      assert.equal(result.report?.counts.passed, 0);
      assert.equal(result.report?.counts.inconclusive, 1);
      assert.equal(result.state?.status, "failed");
      assert.equal(result.state?.lastSuccess, instant);
      assert.match(result.report!.vehicles[0].differences[0], /mudou durante/);
      assert.equal(
        readFileSync(join(env.stateDir, "public-check-report.json"), "utf8"),
        complete,
      );
    } finally {
      env.cleanup();
    }
  }
});

test("global deadline closes the browser and retains complete proof", async () => {
  const env = setup();
  let closed = 0;
  try {
    await assert.rejects(
      runPublicEquipmentCheck({
        ...env.options,
        timeoutMs: 20,
        createBrowser: async () => ({
          observe: async () =>
            new Promise<PublicEquipmentObservation>(() => undefined),
          close: async () => {
            closed++;
          },
        }),
      }),
      /não concluída/,
    );
    assert.ok(closed >= 1);
    assert.equal(
      JSON.parse(
        readFileSync(join(env.stateDir, "public-check-state.json"), "utf8"),
      ).status,
      "failed",
    );
  } finally {
    env.cleanup();
  }
});

test("API supplement uses fixed HTTPS GET without redirects and retains only allowed fields", async () => {
  const raw = {
    success: true,
    total_results: 2,
    data: [
      {
        id: 19687,
        marca: "FIAT",
        modelo: "ARGO DRIVE",
        ano: 2024,
        ano_fabricacao: 2023,
        motor: "1.3",
        cambio: "AUTOMATICO",
        combustivel: "FLEX",
        valor: 1000,
        placa: "PRIVATE",
        contato: "PRIVATE",
        opcionais: [],
      },
      { id: 19739, marca: "HONDA", modelo: "HRV EX", ano: 2018, ano_fabricacao: 2018,
        motor: "1.8", cambio: "AUTOMATICO", combustivel: "FLEX", valor: 0, opcionais: [], placa: "PRIVATE" },
    ],
  };
  const fetched = await fetchPublicCheckApi((async (url, init) => {
    assert.equal(
      String(url),
      "https://www.netcarmultimarcas.com.br/api/v1/veiculos.php?limit=500",
    );
    assert.equal(init?.redirect, "error");
    assert.ok(!init?.method || init.method === "GET");
    return new Response(JSON.stringify(raw), { status: 200 });
  }) as typeof fetch);
  assert.equal(fetched.fuels["19687"], "FLEX");
  assert.ok(!JSON.stringify(fetched).includes("PRIVATE"));
  assert.equal(fetched.snapshot.vehicles.length, 2);
  assert.equal(fetched.snapshot.vehicles.find((row) => row.id === "19739")?.inventoryStatus, "sold");
});

test("a browser launch completing after the deadline is closed without observing a vehicle", async () => {
  const env = setup();
  let completeLaunch: (browser: {
    observe: () => Promise<PublicEquipmentObservation>;
    close: () => Promise<void>;
  }) => void;
  let closed = 0;
  let observed = 0;
  try {
    const pending = new Promise<{
      observe: () => Promise<PublicEquipmentObservation>;
      close: () => Promise<void>;
    }>((resolve) => {
      completeLaunch = resolve;
    });
    await assert.rejects(
      runPublicEquipmentCheck({
        ...env.options,
        timeoutMs: 20,
        createBrowser: () => pending,
      }),
      /não concluída/,
    );
    completeLaunch!({
      observe: async () => {
        observed++;
        return observation();
      },
      close: async () => {
        closed++;
      },
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(closed, 1);
    assert.equal(observed, 0);
  } finally {
    env.cleanup();
  }
});

test("a failed attempt in this week does not fail later daily CLI runs that skip the weekly stage", () => {
  const env = setup();
  try {
    const state = {
      ...previousState(),
      ...publicCheckPeriod(new Date()),
      status: "failed",
      error: "Última conferência não concluída.",
    };
    writeFileSync(
      join(env.stateDir, "public-check-state.json"),
      JSON.stringify(state),
      { mode: 0o600 },
    );
    const output = execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        fileURLToPath(new URL("../audit-equipment-public.ts", import.meta.url)),
        "--state-dir",
        env.stateDir,
      ],
      { encoding: "utf8", timeout: 5000 },
    );
    assert.match(output, /já tentada neste período/);
    assert.equal(
      JSON.parse(
        readFileSync(join(env.stateDir, "public-check-state.json"), "utf8"),
      ).status,
      "failed",
    );
  } finally {
    env.cleanup();
  }
});
