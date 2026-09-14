/** A consultation date is not a provider protocol. Kept for old callers. */
export function icheckProtocolFromDate(
  _dataHora: string | null | undefined,
): null {
  return null;
}

/** Reject the old date-derived identifiers; preserve actual provider identifiers. */
export function resolveIcheckProtocol(
  protocoloConsulta: string | null | undefined,
  dataHora: string | null | undefined,
): string | null {
  const value = String(protocoloConsulta || "").trim();
  if (!value || !/^[a-zA-Z0-9][a-zA-Z0-9._/-]{2,79}$/.test(value)) return null;
  const match = String(dataHora || "").match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    if (
      [
        `${month}${day}${year}`,
        `${day}${month}${year}`,
        `${year}${month}${day}`,
      ].includes(value)
    )
      return null;
  }
  return value;
}
