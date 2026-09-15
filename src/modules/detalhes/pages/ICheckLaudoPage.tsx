import { useEffect, useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import {
  Printer,
  Download,
  ArrowLeft,
  Check,
  AlertTriangle,
  Info,
} from "lucide-react";
import { useVehicleQuery } from "@/catalog/queries/useVehicleQuery";
import { maskPlate } from "@/lib/slug";
import { VEHICLE_EQUIPMENT_NOTICE } from "@/lib/vehicleEquipmentNotice";
import {
  ICHECK_SOURCE_LABEL,
  ICHECK_SCOPE_NOTICE,
} from "@/reports/icheck/icheckCopy";
import { optimizeStockImage } from "@/lib/images";
import { useMetaTags } from "@/hooks/useMetaTags";
import { VehicleUnavailablePage } from "@/components/VehicleUnavailablePage";
import {
  buildClientICheckReportData,
  downloadICheckReportPdf,
} from "@/reports/icheck/downloadICheckReportPdf";
import {
  formatHistoryStatus,
  getHistorySummary,
  isAlienacaoFiduciaria,
  normalizeHistoryItems,
} from "@/reports/icheck/icheckHistory";
import {
  loadIcheckMetadata,
  type ICheckMetadataResult,
} from "@/lib/icheckMetadata";

const summaryStyles = {
  clear: "border-[#2E7D32]/40 bg-[#E8F7EF] text-[#1B5E20]",
  warning: "border-[#F59E0B]/50 bg-[#FFF8E1] text-[#92400E]",
  alert: "border-[#B91C1C]/40 bg-[#FEF2F2] text-[#991B1B]",
  incomplete: "border-[#64748B]/30 bg-[#F1F5F9] text-[#334155]",
  unavailable: "border-[#64748B]/30 bg-[#F1F5F9] text-[#334155]",
};

function Spec({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  if (value == null || value === "" || value === "—") return null;
  return (
    <div className="rounded-xl bg-[#F5F8F9] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5A6B73]">
        {label}
      </p>
      <p className="text-sm font-bold text-[#00283C]">{String(value)}</p>
    </div>
  );
}

export function ICheckLaudoPage() {
  const { slug } = useParams({ from: "/laudo/$slug" });
  const { data: vehicle, isLoading, isError } = useVehicleQuery(slug);
  const [loaded, setLoaded] = useState<{
    key: string;
    result: ICheckMetadataResult;
  } | null>(null);
  const [savingPdf, setSavingPdf] = useState(false);
  const identityKey = vehicle
    ? JSON.stringify([
        vehicle.id,
        vehicle.placa,
        vehicle.pdf,
        vehicle.pdf_url,
        vehicle.icheckAttachmentInvalid,
      ])
    : "";
  const title = vehicle
    ? `${vehicle.marca || ""} ${vehicle.modelo || vehicle.name || ""} ${vehicle.year || ""}`.trim()
    : "Consulta i-CHECK";

  useMetaTags({
    title: vehicle ? `Consulta i-CHECK — ${title}` : "Consulta i-CHECK",
    description:
      "Certificado i-CHECK com resultados da consulta DEKRA / CheckAuto e dados do estoque Netcar. Consulta de histórico, distinta de vistoria física ou laudo cautelar.",
    robots: "noindex, nofollow",
  });

  useEffect(() => {
    if (!vehicle) return;
    const controller = new AbortController();
    void loadIcheckMetadata(vehicle, controller.signal).then((result) => {
      if (!controller.signal.aborted) setLoaded({ key: identityKey, result });
    });
    return () => controller.abort();
  }, [identityKey]);

  if (isLoading && !vehicle)
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-[#00283C]/70">
        Carregando consulta…
      </div>
    );
  if (isError || !vehicle) return <VehicleUnavailablePage />;
  if (!loaded || loaded.key !== identityKey)
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-[#00283C]/70">
        Carregando resultados da consulta…
      </div>
    );

  const { protocol, status } = loaded.result;
  const history = normalizeHistoryItems(protocol?.history);
  const summary = getHistorySummary(history);
  const consultaId = protocol?.consultaId || protocol?.protocoloConsulta;
  const hasAlienacao = history.some((item) =>
    isAlienacaoFiduciaria(item.status),
  );
  const gallery = (
    vehicle.imagens_site?.galeria?.length
      ? vehicle.imagens_site.galeria
      : vehicle.fullImages?.length
        ? vehicle.fullImages
        : vehicle.images || []
  )
    .filter(Boolean)
    .slice(0, 9) as string[];
  const yearLabel =
    vehicle.anoFabricacao && vehicle.year
      ? `${vehicle.anoFabricacao} / ${vehicle.year}`
      : String(vehicle.year || vehicle.anoFabricacao || "—");
  const optionals = (vehicle.opcionais || [])
    .map((item) =>
      typeof item === "string" ? item : item.descricao || item.tag || "",
    )
    .filter(Boolean);
  const detailSections =
    protocol?.consultationSections?.filter((section) => section.items.length) ||
    [];
  const highlights = (protocol?.consultationHighlights || []).filter(
    (detail) =>
      !history.some(
        (item) =>
          item.label.toLocaleLowerCase("pt-BR") ===
            detail.label.toLocaleLowerCase("pt-BR") &&
          item.status === detail.value,
      ),
  );
  const missingMessage =
    vehicle.icheckAttachmentInvalid || status === "invalid_attachment"
      ? "As informações desta consulta estão indisponíveis. Confirme os dados com a Netcar."
      : status === "no_pdf"
        ? "A consulta de histórico deste veículo ainda não está disponível."
        : status === "invalid_metadata"
          ? "Não foi possível validar as informações desta consulta. Confirme os dados com a Netcar."
          : status === "unavailable"
            ? "Não foi possível carregar os resultados. Tente novamente ou fale com a Netcar."
            : null;

  const handleSavePdf = async () => {
    if (savingPdf) return;
    setSavingPdf(true);
    try {
      const data = buildClientICheckReportData({ vehicle, protocol, slug });
      const platePart = vehicle.placa
        ? vehicle.placa.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
        : slug;
      await downloadICheckReportPdf(
        data,
        `Relatorio-Netcar-i-CHECK-${platePart}.pdf`,
      );
    } catch (error) {
      console.error("[i-CHECK] falha ao gerar relatório PDF", error);
      window.alert("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setSavingPdf(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#F3F6F8] print:bg-white print:[print-color-adjust:exact] print:[-webkit-print-color-adjust:exact]">
      <div className="sticky top-0 z-30 border-b border-[#00283C]/10 bg-white/95 print:hidden">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link
            to="/veiculo/$slug"
            params={{ slug }}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#00283C]/80"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao veículo
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSavePdf()}
              disabled={savingPdf}
              className="inline-flex items-center gap-2 rounded-full border border-[#00283C]/25 bg-white px-3 py-2 text-xs font-bold text-[#00283C] transition-colors hover:border-[#00283C]/50 hover:bg-[#F1F5F9] disabled:cursor-wait disabled:opacity-60"
            >
              <Download className="h-3.5 w-3.5" />
              {savingPdf ? "Gerando…" : "Baixar relatório Netcar"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-full bg-[#00283C] px-3 py-2 text-xs font-bold text-white"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir
            </button>
          </div>
        </div>
      </div>

      <article className="mx-auto max-w-3xl px-4 py-6 print:max-w-none print:px-2 print:py-0">
        <div className="overflow-hidden rounded-3xl bg-white shadow-[0_12px_40px_rgba(0,40,60,0.08)] print:rounded-none print:shadow-none">
          <header className="flex items-center justify-between gap-4 border-b border-[#E4EAEF] px-5 py-4 sm:px-8">
            <div className="flex items-center gap-3">
              <img
                src="/brand/checkauto-dekra.png"
                alt="DEKRA CheckAuto"
                className="h-16 w-16 object-contain"
              />
              <div>
                <p className="text-sm font-extrabold text-[#00283C]">
                  DEKRA / CheckAuto
                </p>
                <p className="text-xs text-[#5A6B73]">
                  i-CHECK · Certificado de consulta de histórico
                </p>
              </div>
            </div>
            <img
              src="/brand/netcar.png"
              alt="Netcar"
              className="h-6 w-auto max-w-[88px] object-contain"
            />
          </header>

          <div className="space-y-6 px-5 py-6 print:space-y-4 sm:px-8">
            <div className="print:break-inside-avoid">
              <h1 className="text-2xl font-extrabold uppercase tracking-tight text-[#00283C]">
                {title}
              </h1>
              <p className="mt-1 text-sm text-[#5A6B73]">
                Placa{" "}
                {vehicle.placa ? maskPlate(vehicle.placa) : "não informada"} ·
                Dados do estoque Netcar
              </p>
            </div>

            <section className="rounded-2xl border border-[#E4EAEF] px-4 py-4 print:break-inside-avoid">
              <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#00283C]">
                {ICHECK_SOURCE_LABEL}
              </h2>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-[#5A6B73]">
                    Data e hora da consulta
                  </dt>
                  <dd className="mt-1 text-lg font-extrabold tabular-nums text-[#00283C] sm:text-xl">
                    {protocol?.dataHoraConsulta || "Indisponível"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[#5A6B73]">Fonte</dt>
                  <dd className="font-bold text-[#00283C]">
                    {protocol?.sourceLabel || "Indisponível"}
                  </dd>
                </div>
                {consultaId ? (
                  <div>
                    <dt className="text-xs text-[#5A6B73]">
                      Protocolo do fornecedor
                    </dt>
                    <dd className="font-bold text-[#00283C]">{consultaId}</dd>
                  </div>
                ) : null}
                {protocol?.chassiMasked ? (
                  <div>
                    <dt className="text-xs text-[#5A6B73]">Chassi</dt>
                    <dd className="font-bold tracking-wide text-[#00283C]">
                      {protocol.chassiMasked}
                    </dd>
                  </div>
                ) : null}
                {protocol?.tipoChave ? (
                  <div>
                    <dt className="text-xs text-[#5A6B73]">Identificação</dt>
                    <dd className="font-bold text-[#00283C]">
                      {protocol.tipoChave}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-[#5A6B73]">
                Os resultados refletem a situação na data e hora indicadas
                acima.
              </p>
            </section>

            <section
              aria-label="Resultado da consulta"
              className={`rounded-2xl border-2 px-4 py-4 print:break-inside-avoid ${summaryStyles[summary.approved ? "clear" : summary.level]} ${summary.approved ? "text-center sm:py-6" : ""}`}
            >
              <h2
                className={`flex items-center gap-2 font-extrabold ${summary.approved ? "justify-center text-3xl tracking-wide sm:gap-3 sm:text-4xl" : "text-base"}`}
              >
                {summary.approved ? (
                  <Check className="h-9 w-9 shrink-0 sm:h-11 sm:w-11" />
                ) : summary.level === "warning" || summary.level === "alert" ? (
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                ) : (
                  <Info className="h-5 w-5 shrink-0" />
                )}
                {summary.approved ? "APROVADO" : summary.title}
              </h2>
              {summary.approved ? (
                <p className="mt-2 text-base font-bold">{summary.title}</p>
              ) : null}
              <p className="mt-1 text-sm leading-relaxed">
                {summary.description}
              </p>
              <p className="mt-3 border-t border-current/15 pt-3 text-xs leading-relaxed">
                <strong>Sobre esta consulta: </strong>
                {ICHECK_SCOPE_NOTICE}
              </p>
              {missingMessage ? (
                <p className="mt-2 text-sm font-medium">{missingMessage}</p>
              ) : null}
              {hasAlienacao ? (
                <p className="mt-3 rounded-lg bg-[#FFF8E1] px-3 py-2 text-sm leading-relaxed text-[#92400E]">
                  A consulta registra alienação fiduciária na data indicada.
                  Confirme a situação atual e a baixa do gravame com a Netcar.
                </p>
              ) : null}
            </section>

            <section className="print:break-inside-avoid">
              <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-[#00283C]">
                Resultados individuais da consulta
              </h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {history.map((item, index) => {
                  const level =
                    item.riskLevel === "alert"
                      ? "alert"
                      : item.riskLevel === "warn"
                        ? "warning"
                        : item.clear
                          ? "clear"
                          : "unavailable";
                  return (
                    <div
                      key={`${item.key}-${index}`}
                      className={`flex items-start gap-3 rounded-xl border px-3 py-3 print:break-inside-avoid ${summaryStyles[level]}`}
                    >
                      {level === "clear" ? (
                        <Check className="mt-0.5 h-5 w-5 shrink-0" />
                      ) : level === "warning" || level === "alert" ? (
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                      ) : (
                        <Info className="mt-0.5 h-5 w-5 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-[#00283C]">
                          {item.label}
                        </h3>
                        <p className="mt-0.5 text-sm font-bold">
                          {formatHistoryStatus(item.status)}
                        </p>
                        {item.hint ? (
                          <p className="mt-1 text-xs leading-relaxed text-[#5A6B73]">
                            {item.hint}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[#5A6B73]">
                {summary.level === "unavailable"
                  ? "Os grupos acima estão sem resultados disponíveis."
                  : "Os resultados disponíveis são apresentados conforme a consulta CheckAuto / DEKRA."}{" "}
                Resultado indisponível significa que a informação não pôde ser
                apresentada.
              </p>
            </section>

            <section className="rounded-2xl border border-[#E4EAEF] px-4 py-4">
              <h2 className="text-sm font-extrabold text-[#00283C]">
                Observações da consulta
              </h2>
              <p className="mt-1 text-xs text-[#5A6B73]">
                Observações explicativas do documento de origem
              </p>
              {protocol?.consultationNotes?.length ? (
                <div className="mt-3 space-y-3">
                  {protocol.consultationNotes.map((note, index) => (
                    <p
                      key={index}
                      className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#475569]"
                    >
                      {note}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-[#5A6B73]">
                  Observações não disponíveis para esta consulta.
                </p>
              )}
            </section>

            {highlights.length ? (
              <section>
                <h2 className="mb-3 text-sm font-extrabold text-[#00283C]">
                  Informações adicionais da consulta
                </h2>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {highlights.map((item, index) => (
                    <Spec
                      key={`${item.label}-${index}`}
                      label={item.label}
                      value={item.value}
                    />
                  ))}
                </div>
              </section>
            ) : null}
            {detailSections.length ? (
              <section className="space-y-3">
                <h2 className="text-sm font-extrabold text-[#00283C]">
                  Detalhamento das consultas disponíveis
                </h2>
                {detailSections.map((section, index) => (
                  <details
                    key={`${section.title}-${index}`}
                    className="rounded-xl border border-[#E4EAEF] p-3"
                    open
                  >
                    <summary className="cursor-pointer text-sm font-bold text-[#00283C]">
                      {section.title}
                    </summary>
                    <dl className="mt-3 space-y-3">
                      {section.items.map((item, itemIndex) => (
                        <div key={`${item.label}-${itemIndex}`}>
                          <dt className="text-xs text-[#5A6B73]">
                            {item.label}
                          </dt>
                          <dd className="whitespace-pre-wrap break-words text-sm text-[#00283C]">
                            {item.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                ))}
              </section>
            ) : (
              <p className="rounded-xl bg-[#F1F5F9] px-4 py-3 text-sm leading-relaxed text-[#475569]">
                O detalhamento completo de cada base DEKRA não está disponível
                neste relatório.
              </p>
            )}

            <section>
              <h2 className="mb-3 rounded-md bg-[#00283C] px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white">
                Dados do estoque Netcar
              </h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Spec
                  label="Marca / modelo"
                  value={`${vehicle.marca || ""} ${vehicle.modelo || vehicle.name || ""}`.trim()}
                />
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
              <p className="mt-2 text-xs text-[#5A6B73]">
                Ficha, quilometragem, opcionais e fotos informados pelo estoque
                Netcar.
              </p>
            </section>
            {gallery.length ? (
              <section>
                <h2 className="mb-3 text-sm font-extrabold text-[#00283C]">
                  Fotos do seminovo na Netcar
                </h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {gallery.map((src, index) => (
                    <img
                      key={`${src}-${index}`}
                      src={optimizeStockImage(src, 600) || src}
                      alt={`${title} — foto ${index + 1}`}
                      className="aspect-[4/3] w-full rounded-lg object-cover"
                      loading="lazy"
                    />
                  ))}
                </div>
              </section>
            ) : null}
            {optionals.length ? (
              <section>
                <h2 className="mb-3 text-sm font-extrabold text-[#00283C]">
                  Opcionais informados pela Netcar
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
                <p className="mt-3 text-xs leading-relaxed text-[#5A6B73]">
                  {VEHICLE_EQUIPMENT_NOTICE}
                </p>
              </section>
            ) : null}
            <section className="rounded-xl bg-[#F1F5F9] px-4 py-4">
              <h2 className="text-xs font-extrabold text-[#00283C]">
                Sobre este relatório
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-[#5A6B73]">
                Relatório elaborado pela Netcar com os resultados e as
                observações da consulta DEKRA / CheckAuto. Dados do estoque,
                opcionais e fotos são informados pela Netcar.
              </p>
            </section>
          </div>
          <footer className="border-t border-[#E4EAEF] px-5 py-4 text-[11px] text-[#5A6B73] sm:px-8">
            Netcar Multimarcas · Relatório i-CHECK
          </footer>
        </div>
      </article>
    </div>
  );
}
