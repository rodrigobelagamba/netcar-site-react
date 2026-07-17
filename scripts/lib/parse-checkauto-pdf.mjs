import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
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

function statusNearLabel(text, patterns) {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const idx = match.index;
    const window = text.slice(Math.max(0, idx - 100), idx + match[0].length + 120);
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
    status: statusNearLabel(rawText, item.patterns),
  }));

  const available = history.some((h) => h.status != null);
  const allClear =
    available && history.every((h) => h.status === "Sem Registro");

  const issuedAt =
    extractField(rawText, /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/) || null;

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
    history,
    allClear,
    available,
  };
}

export { HISTORY_ITEMS };
