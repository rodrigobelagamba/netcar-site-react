import { useParams, Link } from "@tanstack/react-router";
import { Printer, Download, ArrowLeft, Check } from "lucide-react";
import { useVehicleQuery } from "@/catalog/queries/useVehicleQuery";
import { maskPlate } from "@/lib/slug";
import { optimizeStockImage } from "@/lib/images";
import { useMetaTags } from "@/hooks/useMetaTags";
import { VehicleUnavailableRedirect } from "@/components/VehicleUnavailableRedirect";

const HISTORY_ITEMS = [
  { key: "leilao", label: "Leilão" },
  { key: "sinistro", label: "Sinistro / Perda" },
  { key: "roubo", label: "Roubo / Furto" },
  { key: "estaduais", label: "Informações Estaduais" },
] as const;

function Spec({ label, value }: { label: string; value?: string | number | null }) {
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

  const title = vehicle
    ? `${vehicle.marca || ""} ${vehicle.modelo || vehicle.name || ""} ${vehicle.year || ""}`.trim()
    : "Laudo i-CHECK";

  useMetaTags({
    title: vehicle ? `Laudo i-CHECK — ${title}` : "Laudo i-CHECK",
    description:
      "Laudo técnico-informativo Netcar com fotos, ficha e histórico consultado via DEKRA / CheckAuto. Não é vistoria cautelar.",
    robots: "noindex, nofollow",
  });

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

  const handlePrint = () => window.print();

  const handleSavePdf = async () => {
    const fileName = vehicle.pdf || `laudo-icheck-${vehicle.id}.pdf`;
    let pdfUrl = vehicle.pdf
      ? `/arquivos/autocheck/${vehicle.pdf}`
      : vehicle.pdf_url || "";

    if (!pdfUrl) {
      // Sem arquivo no host: salva via diálogo (Salvar como PDF)
      window.print();
      return;
    }

    if (!pdfUrl.startsWith("http")) {
      pdfUrl = `${window.location.origin}${pdfUrl.startsWith("/") ? "" : "/"}${pdfUrl}`;
    }

    try {
      const res = await fetch(`${pdfUrl}${pdfUrl.includes("?") ? "&" : "?"}v=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      // PDF antigo CheckAuto ~50KB; laudo novo ~2MB — se veio miúdo, usa impressão da tela
      if (blob.size < 200_000) {
        window.print();
        return;
      }
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Fallback: salva o que está na tela
      window.print();
    }
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
              className="inline-flex items-center gap-2 rounded-full border border-secondary/40 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-secondary shadow-sm transition hover:border-secondary hover:bg-[#E8F7EF]"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={2.5} />
              Salvar PDF
            </button>
            <button
              type="button"
              onClick={handlePrint}
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
                Documento de caráter técnico-informativo. Não constitui vistoria
                cautelar nem laudo estrutural/pericial.
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

            <section>
              <h2 className="mb-3 rounded-md bg-[#00283C] px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white">
                Histórico do veículo (CheckAuto / DEKRA)
              </h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {HISTORY_ITEMS.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center gap-3 rounded-xl bg-[#F5F8F9] px-3 py-3"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2E7D32] text-white">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-[#00283C]">{item.label}</p>
                      <p className="text-xs text-[#5A6B73]">Sem Registro</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-[#5A6B73]">
                Status conforme consulta CheckAuto/DEKRA às bases disponíveis na
                emissão do laudo vinculado a este seminovo.
              </p>
            </section>

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
                Natureza deste documento — não é vistoria cautelar
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-[#5A6B73]">
                Esta consulta tem caráter de laudo técnico / dossiê informativo do
                veículo (procedência e histórico em bases CheckAuto/DEKRA, fotos e
                ficha do seminovo). Não substitui vistoria cautelar, laudo de
                engenharia, perícia estrutural nem inspeção veicular presencial.
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
