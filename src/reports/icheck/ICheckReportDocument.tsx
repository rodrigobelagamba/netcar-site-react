import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import { icheckProtocolFromDate } from "../../lib/icheck-protocol";
import {
  formatHistoryStatus,
  isAlienacaoFiduciaria,
  isClearHistoryStatus,
  type ICheckHistoryItem,
} from "./icheckHistory";

const NAVY = "#00283C";
const MINT = "#5CD29D";
const GREEN = "#2E7D32";
const AMBER = "#F59E0B";
const AMBER_TEXT = "#B45309";
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
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerCenter: {
    alignItems: "center",
    marginBottom: 8,
  },
  partnerBadge: { width: 140, height: 140, objectFit: "contain" },
  dekraLogo: { width: 160, height: 36, objectFit: "contain" },
  checkautoLogo: { width: 110, height: 22, objectFit: "contain", marginTop: 2 },
  netcarLogo: { width: 72, height: 18, objectFit: "contain" },
  partnerFallback: { fontSize: 14, fontFamily: "Helvetica-Bold", color: GREEN },
  partnerTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: GREEN,
    textTransform: "uppercase",
    letterSpacing: 1.0,
    marginTop: 4,
  },
  eyebrow: {
    fontSize: 8,
    letterSpacing: 1.1,
    color: MUTED,
    textTransform: "uppercase",
  },
  reportTag: {
    fontSize: 8,
    letterSpacing: 1.0,
    color: MUTED,
    textTransform: "uppercase",
    marginTop: 2,
  },
  authorityBox: {
    backgroundColor: "#F3FBF7",
    borderWidth: 1,
    borderColor: MINT,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  financeBox: {
    borderWidth: 1,
    borderColor: "#2E7D324D",
    backgroundColor: "#F3FBF7",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  financeBoxAlert: {
    borderWidth: 1,
    borderColor: "#B91C1C40",
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  financeTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: GREEN,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  financeTitleAlert: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#991B1B",
    marginBottom: 4,
  },
  financeBody: { fontSize: 8, color: NAVY, lineHeight: 1.4 },
  financeAlienacao: {
    marginTop: 6,
    backgroundColor: "#FFF8E1",
    borderWidth: 1,
    borderColor: "#F59E0B73",
    borderRadius: 6,
    padding: 7,
  },
  financeAlienacaoTitle: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#92400E",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  financeAlienacaoBody: {
    fontSize: 7.5,
    color: "#78350F",
    lineHeight: 1.35,
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
    backgroundColor: "#E8F7EF",
    borderWidth: 2,
    borderColor: "#2E7D3273",
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
  historyStatusWarn: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: AMBER_TEXT,
  },
  historyCardWarn: {
    backgroundColor: "#FFF8E1",
    borderColor: "#F59E0B",
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

export type { ICheckHistoryItem };

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
      <View style={styles.headerTop}>
        <Text style={styles.eyebrow}>Histórico atestado via</Text>
        {data.netcarLogoPath ? (
          <Image src={data.netcarLogoPath} style={styles.netcarLogo} />
        ) : (
          <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY }}>
            Netcar
          </Text>
        )}
      </View>

      <View style={styles.headerCenter}>
        {hasPartnerBadge ? (
          <Image src={data.partnerLogosPath} style={styles.partnerBadge} />
        ) : (
          <View style={{ alignItems: "center", gap: 2 }}>
            {hasDekra ? (
              <Image src={data.dekraLogoPath} style={styles.dekraLogo} />
            ) : null}
            {hasCheckauto ? (
              <Image src={data.checkautoLogoPath} style={styles.checkautoLogo} />
            ) : null}
            {!hasDekra && !hasCheckauto ? (
              <Text style={styles.partnerFallback}>DEKRA · CheckAuto</Text>
            ) : null}
          </View>
        )}
        <Text style={styles.partnerTitle}>DEKRA · CheckAuto</Text>
        <Text style={styles.reportTag}>Relatório i-CHECK do seminovo</Text>
      </View>

      {showAuthority ? (
        <View style={styles.authorityBox}>
          <Text style={styles.authorityTitle}>
            AUTORIDADE DEKRA — LÍDER GLOBAL EM INSPEÇÃO VEICULAR
          </Text>
          <Text style={styles.authorityBody}>
            A DEKRA é a maior empresa de inspeção veicular do mundo e líder global em
            testes, vistorias e certificações. Fundada na Alemanha em 1925. Histórico
            consultado via CheckAuto, uma empresa DEKRA.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Mesma regra da tela: bloco "Leitura para financiamento e seguro". */
function FinancingBlock({ history }: { history: ICheckHistoryItem[] }) {
  if (!history.length) return null;

  const hasAlienacao = history.some((item) =>
    isAlienacaoFiduciaria(item.status),
  );
  const hasGraveAlert = history.some((item) => {
    if (isAlienacaoFiduciaria(item.status)) return false;
    if (item.riskLevel === "alert") return true;
    const s = String(item.status || "");
    return (
      /com\s*registro|consta\s+registro|ocorr[eê]ncia/i.test(s) &&
      !isClearHistoryStatus(s)
    );
  });
  const cleanCore = history
    .filter((item) => !isAlienacaoFiduciaria(item.status))
    .every((item) => item.riskLevel !== "alert");

  if (hasGraveAlert) {
    return (
      <View>
        <Text style={styles.sectionTitle}>
          LEITURA PARA FINANCIAMENTO E SEGURO
        </Text>
        <View style={styles.financeBoxAlert}>
          <Text style={styles.financeTitleAlert}>
            Há apontamento relevante no histórico
          </Text>
          <Text style={[styles.financeBody, { color: MUTED }]}>
            Bancos e seguradoras costumam analisar caso a caso quando existe registro
            de leilão, sinistro ou roubo/furto. A Netcar orienta confirmar a situação
            com a instituição antes de fechar crédito ou apólice.
          </Text>
        </View>
      </View>
    );
  }

  if (!cleanCore && !hasAlienacao) return null;

  return (
    <View>
      <Text style={styles.sectionTitle}>
        LEITURA PARA FINANCIAMENTO E SEGURO
      </Text>
      <View style={styles.financeBox}>
        <Text style={styles.financeTitle}>Veículo apto a crédito e seguro</Text>
        <Text style={styles.financeBody}>
          De acordo com as bases consultadas, não foram encontrados registros de
          leilão, sinistro com perda total ou ocorrência de roubo/furto. A ausência
          desses apontamentos pode contribuir positivamente para análises de
          financiamento e contratação de seguro, observadas as políticas e critérios
          de cada instituição.
        </Text>
        {hasAlienacao ? (
          <View style={styles.financeAlienacao}>
            <Text style={styles.financeAlienacaoTitle}>
              Sobre a alienação fiduciária
            </Text>
            <Text style={styles.financeAlienacaoBody}>
              Consta vínculo com instituição financeira (veículo financiado). Não
              impede a compra: na transferência, o gravame é quitado/baixado com o
              banco. Seguradoras e financeiras costumam aceitar o bem após
              regularização do financiamento.
            </Text>
          </View>
        ) : (
          <Text
            style={{
              fontSize: 7.5,
              color: MUTED,
              marginTop: 5,
              lineHeight: 1.35,
            }}
          >
            Histórico limpo nos itens críticos — perfil compatível com produtos de
            crédito e proteção veicular do mercado.
          </Text>
        )}
      </View>
    </View>
  );
}

export function ICheckReportDocument({ data }: { data: ICheckReportData }) {
  const history = (data.history || []).filter(
    (item) => item.status && !/indispon[ií]vel/i.test(item.status),
  );
  const potencia =
    data.specs.find((s) => s.label === "Potência")?.value || "";
  // Mesmos campos da tela (sem Chassi / Emissão inventados)
  const vehicleFields = [
    ["Marca / modelo", `${data.marca} ${data.modelo}`.trim()],
    ["Ano", data.yearLabel],
    ["Placa", data.placaMasked],
    ["Km", data.kmLabel],
    ["Cor", data.cor],
    ["Combustível", data.combustivel],
    ["Câmbio", data.cambio],
    ["Motor", data.motor],
    ["Potência", potencia],
  ].filter(([, value]) => value && value !== "—");

  const dataHora = data.dataHoraConsulta || data.issuedAt || "";
  const protocoloNetcar =
    data.consultaId || icheckProtocolFromDate(dataHora) || "";
  const hasProtocol = Boolean(protocoloNetcar || dataHora || data.tipoChave);
  const hasPhotos = data.galleryPhotos.length > 0 || data.heroPhotos.length > 0;
  const hasOptionals = data.optionals.length > 0;
  const hasPage2 = hasPhotos || hasOptionals;

  const totalPages = 1 + (hasPage2 ? 1 : 0);
  const heroA = data.heroPhotos[0];
  const heroB = data.heroPhotos[1] || data.heroPhotos[0];

  return (
    <Document
      title={`i-CHECK ${data.vehicleName}`}
      author="Netcar Multimarcas"
      subject="Relatório de procedência do seminovo"
    >
      {/* Página 1 — mesmo fluxo da tela até financiamento */}
      <Page size="A4" style={styles.page}>
        <Header data={data} showAuthority />
        <Text style={styles.title}>{data.vehicleName}</Text>
        <Text style={styles.subtitle}>
          Dossiê com fotos, ficha técnica e histórico CheckAuto/DEKRA —
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

        {/* Tela sempre mostra o banner verde — PDF espelha */}
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
            Consulta às bases CheckAuto / DEKRA — sem registros graves nos itens
            abaixo
          </Text>
        </View>

        {hasProtocol ? (
          <View style={styles.protocolBox}>
            <Text style={styles.protocolTitle}>
              Consulta CheckAuto / DEKRA
            </Text>
            <View style={styles.protocolGrid}>
              {dataHora ? (
                <View style={styles.protocolCell}>
                  <Text style={styles.protocolLabel}>Data / hora</Text>
                  <Text style={styles.protocolValue}>{dataHora}</Text>
                </View>
              ) : null}
              {protocoloNetcar ? (
                <View style={styles.protocolCell}>
                  <Text style={styles.protocolLabel}>ConsultaID</Text>
                  <Text style={styles.protocolValueMono}>{protocoloNetcar}</Text>
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
            {heroB ? <Image src={heroB} style={styles.heroImg} /> : null}
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
                    index >= arr.length - 2 ? { borderBottomWidth: 0 } : {},
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
            <Text style={styles.sectionTitle}>HISTÓRICO DO VEÍCULO</Text>
            <View style={styles.historyGrid}>
              {history.map((item) => {
                const isWarn =
                  item.riskLevel === "warn" ||
                  isAlienacaoFiduciaria(item.status);
                const isAlert =
                  !isWarn &&
                  (item.riskLevel === "alert" ||
                    (item.clear === false &&
                      !/^consultado\.?$/i.test(String(item.status || "")) &&
                      !/^sem\s*registro/i.test(String(item.status || ""))));
                const statusLabel = formatHistoryStatus(item.status);
                const isOk =
                  !isWarn &&
                  !isAlert &&
                  /^nada\s*consta$/i.test(statusLabel);
                return (
                  <View
                    key={item.key}
                    style={[
                      styles.historyCard,
                      isWarn ? styles.historyCardWarn : {},
                      !isWarn && !isAlert
                        ? { backgroundColor: "#E8F7EF", borderColor: "#2E7D3240" }
                        : {},
                      isAlert
                        ? { backgroundColor: "#FEF2F2", borderColor: "#B91C1C40" }
                        : {},
                    ]}
                  >
                    {isOk && data.checkIconPath ? (
                      <Image src={data.checkIconPath} style={styles.checkIcon} />
                    ) : (
                      <View
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 7,
                          backgroundColor: isWarn
                            ? AMBER
                            : isAlert
                              ? "#B91C1C"
                              : GREEN,
                        }}
                      />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyLabel}>{item.label}</Text>
                      <Text
                        style={
                          isWarn
                            ? styles.historyStatusWarn
                            : isAlert
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

        <FinancingBlock history={history} />

        {!hasPage2 ? (
          <>
            <View style={styles.trustBox}>
              <Text style={styles.trustTitle}>
                CONFIANÇA GARANTIDA PELA NETCAR
              </Text>
              <Text style={styles.trustBody}>
                A Netcar atesta a curadoria deste seminovo e que o histórico acima
                foi obtido via consulta CheckAuto/DEKRA. Complemente sempre com a
                avaliação presencial e a documentação do Detran.
              </Text>
            </View>
            <View style={styles.disclaimerBox}>
              <Text style={styles.disclaimerTitle}>
                NATUREZA DESTA CONSULTA — NÃO É LAUDO TÉCNICO
              </Text>
              <Text style={styles.disclaimerBody}>
                Esta consulta NÃO tem caráter de laudo técnico. É um dossiê
                informativo de procedência e histórico (bases CheckAuto/DEKRA), com
                fotos e ficha do seminovo. Não substitui vistoria cautelar, laudo
                de engenharia, perícia estrutural nem inspeção veicular presencial.
              </Text>
            </View>
          </>
        ) : null}

        <PageFooter page={1} total={totalPages} listingUrl={data.listingUrl} />
      </Page>

      {/* Página 2 — galeria + opcionais + disclaimers (ordem da tela) */}
      {hasPage2 ? (
        <Page size="A4" style={styles.page}>
          <Header data={data} />
          {hasPhotos ? (
            <>
              <Text style={styles.sectionTitle}>
                FOTOS DO SEMINOVO NA NETCAR
              </Text>
              <View style={styles.galleryGrid}>
                {(data.galleryPhotos.length > 0
                  ? data.galleryPhotos.slice(0, 9)
                  : data.heroPhotos
                ).map((src, index) => (
                  <Image
                    key={`${src}-${index}`}
                    src={src}
                    style={styles.galleryImg}
                  />
                ))}
              </View>
            </>
          ) : null}

          {hasOptionals ? (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 10 }]}>
                OPCIONAIS EM DESTAQUE
              </Text>
              <View style={styles.chipRow}>
                {data.optionals.slice(0, 28).map((item) => (
                  <View key={item} style={styles.chip}>
                    <Text style={styles.chipText}>{item}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <View style={styles.trustBox}>
            <Text style={styles.trustTitle}>
              CONFIANÇA GARANTIDA PELA NETCAR
            </Text>
            <Text style={styles.trustBody}>
              A Netcar atesta a curadoria deste seminovo e que o histórico acima
              foi obtido via consulta CheckAuto/DEKRA. Complemente sempre com a
              avaliação presencial e a documentação do Detran.
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
            </Text>
          </View>

          <PageFooter
            page={2}
            total={totalPages}
            listingUrl={data.listingUrl}
          />
        </Page>
      ) : null}
    </Document>
  );
}
