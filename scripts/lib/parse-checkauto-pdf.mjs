import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const HISTORY_ITEMS = [
  { key: "leilao", label: "Leilão", patterns: [/leil[aã]o/i] },
  {
    key: "sinistro",
    label: "Sinistro / Perda",
    patterns: [/sinistro\s*\/?\s*perda/i, /sinistro/i],
  },
  {
    key: "roubo",
    label: "Roubo / Furto",
    patterns: [/roubo\s*\/?\s*furto/i, /roubo/i, /furto/i],
  },
  {
    key: "estaduais",
    label: "Informações Estaduais",
    patterns: [/informa[cç][oõ]es\s+estaduais/i],
  },
];

function cleanStatus(raw) {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "");
}

/**
 * Certificado CheckAuto usa layout 2 colunas: status de itens anteriores
 * aparece em `before`. Para estaduais, ler só `after` do label.
 * Abreviação oficial: "INF Alienacao Fidu" (não "Alienação Fiduciária").
 */
function statusNearLabel(text, patterns, key) {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const idx = match.index;
    const before = text.slice(Math.max(0, idx - 120), idx);
    const after = text.slice(idx, idx + match[0].length + 220);
    const window = before + after;

    if (key === "estaduais") {
      const alien =
        after.match(/INF\s*Aliena[cç]?[aã]?o?\s*Fidu[a-z]*[^\n]{0,40}/i) ||
        after.match(/Aliena[cç][aã]o\s+Fiduci[aá]ria[^\n.]{0,80}/i) ||
        after.match(/Aliena[cç][aã]o\s+Fidu[^\n.]{0,40}/i);
      if (alien) return cleanStatus(alien[0]);
      const restri = after.match(
        /(?:Restri[cç][aã]o|Bloqueio|Pend[eê]ncia)[^\n.]{0,80}/i,
      );
      if (restri) return cleanStatus(restri[0]);
      // Sem Registro só no after — before sempre poluído por outros itens
      if (/sem\s*registro/i.test(after)) return "Sem Registro";
      if (/nenhum\s*registro/i.test(after)) return "Sem Registro";
      continue;
    }

    if (/sem\s*registro/i.test(window)) return "Sem Registro";
    if (/nenhum\s*registro/i.test(window)) return "Sem Registro";
    if (/com\s*registro|consta\s+registro|registro\s+encontrado/i.test(window)) {
      return "Com registro";
    }
  }
  return null;
}

function extractField(text, labelPattern) {
  const m = text.match(labelPattern);
  return m?.[1]?.trim() || null;
}

function normalizeTipoChave(raw) {
  if (!raw) return null;
  const compact = String(raw)
    .replace(/\s+/g, " ")
    .replace(/\s*UF:\s*/i, " UF: ")
    .trim();
  return compact || null;
}

/**
 * Extrai protocolo CheckAuto (veracidade) de XML ou texto de PDF.
 * Campos: ConsultaID, DataHoraConsulta, TipoChave.
 */
export function extractCheckAutoProtocol(source) {
  const text = String(source || "");
  if (!text.trim()) {
    return { consultaId: null, dataHoraConsulta: null, tipoChave: null };
  }

  const consultaId =
    extractField(text, /<ConsultaID>\s*(\d+)\s*<\/ConsultaID>/i) ||
    extractField(text, /ConsultaID\s*[:=]?\s*(\d{6,})/i) ||
    extractField(text, /Protocolo\s*[:=]?\s*(\d{6,})/i) ||
    null;

  const dataHoraConsulta =
    extractField(
      text,
      /<DataHoraConsulta>\s*([^<]+?)\s*<\/DataHoraConsulta>/i,
    ) ||
    extractField(
      text,
      /DataHoraConsulta\s*[:=]?\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/i,
    ) ||
    extractField(text, /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/) ||
    null;

  let tipoChave =
    extractField(text, /<TipoChave>\s*([\s\S]*?)\s*<\/TipoChave>/i) ||
    extractField(text, /TipoChave\s*[:=]?\s*(Placa:\s*[A-Z0-9-]+\s*UF:\s*[A-Z]{2})/i) ||
    null;

  if (!tipoChave) {
    const placa = extractField(text, /Placa:\s*([A-Z]{3}[- ]?[0-9][0-9A-Z][0-9]{2})/i);
    const uf = extractField(text, /\bUF:\s*([A-Z]{2})\b/i);
    if (placa && uf) tipoChave = `Placa: ${placa.replace(/\s+/g, "")} UF: ${uf}`;
  }

  return {
    consultaId: consultaId ? String(consultaId) : null,
    dataHoraConsulta: dataHoraConsulta ? String(dataHoraConsulta).trim() : null,
    tipoChave: normalizeTipoChave(tipoChave),
  };
}

export function parseCheckAutoXml(xmlPathOrString) {
  const xml = existsSync(xmlPathOrString)
    ? readFileSync(xmlPathOrString, "utf8")
    : String(xmlPathOrString || "");
  return extractCheckAutoProtocol(xml);
}

function extractTextWithPython(buffer) {
  const tmp = join(tmpdir(), `checkauto-${Date.now()}.pdf`);
  writeFileSync(tmp, buffer);
  try {
    const script = `
import fitz, sys
doc = fitz.open(sys.argv[1])
print("\\n".join(page.get_text() for page in doc))
`;
    const out = execFileSync("python3", ["-c", script, tmp], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return out || "";
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Extrai histórico e metadados do PDF CheckAuto atual.
 * Se o parse falhar ou itens não forem encontrados, status fica null
 * (NÃO inventa "Sem Registro").
 */
export async function parseCheckAutoPdf(pdfPathOrBuffer) {
  const buffer = Buffer.isBuffer(pdfPathOrBuffer)
    ? pdfPathOrBuffer
    : readFileSync(pdfPathOrBuffer);

  let rawText = "";
  try {
    rawText = extractTextWithPython(buffer);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      text: "",
      issuedAt: null,
      chassi: null,
      consultaId: null,
      dataHoraConsulta: null,
      tipoChave: null,
      history: HISTORY_ITEMS.map((item) => ({
        key: item.key,
        label: item.label,
        status: null,
      })),
      allClear: false,
      available: false,
    };
  }

  const history = HISTORY_ITEMS.map((item) => ({
    key: item.key,
    label: item.label,
    status: statusNearLabel(rawText, item.patterns, item.key),
  }));

  const available = history.some((h) => h.status != null);
  const allClear =
    available && history.every((h) => h.status === "Sem Registro");

  const protocol = extractCheckAutoProtocol(rawText);

  const issuedAt = protocol.dataHoraConsulta || null;

  const chassi =
    extractField(rawText, /Chassi:\s*([A-Z0-9X]{8,})/i) ||
    extractField(rawText, /Chassi\s*\n\s*([A-Z0-9X]{8,})/i) ||
    null;

  return {
    ok: true,
    error: null,
    text: rawText,
    issuedAt,
    chassi,
    consultaId: protocol.consultaId,
    dataHoraConsulta: protocol.dataHoraConsulta,
    tipoChave: protocol.tipoChave,
    history,
    allClear,
    available,
  };
}

export { HISTORY_ITEMS };
