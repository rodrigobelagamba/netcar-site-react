/**
 * Validade i-CHECK: consulta oculta se dataHoraConsulta for anterior a (hoje − 2 anos).
 * Sem data parseável → inválida (não exibir).
 */

/** Extrai data (calendário local) de `DD/MM/YYYY` ou `DD/MM/YYYY HH:mm:ss`. */
export function parseConsultaDate(
  dataHora: string | null | undefined,
): Date | null {
  if (!dataHora) return null;
  const match = String(dataHora).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (
    !Number.isFinite(day) ||
    !Number.isFinite(month) ||
    !Number.isFinite(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/** True se consulta >= (now − 2 anos no calendário). */
export function isConsultaValid(
  dataHora: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const consulta = parseConsultaDate(dataHora);
  if (!consulta) return false;
  const cutoff = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
  return consulta.getTime() >= cutoff.getTime();
}
