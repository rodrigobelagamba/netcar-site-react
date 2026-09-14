import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readFileSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import PDFDocument from "@react-pdf/pdfkit";
import {
  extractCertificateHistory,
  parseCheckAutoPdf,
  extractCheckAutoProtocol,
  extractCertificateNotes,
} from "../lib/parse-checkauto-pdf.mjs";
import { parseCheckAutoDossier } from "../lib/parse-checkauto-xml.mjs";
import { summarizeDossier } from "../lib/icheck-dossier-summary.mjs";
import {
  fetchInventory,
  resolveCertificateReference,
  certificateMatchesVehicle,
  dossierMatchesCertificate,
  syncMetadata,
} from "../sync-icheck-metadata.mjs";

const vehicle = {
  id: "100",
  placa: "ABC1D23",
  pdf: "CheckAuto_ABC1D23_1234.pdf",
};
const reference = resolveCertificateReference(vehicle);
const core = [
  "Leilão",
  "Sinistro / Perda",
  "Roubo / Furto",
  "Informações Estaduais",
];
async function certificate(
  statuses = [
    "Sem Registro.",
    "Com registro",
    "Indisponível",
    "INF Alienacao Fidu",
  ],
) {
  const pdf = new PDFDocument({ size: [595, 842], margin: 0, compress: false });
  const chunks = [];
  const finished = new Promise((resolve, reject) => {
    pdf.on("data", (chunk) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
  });
  pdf.font("Helvetica").fontSize(12);
  const draw = (text, x, y) => pdf.text(text, x, 842 - y, { lineBreak: false });
  draw("CERTIFICADO DE PROCEDÊNCIA VEICULAR", 40, 780);
  draw("Placa: ABC-XX23", 40, 750);
  draw("Data: 14/09/2026 13:22:10", 270, 750);
  draw("Chassi: 9BHBH5XXXXXXXXX", 40, 720);
  draw("Histórico do Veículo", 40, 690);
  // Write status BEFORE label in content order: geometry must bind each physical row.
  statuses.forEach((status, index) => {
    if (status) draw(status, 295, 650 - index * 35);
    draw(core[index], 40, 650 - index * 35);
  });
  draw("Observações Explicativas", 40, 470);
  draw("Ausência de registro de leilão não substitui vistoria.", 40, 450);
  pdf.end();
  return finished;
}
function xml(code, body = "", overrides = "") {
  return `<Consulta><ConsultaID>123456789</ConsultaID><DataHoraConsulta>14/09/2026 13:22:10</DataHoraConsulta><ResumoConsulta><RegistroEstadual>1</RegistroEstadual><RouboFurtoFederal>${code}</RouboFurtoFederal><LeilaoRemarketing>2</LeilaoRemarketing>${overrides}</ResumoConsulta><Veiculo><RegistroEstadual><Placa>ABC1D23</Placa><TipoSituacaoVeiculo>Em circulação</TipoSituacaoVeiculo><NomeRestricao1>Alienação fiduciária</NomeRestricao1></RegistroEstadual><RouboFurtoFederal>${body}</RouboFurtoFederal><LeilaoRemarketing><DescricaoRetorno>Sem registro</DescricaoRetorno></LeilaoRemarketing></Veiculo></Consulta>`;
}

test("row binding never borrows a neighboring result, including blank/unknown rows", () => {
  const history = extractCertificateHistory(
    `Histórico do Veículo\nSem Registro. Leilão\nSinistro / Perda Com registro\nRoubo / Furto\nInformações Estaduais Retorno não reconhecido\nObservações Explicativas\nSem Registro Leilão`,
  );
  assert.deepEqual(
    history.map((item) => item.status),
    ["Sem Registro", "Com registro", null, "Retorno não reconhecido"],
  );
  assert.deepEqual(
    history.map((item) => item.clear),
    [true, false, false, false],
  );
  assert.equal(
    extractCheckAutoProtocol("Data: 14/09/2026 13:22:10").consultaId,
    null,
  );
});

test("Node PDF extraction keeps mixed table rows and identifies date/plate", async () => {
  const parsed = await parseCheckAutoPdf(await certificate());
  assert.equal(parsed.ok, true);
  assert.equal(parsed.placa, "ABC-XX23");
  assert.equal(parsed.dataHoraConsulta, "14/09/2026 13:22:10");
  assert.deepEqual(parsed.consultationNotes, [
    "Ausência de registro de leilão não substitui vistoria.",
  ]);
  assert.deepEqual(
    parsed.history.map((item) => item.riskLevel),
    ["ok", "alert", "unavailable", "warn"],
  );
  assert.equal(parsed.allClear, false);
  const blank = await parseCheckAutoPdf(
    await certificate(["Sem Registro", "", "Sem Registro", "Sem Registro"]),
  );
  assert.equal(blank.history[1].status, null);
  assert.equal(blank.allClear, false);
  assert.equal(
    (await parseCheckAutoPdf(Buffer.from("<?php echo 'x';"))).ok,
    false,
  );
});

test("explanatory notes survive headings before or after their PDF text without copying the sales footer", () => {
  const notes = [
    "Como os sistemas estaduais e federais podem ter atualizações em momentos diferentes, é recomendável confirmar eventuais restrições.",
    "A existência de Alienação Fiduciária não significa problema legal. Trata-se de um vínculo com instituição financeira.",
  ];
  const body = `${notes[0].replace("é recomendável", "é\nrecomendável")}\n${notes[1]}`;
  for (const source of [
    `Histórico do Veículo\nLeilão Sem Registro\nObservações Explicativas\n${body}\nCONFIANÇA GARANTIDA PELA NETCAR\nA Netcar atesta algo.`,
    `Histórico do Veículo\nLeilão Sem Registro\n${body}\nObservações Explicativas\nA Netcar atesta algo.\nCONFIANÇA GARANTIDA PELA NETCAR`,
  ])
    assert.deepEqual(extractCertificateNotes(source), notes);
  assert.deepEqual(extractCertificateNotes("Leilão Sem Registro"), []);
  assert.deepEqual(
    extractCertificateNotes(
      "Observações:\nObservação específica do veículo.\n\nConferir junto ao vendedor.",
    ),
    ["Observação específica do veículo.", "Conferir junto ao vendedor."],
  );
});

test("certificate reference rejects bad extensions, other origins, traversal and conflicting fields", () => {
  for (const pdf of ["x.php.badext", "../x.pdf", "x%2Epdf", "x.pdf?evil=1"])
    assert.throws(() => resolveCertificateReference({ ...vehicle, pdf }));
  for (const pdf_url of [
    "https://other.example/arquivos/autocheck/CheckAuto_ABC1D23_1234.pdf",
    "//other.example/x.pdf",
    "https://user:password@www.netcarmultimarcas.com.br/arquivos/autocheck/CheckAuto_ABC1D23_1234.pdf",
    "/arquivos/autocheck/other.pdf",
  ])
    assert.throws(() => resolveCertificateReference({ ...vehicle, pdf_url }));
  assert.equal(certificateMatchesVehicle({ placa: "ABC-XX23" }, vehicle), true);
  assert.equal(
    certificateMatchesVehicle({ placa: "ABD-XX23" }, vehicle),
    false,
  );
  assert.equal(
    certificateMatchesVehicle({ placa: "XXX-XX23" }, vehicle),
    false,
  );
});

test("unknown XML returns never become clear, and attention survives summarization", () => {
  for (const code of ["", "0", "99", "NOT_A_CODE"]) {
    const dossier = parseCheckAutoDossier(xml(code));
    const roubo = dossier.sections.find(
      (section) => section.key === "rouboFurto",
    );
    assert.equal(roubo.riskLevel, "unavailable", `code ${code}`);
    assert.equal(dossier.allClear, false);
    assert.equal(
      dossier.history.find((item) => item.key === "roubo").status,
      null,
    );
  }
  const dossier = parseCheckAutoDossier(xml("2"));
  const summary = summarizeDossier(dossier.sections);
  const estadual = summary.history.find(
    (item) => item.key === "registroEstadual",
  );
  assert.equal(estadual.riskLevel, "warn");
  assert.equal(estadual.clear, false);
  assert.equal(summary.sections.length, 6);
  assert.equal(
    dossier.history.find((item) => item.key === "sinistro").status,
    null,
    "leilão sem registro does not establish a distinct sinistro result",
  );
  const missing = parseCheckAutoDossier(
    "<Consulta><ResumoConsulta><RouboFurtoFederal>2</RouboFurtoFederal></ResumoConsulta><Veiculo></Veiculo></Consulta>",
  );
  assert.equal(
    missing.sections.find((section) => section.key === "rouboFurto").riskLevel,
    "unavailable",
  );
});

test("XML records override contradictory no-record code and one recovery cannot hide another active occurrence", () => {
  const dossier = parseCheckAutoDossier(
    xml(
      "2",
      "<Registro><CategoriaOcorrencia>Roubado</CategoriaOcorrencia></Registro><Registro><CategoriaOcorrencia>Recuperado</CategoriaOcorrencia></Registro>",
    ),
  );
  assert.equal(
    dossier.sections.find((section) => section.key === "rouboFurto").riskLevel,
    "alert",
  );
  const auction = parseCheckAutoDossier(
    xml("2").replace(
      "<DescricaoRetorno>Sem registro</DescricaoRetorno>",
      "<DescricaoRetorno>Sem registro</DescricaoRetorno><Registro><Descricao>Leilão registrado</Descricao></Registro>",
    ),
  );
  assert.equal(
    auction.sections.find((section) => section.key === "leilao").riskLevel,
    "alert",
  );
});

test("XML enrichment requires the same plate and exact consultation date", async () => {
  const parsed = await parseCheckAutoPdf(await certificate());
  const dossier = parseCheckAutoDossier(xml("2"));
  assert.equal(dossierMatchesCertificate(dossier, parsed, vehicle), true);
  assert.equal(
    dossierMatchesCertificate(
      {
        ...dossier,
        protocol: {
          ...dossier.protocol,
          dataHoraConsulta: "13/09/2026 13:22:10",
        },
      },
      parsed,
      vehicle,
    ),
    false,
  );
  assert.equal(
    dossierMatchesCertificate(
      dossier,
      { ...parsed, dataHoraConsulta: null },
      vehicle,
    ),
    false,
  );
  assert.equal(
    dossierMatchesCertificate(
      {
        ...dossier,
        vehicleHint: { ...dossier.vehicleHint, placa: "DEF-XX23" },
      },
      parsed,
      vehicle,
    ),
    false,
  );
});

test("sync preserves original PDFs, checks current hash before reuse and removes stale success on failure", async () => {
  const dir = mkdtempSync(join(tmpdir(), "icheck-ingestion-"));
  try {
    const original = await certificate([
      "Sem Registro",
      "Sem Registro",
      "Sem Registro",
      "Sem Registro",
    ]);
    writeFileSync(join(dir, vehicle.pdf), original);
    const options = { inventory: [vehicle], sourceDir: dir, outputDir: dir };
    assert.equal((await syncMetadata(options)).generated, 1);
    assert.equal((await syncMetadata(options)).reused, 1);
    let metadata = JSON.parse(readFileSync(join(dir, reference.metaName)));
    assert.equal(metadata.allClear, true);
    assert.equal(metadata.consultaId, null);
    assert.equal(JSON.stringify(metadata).includes(dir), false);
    assert.deepEqual(readFileSync(join(dir, vehicle.pdf)), original);
    writeFileSync(join(dir, vehicle.pdf), await certificate());
    assert.equal((await syncMetadata(options)).generated, 1);
    metadata = JSON.parse(readFileSync(join(dir, reference.metaName)));
    assert.equal(metadata.allClear, false);
    assert.equal(metadata.history[1].riskLevel, "alert");
    writeFileSync(join(dir, vehicle.pdf), Buffer.from("not a pdf"));
    assert.equal((await syncMetadata(options)).unavailable, 1);
    metadata = JSON.parse(readFileSync(join(dir, reference.metaName)));
    assert.equal(metadata.source, "unavailable");
    assert(
      metadata.history.every((item) => item.status === null && !item.clear),
    );
    assert.deepEqual(
      readdirSync(dir).sort(),
      [vehicle.pdf, reference.metaName].sort(),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("PDF sync recovers transient transport, timeout and temporary HTTP failures within three attempts", async () => {
  const dir = mkdtempSync(join(tmpdir(), "icheck-retry-"));
  const pdf = await certificate([
    "Sem Registro",
    "Sem Registro",
    "Sem Registro",
    "Sem Registro",
  ]);
  const transport = () =>
    Object.assign(new TypeError("fetch failed"), {
      cause: { code: "ECONNRESET" },
    });
  const interruptedBody = () =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.error(
            Object.assign(new TypeError("terminated"), {
              cause: { code: "UND_ERR_SOCKET" },
            }),
          );
        },
      }),
    );
  const scenarios = [
    { name: "single transport reset", failures: [transport] },
    {
      name: "reset followed by interrupted stream",
      failures: [transport, interruptedBody],
    },
    {
      name: "timeout",
      failures: [() => new DOMException("timed out", "TimeoutError")],
    },
    {
      name: "request timeout then rate limit",
      failures: [
        () => new Response(null, { status: 408 }),
        () => new Response(null, { status: 429 }),
      ],
    },
    {
      name: "temporary server failures",
      failures: [
        () => new Response(null, { status: 500 }),
        () => new Response(null, { status: 503 }),
      ],
    },
  ];
  try {
    for (const scenario of scenarios) {
      let calls = 0;
      const summary = await syncMetadata({
        inventory: [vehicle],
        outputDir: dir,
        fetchImpl: async () => {
          const failure = scenario.failures[calls++]?.();
          if (failure instanceof Error) throw failure;
          return failure || new Response(pdf);
        },
      });
      assert.equal(calls, scenario.failures.length + 1, scenario.name);
      assert.equal(summary.unavailable, 0, scenario.name);
      const metadata = JSON.parse(readFileSync(join(dir, reference.metaName)));
      assert.equal(metadata.source, "checkauto-pdf", scenario.name);
      assert.equal(metadata.allClear, true, scenario.name);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("PDF retry exhaustion clears previous results and permanent certificate failures are not retried", async () => {
  const dir = mkdtempSync(join(tmpdir(), "icheck-retry-failure-"));
  const pdf = await certificate([
    "Sem Registro",
    "Sem Registro",
    "Sem Registro",
    "Sem Registro",
  ]);
  const scenarios = [
    {
      name: "transport exhausted",
      response: () =>
        Object.assign(new TypeError("fetch failed"), {
          cause: { code: "ECONNRESET" },
        }),
      count: 3,
      error: "source_unavailable",
    },
    {
      name: "HTTP retries exhausted",
      response: () => new Response(null, { status: 503 }),
      count: 3,
      error: "http_503",
    },
    {
      name: "not found",
      response: () => new Response(null, { status: 404 }),
      count: 1,
      error: "http_404",
    },
    {
      name: "invalid PDF",
      response: () => new Response("<?php unexpected_attachment();"),
      count: 1,
      error: "invalid_pdf",
    },
    {
      name: "oversized PDF",
      response: () =>
        new Response(pdf, {
          headers: { "content-length": String(16 * 1024 * 1024) },
        }),
      count: 1,
      error: "pdf_too_large",
    },
    {
      name: "wrong identity",
      response: () => new Response(pdf),
      vehicle: { ...vehicle, placa: "DEF1D23" },
      count: 1,
      error: "identity_mismatch",
    },
  ];
  try {
    for (const scenario of scenarios) {
      await syncMetadata({
        inventory: [vehicle],
        outputDir: dir,
        fetchImpl: async () => new Response(pdf),
      });
      let calls = 0;
      const summary = await syncMetadata({
        inventory: [scenario.vehicle || vehicle],
        outputDir: dir,
        fetchImpl: async () => {
          calls++;
          const response = scenario.response();
          if (response instanceof Error) throw response;
          return response;
        },
      });
      assert.equal(calls, scenario.count, scenario.name);
      assert.equal(summary.unavailable, 1, scenario.name);
      const metadata = JSON.parse(readFileSync(join(dir, reference.metaName)));
      assert.equal(metadata.errorCode, scenario.error, scenario.name);
      assert.equal(metadata.source, "unavailable", scenario.name);
      assert(
        metadata.history.every((item) => item.status === null && !item.clear),
        scenario.name,
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("API inventory pagination requests 500 and refuses a stalled/incomplete listing", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const page = new URL(url).searchParams.get("page");
    return {
      ok: true,
      json: async () => ({
        data: page === "1" ? [{ id: "1" }, { id: "2" }] : [{ id: "3" }],
        total_results: 3,
      }),
    };
  };
  assert.equal((await fetchInventory({ fetchImpl })).length, 3);
  assert.equal(calls.length, 2);
  assert(
    calls.every((url) => new URL(url).searchParams.get("limit") === "500"),
  );
  await assert.rejects(
    fetchInventory({
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ data: [{ id: "1" }], total_results: 3 }),
      }),
    }),
    /stalled/,
  );
});

const audit =
  process.env.ICHECK_AUDIT_DIR ||
  resolve("../output/auditoria-dekra-estoque-2026-09-14");
test(
  "all 54 audited certificates match manually verified results, dates and associations",
  { skip: !existsSync(join(audit, "compare-findings.json")) },
  async () => {
    const findings = JSON.parse(
      readFileSync(join(audit, "compare-findings.json")),
    ).rows.filter((row) => row.certificate_status);
    const inventory = JSON.parse(
      readFileSync(join(audit, "inventory-api.json")),
    ).data;
    assert.equal(findings.length, 54);
    for (const row of findings) {
      const parsed = await parseCheckAutoPdf(join(audit, "pdfs", row.pdf));
      assert.equal(parsed.ok, true, row.pdf);
      assert.equal(parsed.dataHoraConsulta, row.pdf_date, row.pdf);
      assert.deepEqual(
        Object.fromEntries(
          parsed.history.map((item) => [item.key, item.status]),
        ),
        row.certificate_status,
        row.pdf,
      );
      assert.equal(
        certificateMatchesVehicle(
          parsed,
          inventory.find((entry) => String(entry.id) === String(row.id)),
        ),
        true,
        row.pdf,
      );
    }
  },
);
