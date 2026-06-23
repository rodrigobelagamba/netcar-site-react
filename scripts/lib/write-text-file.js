import { existsSync, readFileSync, writeFileSync } from "fs";

/** Normaliza para LF (Unix). */
export function normalizeTextEol(content) {
  return String(content).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Grava arquivo de texto em LF. Não toca o disco se o conteúdo for idêntico
 * (evita mtime/CRLF falso-positivo no git após deploy).
 * @returns {boolean} true se gravou, false se ignorou
 */
export function writeTextFile(filePath, content) {
  const normalized = normalizeTextEol(content);

  if (existsSync(filePath)) {
    const existing = normalizeTextEol(readFileSync(filePath, "utf-8"));
    if (existing === normalized) {
      return false;
    }
  }

  writeFileSync(filePath, normalized, "utf-8");
  return true;
}
