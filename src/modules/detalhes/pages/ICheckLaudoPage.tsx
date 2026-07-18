import { useEffect, useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { Printer, Download, ArrowLeft, Check, AlertTriangle } from "lucide-react";
import { useVehicleQuery } from "@/catalog/queries/useVehicleQuery";
import { maskPlate } from "@/lib/slug";
import { resolveIcheckProtocol } from "@/lib/icheck-protocol";
import { isConsultaValid } from "@/lib/icheck-validity";
import { optimizeStockImage } from "@/lib/images";
import { useMetaTags } from "@/hooks/useMetaTags";
import { VehicleUnavailableRedirect } from "@/components/VehicleUnavailableRedirect";

type HistoryMetaItem = {
  key: string;
  label: string;
  status: string | null;
  hint?: string;
  clear?: boolean;
  riskLevel?: string;
};

type CheckAutoProtocolMeta = {
  consultaId?: string | null;
  dataHoraConsulta?: string | null;
  protocoloConsulta?: string | null;
  tipoChave?: string | null;
  history?: HistoryMetaItem[];
  consultationHighlights?: Array<{ label: string; value: string }>;
};

/** "Sem Registro" do certificado → destaque "NADA CONSTA". */
function formatHistoryStatus(status: string | null | undefined): string {
  if (!status) return "";
  if (/^sem\s*registro\.?$/i.test(status.trim())) return "NADA CONSTA";
  return status;
}

function isClearStatus(status: string | null | undefined): boolean {
  const s = String(status || "");
  return /^sem\s*registro/i.test(s) || /^nada\s*consta/i.test(s);
}

function isAlienacaoFiduciaria(text: string | null | undefined): boolean {
  return /aliena[cç][aã]o\s*fiduci/i.test(String(text || ""));
}

function Spec({
  label,
  value,
  warn = false,
}: {
  label: string;
  value?: string | number | null;
  warn?: boolean;
}) {
  if (value == null || value === "" || value === "—") return null;
  return (
    <div
      className={`rounded-xl px-3 py-2 ring-1 ring-inset ${
        warn
          ? "bg-[#FFF8E1] ring-[#F59E0B]/55"
          : "bg-[#F5F8F9] ring-transparent"
      }`}
    >
      <p
        className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${
          warn ? "text-[#92400E]" : "text-[#5A6B73]"
        }`}
      >
        {label}
      </p>
      <p
        className={`text-sm font-bold ${
          warn ? "text-[#B45309]" : "text-[#00283C]"
        }`}
      >
        {String(value)}
      </p>
    </div>
  );
}

export function ICheckLaudoPage() {
  const { slug } = useParams({ from: "/laudo/$slug" });
  const { data: vehicle, isLoading, isError } = useVehicleQuery(slug);
  const [protocol, setProtocol] = useState<CheckAutoProtocolMeta | null>(null);
  const [protocolReady, setProtocolReady] = useState(false);

  const title = vehicle
    ? `${vehicle.marca || ""} ${vehicle.modelo || vehicle.name || ""} ${vehicle.year || ""}`.trim()
    : "Laudo i-CHECK";

  useMetaTags({
    title: vehicle ? `Laudo i-CHECK — ${title}` : "Laudo i-CHECK",
    description:
      "Consulta i-CHECK Netcar com fotos, ficha e histórico CheckAuto/DEKRA. Não tem caráter de laudo técnico nem vistoria cautelar.",
    robots: "noindex, nofollow",
  });

  useEffect(() => {
    if (!vehicle) {
      setProtocol(null);
      setProtocolReady(false);
      return;
    }
    setProtocolReady(false);
    // Meta só do PDF da API (Automacar) — sem mapa local.
    const pdfFromVehicle =
      vehicle.pdf || vehicle.pdf_url?.split("/").pop() || "";
    const placa = String(vehicle.placa || "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();
    if (!pdfFromVehicle) {
      setProtocol(null);
      setProtocolReady(true);
      return;
    }

    const metaName = String(pdfFromVehicle)
      .replace(/^.*\//, "")
      .replace(/\.pdf$/i, ".meta.json");

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/arquivos/autocheck/${metaName}?v=${Date.now()}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          if (!cancelled) {
            setProtocol({
              consultaId: null,
              dataHoraConsulta: null,
              tipoChave: placa ? `Placa: ${maskPlate(placa)} UF: RS` : null,
            });
            setProtocolReady(true);
          }
          return;
        }
        const json = (await res.json()) as CheckAutoProtocolMeta;
        if (cancelled) return;
        setProtocol(json);
        setProtocolReady(true);
      } catch {
        if (!cancelled) {
          setProtocol({
            consultaId: null,
            dataHoraConsulta: null,
            tipoChave: placa ? `Placa: ${maskPlate(placa)} UF: RS` : null,
          });
          setProtocolReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [vehicle?.pdf, vehicle?.pdf_url, vehicle?.placa]);
  if (isLoading && !vehicle) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-[#00283C]/70">
        Carregando laudo…
      </div>
    );
  }

  if (isError || !vehicle) {
    return <VehicleUnavailableRedirect />;
  }

  if (!protocolReady) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-[#00283C]/70">
        Carregando laudo…
      </div>
    );
  }

  const hasApiPdf = Boolean(vehicle.pdf || vehicle.pdf_url);
  if (!hasApiPdf || !isConsultaValid(protocol?.dataHoraConsulta)) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-[17px] font-bold text-[#00283C]">
          Consulta i-CHECK indisponível
        </p>
        <p className="max-w-md text-sm text-[#00283C]/70">
          {hasApiPdf
            ? "Esta consulta tem mais de 2 anos e não é mais exibida."
            : "Este veículo não tem laudo i-CHECK anexado no estoque."}
        </p>
        <Link
          to="/veiculo/$slug"
          params={{ slug }}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#00283C]/80 transition hover:text-[#00283C]"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao veículo
        </Link>
      </div>
    );
  }

  const gallery = (
    vehicle.imagens_site?.galeria?.length
      ? vehicle.imagens_site.galeria
      : vehicle.fullImages?.length
        ? vehicle.fullImages
        : vehicle.images || []
  )
    .filter(Boolean)
    .slice(0, 9) as string[];

  // Galeria site = fundo cinza + logo Netcar (não usar capa PNG sem tratamento)
  const heroA = gallery[0] || vehicle.imagens_site?.capa;
  const heroB = gallery[1] || gallery[0];
  const yearLabel =
    vehicle.anoFabricacao && vehicle.year
      ? `${vehicle.anoFabricacao} / ${vehicle.year}`
      : String(vehicle.year || vehicle.anoFabricacao || "—");

  const optionals = (vehicle.opcionais || [])
    .map((o) => (typeof o === "string" ? o : o.descricao || o.tag || ""))
    .filter(Boolean)
    .slice(0, 28);

  /** Sempre a tela do laudo — não o PDF estático de arquivos/autocheck. */
  const printOnScreenLaudo = () => window.print();

  const handlePrint = () => printOnScreenLaudo();

  const handleSavePdf = () => {
    // Diálogo do browser: destino "Salvar como PDF" = mesmo conteúdo da tela.
    printOnScreenLaudo();
  };

  return (
    <div className="min-h-[100dvh] bg-[#F3F6F8] print:bg-white">
      {/* Barra de ações — documento isolado, some na impressão */}
      <div className="sticky top-0 z-30 border-b border-[#00283C]/08 bg-white/95 print:hidden">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link
            to="/veiculo/$slug"
            params={{ slug }}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#00283C]/80 transition hover:text-[#00283C]"
          >
            <ArrowLeft className="h-4 w-4" />
            Fechar
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSavePdf}
              title="Abre impressão — escolha Salvar como PDF. Mesmo conteúdo da tela."
              className="inline-flex items-center gap-2 rounded-full border border-secondary/40 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-secondary shadow-sm transition hover:border-secondary hover:bg-[#E8F7EF]"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={2.5} />
              Salvar PDF
            </button>
            <button
              type="button"
              onClick={handlePrint}
              title="Imprime o laudo exibido nesta página"
              className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-white shadow-sm transition hover:bg-[#1B5E20]"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir
            </button>
          </div>
        </div>
      </div>

      <article className="mx-auto max-w-3xl px-4 py-6 print:max-w-none print:px-0 print:py-0 sm:py-8">
        <div className="overflow-hidden rounded-[1.5rem] bg-white shadow-[0_12px_40px_rgba(0,40,60,0.08)] print:rounded-none print:shadow-none">
          {/* Header — DEKRA em destaque (mobile empilhado, sem overlap) */}
          <header className="border-b border-[#E4EAEF] px-4 py-5 sm:px-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5A6B73]">
                Histórico atestado via
              </p>
              <img
                src="/brand/netcar.png"
                alt="Netcar"
                className="h-5 w-auto max-w-[72px] shrink-0 object-contain object-right opacity-90 sm:h-6 sm:max-w-[88px]"
              />
            </div>

            <div className="flex flex-col items-center text-center">
              <img
                src="/brand/checkauto-dekra.png"
                alt="DEKRA CheckAuto"
                className="h-40 w-40 object-contain sm:h-48 sm:w-48"
              />
              <p className="mt-2 text-base font-extrabold uppercase tracking-[0.1em] text-[#1B5E20]">
                DEKRA · CheckAuto
              </p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5A6B73]">
                Relatório i-CHECK do seminovo
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-[#5CD29D]/50 bg-[#F3FBF7] px-3 py-3 sm:px-4">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#1B5E20] sm:text-[11px]">
                Autoridade DEKRA — líder global em inspeção veicular
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-[#5A6B73] sm:text-xs">
                A <strong className="font-bold text-[#00283C]">DEKRA</strong> é a
                maior empresa de inspeção veicular do mundo e líder global em
                testes, vistorias e certificações. Fundada na Alemanha em 1925.
                Histórico consultado via CheckAuto, uma empresa DEKRA.
              </p>
            </div>
          </header>

          <div className="space-y-6 px-5 py-6 sm:px-8 sm:py-8">
            <div>
              <h1 className="text-2xl font-extrabold uppercase tracking-tight text-[#00283C] sm:text-[28px]">
                {title}
              </h1>
              <p className="mt-1 text-sm text-[#5A6B73]">
                Dossiê com fotos, ficha técnica e histórico CheckAuto/DEKRA —
                transparência Netcar na sua compra.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[#5A6B73]">
                Esta consulta não tem caráter de laudo técnico. Não constitui
                vistoria cautelar nem laudo estrutural/pericial.
              </p>
            </div>

            <div className="rounded-2xl border-2 border-[#2E7D32] bg-[#E8F7EF] px-4 py-4 text-center">
              <p className="inline-flex items-center gap-2 text-base font-extrabold uppercase tracking-[0.12em] text-[#1B5E20] sm:text-lg">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2E7D32] text-white">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                Histórico aprovado
              </p>
              <p className="mt-1 text-xs text-[#5A6B73]">
                Consulta às bases CheckAuto / DEKRA — sem registros graves nos
                itens abaixo
              </p>
            </div>

            {(() => {
              const protocoloNetcar = resolveIcheckProtocol(
                protocol?.protocoloConsulta,
                protocol?.dataHoraConsulta,
              );
              if (
                !protocol?.dataHoraConsulta &&
                !protocoloNetcar &&
                !protocol?.tipoChave
              ) {
                return null;
              }
              return (
                <section className="rounded-2xl border-2 border-[#2E7D32]/45 bg-[#E8F7EF] px-4 py-4 shadow-[0_8px_24px_rgba(46,125,50,0.12)]">
                  <h2 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#1B5E20]">
                    Consulta CheckAuto / DEKRA
                  </h2>
                  <dl className="mt-3 space-y-2">
                    {protocol?.dataHoraConsulta ? (
                      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
                        <dt className="w-28 shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5A6B73]">
                          Data / hora
                        </dt>
                        <dd className="text-sm font-bold tabular-nums text-[#00283C]">
                          {protocol.dataHoraConsulta}
                        </dd>
                      </div>
                    ) : null}
                    {protocoloNetcar ? (
                      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
                        <dt className="w-28 shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5A6B73]">
                          ConsultaID
                        </dt>
                        <dd className="text-sm font-bold tabular-nums tracking-wide text-[#00283C]">
                          {protocoloNetcar}
                        </dd>
                      </div>
                    ) : null}
                    {protocol?.tipoChave || vehicle.placa ? (
                      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
                        <dt className="w-28 shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5A6B73]">
                          Chave
                        </dt>
                        <dd className="text-sm font-bold text-[#00283C]">
                          {vehicle.placa
                            ? `Placa: ${maskPlate(vehicle.placa)} UF: RS`
                            : String(protocol?.tipoChave || "").replace(
                                /Placa:\s*[A-Z0-9-]+/i,
                                (m) => {
                                  const raw = m.replace(/^Placa:\s*/i, "");
                                  return `Placa: ${maskPlate(raw)}`;
                                },
                              )}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </section>
              );
            })()}

            {(heroA || heroB) && (
              <div className="grid grid-cols-2 gap-2 print:gap-1.5">
                {heroA ? (
                  <img
                    src={optimizeStockImage(heroA, 900) || heroA}
                    alt={`${title} — foto 1`}
                    className="aspect-[4/3] w-full rounded-xl object-cover"
                  />
                ) : null}
                {heroB ? (
                  <img
                    src={optimizeStockImage(heroB, 900) || heroB}
                    alt={`${title} — foto 2`}
                    className="aspect-[4/3] w-full rounded-xl object-cover"
                  />
                ) : null}
              </div>
            )}

            <section>
              <h2 className="mb-3 rounded-md bg-[#00283C] px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white">
                Dados do veículo
              </h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Spec label="Marca / modelo" value={`${vehicle.marca} ${vehicle.modelo}`} />
                <Spec label="Ano" value={yearLabel} />
                <Spec
                  label="Placa"
                  value={vehicle.placa ? maskPlate(vehicle.placa) : null}
                />
                <Spec
                  label="Km"
                  value={
                    vehicle.km != null
                      ? `${Number(vehicle.km).toLocaleString("pt-BR")} km`
                      : null
                  }
                />
                <Spec label="Cor" value={vehicle.cor} />
                <Spec label="Combustível" value={vehicle.combustivel} />
                <Spec label="Câmbio" value={vehicle.cambio} />
                <Spec label="Motor" value={vehicle.motor} />
                <Spec
                  label="Potência"
                  value={vehicle.potencia ? `${vehicle.potencia} cv` : null}
                />
              </div>
            </section>

            {(() => {
              const historyCards = protocol?.history?.length
                ? protocol.history.filter(
                    (item) =>
                      item.status &&
                      !/indispon[ií]vel/i.test(item.status),
                  )
                : [];
              if (!historyCards.length) return null;
              return (
                <section>
                  <h2 className="mb-3 rounded-md bg-[#00283C] px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white">
                    Histórico do veículo
                  </h2>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {historyCards.map((item) => {
                      const statusLabel = formatHistoryStatus(item.status);
                      const alienacao = isAlienacaoFiduciaria(item.status);
                      // Vermelho só riskLevel "alert" — "Consultado" (clear:false) não é grave.
                      const isAlert =
                        !alienacao && item.riskLevel === "alert";
                      const clear = !alienacao && !isAlert;
                      return (
                        <div
                          key={item.key}
                          className={`flex items-start gap-3 rounded-xl px-3 py-3 ring-1 ring-inset ${
                            alienacao
                              ? "bg-[#FFF8E1] ring-[#F59E0B]/55"
                              : clear
                                ? "bg-[#E8F7EF] ring-[#2E7D32]/25"
                                : isAlert
                                  ? "bg-[#FEF2F2] ring-[#B91C1C]/25"
                                  : "bg-[#F5F8F9] ring-[#00283C]/10"
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${
                              alienacao
                                ? "bg-[#F59E0B]"
                                : isAlert
                                  ? "bg-[#B91C1C]"
                                  : "bg-[#2E7D32]"
                            }`}
                          >
                            {alienacao ? (
                              <AlertTriangle className="h-3.5 w-3.5" strokeWidth={3} />
                            ) : (
                              <Check className="h-3.5 w-3.5" strokeWidth={3} />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#00283C]">
                              {item.label}
                            </p>
                            <p
                              className={`mt-0.5 text-sm font-extrabold tracking-[0.04em] ${
                                alienacao
                                  ? "normal-case text-[#B45309]"
                                  : clear
                                    ? "uppercase tracking-[0.06em] text-[#1B5E20]"
                                    : isAlert
                                      ? "uppercase tracking-[0.06em] text-[#B91C1C]"
                                      : "text-[#00283C]"
                              }`}
                            >
                              {statusLabel}
                            </p>
                            {item.hint ? (
                              <p className="mt-0.5 text-[11px] text-[#5A6B73]/80">
                                {item.hint}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })()}

            {(() => {
              const history = (protocol?.history || []).filter(
                (item) => item.status && !/indispon[ií]vel/i.test(item.status),
              );
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
                  !isClearStatus(s)
                );
              });
              const cleanCore = history
                .filter((item) => !isAlienacaoFiduciaria(item.status))
                .every((item) => item.riskLevel !== "alert");

              if (hasGraveAlert) {
                return (
                  <section>
                    <h2 className="mb-3 rounded-md bg-[#00283C] px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white">
                      Leitura para financiamento e seguro
                    </h2>
                    <div className="rounded-2xl border border-[#B91C1C]/25 bg-[#FEF2F2] px-4 py-4">
                      <p className="text-sm font-extrabold text-[#991B1B]">
                        Há apontamento relevante no histórico
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-[#5A6B73]">
                        Bancos e seguradoras costumam analisar caso a caso quando
                        existe registro de leilão, sinistro ou roubo/furto.
                        A Netcar orienta confirmar a situação com a instituição
                        antes de fechar crédito ou apólice.
                      </p>
                    </div>
                  </section>
                );
              }

              if (!cleanCore && !hasAlienacao) return null;

              return (
                <section>
                  <h2 className="mb-3 rounded-md bg-[#00283C] px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white">
                    Leitura para financiamento e seguro
                  </h2>
                  <div className="rounded-2xl border border-[#2E7D32]/30 bg-[#F3FBF7] px-4 py-4">
                    <p className="inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.08em] text-[#1B5E20]">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2E7D32] text-white">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                      Veículo apto a crédito e seguro
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-[#00283C]/85">
                      De acordo com as bases consultadas, não foram encontrados
                      registros de leilão, sinistro com perda total ou ocorrência
                      de roubo/furto. A ausência desses apontamentos pode
                      contribuir positivamente para análises de financiamento e
                      contratação de seguro, observadas as políticas e critérios
                      de cada instituição.
                    </p>
                    {hasAlienacao ? (
                      <div className="mt-3 rounded-xl bg-[#FFF8E1] px-3 py-3 ring-1 ring-inset ring-[#F59E0B]/45">
                        <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[#92400E]">
                          Sobre a alienação fiduciária
                        </p>
                        <p className="mt-1.5 text-sm leading-relaxed text-[#78350F]/90">
                          Consta vínculo com instituição financeira (veículo
                          financiado). Não impede a compra: na transferência, o
                          gravame é quitado/baixado com o banco. Seguradoras e
                          financeiras costumam aceitar o bem após regularização
                          do financiamento.
                        </p>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs leading-relaxed text-[#5A6B73]">
                        Histórico limpo nos itens críticos — perfil compatível
                        com produtos de crédito e proteção veicular do mercado.
                      </p>
                    )}
                  </div>
                </section>
              );
            })()}

            {gallery.length > 0 ? (
              <section>
                <h2 className="mb-3 rounded-md bg-[#00283C] px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white">
                  Fotos do seminovo na Netcar
                </h2>
                <div className="grid grid-cols-3 gap-2">
                  {gallery.map((src, index) => (
                    <img
                      key={`${src}-${index}`}
                      src={optimizeStockImage(src, 600) || src}
                      alt={`${title} — galeria ${index + 1}`}
                      className="aspect-[4/3] w-full rounded-lg object-cover"
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {optionals.length > 0 ? (
              <section>
                <h2 className="mb-3 rounded-md bg-[#00283C] px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white">
                  Opcionais em destaque
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {optionals.map((item) => (
                    <span
                      key={item}
                      className="rounded-md border border-[#E4EAEF] px-2 py-1 text-[11px] font-medium text-[#00283C]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-2xl border border-[#5CD29D] bg-[#F3FBF7] px-4 py-4">
              <h2 className="text-sm font-extrabold uppercase tracking-[0.08em] text-[#00283C]">
                Confiança garantida pela Netcar
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-[#5A6B73]">
                A Netcar atesta a curadoria deste seminovo e que o histórico acima
                foi obtido via consulta CheckAuto/DEKRA. Complemente sempre com a
                avaliação presencial e a documentação do Detran.
              </p>
            </section>

            <section className="rounded-2xl bg-[#FFF8E8] px-4 py-4">
              <h2 className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#00283C]">
                Natureza desta consulta — não é laudo técnico
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-[#5A6B73]">
                Esta consulta <strong className="font-bold text-[#00283C]">não tem
                caráter de laudo técnico</strong>. É um dossiê informativo de
                procedência e histórico (bases CheckAuto/DEKRA), com fotos e ficha
                do seminovo. Não substitui vistoria cautelar, laudo de engenharia,
                perícia estrutural nem inspeção veicular presencial.
              </p>
            </section>
          </div>

          <footer className="flex flex-col gap-1 border-t border-[#E4EAEF] px-5 py-4 text-[11px] text-[#5A6B73] sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <span>Netcar Multimarcas · i-CHECK</span>
            <span className="truncate">
              {typeof window !== "undefined" ? window.location.href : `/laudo/${slug}`}
            </span>
          </footer>
        </div>
      </article>
    </div>
  );
}
