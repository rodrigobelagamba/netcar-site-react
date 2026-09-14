/**
 * Compacta dossiê CheckAuto pro layout i-CHECK de 3 páginas.
 * Mantém indisponibilidade e apontamentos; uma consulta concluída não significa ausência de registros.
 */

function fieldValue(section, label) {
  return section?.fields?.find((f) => f.label === label)?.value || "";
}

function isUnavailable(section, status) {
  if (!section || section.riskLevel === "unavailable") return true;
  return /indispon[ií]vel/i.test(String(status || ""));
}

/**
 * @returns {{ history: Array<{key,label,status,hint,clear,riskLevel}>, highlights: Array<{label,value}> }}
 */
export function summarizeDossier(sections = []) {
  const byKey = Object.fromEntries((sections || []).map((s) => [s.key, s]));

  const history = [
    {
      key: "registroEstadual",
      label: "Registro DETRAN",
      hint: "Identidade e situação no DETRAN",
    },
    {
      key: "rouboFurto",
      label: "Roubo / Furto",
      hint: "Bases federais de ocorrência",
    },
    {
      key: "leilao",
      label: "Leilão / Sinistro",
      hint: "Remarketing e sinistro",
    },
    {
      key: "agregado",
      label: "Chassi / Motor",
      hint: "Cruzamento placa · chassi · motor",
    },
    {
      key: "decodificador",
      label: "VIN (chassi)",
      hint: "Fabricante, fábrica, versão",
    },
    {
      key: "precificador",
      label: "Tabela FIPE",
      hint: "Referência de mercado",
    },
  ]
    .map((item) => {
      const section = byKey[item.key];
      if (!section) return null;
      const status = section.riskLabel || "";

      const unavailable = isUnavailable(section, status);
      const riskLevel = unavailable
        ? "unavailable"
        : section.riskLevel === "alert"
          ? "alert"
          : section.riskLevel === "ok"
            ? "ok"
            : "warn";
      return {
        ...item,
        status: unavailable ? null : status,
        clear: riskLevel === "ok",
        riskLevel,
      };
    })
    .filter(Boolean);

  const reg = byKey.registroEstadual;
  const fipe = byKey.precificador;
  const roubo = byKey.rouboFurto;
  const agregado = byKey.agregado;
  const leilao = byKey.leilao;

  const fipeValor =
    fipe?.records?.[0]?.find((f) => f.label === "Valor")?.value ||
    fieldValue(fipe, "Valor");

  const highlights = [
    !isUnavailable(reg, reg?.riskLabel)
      ? { label: "Situação DETRAN", value: fieldValue(reg, "Situação") }
      : null,
    !isUnavailable(reg, reg?.riskLabel)
      ? { label: "Município", value: fieldValue(reg, "Município") }
      : null,
    !isUnavailable(reg, reg?.riskLabel)
      ? { label: "Restrições", value: fieldValue(reg, "Restrições") }
      : null,
    !isUnavailable(reg, reg?.riskLabel)
      ? { label: "Débitos", value: fieldValue(reg, "Débito IPVA/Licenc.") }
      : null,
    !isUnavailable(agregado, agregado?.riskLabel) ||
    !isUnavailable(reg, reg?.riskLabel)
      ? {
          label: "Nº motor",
          value:
            fieldValue(reg, "Nº motor") || fieldValue(agregado, "Nº motor"),
        }
      : null,
    !isUnavailable(roubo, roubo?.riskLabel)
      ? {
          label: "Roubo/furto",
          value: roubo?.riskLabel || fieldValue(roubo, "Qtde ocorrências"),
        }
      : null,
    !isUnavailable(fipe, fipe?.riskLabel)
      ? { label: "FIPE (ref.)", value: fipeValor }
      : null,
    !isUnavailable(leilao, leilao?.riskLabel)
      ? { label: "Leilão", value: leilao?.riskLabel || "" }
      : null,
  ].filter(
    (h) => h && h.value && h.value !== "—" && !/indispon[ií]vel/i.test(h.value),
  );

  return { history, highlights, sections };
}
