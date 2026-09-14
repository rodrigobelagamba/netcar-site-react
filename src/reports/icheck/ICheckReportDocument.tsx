import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Link,
  StyleSheet,
} from "@react-pdf/renderer";
import {
  getHistorySummary,
  normalizeHistoryItems,
  type ICheckHistoryItem,
} from "./icheckHistory";
import { getConsultationAgeDays } from "../../lib/icheckMetadata";

const NAVY = "#00283C";
const MUTED = "#5A6B73";
const LINE = "#DFE7EB";
const SOFT = "#F5F8F9";
const PALETTES = {
  clear: {
    color: "#246B36",
    backgroundColor: "#EDF8F0",
    borderColor: "#9DCDA9",
  },
  warning: {
    color: "#87521A",
    backgroundColor: "#FFF7E6",
    borderColor: "#E4BE78",
  },
  alert: {
    color: "#A12B2B",
    backgroundColor: "#FEF0F0",
    borderColor: "#E3AAAA",
  },
  incomplete: { color: "#536570", backgroundColor: SOFT, borderColor: LINE },
  unavailable: { color: "#536570", backgroundColor: SOFT, borderColor: LINE },
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: NAVY,
    paddingTop: 28,
    paddingBottom: 48,
    paddingHorizontal: 32,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  netcarLogo: { width: 88, height: 22, objectFit: "contain" },
  brandName: { fontFamily: "Helvetica-Bold", fontSize: 13, color: NAVY },
  eyebrow: { fontSize: 7, color: MUTED, letterSpacing: 0.8, marginBottom: 3 },
  headerTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: NAVY },
  title: { fontSize: 17, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  subtitle: { fontSize: 8, color: MUTED, lineHeight: 1.4, marginBottom: 12 },
  banner: { borderWidth: 1, borderRadius: 7, padding: 12, marginBottom: 12 },
  bannerTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  bannerBody: { fontSize: 8.5, lineHeight: 1.4 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginTop: 6,
    marginBottom: 5,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  source: { fontSize: 7.5, color: MUTED, lineHeight: 1.4, marginBottom: 8 },
  row: { flexDirection: "row", marginBottom: 6 },
  half: { width: "50%", paddingRight: 6 },
  cell: {
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 5,
    padding: 8,
  },
  label: { fontSize: 7, color: MUTED, marginBottom: 3 },
  value: { fontSize: 8.5, fontFamily: "Helvetica-Bold", lineHeight: 1.35 },
  historyStatus: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.3,
  },
  hint: { fontSize: 7.5, color: MUTED, marginTop: 4, lineHeight: 1.35 },
  note: {
    backgroundColor: SOFT,
    borderRadius: 6,
    padding: 10,
    marginTop: 6,
    marginBottom: 10,
  },
  body: { fontSize: 8, color: MUTED, lineHeight: 1.45 },
  link: {
    fontSize: 8,
    color: "#126346",
    marginTop: 5,
    textDecoration: "underline",
  },
  detailRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  detailValue: { fontSize: 8, lineHeight: 1.4 },
  galleryCell: { width: "33.333%", paddingRight: 6 },
  photo: {
    width: "100%",
    height: 96,
    objectFit: "cover",
    borderRadius: 5,
    backgroundColor: SOFT,
  },
  optionals: { fontSize: 7.5, lineHeight: 1.4, color: NAVY },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: LINE,
  },
  footerText: { fontSize: 7, color: MUTED },
});

export type { ICheckHistoryItem };
export type ICheckConsultationSection = {
  title: string;
  items: Array<{ label: string; value: string }>;
};

export type ICheckReportData = {
  vehicleName: string;
  marca: string;
  modelo: string;
  yearLabel: string;
  placaMasked: string;
  kmLabel: string;
  cor: string;
  combustivel: string;
  cambio: string;
  motor: string;
  chassiMasked: string;
  issuedAt: string;
  /** Identificador real retornado pela fonte; nunca derivado da data. */
  consultaId?: string;
  dataHoraConsulta?: string;
  tipoChave?: string;
  listingUrl: string;
  sourcePdfUrl?: string;
  sourceLabel?: string;
  dekraLogoPath: string;
  checkautoLogoPath: string;
  partnerLogosPath: string;
  netcarLogoPath: string;
  checkIconPath: string;
  heroPhotos: string[];
  galleryPhotos: string[];
  photosUnavailable?: number;
  specs: Array<{ label: string; value: string }>;
  optionals: string[];
  history: ICheckHistoryItem[];
  /** Compatibilidade com geração offline; o documento deriva o estado dos itens. */
  historyAvailable: boolean;
  allClear: boolean;
  consultationHighlights?: Array<{ label: string; value: string }>;
  consultationSections?: ICheckConsultationSection[];
};

function rows<T>(items: T[], width: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += width)
    result.push(items.slice(i, i + width));
  return result;
}

function PageFooter({ listingUrl }: { listingUrl: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>Netcar Multimarcas · Resumo i-CHECK</Text>
      <Link src={listingUrl} style={styles.footerText}>
        Página do veículo
      </Link>
      <Text
        style={styles.footerText}
        render={({ pageNumber, totalPages }) =>
          `Página ${pageNumber} de ${totalPages}`
        }
      />
    </View>
  );
}

function Header({ data }: { data: ICheckReportData }) {
  return (
    <View style={styles.header} wrap={false}>
      <View>
        <Text style={styles.eyebrow}>NETCAR MULTIMARCAS</Text>
        <Text style={styles.headerTitle}>Resumo i-CHECK</Text>
      </View>
      {data.netcarLogoPath ? (
        <Image src={data.netcarLogoPath} style={styles.netcarLogo} />
      ) : (
        <Text style={styles.brandName}>Netcar</Text>
      )}
    </View>
  );
}

function FieldGrid({
  items,
  columns = 2,
}: {
  items: Array<{ label: string; value: string }>;
  columns?: 2 | 3;
}) {
  return (
    <React.Fragment>
      {rows(items, columns).map((row, index) => (
        <View key={index} style={styles.row} wrap={false}>
          {row.map((item, cellIndex) => (
            <View
              key={`${item.label}-${cellIndex}`}
              style={[
                styles.half,
                { width: columns === 3 ? "33.333%" : "50%" },
              ]}
            >
              <View style={[styles.cell, columns === 3 ? { padding: 6 } : {}]}>
                <Text style={styles.label}>{item.label}</Text>
                <Text style={styles.value}>{item.value}</Text>
              </View>
            </View>
          ))}
        </View>
      ))}
    </React.Fragment>
  );
}

export function ICheckReportDocument({ data }: { data: ICheckReportData }) {
  const history = normalizeHistoryItems(data.history);
  const summary = getHistorySummary(history);
  const palette = PALETTES[summary.level];
  const dataHora = data.dataHoraConsulta || data.issuedAt;
  const ageDays = getConsultationAgeDays(dataHora);
  const consultationFields = [
    {
      label: "Data e hora da consulta na fonte",
      value: dataHora || "Não informada na fonte",
    },
    ...(data.consultaId
      ? [
          {
            label: "Identificador da consulta na fonte",
            value: data.consultaId,
          },
        ]
      : []),
    ...(data.tipoChave
      ? [{ label: "Chave de consulta", value: data.tipoChave }]
      : []),
  ];
  const catalogFields = [
    {
      label: "Marca / modelo",
      value: `${data.marca} ${data.modelo}`.trim() || data.vehicleName,
    },
    { label: "Placa do cadastro", value: data.placaMasked },
    { label: "Ano fabricação / modelo", value: data.yearLabel },
    { label: "Quilometragem anunciada", value: data.kmLabel },
    { label: "Cor", value: data.cor },
    { label: "Combustível", value: data.combustivel },
    { label: "Câmbio", value: data.cambio },
    { label: "Motor", value: data.motor },
    ...data.specs.filter((item) => ["Potência", "Portas"].includes(item.label)),
  ].filter((item) => item.value && item.value !== "—");
  const gallery = [
    ...new Set(
      data.galleryPhotos.length ? data.galleryPhotos : data.heroPhotos,
    ),
  ].slice(0, 9);
  const hasCatalog =
    catalogFields.length > 0 || gallery.length > 0 || data.optionals.length > 0;

  return (
    <Document
      title={`Resumo i-CHECK - ${data.vehicleName}`}
      author="Netcar Multimarcas"
      subject="Resumo das consultas disponíveis e dados do anúncio"
    >
      <Page size="A4" style={styles.page} wrap>
        <Header data={data} />
        <View wrap={false}>
          <Text style={styles.title}>{data.vehicleName}</Text>
          <Text style={styles.subtitle}>
            {data.placaMasked ? `Placa do cadastro: ${data.placaMasked}. ` : ""}
            {data.sourcePdfUrl || summary.level !== "unavailable"
              ? "Resultados do documento associado ao veículo."
              : "Disponibilidade das consultas associadas ao veículo."}
          </Text>
        </View>
        <View style={[styles.banner, palette]} wrap={false}>
          <Text style={styles.bannerTitle}>{summary.title}</Text>
          <Text style={styles.bannerBody}>{summary.description}</Text>
        </View>
        <FieldGrid items={consultationFields} />
        {ageDays !== null && ageDays > 180 ? (
          <View
            style={[
              styles.note,
              { backgroundColor: PALETTES.warning.backgroundColor },
            ]}
            wrap={false}
          >
            <Text style={[styles.body, { color: PALETTES.warning.color }]}>
              Consulta realizada há mais de 180 dias. Os resultados retratam o
              documento dessa data; solicite uma consulta atualizada para
              confirmar a situação.
            </Text>
          </View>
        ) : null}
        <Text style={styles.sectionTitle} minPresenceAhead={85}>
          Consultas individuais
        </Text>
        <Text style={styles.source}>
          Fonte:{" "}
          {data.sourceLabel ||
            (data.sourcePdfUrl || summary.level !== "unavailable"
              ? "certificado CheckAuto / DEKRA associado"
              : "nenhum retorno validado disponível")}
          . Os resultados se referem à data da consulta.
        </Text>
        {rows(history, 2).map((row, index) => (
          <View key={index} style={styles.row} wrap={false}>
            {row.map((item) => {
              const itemPalette =
                item.riskLevel === "alert"
                  ? PALETTES.alert
                  : item.riskLevel === "warn"
                    ? PALETTES.warning
                    : item.clear
                      ? PALETTES.clear
                      : PALETTES.unavailable;
              return (
                <View key={item.key} style={styles.half}>
                  <View style={[styles.cell, itemPalette]}>
                    <Text style={styles.label}>{item.label}</Text>
                    <Text style={styles.historyStatus}>
                      {item.status || "Resultado indisponível"}
                    </Text>
                    {item.hint ? (
                      <Text style={styles.hint}>{item.hint}</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
        {(data.consultationHighlights || []).length > 0 ? (
          <>
            <Text style={styles.sectionTitle} minPresenceAhead={55}>
              Outros dados retornados pela consulta
            </Text>
            <FieldGrid items={data.consultationHighlights!} />
          </>
        ) : null}
        {(data.consultationSections || []).map((section, sectionIndex) => (
          <View key={`${section.title}-${sectionIndex}`}>
            <Text style={styles.sectionTitle} minPresenceAhead={45}>
              {section.title}
            </Text>
            {section.items.map((item, itemIndex) => (
              <View
                key={`${item.label}-${itemIndex}`}
                style={styles.detailRow}
                wrap={false}
              >
                <Text style={styles.label} minPresenceAhead={14}>
                  {item.label}
                </Text>
                <Text style={styles.detailValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        ))}
        <View style={styles.note} wrap={false}>
          <Text style={styles.body}>
            Este resumo reproduz os resultados disponíveis. Resultado
            indisponível não equivale a ausência de registro. O certificado
            resumido apresenta quatro grupos; consultas adicionais só são
            exibidas quando constam no retorno associado.
          </Text>
          {data.sourcePdfUrl ? (
            <Link src={data.sourcePdfUrl} style={styles.link}>
              Abrir certificado original CheckAuto / DEKRA
            </Link>
          ) : null}
        </View>
        <View style={styles.note} wrap={false}>
          <Text style={styles.body}>
            A consulta tem caráter informativo e não substitui vistoria cautelar
            ou laudo técnico. Registros podem mudar após a data informada. Dados
            do anúncio e fotos, apresentados a seguir quando disponíveis, são
            fornecidos pelo catálogo Netcar.
          </Text>
        </View>
        <PageFooter listingUrl={data.listingUrl} />
      </Page>
      {hasCatalog ? (
        <Page size="A4" style={styles.page} wrap>
          <Text style={styles.eyebrow}>CATÁLOGO NETCAR · DADOS DO ANÚNCIO</Text>
          <Text style={styles.title}>{data.vehicleName}</Text>
          <Text style={styles.subtitle}>
            Dados e fotos do catálogo Netcar. Não fazem parte do certificado
            CheckAuto / DEKRA.
          </Text>
          <Text style={styles.sectionTitle} minPresenceAhead={55}>
            Ficha do anúncio
          </Text>
          <FieldGrid items={catalogFields} columns={3} />
          {gallery.length > 0 ? (
            <>
              <Text style={styles.sectionTitle} minPresenceAhead={120}>
                Fotos do anúncio
              </Text>
              {rows(gallery, 3).map((row, index) => (
                <View key={index} style={styles.row} wrap={false}>
                  {row.map((src, photoIndex) => (
                    <View
                      key={`${index}-${photoIndex}`}
                      style={styles.galleryCell}
                    >
                      <Image src={src} style={styles.photo} />
                    </View>
                  ))}
                </View>
              ))}
            </>
          ) : null}
          {data.photosUnavailable ? (
            <Text style={styles.source}>
              {data.photosUnavailable} foto(s) não puderam ser incluídas. Veja a
              galeria completa na página do veículo.
            </Text>
          ) : null}
          {data.optionals.length > 0 ? (
            <View wrap={false}>
              <Text style={styles.sectionTitle} minPresenceAhead={38}>
                Opcionais anunciados
              </Text>
              <Text style={styles.optionals}>{data.optionals.join(" · ")}</Text>
            </View>
          ) : null}
          <PageFooter listingUrl={data.listingUrl} />
        </Page>
      ) : null}
    </Document>
  );
}
