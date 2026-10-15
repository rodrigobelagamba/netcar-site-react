import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import {
  getDefaultAutoSelectFamily,
  getDefaultAutoSelectFamilyAttemptTimeout,
  setDefaultAutoSelectFamilyAttemptTimeout,
} from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, test } from "node:test";
import {
  configureSeoStockNetwork,
  fetchCompleteSeoStock,
} from "../lib/seo-stock-source.js";

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
const directory = () => {
  const root = mkdtempSync(join(tmpdir(), "netcar-offer-network-"));
  roots.push(root);
  return root;
};
const row = { id: "20000", valor: 100000 };
const page = (data) => ({
  ok: true,
  status: 200,
  json: async () => ({ success: true, total_results: data.length, data }),
});
const liveResponse = (url) =>
  page(Number(new URL(url).searchParams.get("offset")) === 0 ? [row] : []);
const transportError = (code) =>
  new TypeError("private https://secret@example.invalid", {
    cause: new AggregateError([
      Object.assign(new Error("private transport"), { code }),
    ]),
  });

test("bounded transport retry succeeds without accepting partial data or changing the two-pass contract", async () => {
  const calls = [];
  const signals = [];
  const delays = [];
  const rootDir = directory();
  const accepted = await fetchCompleteSeoStock({
    rootDir,
    retryDelay: async (ms) => delays.push(ms),
    fetchImpl: async (url, options) => {
      calls.push(Number(new URL(url).searchParams.get("offset")));
      signals.push(options.signal);
      if (calls.length <= 2) throw transportError("ETIMEDOUT");
      return liveResponse(url);
    },
  });
  assert.deepEqual(calls, [0, 0, 0, 1, 0, 1]);
  assert.deepEqual(delays, [1000, 2000]);
  assert.equal(
    new Set(signals).size,
    6,
    "each attempt has its own request deadline",
  );
  assert.equal(accepted.activeCount, 1);
  assert.equal(accepted.pages, 4);
  assert.deepEqual(readdirSync(rootDir), []);
});

test("transport exhaustion stops after three attempts and only emits allowlisted diagnostic data", async () => {
  let calls = 0;
  const delays = [];
  const rootDir = directory();
  await assert.rejects(
    fetchCompleteSeoStock({
      rootDir,
      retryDelay: async (ms) => delays.push(ms),
      fetchImpl: async () => {
        calls++;
        throw transportError("ECONNRESET");
      },
    }),
    (error) => {
      assert.equal(error.code, "seo_stock_ECONNRESET");
      assert.equal(error.page, 1);
      assert.equal(error.attempts, 3);
      assert.doesNotMatch(error.stack, /private|secret|example\.invalid/);
      return true;
    },
  );
  assert.equal(calls, 3);
  assert.deepEqual(delays, [1000, 2000]);
  assert.deepEqual(readdirSync(rootDir), []);
});

for (const [name, result] of [
  [
    "TLS certificate failure",
    () => {
      throw transportError("CERT_HAS_EXPIRED");
    },
  ],
  [
    "mixed TLS and transport failure",
    () => {
      throw new AggregateError([
        transportError("ECONNRESET"),
        transportError("ERR_TLS_CERT_ALTNAME_INVALID"),
      ]);
    },
  ],
  [
    "TLS in truncated ninth aggregate entry",
    () => {
      throw new AggregateError([
        ...Array.from({ length: 8 }, () => transportError("ECONNRESET")),
        transportError("CERT_HAS_EXPIRED"),
      ]);
    },
  ],
  [
    "unknown in truncated ninth aggregate entry",
    () => {
      throw new AggregateError([
        ...Array.from({ length: 8 }, () => transportError("ECONNRESET")),
        new Error("private unknown"),
      ]);
    },
  ],
  [
    "unclassified aggregate leaf",
    () => {
      throw new AggregateError([
        transportError("ECONNRESET"),
        new Error("private unknown"),
      ]);
    },
  ],
  [
    "cyclic transport cause",
    () => {
      const error = Object.assign(new Error("private cycle"), {
        code: "ECONNRESET",
      });
      error.cause = error;
      throw error;
    },
  ],
  [
    "error graph exceeds diagnostic bound",
    () => {
      let error = transportError("CERT_HAS_EXPIRED");
      for (let index = 0; index < 20; index++)
        error = Object.assign(new Error("private nested", { cause: error }), {
          code: "ECONNRESET",
        });
      throw error;
    },
  ],
  [
    "unknown error",
    () => {
      throw new Error("private response");
    },
  ],
  [
    "null thrown value",
    () => {
      throw null;
    },
  ],
  [
    "invalid JSON",
    () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("private JSON body");
      },
    }),
  ],
  [
    "HTTP 503",
    () => ({
      ok: false,
      status: 503,
      json: async () => {
        assert.fail("HTTP error body must not be parsed");
      },
    }),
  ],
  [
    "schema error",
    () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: [row], total_results: 2 }),
    }),
  ],
  ["missing price", () => page([{ id: "20000" }])],
]) {
  test(`${name} fails immediately without transport retries`, async () => {
    let calls = 0;
    await assert.rejects(
      fetchCompleteSeoStock({
        rootDir: directory(),
        retryDelay: async () => assert.fail("must not retry"),
        fetchImpl: async () => {
          calls++;
          return result();
        },
      }),
      (error) => {
        assert.doesNotMatch(error.stack, /private|secret|example\.invalid/);
        return true;
      },
    );
    assert.equal(calls, 1);
  });
}

test("connection policy preserves both families and TLS, and never lowers an existing higher timeout", () => {
  const previous = getDefaultAutoSelectFamilyAttemptTimeout();
  const family = getDefaultAutoSelectFamily();
  const tls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  try {
    for (const initial of [250, 5000]) {
      setDefaultAutoSelectFamilyAttemptTimeout(initial);
      configureSeoStockNetwork();
      assert.equal(
        getDefaultAutoSelectFamilyAttemptTimeout(),
        Math.max(initial, 2000),
      );
      assert.equal(getDefaultAutoSelectFamily(), family);
      assert.equal(process.env.NODE_TLS_REJECT_UNAUTHORIZED, tls);
    }
  } finally {
    setDefaultAutoSelectFamilyAttemptTimeout(previous);
  }
});

test("importing the reader and reusable runner/reconciler/auditor has no network configuration side effects", () => {
  const imports = [
    "../lib/seo-stock-source.js",
    "../reconcile-offers.mjs",
    "../run-offer-reconciliation.mjs",
    "../validate-offer-consistency.mjs",
  ].map((path) => new URL(path, import.meta.url).href);
  const code = `import assert from 'node:assert/strict'; import net from 'node:net';
    net.setDefaultAutoSelectFamilyAttemptTimeout(250);
    const family = net.getDefaultAutoSelectFamily(); const tls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    for (const path of ${JSON.stringify(imports)}) await import(path);
    assert.equal(net.getDefaultAutoSelectFamilyAttemptTimeout(), 250);
    assert.equal(net.getDefaultAutoSelectFamily(), family);
    assert.equal(process.env.NODE_TLS_REJECT_UNAUTHORIZED, tls);`;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", code],
    { encoding: "utf8", timeout: 10000 },
  );
  assert.equal(result.status, 0, result.stderr);
});

for (const cli of [
  "generate-landings.js",
  "generate-seo-assets.js",
  "reconcile-offers.mjs",
  "run-offer-reconciliation.mjs",
  "validate-offer-consistency.mjs",
]) {
  test(`${cli} explicitly applies connection policy before its CLI work`, () => {
    // Stop inside the setter, before any CLI work or network IO. This exercises
    // the actual entrypoint without touching project snapshots/build outputs.
    const preload = `import assert from 'node:assert/strict'; import net from 'node:net'; import {syncBuiltinESMExports} from 'node:module';
      net.setDefaultAutoSelectFamilyAttemptTimeout(250);
      const family = net.getDefaultAutoSelectFamily(); const tls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      net.setDefaultAutoSelectFamilyAttemptTimeout = (timeout) => {
        assert.equal(timeout, 2000); assert.equal(net.getDefaultAutoSelectFamily(), family);
        assert.equal(process.env.NODE_TLS_REJECT_UNAUTHORIZED, tls);
        process.stdout.write('network_policy_applied\\n'); throw new Error('test_stop_before_cli_work');
      }; syncBuiltinESMExports();
      globalThis.fetch = () => { throw new Error('unexpected_fetch_before_policy'); };`;
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        `data:text/javascript,${encodeURIComponent(preload)}`,
        fileURLToPath(new URL(`../${cli}`, import.meta.url)),
      ],
      { encoding: "utf8", timeout: 10000 },
    );
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "network_policy_applied\n");
    assert.match(result.stderr, /test_stop_before_cli_work/);
    assert.doesNotMatch(
      result.stderr,
      /\n(?:AssertionError|Error: unexpected_fetch_before_policy)/,
    );
  });
}

test("retry attempts retain the 20-second deadline", () => {
  const moduleUrl = new URL("../lib/seo-stock-source.js", import.meta.url).href;
  const rootDir = directory();
  const code = `import assert from 'node:assert/strict';
    const {fetchCompleteSeoStock} = await import(${JSON.stringify(moduleUrl)});
    let requests=0, deadlines=0; const timeout=AbortSignal.timeout.bind(AbortSignal);
    AbortSignal.timeout=(ms)=>{assert.equal(ms,20000);deadlines++;return timeout(ms);};
    await assert.rejects(fetchCompleteSeoStock({rootDir:${JSON.stringify(rootDir)},retryDelay:async()=>{},fetchImpl:async()=>{requests++;throw Object.assign(new Error('synthetic'),{code:'ETIMEDOUT'});}}));
    assert.equal(requests,3);assert.equal(deadlines,3);`;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", code],
    { encoding: "utf8", timeout: 10000 },
  );
  assert.equal(result.status, 0, result.stderr);
});
