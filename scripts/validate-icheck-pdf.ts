import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { PDFParse } from "pdf-parse";
import {
  ICheckReportDocument,
  type ICheckReportData,
} from "../src/reports/icheck/ICheckReportDocument";
import { buildClientICheckReportData } from "../src/reports/icheck/downloadICheckReportPdf";
import { ICHECK_HISTORY_GROUPS } from "../src/reports/icheck/icheckHistory";
import type { Vehicle } from "../src/catalog/endpoints/vehicles";

const outputDir = resolve(process.argv[2] || "tmp/pdfs/icheck-validation");
await mkdir(outputDir, { recursive: true });
const vehicle: Vehicle = {
  id: "19932",
  name: "CRETA N-LINE TURBO",
  slug: "creta-19932",
  price: 0,
  marca: "HYUNDAI",
  modelo: "CRETA N-LINE TURBO",
  year: 2023,
  anoFabricacao: 2022,
  km: 50300,
  placa: "JBT8I78",
  cor: "Preto",
  cambio: "Automático",
  motor: "1.0 Turbo",
  combustivel: "Flex",
  potencia: "120",
  portas: 4,
  images: [],
  opcionais: Array.from({ length: 56 }, (_, index) => ({
    tag: `item-${index}`,
    descricao: `Opcional anunciado ${index + 1}`,
  })),
};
const clearHistory = ICHECK_HISTORY_GROUPS.map((group) => ({
  ...group,
  status: "Sem Registro",
  clear: true,
  riskLevel: "ok",
}));
const base = buildClientICheckReportData({
  vehicle,
  slug: vehicle.slug,
  protocol: {
    dataHoraConsulta: "22/07/2026 10:35:29",
    protocoloConsulta: "07222026",
    consultaId: null,
    history: clearHistory,
    sourcePdfUrl:
      "https://www.netcarmultimarcas.com.br/arquivos/autocheck/CheckAuto_JBT8I78_1022.pdf",
    consultationHighlights: [
      {
        label: "Observação adicional",
        value: "Informação presente na consulta de exemplo",
      },
    ],
  },
});
assert.equal(
  base.consultaId,
  undefined,
  "Must not derive a protocol from the date",
);
assert.equal(base.tipoChave, "Placa: JBT-XX78", "Must not invent a state");
assert.equal(
  buildClientICheckReportData({ vehicle, slug: vehicle.slug, protocol: null })
    .allClear,
  false,
);
const logo = resolve("public/brand/netcar.png");
const image = await readFile(resolve("public/images/loja1.jpg"));
const photos = Array.from(
  { length: 9 },
  (_, index) =>
    `data:image/jpeg;base64,${image.toString("base64")}${"\n".repeat(index)}`,
);
const fixture: ICheckReportData = {
  ...base,
  netcarLogoPath: logo,
  galleryPhotos: photos,
};
const cases: Array<{ name: string; data: ICheckReportData; expected: string }> =
  [
    {
      name: "clear",
      data: fixture,
      expected: "Sem registros nos itens consultados",
    },
    {
      name: "warning",
      data: {
        ...fixture,
        history: clearHistory.map((item) =>
          item.key === "estaduais"
            ? {
                ...item,
                status: "INF Alienacao Fidu",
                clear: false,
                riskLevel: "warn",
              }
            : item,
        ),
      },
      expected: "Consulta com observação",
    },
    {
      name: "alert",
      data: {
        ...fixture,
        history: clearHistory.map((item) =>
          item.key === "leilao"
            ? {
                ...item,
                status: "Com Registro de Leilão",
                clear: false,
                riskLevel: "alert",
              }
            : item,
        ),
      },
      expected: "Consulta com apontamento",
    },
    {
      name: "missing",
      data: {
        ...fixture,
        history: [],
        dataHoraConsulta: undefined,
        issuedAt: "",
        galleryPhotos: [],
        optionals: [],
      },
      expected: "Resultados indisponíveis",
    },
    {
      name: "partial",
      data: {
        ...fixture,
        history: clearHistory.slice(0, 2),
        galleryPhotos: [],
        optionals: [],
      },
      expected: "Resultados parciais",
    },
    {
      name: "multipage",
      data: {
        ...fixture,
        dataHoraConsulta: "04/04/2024 10:12:00",
        consultaId: "REAL-123456",
        consultationSections: [
          {
            title: "Retornos individuais adicionais",
            items: Array.from({ length: 80 }, (_, index) => ({
              label: `Consulta detalhada ${index + 1}`,
              value: `Retorno ${index + 1}: informação integral de exemplo para verificar paginação, legibilidade e preservação dos resultados adicionais sem omitir o último item.`,
            })),
          },
        ],
      },
      expected: "Consulta detalhada 80",
    },
  ];
const results = [];
for (const sample of cases) {
  const buffer = await renderToBuffer(
    React.createElement(ICheckReportDocument, { data: sample.data }),
  );
  const parser = new PDFParse({ data: buffer });
  try {
    const text = await parser.getText();
    const info = await parser.getInfo({ parsePageInfo: true });
    assert.ok(
      info.pages.some((page) =>
        page.links.some((link) => link.url === sample.data.sourcePdfUrl),
      ),
      `${sample.name}: original PDF link is missing`,
    );
    await writeFile(resolve(outputDir, `${sample.name}.pdf`), buffer);
    await writeFile(resolve(outputDir, `${sample.name}.txt`), text.text);
    assert.ok(
      text.text.includes(sample.expected),
      `${sample.name}: missing expected result`,
    );
    assert.ok(text.pages[0].text.includes("Consultas individuais"));
    for (const { label } of ICHECK_HISTORY_GROUPS)
      assert.ok(
        text.pages[0].text.includes(label),
        `${sample.name}: ${label} must precede photos`,
      );
    assert.ok(
      !text.text.includes("07222026"),
      `${sample.name}: fabricated protocol`,
    );
    assert.ok(
      !text.text.includes("UF: RS"),
      `${sample.name}: fabricated state`,
    );
    assert.ok(
      !text.text.includes("sem registros graves"),
      `${sample.name}: obsolete unconditional conclusion`,
    );
    for (const page of text.pages) {
      assert.ok(
        page.text.includes(`Página ${page.num} de ${text.total}`),
        `${sample.name}: inaccurate footer`,
      );
      assert.ok(
        page.text.length > 180,
        `${sample.name}: nearly-empty page ${page.num}`,
      );
    }
    if (sample.name === "warning")
      assert.ok(text.text.includes("INF Alienacao Fidu"));
    if (sample.name === "missing") {
      assert.equal(
        text.text.includes("Sem registros nos itens consultados"),
        false,
      );
      assert.equal(
        (text.text.match(/^Resultado indisponível$/gm) || []).length,
        4,
      );
      assert.ok(text.text.includes("Não informada na fonte"));
    }
    if (sample.name === "multipage") {
      assert.ok(text.total >= 4);
      assert.ok(text.text.includes("REAL-123456"));
      assert.ok(text.text.includes("há mais de 180 dias"));
      for (let index = 1; index <= 80; index += 1) {
        assert.ok(
          text.pages.some((page) =>
            page.text.includes(
              `Consulta detalhada ${index}\nRetorno ${index}:`,
            ),
          ),
          `Detail ${index} must stay with its result`,
        );
      }
    } else {
      assert.ok(
        text.total <= 2,
        `${sample.name}: expected at most two compact pages, received ${text.total}`,
      );
    }
    if (sample.data.optionals.length)
      assert.ok(
        text.text.includes("Opcional anunciado 56"),
        `${sample.name}: optional list was truncated`,
      );
    results.push({
      name: sample.name,
      pages: text.total,
      bytes: buffer.length,
    });
  } finally {
    await parser.destroy();
  }
}
await writeFile(
  resolve(outputDir, "results.json"),
  `${JSON.stringify(results, null, 2)}\n`,
);
console.log(
  JSON.stringify({ passed: results.length, outputDir, results }, null, 2),
);
