import { readFileSync, existsSync } from "node:fs";
import { PDFParse } from "pdf-parse";

export const HISTORY_ITEMS = [
  { key: "leilao", label: "Leilão", pattern: /\bleil[aã]o\b/i },
  {
    key: "sinistro",
    label: "Sinistro / Perda",
    pattern: /\bsinistro\s*\/?\s*perda\b/i,
  },
  { key: "roubo", label: "Roubo / Furto", pattern: /\broubo\s*\/?\s*furto\b/i },
  {
    key: "estaduais",
    label: "Informações Estaduais",
    pattern: /informa[cç][oõ]es\s+estaduais/i,
  },
];

const clean = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();
const field = (text, pattern) => clean(text.match(pattern)?.[1]) || null;

export function classifyCertificateStatus(value) {
  const status = clean(value).replace(/[.]+$/, "") || null;
  const clear = /^(?:sem|nenhum)\s+registro$/i.test(status || "");
  const unavailable =
    !status ||
    /^(?:indispon[ií]vel|n[aã]o consultad[oa]|n[aã]o informado|erro|sem retorno|desconhecido)/i.test(
      status,
    );
  const warn = /aliena[cç][aã]o|alienacao/i.test(status || "");
  const alert =
    !clear &&
    !unavailable &&
    !warn &&
    /com\s+registro|consta\s+registro|registro\s+encontrado|bloqueio|restri[cç][aã]o|sinistro|roubad|furtad/i.test(
      status,
    );
  return {
    status: clear ? "Sem Registro" : status,
    clear,
    riskLevel: unavailable
      ? "unavailable"
      : clear
        ? "ok"
        : warn
          ? "warn"
          : alert
            ? "alert"
            : "warn",
  };
}

/** Parse only a single physical table row. Never borrow another row's result. */
export function extractCertificateHistory(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map(clean);
  const start = lines.findIndex((line) =>
    /hist[oó]rico do ve[ií]culo/i.test(line),
  );
  const table = start >= 0 ? lines.slice(start + 1) : lines;
  const stop = table.findIndex((line) =>
    /^(?:Como os sistemas|Observa[cç][oõ]es|A aus[eê]ncia|A exist[eê]ncia|O relat[oó]rio)/i.test(
      line,
    ),
  );
  const rows = stop >= 0 ? table.slice(0, stop) : table;
  return HISTORY_ITEMS.map(({ key, label, pattern }) => {
    const matches = rows.filter((line) => pattern.test(line));
    // Ambiguous repeated rows or multiple labels on one line cannot establish a result.
    const row =
      matches.length === 1 &&
      HISTORY_ITEMS.filter((item) => item.pattern.test(matches[0])).length === 1
        ? matches[0]
        : "";
    const value = row.replace(pattern, "").replace(/^[\s:|–—-]+|[\s|]+$/g, "");
    return { key, label, ...classifyCertificateStatus(value) };
  });
}

/** Some certificates store their notes before the heading in PDF content order. */
export function extractCertificateNotes(text) {
  const notes = [];
  let current = [];
  let inNotes = false;
  const flush = () => {
    const note = clean(current.join(" "));
    if (note && !notes.includes(note)) notes.push(note);
    current = [];
  };
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = clean(raw);
    if (/^(?:CONFIAN[CÇ]A GARANTIDA|A Netcar atesta)/i.test(line)) {
      flush();
      break;
    }
    if (/^Observa[cç][oõ]es(?: Explicativas)?\s*:?$/i.test(line)) {
      flush();
      inNotes = true;
      continue;
    }
    if (
      /^(?:As informa[cç][oõ]es apresentadas|O relat[oó]rio tem|A exist[eê]ncia de|A aus[eê]ncia de|Como os sistemas)\b/i.test(
        line,
      )
    ) {
      flush();
      inNotes = true;
    }
    if (!inNotes) continue;
    if (!line) {
      flush();
      continue;
    }
    if (/^(?:PAGE \d+|-- \d+ of \d+ --)$/i.test(line)) continue;
    current.push(line);
  }
  flush();
  return notes;
}

export function extractCheckAutoProtocol(source) {
  const text = String(source || "");
  const consultaId =
    field(text, /<ConsultaID>\s*([^<]+)\s*<\/ConsultaID>/i) ||
    field(text, /\b(?:ConsultaID|Protocolo)\s*[:=]?\s*([0-9]{6,})\b/i);
  const dataHoraConsulta =
    field(text, /<DataHoraConsulta>\s*([^<]+)\s*<\/DataHoraConsulta>/i) ||
    field(text, /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/);
  let tipoChave =
    field(text, /<TipoChave>\s*([\s\S]*?)\s*<\/TipoChave>/i) ||
    field(text, /TipoChave\s*[:=]?\s*(Placa:\s*[A-Z0-9-]+\s*UF:\s*[A-Z]{2})/i);
  const placa = field(
    text,
    /Placa:\s*([A-Z]{3}[- ]?(?:XX|[0-9][0-9A-Z])[0-9]{2})/i,
  );
  const uf = field(text, /\bUF:\s*([A-Z]{2})\b/i);
  if (!tipoChave && placa)
    tipoChave = `Placa: ${placa}${uf ? ` UF: ${uf}` : ""}`;
  return { consultaId, dataHoraConsulta, tipoChave };
}

export function parseCheckAutoXml(xmlPathOrString) {
  const xml =
    typeof xmlPathOrString === "string" &&
    !xmlPathOrString.includes("<") &&
    existsSync(xmlPathOrString)
      ? readFileSync(xmlPathOrString, "utf8")
      : String(xmlPathOrString || "");
  return extractCheckAutoProtocol(xml);
}

/** Read the certificate with pdf.js's positioned line extraction, entirely in Node. */
export async function parseCheckAutoPdf(pdfPathOrBuffer) {
  let parser;
  try {
    const buffer =
      Buffer.isBuffer(pdfPathOrBuffer) || pdfPathOrBuffer instanceof Uint8Array
        ? pdfPathOrBuffer
        : readFileSync(pdfPathOrBuffer);
    if (Buffer.from(buffer).subarray(0, 5).toString("ascii") !== "%PDF-")
      throw new Error("invalid_pdf");
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText({
      lineEnforce: true,
      lineThreshold: 3,
      cellSeparator: "\t",
    });
    const rawText = result.pages.map((page) => page.text).join("\n");
    if (
      !/CERTIFICADO/i.test(rawText) ||
      !/PROCED[EÊ]NCIA VEICULAR/i.test(rawText)
    )
      throw new Error("unsupported_certificate");
    const history = extractCertificateHistory(rawText);
    const header = rawText.split(/Hist[oó]rico do Ve[ií]culo/i)[0];
    const protocol = extractCheckAutoProtocol(header);
    const placa = field(
      header,
      /Placa:\s*([A-Z]{3}[- ]?(?:XX|[0-9][A-Z0-9])[0-9]{2})/i,
    );
    const chassi = field(header, /Chassi:\s*([A-Z0-9*]{8,})/i);
    const available = history.some(
      (item) => item.status !== null && item.riskLevel !== "unavailable",
    );
    return {
      ok: true,
      error: null,
      text: rawText,
      issuedAt: protocol.dataHoraConsulta,
      placa,
      chassi,
      ...protocol,
      history,
      consultationNotes: extractCertificateNotes(rawText),
      allClear: history.every((item) => item.clear),
      available,
      pages: result.total,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      text: "",
      issuedAt: null,
      placa: null,
      chassi: null,
      consultaId: null,
      dataHoraConsulta: null,
      tipoChave: null,
      history: HISTORY_ITEMS.map(({ key, label }) => ({
        key,
        label,
        ...classifyCertificateStatus(null),
      })),
      consultationNotes: [],
      allClear: false,
      available: false,
    };
  } finally {
    if (parser) await parser.destroy();
  }
}
