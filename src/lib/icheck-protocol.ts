/**
 * Protocolo i-CHECK Netcar = data da consulta em MMDDYYYY (formato americano).
 * Ex.: 22/12/2023 09:16:59 → "12222023"
 */
export function icheckProtocolFromDate(
  dataHora: string | null | undefined,
): string | null {
  if (!dataHora) return null;
  const match = String(dataHora).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${month}${day}${year}`;
}

/** Aceita só MMDDYYYY (8 dígitos); senão recalcula pela data. */
export function resolveIcheckProtocol(
  protocoloConsulta: string | null | undefined,
  dataHora: string | null | undefined,
): string | null {
  const fromMeta = String(protocoloConsulta || "").trim();
  if (/^\d{8}$/.test(fromMeta)) return fromMeta;
  return icheckProtocolFromDate(dataHora);
}
