/** Shared rules for the HTML page and its PDF summary. Only explicit results are clear. */
export type ICheckHistoryItem = {
  key: string;
  label: string;
  status: string | null;
  hint?: string;
  clear?: boolean;
  riskLevel?: string;
};

export const ICHECK_HISTORY_GROUPS = [
  { key: "leilao", label: "Leilão" },
  { key: "sinistro", label: "Sinistro / Perda" },
  { key: "roubo", label: "Roubo / Furto" },
  { key: "estaduais", label: "Informações estaduais" },
] as const;

export function canonicalHistoryKey(key: string): string {
  if (key === "rouboFurto") return "roubo";
  if (key === "registroEstadual") return "estaduais";
  return key;
}

export function isClearHistoryStatus(
  status: string | null | undefined,
): boolean {
  return /^(?:sem\s+registros?|nada\s+consta)(?:\s+de\s+(?:leil[aã]o(?:\s*\/\s*sinistro)?|sinistro|roubo(?:\s*\/\s*furto)?))?\.?$/i.test(
    String(status || "").trim(),
  );
}

export function formatHistoryStatus(status: string | null | undefined): string {
  return String(status || "").trim() || "Resultado indisponível";
}

export function isAlienacaoFiduciaria(
  text: string | null | undefined,
): boolean {
  return /aliena[cç][aã]o|alienacao|aliena/i.test(String(text || ""));
}

export function historyRiskLevel(
  status: string | null | undefined,
  metaLevel?: string | null,
): "ok" | "warn" | "alert" | "unknown" {
  const value = String(status || "").trim();
  if (
    !value ||
    /indispon[ií]vel|n[aã]o\s+(?:consultad[oa]|informad[oa])|n[aã]o\s+foi\s+poss[ií]vel/i.test(
      value,
    )
  )
    return "unknown";
  if (metaLevel === "unavailable" || metaLevel === "unknown") return "unknown";
  if (metaLevel === "alert") return "alert";
  if (isAlienacaoFiduciaria(value)) return "warn";
  if (isClearHistoryStatus(value)) {
    return metaLevel === "warn" || metaLevel === "attention" ? "warn" : "ok";
  }
  if (
    /com\s*registro|consta\s+registro|ocorr[eê]ncia|roubo|furto|leil[aã]o|sinistro|bloqueio|restri|d[eé]bito/i.test(
      value,
    )
  )
    return "alert";
  if (metaLevel === "warn" || metaLevel === "attention") return "warn";
  return "unknown";
}

/** Missing groups remain visible; unknown text never becomes a successful result. */
export function normalizeHistoryItems(
  items: ICheckHistoryItem[] | null | undefined,
): ICheckHistoryItem[] {
  const supplied = (items || []).map((item) => {
    const riskLevel = historyRiskLevel(item.status, item.riskLevel);
    return {
      ...item,
      key: canonicalHistoryKey(item.key),
      status: formatHistoryStatus(item.status),
      clear: riskLevel === "ok" && isClearHistoryStatus(item.status),
      riskLevel,
    };
  });
  const knownKeys = new Set<string>(
    ICHECK_HISTORY_GROUPS.map(({ key }) => key),
  );
  return [
    ...ICHECK_HISTORY_GROUPS.flatMap((group): ICheckHistoryItem[] => {
      const matches = supplied.filter((item) => item.key === group.key);
      return matches.length
        ? matches.map((item) => ({ ...item, label: group.label }))
        : [
            {
              ...group,
              status: "Resultado indisponível",
              clear: false,
              riskLevel: "unknown",
            },
          ];
    }),
    ...supplied.filter(({ key }) => !knownKeys.has(key)),
  ];
}

export type ICheckHistorySummary = {
  level: "clear" | "warning" | "alert" | "incomplete" | "unavailable";
  title: string;
  description: string;
};

export function getHistorySummary(
  items: ICheckHistoryItem[] | null | undefined,
): ICheckHistorySummary {
  const history = normalizeHistoryItems(items);
  const missing = history.some(({ riskLevel }) => riskLevel === "unknown");
  if (history.some(({ riskLevel }) => riskLevel === "alert"))
    return {
      level: "alert",
      title: "Consulta com apontamento",
      description: `Há apontamento nesta consulta. Confira os resultados individuais e a data da consulta.${missing ? " Há também resultados indisponíveis." : ""}`,
    };
  if (history.some(({ riskLevel }) => riskLevel === "warn"))
    return {
      level: "warning",
      title: "Consulta com observação",
      description: `Há observação nesta consulta. Confira os resultados individuais e a data da consulta.${missing ? " Há também resultados indisponíveis." : ""}`,
    };
  if (history.every(({ riskLevel }) => riskLevel === "unknown"))
    return {
      level: "unavailable",
      title: "Resultados indisponíveis",
      description:
        "Não foi possível apresentar os resultados individuais desta consulta. A ausência de dados não indica ausência de registros.",
    };
  if (missing)
    return {
      level: "incomplete",
      title: "Resultados parciais",
      description:
        "Parte dos resultados está indisponível. Não é possível concluir sobre os itens sem informação.",
    };
  return {
    level: "clear",
    title: "Sem registros nos itens consultados",
    description:
      "Os quatro grupos consultados estão sem registro na data indicada. Veja abaixo o resultado de cada grupo.",
  };
}
