import { test } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  fetchInventory,
  syncMetadata,
  synchronizationDiagnostic,
} from "../sync-icheck-metadata.mjs";

const singleVehicle = { id: "19932", placa: "JBT8I78" };
const inventoryResponse = (data = [singleVehicle], extra = {}) =>
  Response.json({
    success: true,
    data,
    total: data.length,
    total_results: data.length,
    ...extra,
  });
const transportError = (code = "ECONNRESET") =>
  new TypeError("fetch failed", { cause: { code } });
const interruptedBody = () =>
  new Response(
    new ReadableStream({
      start(controller) {
        controller.error(
          new TypeError("terminated", { cause: { code: "UND_ERR_SOCKET" } }),
        );
      },
    }),
  );

function errorResponse(status, events) {
  return new Response(
    new ReadableStream({
      cancel() {
        events.push(`cancel:${status}`);
      },
    }),
    { status },
  );
}

async function rejectionOf(operation) {
  try {
    await operation();
  } catch (error) {
    return error;
  }
  assert.fail("Expected operation to reject");
}

test("inventory retries transient fetch, body and timeout failures with bounded backoff", async (t) => {
  const cases = [
    ["socket reset", () => transportError()],
    ["temporary DNS failure", () => transportError("EAI_AGAIN")],
    ["interrupted JSON stream", interruptedBody],
    ["timeout", () => new DOMException("timed out", "TimeoutError")],
    ["abort", () => new DOMException("request aborted", "AbortError")],
    [
      "nested aggregate transport cause",
      () =>
        new TypeError("fetch failed", {
          cause: new AggregateError([
            Object.assign(new Error("connect"), { code: "ETIMEDOUT" }),
          ]),
        }),
    ],
  ];
  for (const [name, failure] of cases) {
    await t.test(name, async () => {
      let calls = 0;
      const delays = [];
      const signals = [];
      const actual = await fetchInventory({
        retryDelay: async (ms) => delays.push(ms),
        fetchImpl: async (url, options) => {
          assert.equal(new URL(url).searchParams.get("page"), "1");
          assert.equal(options.redirect, "error");
          assert.ok(options.signal instanceof AbortSignal);
          signals.push(options.signal);
          calls++;
          if (calls <= 2) {
            const result = failure();
            if (result instanceof Error) throw result;
            return result;
          }
          return inventoryResponse();
        },
      });
      assert.deepEqual(actual, [singleVehicle]);
      assert.equal(calls, 3);
      assert.deepEqual(delays, [1000, 2000]);
      assert.equal(
        new Set(signals).size,
        3,
        "Each retry needs a fresh timeout signal",
      );
    });
  }
});

test("temporary HTTP inventory failures cancel their bodies before retrying", async (t) => {
  for (const status of [408, 429, 500, 502, 503, 504, 599]) {
    await t.test(String(status), async () => {
      let calls = 0;
      const events = [];
      const actual = await fetchInventory({
        retryDelay: async (ms) => events.push(`delay:${ms}`),
        fetchImpl: async () => {
          events.push(`fetch:${++calls}`);
          return calls < 3
            ? errorResponse(status, events)
            : inventoryResponse();
        },
      });
      assert.deepEqual(actual, [singleVehicle]);
      assert.deepEqual(events, [
        "fetch:1",
        `cancel:${status}`,
        "delay:1000",
        "fetch:2",
        `cancel:${status}`,
        "delay:2000",
        "fetch:3",
      ]);
    });
  }
});

test("a page-two retry preserves page one and retries only the failed page", async () => {
  const calls = [];
  const delays = [];
  let secondPageAttempts = 0;
  const actual = await fetchInventory({
    retryDelay: async (ms) => delays.push(ms),
    fetchImpl: async (url, options) => {
      const query = new URL(url).searchParams;
      const page = Number(query.get("page"));
      calls.push(page);
      assert.equal(query.get("limit"), "500");
      assert.equal(query.get("offset"), page === 1 ? "0" : "2");
      assert.equal(options.redirect, "error");
      if (page === 1)
        return inventoryResponse([{ id: "1" }, { id: "2" }], {
          total: 3,
          total_results: 2,
        });
      if (page === 2 && ++secondPageAttempts === 1) return interruptedBody();
      if (page === 2)
        return inventoryResponse([{ id: "3" }], { total: 3, total_results: 1 });
      assert.fail(`Unexpected page ${page}`);
    },
  });
  assert.deepEqual(
    actual.map(({ id }) => id),
    ["1", "2", "3"],
  );
  assert.deepEqual(calls, [1, 2, 2]);
  assert.deepEqual(delays, [1000]);
});

test("inventory exhaustion stops after three attempts and reports sanitized stage/cause", async (t) => {
  for (const scenario of [
    { name: "transport", make: () => transportError(), code: "ECONNRESET" },
    {
      name: "HTTP 503",
      make: () => new Response(null, { status: 503 }),
      code: "inventory_http_503",
    },
    { name: "body stream", make: interruptedBody, code: "UND_ERR_SOCKET" },
    {
      name: "timeout",
      make: () => new DOMException("secret endpoint timed out", "TimeoutError"),
      code: "request_timeout",
    },
  ]) {
    await t.test(scenario.name, async () => {
      let calls = 0;
      const delays = [];
      const error = await rejectionOf(() =>
        fetchInventory({
          retryDelay: async (ms) => delays.push(ms),
          fetchImpl: async () => {
            calls++;
            const response = scenario.make();
            if (response instanceof Error) throw response;
            return response;
          },
        }),
      );
      assert.equal(calls, 3);
      assert.deepEqual(delays, [1000, 2000]);
      assert.deepEqual(synchronizationDiagnostic(error), {
        stage: "inventory",
        code: scenario.code,
        page: 1,
        attempts: 3,
      });
    });
  }
});

test("permanent HTTP failures cancel their bodies and never retry", async (t) => {
  for (const status of [401, 403, 404]) {
    await t.test(String(status), async () => {
      let calls = 0;
      const events = [];
      const error = await rejectionOf(() =>
        fetchInventory({
          retryDelay: async () =>
            assert.fail("Permanent HTTP responses must not retry"),
          fetchImpl: async () => {
            calls++;
            return errorResponse(status, events);
          },
        }),
      );
      assert.equal(calls, 1);
      assert.deepEqual(events, [`cancel:${status}`]);
      assert.deepEqual(synchronizationDiagnostic(error), {
        stage: "inventory",
        code: `inventory_http_${status}`,
        page: 1,
        attempts: 1,
      });
    });
  }
});

test("malformed JSON, schema, TLS and redirect failures are not retryable", async (t) => {
  const scenarios = [
    {
      name: "malformed JSON",
      make: () =>
        new Response("{unexpected secret-token", {
          headers: { "content-type": "application/json" },
        }),
      code: "invalid_json",
    },
    {
      name: "invalid data shape",
      make: () => Response.json({ success: true, data: "private-body" }),
      code: "invalid_inventory",
    },
    {
      name: "API explicitly unsuccessful",
      make: () => Response.json({ success: false, data: [] }),
      code: "invalid_inventory",
    },
    {
      name: "null payload",
      make: () => Response.json(null),
      code: "invalid_inventory",
    },
    {
      name: "invalid vehicle identity",
      make: () => inventoryResponse([{}]),
      code: "invalid_vehicle_id",
    },
    {
      name: "expired TLS certificate",
      make: () => transportError("CERT_HAS_EXPIRED"),
      code: "CERT_HAS_EXPIRED",
    },
    {
      name: "self-signed TLS certificate",
      make: () => transportError("DEPTH_ZERO_SELF_SIGNED_CERT"),
      code: "DEPTH_ZERO_SELF_SIGNED_CERT",
    },
    {
      name: "unexpected redirect",
      make: () =>
        new TypeError("fetch failed", {
          cause: new Error(
            "unexpected redirect to https://user:password@private.example/",
          ),
        }),
      code: "unknown_error",
    },
  ];
  for (const scenario of scenarios) {
    await t.test(scenario.name, async () => {
      let calls = 0;
      const error = await rejectionOf(() =>
        fetchInventory({
          retryDelay: async () =>
            assert.fail(`Must not retry ${scenario.name}`),
          fetchImpl: async (_url, options) => {
            assert.equal(options.redirect, "error");
            calls++;
            const response = scenario.make();
            if (response instanceof Error) throw response;
            return response;
          },
        }),
      );
      assert.equal(calls, 1);
      const diagnostic = synchronizationDiagnostic(error);
      assert.equal(diagnostic.code, scenario.code);
      assert.equal(diagnostic.stage, "inventory");
      assert.doesNotMatch(
        JSON.stringify(diagnostic),
        /private|password|secret-token|user:/,
      );
    });
  }
});

test("diagnostics redact sensitive messages, URLs, unknown codes and nested connection objects", async () => {
  const sensitive = "https://user:password@private.example/?token=secret-token";
  for (const sourceCode of [sensitive, "ECONNRESET"]) {
    const original = new TypeError(`fetch failed ${sensitive}`, {
      cause: Object.assign(new Error(sensitive), {
        code: sourceCode,
        connection: { password: sensitive },
      }),
    });
    const error = await rejectionOf(() =>
      fetchInventory({
        api: sensitive,
        retryDelay: async () => {},
        fetchImpl: async () => {
          throw original;
        },
      }),
    );
    const diagnostic = synchronizationDiagnostic(error);
    assert.deepEqual(diagnostic, {
      stage: "inventory",
      code: sourceCode === "ECONNRESET" ? sourceCode : "unknown_error",
      page: 1,
      attempts: sourceCode === "ECONNRESET" ? 3 : 1,
    });
    assert.doesNotMatch(
      JSON.stringify(diagnostic),
      /private|password|secret-token|https|connection|message/,
    );
  }
});

test("failed page two aborts sync before output creation and leaves previous metadata untouched", async () => {
  const temporary = mkdtempSync(join(tmpdir(), "icheck-inventory-failure-"));
  try {
    const existing = join(temporary, "existing");
    mkdirSync(existing);
    const original = '{"source":"checkauto-pdf","keep":"unchanged"}\n';
    writeFileSync(join(existing, "previous.meta.json"), original);
    for (const outputDir of [join(temporary, "not-created"), existing]) {
      const calls = [];
      const error = await rejectionOf(() =>
        syncMetadata({
          outputDir,
          fetchImpl: async (url) => {
            const parsed = new URL(url);
            assert.match(parsed.pathname, /\/api\/v1\/veiculos\.php$/);
            const page = Number(parsed.searchParams.get("page"));
            calls.push(page);
            if (page === 1)
              return inventoryResponse(
                [{ id: "1", placa: "ABC1D23", pdf: "CheckAuto_ABC1D23.pdf" }],
                { total: 2, total_results: 1 },
              );
            return new Response(null, { status: 403 });
          },
        }),
      );
      assert.deepEqual(calls, [1, 2]);
      assert.deepEqual(synchronizationDiagnostic(error), {
        stage: "inventory",
        code: "inventory_http_403",
        page: 2,
        attempts: 1,
      });
    }
    assert.equal(existsSync(join(temporary, "not-created")), false);
    assert.deepEqual(readdirSync(existing), ["previous.meta.json"]);
    assert.equal(
      readFileSync(join(existing, "previous.meta.json"), "utf8"),
      original,
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
