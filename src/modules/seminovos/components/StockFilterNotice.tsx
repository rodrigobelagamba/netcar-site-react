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
      className="mb-4 flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <Filter
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-800"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#00283C]">Estoque filtrado — você não está vendo todos os carros</p>
          <p className="text-xs leading-relaxed text-[#665538]">
            {summary}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-amber-300 bg-white px-3 text-sm font-bold text-[#00283C] transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
      >
        Ver todo o estoque
      </button>
    </section>
  );
}
