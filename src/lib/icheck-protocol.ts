/**
 * Protocolo i-CHECK Netcar = data da consulta em MMDDYY (formato americano).
 * Ex.: 22/12/2023 09:16:59 → "122223"
 */
export function icheckProtocolFromDate(
  dataHora: string | null | undefined,
): string | null {
  if (!dataHora) return null;
  const match = String(dataHora).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${month}${day}${year.slice(2)}`;
}
