import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import { icheckProtocolFromDate } from "../../lib/icheck-protocol";

const NAVY = "#00283C";
const MINT = "#5CD29D";
const GREEN = "#2E7D32";
const MUTED = "#5A6B73";
const LINE = "#E4EAEF";
const SOFT = "#F5F8F9";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: NAVY,
    paddingTop: 28,
    paddingBottom: 36,
    paddingHorizontal: 28,
    backgroundColor: "#FFFFFF",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  brandBlock: { flexDirection: "column", gap: 2 },
  partnerBadge: { width: 248, height: 240, objectFit: "contain" },
  dekraLogo: { width: 200, height: 46, objectFit: "contain" },
  checkautoLogo: { width: 120, height: 24, objectFit: "contain", marginTop: 2 },
  netcarLogo: { width: 88, height: 22, objectFit: "contain" },
  partnerFallback: { fontSize: 18, fontFamily: "Helvetica-Bold", color: GREEN },
  eyebrow: {
    fontSize: 8,
    letterSpacing: 1.1,
    color: MUTED,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  reportTag: {
    fontSize: 8,
    letterSpacing: 1.0,
    color: MUTED,
    textTransform: "uppercase",
    marginTop: 4,
  },
  authorityBox: {
    backgroundColor: "#F3FBF7",
    borderWidth: 1,
    borderColor: MINT,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
    maxWidth: 420,
  },
  authorityTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: GREEN,
    marginBottom: 3,
    letterSpacing: 0.4,
  },
  authorityBody: {
    fontSize: 7.5,
    color: MUTED,
    lineHeight: 1.35,
  },
  title: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 2,
  },
  subtitle: { fontSize: 8, color: MUTED, maxWidth: 280 },
  statusBanner: {
    backgroundColor: SOFT,
    borderWidth: 1,
    borderColor: MINT,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    alignItems: "center",
  },
  statusBannerApproved: {
    backgroundColor: "#E8F7EF",
    borderWidth: 2,
    borderColor: GREEN,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    alignItems: "center",
  },
  statusBannerApprovedTitle: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: GREEN,
    textAlign: "center",
    letterSpacing: 1.4,
  },
  statusBannerApprovedSub: {
    fontSize: 8,
    color: MUTED,
    textAlign: "center",
    marginTop: 3,
    letterSpacing: 0.3,
  },
  protocolBox: {
    backgroundColor: "#F3FBF7",
    borderWidth: 1,
    borderColor: MINT,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
    marginTop: 8,
  },
  protocolTitle: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: GREEN,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  protocolGrid: {
    flexDirection: "row",
    gap: 8,
  },
  protocolCell: { flex: 1 },
  protocolLabel: {
    fontSize: 7,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  protocolValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },
  protocolValueMono: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    letterSpacing: 0.6,
  },
  historyHint: {
    fontSize: 6.5,
    color: MUTED,
    marginTop: 1,
  },
  statusBannerText: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: GREEN,
    textAlign: "center",
    letterSpacing: 0.6,
  },
  statusBannerMuted: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    textAlign: "center",
  },
  heroRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  heroImg: {
    flex: 1,
    height: 150,
    borderRadius: 8,
    objectFit: "cover",
    backgroundColor: SOFT,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    backgroundColor: NAVY,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginBottom: 8,
  },
  idGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 8,
    marginBottom: 12,
    overflow: "hidden",
  },
  idCell: {
    width: "50%",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  idLabel: {
    fontSize: 7,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  idValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: NAVY },
  historyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  historyCard: {
    width: "48.5%",
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 8,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: SOFT,
  },
  checkIcon: { width: 14, height: 14 },
  historyLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: NAVY },
  historyStatus: { fontSize: 8, color: MUTED },
  historyStatusOk: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: GREEN,
    textTransform: "uppercase",
  },
  historyStatusAlert: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#B91C1C",
    textTransform: "uppercase",
  },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: MUTED },
  galleryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  galleryImg: {
    width: "32%",
    height: 120,
    borderRadius: 6,
    objectFit: "cover",
    backgroundColor: SOFT,
    marginBottom: 4,
  },
  specGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  specPill: {
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 9,
    backgroundColor: SOFT,
  },
  specText: { fontSize: 8, color: NAVY },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginBottom: 12 },
  chip: {
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 7,
  },
  chipText: { fontSize: 7.5, color: NAVY },
  trustBox: {
    borderWidth: 1,
    borderColor: MINT,
    backgroundColor: "#F3FBF7",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  trustTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 4,
  },
  trustBody: { fontSize: 8, color: MUTED, lineHeight: 1.4 },
  disclaimerBox: {
    backgroundColor: "#FFF8E8",
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 11,
    marginBottom: 12,
  },
  disclaimerTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 3,
    letterSpacing: 0.4,
  },
  disclaimerBody: { fontSize: 7.5, color: MUTED, lineHeight: 1.35 },
  notesTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 6,
  },
  noteItem: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 5,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: MINT,
    marginTop: 3,
  },
  noteText: { flex: 1, fontSize: 7.5, color: MUTED, lineHeight: 1.35 },
  emptyPhoto: {
    flex: 1,
    height: 150,
    borderRadius: 8,
    backgroundColor: SOFT,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: "center",
    justifyContent: "center",
  },
});

export type ICheckHistoryItem = {
  key: string;
  label: string;
  status: string | null;
  hint?: string;
  clear?: boolean;
  riskLevel?: string;
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
  /** Protocolo CheckAuto — veracidade da consulta */
  consultaId?: string;
  dataHoraConsulta?: string;
  tipoChave?: string;
  listingUrl: string;
  dekraLogoPath: string;
  checkautoLogoPath: string;
  partnerLogosPath: string; // fallback combinado
  netcarLogoPath: string;
  checkIconPath: string; // png preferencial (react-pdf)
  heroPhotos: string[];
  galleryPhotos: string[];
  specs: Array<{ label: string; value: string }>;
  optionals: string[];
  history: ICheckHistoryItem[];
  historyAvailable: boolean;
  allClear: boolean;
  /** Destaques curtos da consulta (DETRAN, FIPE, etc.) */
  consultationHighlights?: Array<{ label: string; value: string }>;
};

function PageFooter({
  page,
  total,
  listingUrl,
}: {
  page: number;
  total: number;
  listingUrl: string;
}) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>Netcar Multimarcas · i-CHECK</Text>
      <Text style={styles.footerText}>{listingUrl}</Text>
      <Text style={styles.footerText}>
        Página {page} de {total}
      </Text>
    </View>
  );
}

function Header({
  data,
  showAuthority = false,
}: {
  data: ICheckReportData;
  showAuthority?: boolean;
}) {
  const hasPartnerBadge = Boolean(data.partnerLogosPath);
  const hasDekra = Boolean(data.dekraLogoPath);
  const hasCheckauto = Boolean(data.checkautoLogoPath);

  return (
    <View>
      <View style={styles.headerRow}>
        {/* Esquerda: badge oficial DEKRA + CheckAuto (quem atesta) */}
        <View
          style={[
            styles.brandBlock,
            { flexDirection: "row", alignItems: "center", gap: 12 },
          ]}
        >
          {hasPartnerBadge ? (
            <Image src={data.partnerLogosPath} style={styles.partnerBadge} />
          ) : null}
          <View style={{ flexDirection: "column", gap: 3, maxWidth: 280 }}>
            <Text style={styles.eyebrow}>Histórico atestado via</Text>
            {!hasPartnerBadge && hasDekra ? (
              <Image src={data.dekraLogoPath} style={styles.dekraLogo} />
            ) : null}
            {!hasPartnerBadge && hasCheckauto ? (
              <Image src={data.checkautoLogoPath} style={styles.checkautoLogo} />
            ) : null}
            {!hasPartnerBadge && !hasDekra ? (
              <Text style={styles.partnerFallback}>DEKRA · CheckAuto</Text>
            ) : null}
            <Text style={styles.reportTag}>Relatório i-CHECK do seminovo</Text>
          </View>
        </View>

        {/* Direita: Netcar */}
        <View style={{ alignItems: "flex-end", justifyContent: "flex-start" }}>
          {data.netcarLogoPath ? (
            <Image src={data.netcarLogoPath} style={styles.netcarLogo} />
          ) : (
            <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: NAVY }}>
              Netcar
            </Text>
          )}
        </View>
      </View>

      {showAuthority ? (
        <View style={styles.authorityBox}>
          <Text style={styles.authorityTitle}>
            AUTORIDADE DEKRA — LÍDER GLOBAL EM INSPEÇÃO VEICULAR
          </Text>
          <Text style={styles.authorityBody}>
            A DEKRA é a maior empresa de inspeção veicular do mundo e líder global em
            testes, vistorias e certificações. Fundada na Alemanha em 1925, opera
            focada em garantir a segurança da interação humana com a tecnologia e o
            meio ambiente. O histórico deste seminovo foi consultado via CheckAuto,
            uma empresa DEKRA.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function ICheckReportDocument({ data }: { data: ICheckReportData }) {
  const history = (data.history || []).filter(
    (item) => item.status && !/indispon[ií]vel/i.test(item.status),
  );
  const highlights = (data.consultationHighlights || []).filter(
    (item) => item.value && item.value !== "—" && !/indispon[ií]vel/i.test(item.value),
  );
  const vehicleFields = [
    ["Marca / modelo", `${data.marca} ${data.modelo}`.trim()],
    ["Ano", data.yearLabel],
    ["Placa", data.placaMasked],
    ["Km", data.kmLabel],
    ["Cor", data.cor],
    ["Combustível", data.combustivel],
    ["Câmbio", data.cambio],
    ["Motor", data.motor],
    ["Chassi", data.chassiMasked],
    ["Emissão", data.dataHoraConsulta || data.issuedAt],
  ].filter(([, value]) => value && value !== "—");

  const dataHora = data.dataHoraConsulta || data.issuedAt || "";
  const protocoloNetcar = icheckProtocolFromDate(dataHora);
  const hasProtocol = Boolean(
    protocoloNetcar || dataHora || data.tipoChave,
  );

  const formatStatus = (status?: string | null) => {
    if (!status) return "";
    if (/^sem\s*registro\.?$/i.test(String(status).trim())) return "NADA CONSTA";
    return status;
  };
  const hasPhotos = data.galleryPhotos.length > 0 || data.heroPhotos.length > 0;
  const hasSpecs = data.specs.length > 0;
  const hasOptionals = data.optionals.length > 0;
  const hasHighlights = highlights.length > 0;
  const hasFichaPage = hasHighlights || hasSpecs || hasOptionals;

  const totalPages = 1 + (hasPhotos ? 1 : 0) + (hasFichaPage ? 1 : 0);
  const galleryPage = hasPhotos ? 2 : 0;
  const fichaPage = hasFichaPage ? (hasPhotos ? 3 : 2) : 0;
  const heroA = data.heroPhotos[0];
  const heroB = data.heroPhotos[1] || data.heroPhotos[0];

  return (
    <Document
      title={`i-CHECK ${data.vehicleName}`}
      author="Netcar Multimarcas"
      subject="Relatório de procedência do seminovo"
    >
      {/* Página 1 — Capa */}
      <Page size="A4" style={styles.page}>
        <Header data={data} showAuthority />
        <Text style={styles.title}>{data.vehicleName}</Text>
        <Text style={styles.subtitle}>
          Dossiê com fotos do veículo, ficha técnica e histórico CheckAuto/DEKRA —
          transparência Netcar na sua compra.
        </Text>
        <Text
          style={{
            fontSize: 7.5,
            color: MUTED,
            marginTop: 4,
            marginBottom: 2,
            maxWidth: 460,
          }}
        >
          Esta consulta não tem caráter de laudo técnico. Não constitui vistoria
          cautelar nem laudo estrutural/pericial.
        </Text>

        {data.allClear ? (
          <View style={[styles.statusBannerApproved, { marginTop: 10 }]}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              {data.checkIconPath ? (
                <Image
                  src={data.checkIconPath}
                  style={{ width: 18, height: 18 }}
                />
              ) : null}
              <Text style={styles.statusBannerApprovedTitle}>
                HISTÓRICO APROVADO
              </Text>
            </View>
            <Text style={styles.statusBannerApprovedSub}>
              Sem registros graves nas bases CheckAuto / DEKRA consultadas
            </Text>
          </View>
        ) : history.length > 0 ? (
          <View style={[styles.statusBanner, { marginTop: 10 }]}>
            <Text style={styles.statusBannerMuted}>
              HISTÓRICO CONSULTADO — VER DETALHES ABAIXO
            </Text>
          </View>
        ) : null}

        {hasProtocol ? (
          <View style={styles.protocolBox}>
            <Text style={styles.protocolTitle}>
              Consulta CheckAuto — data e ConsultaID (MMDDYYYY)
            </Text>
            <View style={styles.protocolGrid}>
              {protocoloNetcar ? (
                <View style={styles.protocolCell}>
                  <Text style={styles.protocolLabel}>ConsultaID</Text>
                  <Text style={styles.protocolValueMono}>{protocoloNetcar}</Text>
                </View>
              ) : null}
              {dataHora ? (
                <View style={styles.protocolCell}>
                  <Text style={styles.protocolLabel}>Data / hora</Text>
                  <Text style={styles.protocolValue}>{dataHora}</Text>
                </View>
              ) : null}
              {data.tipoChave ? (
                <View style={styles.protocolCell}>
                  <Text style={styles.protocolLabel}>Chave</Text>
                  <Text style={styles.protocolValue}>{data.tipoChave}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {heroA || heroB ? (
          <View style={styles.heroRow}>
            {heroA ? (
              <Image src={heroA} style={styles.heroImg} />
            ) : (
              <View style={styles.emptyPhoto}>
                <Text style={{ color: MUTED, fontSize: 8 }}>Sem foto</Text>
              </View>
            )}
            {heroB ? (
              <Image src={heroB} style={styles.heroImg} />
            ) : null}
          </View>
        ) : null}

        {vehicleFields.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>DADOS DO VEÍCULO</Text>
            <View style={styles.idGrid}>
              {vehicleFields.map(([label, value], index, arr) => (
                <View
                  key={label}
                  style={[
                    styles.idCell,
                    index >= arr.length - 2 ? { borderBottomWidth: 0 } : null,
                  ]}
                >
                  <Text style={styles.idLabel}>{label}</Text>
                  <Text style={styles.idValue}>{value}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {history.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>CONSULTA CHECKAUTO / DEKRA</Text>
            <View style={styles.historyGrid}>
              {history.map((item) => {
                const isAlert =
                  item.riskLevel === "alert" ||
                  (item.clear === false &&
                    !/^consultado\.?$/i.test(String(item.status || "")) &&
                    !/^sem\s*registro/i.test(String(item.status || "")));
                const statusLabel = formatStatus(item.status);
                const isOk = /^nada\s*consta$/i.test(statusLabel);
                return (
                  <View key={item.key} style={styles.historyCard}>
                    {!isAlert && data.checkIconPath ? (
                      <Image src={data.checkIconPath} style={styles.checkIcon} />
                    ) : (
                      <View
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 7,
                          backgroundColor: isAlert ? "#B91C1C" : LINE,
                        }}
                      />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyLabel}>{item.label}</Text>
                      <Text
                        style={
                          isAlert
                            ? styles.historyStatusAlert
                            : isOk
                              ? styles.historyStatusOk
                              : styles.historyStatus
                        }
                      >
                        {statusLabel}
                      </Text>
                      {item.hint ? (
                        <Text style={styles.historyHint}>{item.hint}</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        <PageFooter page={1} total={totalPages} listingUrl={data.listingUrl} />
      </Page>

      {/* Galeria — só se houver fotos */}
      {hasPhotos ? (
        <Page size="A4" style={styles.page}>
          <Header data={data} />
          <Text style={styles.sectionTitle}>FOTOS DO SEMINOVO NA NETCAR</Text>
          <Text style={[styles.subtitle, { marginBottom: 10 }]}>
            Imagens reais do estoque — o mesmo carro que você vê no anúncio.
          </Text>
          <View style={styles.galleryGrid}>
            {(data.galleryPhotos.length > 0
              ? data.galleryPhotos.slice(0, 9)
              : data.heroPhotos
            ).map((src, index) => (
              <Image key={`${src}-${index}`} src={src} style={styles.galleryImg} />
            ))}
          </View>
          <PageFooter
            page={galleryPage}
            total={totalPages}
            listingUrl={data.listingUrl}
          />
        </Page>
      ) : null}

      {/* Ficha + selo — só blocos com conteúdo */}
      {hasFichaPage ? (
      <Page size="A4" style={styles.page}>
        <Header data={data} />
        {hasHighlights ? (
          <>
            <Text style={styles.sectionTitle}>RESUMO DA CONSULTA</Text>
            <Text style={[styles.subtitle, { marginBottom: 8 }]}>
              Pontos principais da consulta CheckAuto — leitura rápida.
            </Text>
            <View style={styles.idGrid}>
              {highlights.slice(0, 8).map((item, index, arr) => (
                <View
                  key={item.label}
                  style={[
                    styles.idCell,
                    index >= arr.length - 2 ? { borderBottomWidth: 0 } : null,
                  ]}
                >
                  <Text style={styles.idLabel}>{item.label}</Text>
                  <Text style={styles.idValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
        {hasSpecs ? (
          <>
            <Text style={styles.sectionTitle}>FICHA TÉCNICA</Text>
            <View style={styles.specGrid}>
              {data.specs.map((spec) => (
                <View key={spec.label} style={styles.specPill}>
                  <Text style={styles.specText}>
                    <Text style={{ fontFamily: "Helvetica-Bold" }}>
                      {spec.label}:{" "}
                    </Text>
                    {spec.value}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {hasOptionals ? (
          <>
            <Text style={styles.sectionTitle}>OPCIONAIS EM DESTAQUE</Text>
            <View style={styles.chipRow}>
              {data.optionals.slice(0, 24).map((item) => (
                <View key={item} style={styles.chip}>
                  <Text style={styles.chipText}>{item}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <View style={styles.trustBox}>
          <Text style={styles.trustTitle}>CONFIANÇA GARANTIDA PELA NETCAR</Text>
          <Text style={styles.trustBody}>
            A Netcar atesta que este seminovo passou pela curadoria da loja e que o
            histórico acima foi obtido via consulta CheckAuto/DEKRA às bases
            disponíveis. Transparência e segurança na sua compra — complemente
            sempre com a avaliação presencial e a documentação do Detran.
          </Text>
        </View>

        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerTitle}>
            NATUREZA DESTA CONSULTA — NÃO É LAUDO TÉCNICO
          </Text>
          <Text style={styles.disclaimerBody}>
            Esta consulta NÃO tem caráter de laudo técnico. É um dossiê
            informativo de procedência e histórico (bases CheckAuto/DEKRA), com
            fotos e ficha do seminovo. Não substitui vistoria cautelar, laudo de
            engenharia, perícia estrutural nem inspeção veicular presencial.
            Complemente sempre com avaliação na loja e documentação oficial.
          </Text>
        </View>

        <Text style={styles.notesTitle}>Observações explicativas</Text>
        {[
          "As informações de histórico foram obtidas por consulta a bases públicas e privadas. A CheckAuto/DEKRA reproduz os dados conforme constam nos sistemas oficiais.",
          "O relatório tem caráter informativo e preventivo, sendo complementar à análise presencial do veículo — e não equivale a vistoria cautelar.",
          "A ausência de registros de leilão, perda total, furto ou roubo indica histórico sem esses agravantes nas bases consultadas na data da emissão.",
          "Sistemas estaduais e federais podem atualizar em momentos diferentes — confirme restrições no Detran quando necessário.",
          "Alienação fiduciária, se existir, é vínculo com instituição financeira e pode ser regularizada na venda com segurança.",
        ].map((note) => (
          <View key={note} style={styles.noteItem}>
            <View style={styles.bullet} />
            <Text style={styles.noteText}>{note}</Text>
          </View>
        ))}

        <PageFooter
          page={fichaPage}
          total={totalPages}
          listingUrl={data.listingUrl}
        />
      </Page>
      ) : null}
    </Document>
  );
}
