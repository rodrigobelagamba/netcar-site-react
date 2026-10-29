import { Filter } from "lucide-react";

type StockFilterNoticeProps = {
  active: boolean;
  resultCount: number;
  updating: boolean;
  onClear: () => void;
};

export function StockFilterNotice({
  active,
  resultCount,
  updating,
  onClear,
}: StockFilterNoticeProps) {
  if (!active) return null;

  const summary = updating
    ? "Atualizando os resultados da sua seleção…"
    : resultCount === 0
      ? "Nenhum veículo corresponde a esta seleção."
      : `${resultCount} ${resultCount === 1 ? "veículo encontrado" : "veículos encontrados"} nesta seleção.`;

  return (
    <section
      aria-label="Estoque filtrado"
      className="inline-flex min-w-0 flex-wrap items-center gap-3 text-xs sm:ml-auto sm:text-sm"
    >
      <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-amber-800">
        <Filter className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Filtrado
      </span>
      <p className="sr-only">
        Estoque filtrado — você não está vendo todos os carros
      </p>
      <p className="sr-only">{summary}</p>
      <button
        type="button"
        aria-label="Ver todos os veículos do estoque"
        onClick={onClear}
        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-[#00283C] px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#00435a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008C95] focus-visible:ring-offset-2"
      >
        Ver todo o estoque
      </button>
    </section>
  );
}
