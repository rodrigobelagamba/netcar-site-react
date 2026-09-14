import assert from "node:assert/strict";
import test from "node:test";
import {
  getConsultationAgeDays,
  loadIcheckMetadata,
  resolveIcheckAttachment,
  validateIcheckMetadata,
} from "./icheckMetadata";
import {
  icheckProtocolFromDate,
  resolveIcheckProtocol,
} from "./icheck-protocol";
import {
  getHistorySummary,
  ICHECK_HISTORY_GROUPS,
  normalizeHistoryItems,
} from "../reports/icheck/icheckHistory";

const vehicle = {
  id: "19932",
  placa: "JBT8I78",
  pdf: "CheckAuto_JBT8I78_1022.pdf",
  pdf_url:
    "https://www.netcarmultimarcas.com.br/arquivos/autocheck/CheckAuto_JBT8I78_1022.pdf",
};
const clearHistory = ICHECK_HISTORY_GROUPS.map((group) => ({
  ...group,
  status: "Sem Registro",
  riskLevel: "ok",
}));
const metadata = {
  schemaVersion: 2,
  available: true,
  identity: { verified: true },
  vehicleId: vehicle.id,
  placa: vehicle.placa,
  pdf: vehicle.pdf,
  source: "checkauto-pdf",
  sourceSha256: "a".repeat(64),
  dataHoraConsulta: "22/07/2026 10:35:29",
  history: clearHistory,
  consultaId: null,
  protocoloConsulta: "07222026",
};

test("shared metadata keeps extra details without duplicating the four results", () => {
  const result = validateIcheckMetadata(
    {
      ...metadata,
      consultationHighlights: [
        ...clearHistory.map((item) => ({
          label: item.label,
          value: item.status,
        })),
        { label: "Consulta adicional", value: "Detalhe preservado" },
      ],
    },
    vehicle,
  );
  assert.deepEqual(result?.consultationHighlights, [
    { label: "Consulta adicional", value: "Detalhe preservado" },
  ]);
});

test("empty and partial histories retain all four groups without a successful conclusion", () => {
  assert.equal(normalizeHistoryItems([]).length, 4);
  assert.equal(getHistorySummary(undefined).level, "unavailable");
  assert.equal(getHistorySummary(clearHistory.slice(0, 3)).level, "incomplete");
  assert.equal(getHistorySummary(clearHistory).level, "clear");
  assert.equal(
    getHistorySummary([
      { key: "leilao", label: "Leilão", status: "Consultado", riskLevel: "ok" },
    ]).level,
    "unavailable",
  );
  const missing = normalizeHistoryItems([
    {
      key: "roubo",
      label: "Roubo",
      status: "Indisponível",
      clear: true,
      riskLevel: "ok",
    },
  ]);
  assert.equal(missing.length, 4);
  assert.ok(missing.every((item) => !item.clear));
});

test("alienation, serious records and ambiguous strings never produce false green", () => {
  assert.equal(
    getHistorySummary(
      clearHistory.map((item) =>
        item.key === "estaduais"
          ? {
              ...item,
              status: "Alienação Fiduciária Ativa (Veículo Financiado)",
            }
          : item,
      ),
    ).level,
    "warning",
  );
  assert.equal(
    getHistorySummary(
      clearHistory.map((item) =>
        item.key === "roubo"
          ? { ...item, status: "Consta registro de roubo" }
          : item,
      ),
    ).level,
    "alert",
  );
  assert.equal(
    getHistorySummary(
      clearHistory.map((item) =>
        item.key === "leilao"
          ? {
              ...item,
              status: "Sem registro de leilão; consta registro de sinistro",
            }
          : item,
      ),
    ).level,
    "alert",
  );
  const warned = getHistorySummary([
    { key: "estaduais", label: "Estaduais", status: "INF - Alienacao Fidu" },
  ]);
  assert.equal(warned.level, "warning");
  assert.match(warned.description, /indisponíveis/);
});

test("explicit occurrences are alerts even when legacy metadata says attention", () => {
  assert.equal(
    getHistorySummary([
      {
        key: "rouboFurto",
        label: "Roubo / Furto",
        status: "3 ocorrência(ões) — ver histórico",
        riskLevel: "attention",
      },
    ]).level,
    "alert",
  );
});

test("metadata must match vehicle, plate and exact attachment; invalid schema fails closed", () => {
  assert.ok(validateIcheckMetadata(metadata, vehicle));
  for (const changed of [
    { vehicleId: "19933" },
    { placa: "JBT5G78" },
    { pdf: "Other.pdf" },
    { schemaVersion: 7 },
    { source: "unavailable" },
    { available: false },
    { identity: { verified: false } },
    { identity: undefined },
    { sourceSha256: null },
    { sourceSha256: undefined },
    { history: [{ key: "leilao", label: "Leilão", status: 1 }] },
    { history: [...clearHistory, clearHistory[0]] },
    { dataHoraConsulta: "31/02/2026 10:00:00" },
    { dataHoraConsulta: null },
  ]) {
    assert.equal(
      validateIcheckMetadata({ ...metadata, ...changed }, vehicle),
      null,
    );
  }
  const result = validateIcheckMetadata(metadata, vehicle)!;
  assert.equal(result.consultaId, null);
  assert.equal(result.protocoloConsulta, null);
  assert.equal(result.tipoChave, "Placa: JBT-XX78");
});

test("PHP, offsite, unsafe paths and conflicting attachments are rejected", () => {
  assert.ok(resolveIcheckAttachment(vehicle));
  assert.ok(
    resolveIcheckAttachment({ pdf_url: `/arquivos/autocheck/${vehicle.pdf}` }),
  );
  for (const changed of [
    {
      pdf: "shell.php.badext",
      pdf_url:
        "https://www.netcarmultimarcas.com.br/arquivos/autocheck/shell.php.badext",
    },
    { pdf_url: `https://evil.example/arquivos/autocheck/${vehicle.pdf}` },
    { pdf_url: `javascript:alert(1)` },
    { pdf_url: `${vehicle.pdf_url}?version=other` },
    { pdf_url: `/arquivos/autocheck/%2e%2e/${vehicle.pdf}` },
    { pdf_url: `/arquivos/autocheck/Another.pdf` },
    {
      pdf_url: `https://www.netcarmultimarcas.com.br:444/arquivos/autocheck/${vehicle.pdf}`,
    },
  ])
    assert.equal(resolveIcheckAttachment({ ...vehicle, ...changed }), null);
});

test("dates are explicit and never manufactured into supplier identifiers", () => {
  assert.equal(icheckProtocolFromDate("22/07/2026 10:35:29"), null);
  assert.equal(resolveIcheckProtocol("07222026", "22/07/2026 10:35:29"), null);
  assert.equal(
    resolveIcheckProtocol("36896005", "10/03/2026 11:17:49"),
    "36896005",
  );
  assert.equal(
    getConsultationAgeDays("31/02/2026", new Date("2026-09-14T16:00:00Z")),
    null,
  );
  assert.equal(
    getConsultationAgeDays(
      "22/07/2026 10:35:29",
      new Date("2026-09-14T16:00:00Z"),
    ),
    54,
  );
});

test("loader handles HTTP 410, invalid JSON, association errors and network failure without clear data", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  const jsonResponse = (value: unknown) =>
    new Response(JSON.stringify(value), {
      headers: { "content-type": "application/json" },
    });
  const cases: Array<[() => Promise<Response>, string]> = [
    [async () => new Response("Gone", { status: 410 }), "unavailable"],
    [
      async () =>
        new Response("<html>fallback</html>", {
          headers: { "content-type": "text/html" },
        }),
      "invalid_metadata",
    ],
    [
      async () =>
        new Response("{", { headers: { "content-type": "application/json" } }),
      "invalid_metadata",
    ],
    [
      async () => jsonResponse({ ...metadata, vehicleId: "99999" }),
      "invalid_metadata",
    ],
    [
      async () => {
        throw new Error("Network offline");
      },
      "unavailable",
    ],
  ];
  for (const [response, status] of cases) {
    globalThis.fetch = response;
    const loaded = await loadIcheckMetadata(vehicle);
    assert.equal(loaded.status, status);
    assert.equal(
      getHistorySummary(loaded.protocol?.history).level,
      "unavailable",
    );
    assert.equal(loaded.protocol, null);
  }
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "/arquivos/autocheck/CheckAuto_JBT8I78_1022.meta.json");
    assert.equal(init?.cache, "no-store");
    return jsonResponse(metadata);
  };
  assert.equal((await loadIcheckMetadata(vehicle)).status, "ready");
});

test("unavailable tombstones stay neutral and cannot claim successful results", () => {
  const tombstone = {
    ...metadata,
    available: false,
    source: "unavailable",
    sourceSha256: null,
    identity: { verified: false },
    dataHoraConsulta: null,
    history: clearHistory.map((item) => ({
      ...item,
      status: null,
      clear: false,
      riskLevel: "unavailable",
    })),
  };
  const result = validateIcheckMetadata(tombstone, vehicle);
  assert.ok(result);
  assert.equal(getHistorySummary(result.history).level, "unavailable");
  assert.equal(
    validateIcheckMetadata(
      {
        ...tombstone,
        dataHoraConsulta: metadata.dataHoraConsulta,
        history: clearHistory,
      },
      vehicle,
    ),
    null,
  );
  const legacy = {
    ...metadata,
    schemaVersion: undefined,
    available: undefined,
    sourceSha256: undefined,
    identity: undefined,
  };
  assert.ok(validateIcheckMetadata(legacy, vehicle));
});

test("a rejected catalog attachment retains its invalid status after unsafe URL removal", async () => {
  const result = await loadIcheckMetadata({
    id: "19688",
    placa: "JBP2J03",
    icheckAttachmentInvalid: true,
  });
  assert.equal(result.status, "invalid_attachment");
  assert.equal(result.protocol, null);
});

test("consultation observations and exact date/time survive validation without rewriting", () => {
  const notes = [
    "Observação explicativa de origem: alienação fiduciária não equivale a sinistro.",
    "Data e hora da consulta: 22/07/2026 10:35:29.\nAs informações devem ser lidas conforme a fonte.",
  ];
  const result = validateIcheckMetadata(
    {
      ...metadata,
      consultationNotes: notes,
      identity: { verified: true, chassiMasked: "9BHPC8XXXXXXXXX" },
    },
    vehicle,
  );
  assert.ok(result);
  assert.deepEqual(result.consultationNotes, notes);
  assert.equal(result.dataHoraConsulta, "22/07/2026 10:35:29");
  assert.equal(result.chassiMasked, "9BHPC8XXXXXXXXX");
  assert.equal(result.sourceLabel, "Consulta CheckAuto / DEKRA");
  assert.equal(getHistorySummary(result.history).level, "clear");
  for (const invalid of [
    { consultationNotes: [42] },
    { consultationNotes: ["x".repeat(4001)] },
    { consultationNotes: Array(41).fill("Nota") },
    { consultationNotes: ["   "] },
    { identity: { verified: true, chassiMasked: "9BHPC81ABCD123456" } },
  ]) {
    assert.equal(
      validateIcheckMetadata({ ...metadata, ...invalid }, vehicle),
      null,
    );
  }
});

test("unavailable metadata accepts an explicitly missing masked chassis", () => {
  const result = validateIcheckMetadata(
    {
      ...metadata,
      source: "unavailable",
      available: false,
      sourceSha256: null,
      identity: { verified: false, chassiMasked: null },
      dataHoraConsulta: null,
      history: clearHistory.map((item) => ({
        ...item,
        status: null,
        clear: false,
        riskLevel: "unavailable",
      })),
    },
    vehicle,
  );
  assert.ok(result);
  assert.equal(result.chassiMasked, undefined);
  assert.equal(getHistorySummary(result.history).level, "unavailable");
});
