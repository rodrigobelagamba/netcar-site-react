import { readFileSync, existsSync } from "node:fs";

function textOf(node, tag) {
  if (!node) return "";
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = String(node).match(re);
  if (!m) return "";
  return m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function blockOf(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = String(xml).match(re);
  return m ? m[0] : "";
}

function innerOf(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = String(xml).match(re);
  return m ? m[1] : "";
}

function allBlocks(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  return [...String(xml).matchAll(re)].map((m) => m[0]);
}

function field(label, value) {
  const v = value == null ? "" : String(value).trim();
  if (!v) return null;
  return { label, value: v };
}

function fields(pairs) {
  return pairs.map(([l, v]) => field(l, v)).filter(Boolean);
}

function maskChassi(chassi) {
  const clean = String(chassi || "").toUpperCase().replace(/\s+/g, "");
  if (clean.length < 8) return clean || "—";
  return `${clean.slice(0, 5)}${"X".repeat(Math.max(0, clean.length - 8))}${clean.slice(-3)}`;
}

function maskPlate(placa) {
  const clean = String(placa || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  if (clean.length < 5) return clean || "—";
  // Padrão certificado CheckAuto: IZT6J30 → IZT-XX30
  return `${clean.slice(0, 3)}-XX${clean.slice(-2)}`;
}

function moneyBr(value) {
  const raw = String(value || "").replace(/\./g, "").replace(",", ".");
  const n = Number(raw);
  if (!Number.isFinite(n)) return String(value || "—");
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function resumoCode(xml, tag) {
  const v = textOf(blockOf(xml, "ResumoConsulta") || xml, tag);
  return v ? Number(v) : null;
}

/** Códigos CheckAuto: 1=info encontrada, 2=sem registro (varia por módulo). */
function riskFromCode(code, { emptyIsOk = false } = {}) {
  if (code == null) return { level: "unavailable", label: "Indisponível" };
  if (emptyIsOk && code === 2) return { level: "ok", label: "Sem registro" };
  if (code === 1) return { level: "attention", label: "Informação encontrada" };
  if (code === 2) return { level: "ok", label: "Sem registro" };
  return { level: "attention", label: `Código ${code}` };
}

export const DOSSIER_COPY = {
  registroEstadual: {
    title: "2. Registro estadual (DETRAN)",
    what: "Base do DETRAN do estado de jurisdição: identidade oficial do veículo e situação cadastral.",
    risk: "Divergência de chassi/placa, restrições graves ou situação fora de circulação elevam o risco jurídico da compra. Débitos (IPVA, licenciamento, multas) precisam ser quitados ou negociados na transferência.",
  },
  rouboFurto: {
    title: "3. Roubo / furto federal",
    what: "Consulta às bases federais de ocorrências de roubo, furto, recuperação e baixa.",
    risk: "Ocorrência ativa (Roubado/Furtado) é risco crítico — não adquirir. Histórico recuperado/baixado exige análise do BO e regularidade atual; não inventamos limpeza se constar registro.",
  },
  agregado: {
    title: "4. Agregado chassi / motor",
    what: "Cruzamento dos identificadores agregados: chassi, placa, motor, cilindradas e UF.",
    risk: "Inconsistência entre chassi, placa e motor pode indicar adulteração ou veículo remarcado. Exige inspeção presencial e conferência no documento.",
  },
  decodificador: {
    title: "5. Decodificador de chassi (VIN)",
    what: "Decodifica o VIN: fabricante, fábrica, país, carroceria, versão, potência, portas etc.",
    risk: "Se a decodificação não bater com o carro físico (motor, carroceria, ano), há indício de irregularidade ou documentação divergente.",
  },
  precificador: {
    title: "6. Precificador (Tabela FIPE)",
    what: "Referências de mercado FIPE ligadas ao modelo consultado (código, ano, combustível e valor).",
    risk: "Valor FIPE é referência — não é preço de venda. Desvio forte do anúncio merece atenção, mas sozinho não prova problema.",
  },
  leilao: {
    title: "7. Leilão / remarketing",
    what: "Busca registros de leilão, sinistro e remarketing nas bases consultadas pela CheckAuto.",
    risk: "Passagem por leilão/sinistro pode afetar valor, seguro e procedência. Sem registro reduz esse risco específico — não substitui vistoria cautelar.",
  },
};

function parseRegistroEstadual(xml) {
  const block = blockOf(innerOf(xml, "Veiculo") || xml, "RegistroEstadual");
  const code = resumoCode(xml, "RegistroEstadual");
  const risk = riskFromCode(code);
  const situacao = textOf(block, "TipoSituacaoVeiculo");
  const debitoIpva = textOf(block, "DebitoIpvaLicenc");
  const restricoes = [
    textOf(block, "NomeRestricao1"),
    textOf(block, "NomeRestricao2"),
    textOf(block, "NomeRestricao3"),
    textOf(block, "NomeRestricao4"),
  ].filter(Boolean);

  let level = risk.level;
  let label = risk.label;
  if (/roub|furto|baixa|leil/i.test(restricoes.join(" "))) {
    level = "alert";
    label = "Restrição relevante";
  } else if (debitoIpva && /existe\s+d[eé]bito/i.test(debitoIpva)) {
    level = "attention";
    label = "Com débitos / restrições leves";
  } else if (code === 1 && situacao) {
    level = restricoes.length ? "attention" : "ok";
    label = restricoes.length ? "Veículo encontrado — ver restrições" : "Veículo encontrado";
  }

  return {
    key: "registroEstadual",
    ...DOSSIER_COPY.registroEstadual,
    riskLevel: level,
    riskLabel: label,
    retorno: textOf(block, "DescricaoRetorno"),
    fields: fields([
      ["Placa", maskPlate(textOf(block, "Placa"))],
      ["Chassi", maskChassi(textOf(block, "Chassi"))],
      ["Renavam", textOf(block, "Renavam")],
      ["Cor", textOf(block, "Cor")],
      ["Marca / modelo", textOf(block, "MarcaModelo")],
      ["Ano fab / mod", `${textOf(block, "AnoFabricacao") || "—"} / ${textOf(block, "AnoModelo") || "—"}`],
      ["Combustível", textOf(block, "Combustivel")],
      ["Tipo", textOf(block, "TipoVeiculo")],
      ["Espécie", textOf(block, "EspecieVeiculo")],
      ["Categoria", textOf(block, "CategoriaVeiculo")],
      ["Potência", textOf(block, "PotenciaVeiculo") ? `${textOf(block, "PotenciaVeiculo")} cv` : ""],
      ["Passageiros", textOf(block, "CapacidadePassageiros")],
      ["Eixos", textOf(block, "NumeroEixos")],
      ["Procedência", textOf(block, "ProcedenciaVeiculo")],
      ["Situação", situacao],
      ["Município", textOf(block, "MunicipioEmplacamento")],
      ["Nº motor", textOf(block, "NumeroMotor")],
      ["UF jurisdição", textOf(block, "UFJurisdicao")],
      ["Restrições", restricoes.join(" · ") || "Nenhuma informada"],
      ["Débito IPVA/Licenc.", debitoIpva],
      ["Débito multas", textOf(block, "DebitosMultas")],
      ["Valor IPVA", textOf(block, "ValorDebitoIPVA") ? moneyBr(textOf(block, "ValorDebitoIPVA")) : ""],
      ["Valor licenciamento", textOf(block, "ValorDebitoLicenciamento") ? moneyBr(textOf(block, "ValorDebitoLicenciamento")) : ""],
      ["Valor multas", textOf(block, "ValorDebitoMultas")],
      ["Valor DPVAT", textOf(block, "ValorDebitoDPVAT")],
    ]),
    records: [],
  };
}

function parseRouboFurto(xml) {
  const block = blockOf(innerOf(xml, "Veiculo") || xml, "RouboFurtoFederal");
  const code = resumoCode(xml, "RouboFurtoFederal");
  const regs = allBlocks(block, "Registro");
  const records = regs.map((reg) =>
    fields([
      ["Categoria", textOf(reg, "CategoriaOcorrencia")],
      ["Data", textOf(reg, "DataOcorrencia")],
      ["UF BO", textOf(reg, "UFBoletimOcorrencia")],
      ["Órgão", textOf(reg, "OrgaoSeguranca")],
      ["Tipo declaração", textOf(reg, "TpDeclaracao")],
      ["Marca / modelo", textOf(reg, "MarcaModelo")],
    ]),
  );
  const cats = records
    .map((r) => r.find((f) => f.label === "Categoria")?.value || "")
    .join(" ");
  let level = "ok";
  let label = "Sem ocorrência ativa";
  if (!block || code == null) {
    level = "unavailable";
    label = "Indisponível";
  } else if (regs.length === 0 && code === 2) {
    level = "ok";
    label = "Sem registro";
  } else if (/roubado|furtado/i.test(cats) && !/recuperado|baixado/i.test(cats)) {
    level = "alert";
    label = "Ocorrência crítica";
  } else if (regs.length > 0) {
    level = "attention";
    label = `${regs.length} ocorrência(ões) — ver histórico`;
  }

  return {
    key: "rouboFurto",
    ...DOSSIER_COPY.rouboFurto,
    riskLevel: level,
    riskLabel: label,
    retorno: textOf(block, "DescricaoRetorno"),
    fields: fields([
      ["Qtde ocorrências", textOf(block, "QtdeOcorrencias") || String(regs.length)],
      ["Retorno", textOf(block, "DescricaoRetorno")],
    ]),
    records,
  };
}

function parseAgregado(xml) {
  const block = blockOf(innerOf(xml, "Veiculo") || xml, "AgregadoChassiMotor");
  const code = resumoCode(xml, "AgregadoChassiMotor");
  const risk = riskFromCode(code);
  return {
    key: "agregado",
    ...DOSSIER_COPY.agregado,
    riskLevel: code === 1 ? "ok" : risk.level,
    riskLabel: code === 1 ? "Identificadores cruzados" : risk.label,
    retorno: textOf(block, "DescricaoRetorno"),
    fields: fields([
      ["Chassi", maskChassi(textOf(block, "Chassi"))],
      ["Placa", maskPlate(textOf(block, "Placa"))],
      ["Nº motor", textOf(block, "NumMotor")],
      ["Cilindradas", textOf(block, "Cilindradas")],
      ["Renavam", textOf(block, "Renavam")],
      ["UF", textOf(block, "uf") || textOf(block, "UF")],
      ["Retorno", textOf(block, "DescricaoRetorno")],
    ]),
    records: [],
  };
}

function parseDecodificador(xml) {
  const block = blockOf(innerOf(xml, "Veiculo") || xml, "DecodificadorChassi");
  const code = resumoCode(xml, "DecodificadorChassi");
  const risk = riskFromCode(code);
  const regs = allBlocks(block, "Registro").filter(
    (r) => !r.includes("<Complemento"),
  );
  // only top-level Registro under Decodificador — exclude Complemento children by taking first series
  const mainInner = innerOf(block, "DecodificadorChassi") || block;
  const beforeComp = mainInner.split(/<Complemento/i)[0];
  const mainRegs = allBlocks(`<x>${beforeComp}</x>`, "Registro");
  const fieldsList = mainRegs
    .map((reg) => field(textOf(reg, "Rotulo"), textOf(reg, "Descricao")))
    .filter(Boolean);
  const compInner = innerOf(block, "Complemento");
  const compFields = allBlocks(compInner, "Registro")
    .map((reg) => field(textOf(reg, "Rotulo"), textOf(reg, "Descricao")))
    .filter(Boolean);

  return {
    key: "decodificador",
    ...DOSSIER_COPY.decodificador,
    riskLevel: code === 1 ? "ok" : risk.level,
    riskLabel: code === 1 ? "VIN decodificado" : risk.label,
    retorno: textOf(block, "DescricaoRetorno"),
    fields: fieldsList,
    records: compFields.length
      ? [compFields.map((f) => ({ label: f.label, value: f.value }))]
      : [],
    complemento: compFields,
  };
}

function parsePrecificador(xml) {
  const block = blockOf(innerOf(xml, "Veiculo") || xml, "Precificador");
  const tabela = blockOf(block, "TabelaFipe") || block;
  const code = Number(textOf(tabela, "CodigoRetorno") || resumoCode(xml, "Precificador"));
  const regs = allBlocks(tabela, "Registro");
  const records = regs.map((reg) =>
    fields([
      ["Código FIPE", textOf(reg, "CodigoFipe")],
      ["Fabricante", textOf(reg, "Fabricante")],
      ["Modelo", textOf(reg, "Modelo")],
      ["Ano", textOf(reg, "Ano")],
      ["Combustível", textOf(reg, "Combustivel")],
      ["Valor", textOf(reg, "Valor") ? moneyBr(textOf(reg, "Valor")) : ""],
    ]),
  );
  return {
    key: "precificador",
    ...DOSSIER_COPY.precificador,
    riskLevel: records.length ? "ok" : riskFromCode(code).level,
    riskLabel: records.length
      ? `${records.length} referência(s) FIPE`
      : riskFromCode(code).label,
    retorno: textOf(tabela, "DescricaoRetorno"),
    fields: fields([
      ["Qtd registros", textOf(tabela, "QtdRegistros") || String(records.length)],
      ["Retorno", textOf(tabela, "DescricaoRetorno")],
    ]),
    records,
  };
}

function parseLeilao(xml) {
  const block = blockOf(innerOf(xml, "Veiculo") || xml, "LeilaoRemarketing");
  const code = resumoCode(xml, "LeilaoRemarketing");
  const regs = allBlocks(block, "Registro");
  const records = regs.map((reg) =>
    fields([
      ["Descrição", textOf(reg, "Descricao") || textOf(reg, "DescricaoRetorno")],
      ["Data", textOf(reg, "Data") || textOf(reg, "DataOcorrencia")],
      ["Base", textOf(reg, "Base") || textOf(reg, "Fonte")],
      ["Observação", textOf(reg, "Observacao") || textOf(reg, "Obs")],
    ]),
  );
  const noRecord =
    code === 2 ||
    /n[aã]o\s+h[aá]\s+registro/i.test(textOf(block, "DescricaoRetorno"));
  return {
    key: "leilao",
    ...DOSSIER_COPY.leilao,
    riskLevel: noRecord ? "ok" : records.length ? "alert" : riskFromCode(code, { emptyIsOk: true }).level,
    riskLabel: noRecord
      ? "Sem registro de leilão/sinistro"
      : records.length
        ? "Registro de leilão/sinistro"
        : riskFromCode(code, { emptyIsOk: true }).label,
    retorno: textOf(block, "DescricaoRetorno"),
    fields: fields([["Retorno", textOf(block, "DescricaoRetorno")]]),
    records,
  };
}

export function parseCheckAutoDossier(xmlPathOrString) {
  const xml = existsSync(xmlPathOrString)
    ? readFileSync(xmlPathOrString, "utf8")
    : String(xmlPathOrString || "");

  if (!xml.trim()) {
    return {
      ok: false,
      protocol: { consultaId: null, dataHoraConsulta: null, tipoChave: null },
      sections: [],
      vehicleHint: null,
      history: [],
      allClear: false,
      available: false,
    };
  }

  const tipoRaw = textOf(xml, "TipoChave").replace(/\s+/g, " ");
  const tipoMasked = tipoRaw
    ? tipoRaw.replace(/Placa:\s*([A-Z0-9-]{5,})/i, (_, p) => `Placa: ${maskPlate(p)}`)
    : null;
  const protocol = {
    consultaId: textOf(xml, "ConsultaID") || null,
    dataHoraConsulta: textOf(xml, "DataHoraConsulta") || null,
    tipoChave: tipoMasked,
  };

  const sections = [
    parseRegistroEstadual(xml),
    parseRouboFurto(xml),
    parseAgregado(xml),
    parseDecodificador(xml),
    parsePrecificador(xml),
    parseLeilao(xml),
  ];

  const reg = sections[0];
  const placa = reg.fields.find((f) => f.label === "Placa")?.value || "";
  const marcaModelo = reg.fields.find((f) => f.label === "Marca / modelo")?.value || "";
  const ano = reg.fields.find((f) => f.label === "Ano fab / mod")?.value || "";

  const history = [
    {
      key: "leilao",
      label: "Leilão",
      status: sections[5].riskLevel === "ok" ? "Sem Registro" : sections[5].riskLabel,
    },
    {
      key: "sinistro",
      label: "Sinistro / Perda",
      status: sections[5].riskLevel === "ok" ? "Sem Registro" : null,
    },
    {
      key: "roubo",
      label: "Roubo / Furto",
      status:
        sections[1].riskLevel === "ok"
          ? "Sem Registro"
          : sections[1].records.length
            ? "Com registro"
            : null,
    },
    {
      key: "estaduais",
      label: "Informações Estaduais",
      status: sections[0].riskLevel === "unavailable" ? null : "Consultado",
    },
  ];

  const available = sections.some((s) => s.riskLevel !== "unavailable");
  const allClear = sections.every(
    (s) => s.riskLevel === "ok" || s.key === "precificador" || s.key === "decodificador" || s.key === "agregado" || s.key === "registroEstadual",
  ) && sections[1].riskLevel === "ok" && sections[5].riskLevel === "ok";

  // allClear more carefully: roubo ok + leilao ok, registro not alert
  const strictClear =
    sections[1].riskLevel === "ok" &&
    sections[5].riskLevel === "ok" &&
    sections[0].riskLevel !== "alert";

  return {
    ok: true,
    protocol,
    sections,
    vehicleHint: {
      placa,
      placaMasked: maskPlate(placa),
      marcaModelo,
      yearLabel: ano,
      cor: reg.fields.find((f) => f.label === "Cor")?.value || "",
      combustivel: reg.fields.find((f) => f.label === "Combustível")?.value || "",
      chassiMasked: reg.fields.find((f) => f.label === "Chassi")?.value || "",
      motor: reg.fields.find((f) => f.label === "Nº motor")?.value || "",
    },
    history,
    allClear: strictClear,
    available,
  };
}

export { maskChassi, maskPlate };
