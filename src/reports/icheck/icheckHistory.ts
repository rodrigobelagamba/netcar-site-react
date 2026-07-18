/**
 * Helpers compartilhados HTML + PDF Netcar i-CHECK.
 * Histórico/consulta: só fatos do meta CheckAuto — sem inventar status.
 */

export type ICheckHistoryItem = {
  key: string;
  label: string;
  status: string | null;
  hint?: string;
  clear?: boolean;
  riskLevel?: string;
};

/** "Sem Registro" do certificado → destaque "NADA CONSTA". */
export function formatHistoryStatus(status: string | null | undefined): string {
  if (!status) return "";
  if (/^sem\s*registro\.?$/i.test(status.trim())) return "NADA CONSTA";
  return status;
}

export function isClearHistoryStatus(status: string | null | undefined): boolean {
  const s = String(status || "");
  return /^sem\s*registro/i.test(s) || /^nada\s*consta/i.test(s);
}

/** Alienação fiduciária (inclui abreviação CheckAuto: INF Alienacao Fidu). */
export function isAlienacaoFiduciaria(text: string | null | undefined): boolean {
  return /aliena/i.test(String(text || ""));
}

export function historyRiskLevel(
  status: string | null | undefined,
  metaLevel?: string | null,
): "ok" | "warn" | "alert" {
  if (isAlienacaoFiduciaria(status)) return "warn";
  if (metaLevel === "alert" || metaLevel === "warn" || metaLevel === "ok") {
    return metaLevel;
  }
  const s = String(status || "");
  if (!s || isClearHistoryStatus(s) || /^consultado\.?$/i.test(s)) return "ok";
  if (/com\s*registro|consta\s+registro|ocorr[eê]ncia|roubo|furto|leil[aã]o|sinistro|bloqueio|restri/i.test(s)) {
    return "alert";
  }
  return "ok";
}

/** Normaliza cards do meta para HTML e PDF (mesma regra de risco). */
export function normalizeHistoryItems(
  items: ICheckHistoryItem[] | null | undefined,
): ICheckHistoryItem[] {
  return (items || [])
    .filter((item) => item.status && !/indispon[ií]vel/i.test(item.status))
    .map((item) => {
      const riskLevel = historyRiskLevel(item.status, item.riskLevel);
      return {
        ...item,
        clear: riskLevel === "ok" && isClearHistoryStatus(item.status),
        riskLevel,
      };
    });
}
