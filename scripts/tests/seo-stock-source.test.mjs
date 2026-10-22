import assert from "node:assert/strict";
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, test } from "node:test";
import { fetchCompleteSeoStock } from "../lib/seo-stock-source.js";

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function directory(previous) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "netcar-seo-source-")));
  roots.push(root);
  if (previous) {
    mkdirSync(join(root, "public", "seo"), { recursive: true });
    writeFileSync(
      join(root, "public", "seo", "stock-bootstrap.json"),
      JSON.stringify(previous),
    );
  }
  return root;
}

function vehicle(id, valor = 100000) {
  return { id, valor, marca: "MARCA", modelo: "MODELO", ano: 2025 };
}

function response(data, { status = 200, success = true, ...extra } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({
      success,
      data,
      total_results: data?.length,
      ...extra,
    }),
  };
}

function feed(pages, { terminal404 = false } = {}) {
  const offsets = [];
  const rows = pages.flat();
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    const offset = Number(parsed.searchParams.get("offset"));
    offsets.push(offset);
    let cursor = 0;
    for (const page of pages) {
      if (cursor === offset) return response(page);
      cursor += page.length;
    }
    assert.equal(offset, rows.length, "must advance by actual page length");
    return terminal404
      ? response([], {
          status: 404,
          success: false,
          message: "Nenhum carro encontrado",
        })
      : response([]);
  };
  return { offsets, fetchImpl };
}

test("accepts only stable complete inventory; server-capped short pages do not end pagination", async () => {
  const rootDir = directory();
  const remote = feed(
    [
      [vehicle(20019, 0)],
      [vehicle("20030", 75900)],
      [vehicle("20031", "89900.00")],
    ],
    { terminal404: true },
  );
  const accepted = await fetchCompleteSeoStock({
    rootDir,
    fetchImpl: remote.fetchImpl,
  });
  assert.equal(accepted.source, "api-complete");
  assert.equal(accepted.totalCount, 3);
  assert.equal(accepted.activeCount, 2);
  assert.equal(accepted.pages, 8);
  assert.deepEqual(remote.offsets, [0, 1, 2, 3, 0, 1, 2, 3]);
  assert.deepEqual(
    accepted.vehicles.map(({ id, valor }) => [id, valor]),
    [
      [20019, 0],
      ["20030", 75900],
      ["20031", "89900.00"],
    ],
  );
  assert.deepEqual(
    readdirSync(rootDir),
    [],
    "reader never writes raw feed or cache",
  );
});

test("projects public fields and retains original warranty/equipment data", async () => {
  const rootDir = directory();
  const source = {
    ...vehicle("1"),
    chassi: "9BWZZZ377VT004251",
    renavam: "private-registry",
    observacoes: "private-notes",
    opcionais: ["ar_condicionado"],
  };
  const accepted = await fetchCompleteSeoStock({
    rootDir,
    fetchImpl: feed([[source]]).fetchImpl,
  });
  const projected = accepted.vehicles[0];
  for (const field of ["chassi", "renavam", "observacoes"])
    assert.equal(field in projected, false);
  assert.deepEqual(projected.opcionais, source.opcionais);
  assert.ok(projected.factoryWarrantyVehicle);
  assert.equal(projected.factoryWarrantyVehicle.year, 2025);
  assert.equal(projected.factoryWarrantyVehicle.price, 100000);
  assert.match(projected.factoryWarrantyVehicle.unitKey, /^vin-sha256:/);
});

for (const bad of [
  undefined,
  null,
  "",
  " 100",
  "1.000,00",
  -1,
  NaN,
  Infinity,
  false,
]) {
  test(`rejects missing or invalid price (${String(bad)}) instead of treating it as sold`, async () => {
    await assert.rejects(
      fetchCompleteSeoStock({
        rootDir: directory(),
        fetchImpl: feed([[{ ...vehicle(1), valor: bad }]]).fetchImpl,
      }),
      /preço ausente ou inválido/,
    );
  });
}

test("rejects an omitted price", async () => {
  await assert.rejects(
    fetchCompleteSeoStock({
      rootDir: directory(),
      fetchImpl: feed([[{ id: 1 }]]).fetchImpl,
    }),
    /preço ausente ou inválido/,
  );
});

for (const id of [
  undefined,
  null,
  "",
  " 1",
  "01",
  1.5,
  Number.MAX_SAFE_INTEGER + 1,
]) {
  test(`rejects absent or ambiguous exact ID (${String(id)})`, async () => {
    await assert.rejects(
      fetchCompleteSeoStock({
        rootDir: directory(),
        fetchImpl: feed([[vehicle(id)]]).fetchImpl,
      }),
      /ID ausente ou inválido/,
    );
  });
}

test("rejects duplicate IDs within a page including numeric/string aliases", async () => {
  await assert.rejects(
    fetchCompleteSeoStock({
      rootDir: directory(),
      fetchImpl: feed([[vehicle(1), vehicle("1")]]).fetchImpl,
    }),
    /IDs duplicados/,
  );
});

test("rejects duplicate IDs across pages rather than silently truncating", async () => {
  await assert.rejects(
    fetchCompleteSeoStock({
      rootDir: directory(),
      fetchImpl: feed([[vehicle(1)], [vehicle(1)]]).fetchImpl,
    }),
    /IDs duplicados entre páginas/,
  );
});

test("rejects an empty first page, including the endpoint's normal no-results shape", async () => {
  for (const terminal of [
    response([]),
    response([], {
      status: 404,
      success: false,
      message: "Nenhum carro encontrado",
    }),
  ]) {
    await assert.rejects(
      fetchCompleteSeoStock({
        rootDir: directory(),
        fetchImpl: async () => terminal,
      }),
      /inválida ou vazia/,
    );
  }
});

test("zero active stock can never authorize removing every available offer", async () => {
  await assert.rejects(
    fetchCompleteSeoStock({
      rootDir: directory(),
      fetchImpl: feed([[vehicle(1, 0)]]).fetchImpl,
    }),
    /sem ofertas ativas/,
  );
});

test("a failed terminal request is not proof of completeness", async () => {
  let calls = 0;
  await assert.rejects(
    fetchCompleteSeoStock({
      rootDir: directory(),
      fetchImpl: async () =>
        ++calls === 1
          ? response([vehicle(1)])
          : response([], { status: 503, success: false }),
    }),
    /página 2 inválida/,
  );
});

test("an unrelated 404 is not a valid terminal response", async () => {
  let calls = 0;
  await assert.rejects(
    fetchCompleteSeoStock({
      rootDir: directory(),
      fetchImpl: async () =>
        ++calls === 1
          ? response([vehicle(1)])
          : response([], {
              status: 404,
              success: false,
              message: "upstream unavailable",
            }),
    }),
    /página 2 inválida/,
  );
});

test("rejects mismatched page counts even when JSON and HTTP appear valid", async () => {
  await assert.rejects(
    fetchCompleteSeoStock({
      rootDir: directory(),
      fetchImpl: async () => response([vehicle(1)], { total_results: 2 }),
    }),
    /resposta incompleta/,
  );
});

test("rejects malformed JSON without logging response contents", async () => {
  await assert.rejects(
    fetchCompleteSeoStock({
      rootDir: directory(),
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("sensitive response body");
        },
      }),
    }),
    (error) =>
      /falha de leitura/.test(error.message) &&
      !error.message.includes("sensitive"),
  );
});

test("detects price or availability changing during the complete scan", async () => {
  for (const changed of [[vehicle(1, 90000)], [vehicle(2)]]) {
    let pass = 0;
    const fetchImpl = async (url) => {
      if (Number(new URL(url).searchParams.get("offset")) > 0)
        return response([]);
      return response(++pass === 1 ? [vehicle(1)] : changed);
    };
    await assert.rejects(
      fetchCompleteSeoStock({ rootDir: directory(), fetchImpl }),
      /mudou durante a leitura/,
    );
  }
});

test("an incomplete or reduced inventory cannot overwrite the prior bootstrap", async () => {
  const previous = {
    vehicles: Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      price: 100000,
    })),
  };
  const rootDir = directory(previous);
  const file = join(rootDir, "public", "seo", "stock-bootstrap.json");
  const before = readFileSync(file, "utf8");
  await assert.rejects(
    fetchCompleteSeoStock({
      rootDir,
      fetchImpl: feed([
        Array.from({ length: 7 }, (_, index) => vehicle(index + 1)),
      ]).fetchImpl,
    }),
    /redução superior a 20%/,
  );
  assert.equal(readFileSync(file, "utf8"), before);
});

test("an active-stock collapse is rejected even when total count stays constant", async () => {
  const rootDir = directory({
    vehicles: Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      price: 100000,
    })),
  });
  await assert.rejects(
    fetchCompleteSeoStock({
      rootDir,
      fetchImpl: feed([
        Array.from({ length: 10 }, (_, index) =>
          vehicle(index + 1, index < 7 ? 100000 : 0),
        ),
      ]).fetchImpl,
    }),
    /redução superior a 20%/,
  );
});

test("a normal sold unit and missing ID remain distinguishable after a safe reduction", async () => {
  const rootDir = directory({
    vehicles: Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      price: 100000,
    })),
  });
  const accepted = await fetchCompleteSeoStock({
    rootDir,
    fetchImpl: feed([
      Array.from({ length: 9 }, (_, index) =>
        vehicle(index + 1, index === 0 ? 0 : 100000),
      ),
    ]).fetchImpl,
  });
  assert.equal(accepted.activeCount, 8);
  assert.equal(accepted.vehicles.find(({ id }) => id === 1).valor, 0);
  assert.equal(
    accepted.vehicles.some(({ id }) => id === 10),
    false,
  );
});

test("rejects filtered API URLs which cannot prove availability for every ID", async () => {
  await assert.rejects(
    fetchCompleteSeoStock({
      rootDir: directory(),
      apiUrl: "https://example.test/veiculos.php?marca=NISSAN",
      fetchImpl: async () => {
        assert.fail("filtered feed must not be fetched");
      },
    }),
    /feed com filtros/,
  );
});

test("repeat accepted reads produce identical public vehicles", async () => {
  const rootDir = directory();
  const fetchImpl = feed([[vehicle(1, 110000), vehicle(2, 0)]]).fetchImpl;
  const first = await fetchCompleteSeoStock({ rootDir, fetchImpl });
  const second = await fetchCompleteSeoStock({ rootDir, fetchImpl });
  assert.deepEqual(second, first);
});

function generatorFixture() {
  const rootDir = directory({ vehicles: [{ id: "1", price: 100000 }] });
  const project = fileURLToPath(new URL("../../", import.meta.url));
  for (const relative of [
    "scripts/generate-landings.js",
    "scripts/lib/seo-stock-source.js",
    "scripts/lib/seo-stock-cache.js",
    "scripts/lib/factory-warranty-catalog.js",
    "src/lib/factoryWarrantyCatalog.js",
    "src/lib/landingStockCopy.mjs",
  ]) {
    const target = join(rootDir, relative);
    mkdirSync(join(target, ".."), { recursive: true });
    cpSync(join(project, relative), target);
  }
  symlinkSync(
    join(project, "node_modules"),
    join(rootDir, "node_modules"),
    "dir",
  );
  writeFileSync(
    join(rootDir, "package.json"),
    JSON.stringify({ type: "module" }),
  );
  mkdirSync(join(rootDir, "src", "data", "seo"), { recursive: true });
  mkdirSync(join(rootDir, ".devops"), { recursive: true });
  const output = join(rootDir, "src", "data", "seo", "landings.json");
  writeFileSync(output, "previous published landings\n");
  return { rootDir, output };
}

function runLandings(rootDir, env = {}) {
  return spawnSync(
    process.execPath,
    [join(rootDir, "scripts", "generate-landings.js")],
    {
      cwd: rootDir,
      encoding: "utf8",
      env: {
        ...process.env,
        NETCAR_SEO_STOCK_API_URL: "invalid-url",
        NETCAR_REUSE_SEO_BUILD_STOCK: "0",
        ...env,
      },
    },
  );
}

test("generator feed failure preserves published output even when fresh fallback caches exist", () => {
  const { rootDir, output } = generatorFixture();
  const cached = {
    generatedAt: new Date().toISOString(),
    vehicles: [vehicle("1")],
  };
  const cacheFile = join(rootDir, ".devops", "seo-stock-cache.json");
  writeFileSync(cacheFile, JSON.stringify(cached));
  const before = readFileSync(cacheFile, "utf8");
  const result = runLandings(rootDir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /URL do feed inválida/);
  assert.equal(readFileSync(output, "utf8"), "previous published landings\n");
  assert.equal(
    readFileSync(cacheFile, "utf8"),
    before,
    "failure must not renew old cache",
  );
});

test("explicit snapshot reuse requires complete provenance and refuses expiry without a network refresh", () => {
  for (const metadata of [
    { source: "versioned-bootstrap", createdAt: new Date().toISOString() },
    {
      source: "api-complete",
      createdAt: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
    },
  ]) {
    const { rootDir, output } = generatorFixture();
    writeFileSync(
      join(rootDir, ".devops", "seo-build-stock.json"),
      JSON.stringify({ ...metadata, vehicles: [vehicle("1")] }),
    );
    const result = runLandings(rootDir, { NETCAR_REUSE_SEO_BUILD_STOCK: "1" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /snapshot completo.*ausente ou expirado/);
    assert.doesNotMatch(result.stderr, /URL do feed inválida/);
    assert.equal(readFileSync(output, "utf8"), "previous published landings\n");
  }
});

test("accepted frozen snapshot rebuilds deterministically without changing its original timestamp", () => {
  const { rootDir, output } = generatorFixture();
  const snapshotFile = join(rootDir, ".devops", "seo-build-stock.json");
  const snapshot = JSON.stringify({
    source: "api-complete",
    createdAt: new Date().toISOString(),
    vehicles: [vehicle("1")],
  });
  writeFileSync(snapshotFile, snapshot);
  const first = runLandings(rootDir, { NETCAR_REUSE_SEO_BUILD_STOCK: "1" });
  assert.equal(first.status, 0, first.stderr);
  const generated = readFileSync(output, "utf8");
  assert.ok(JSON.parse(generated).length > 0);
  const second = runLandings(rootDir, { NETCAR_REUSE_SEO_BUILD_STOCK: "1" });
  assert.equal(second.status, 0, second.stderr);
  assert.equal(readFileSync(output, "utf8"), generated);
  assert.equal(readFileSync(snapshotFile, "utf8"), snapshot);
});
