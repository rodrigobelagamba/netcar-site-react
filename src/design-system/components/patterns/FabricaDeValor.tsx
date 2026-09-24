import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

interface Category {
  id: number;
  name: string;
  numero: string;
  items: Array<{
    desc: string;
  }>;
}

const categories: Category[] = [
  {
    id: 0,
    name: "Avaliação inicial",
    numero: "01",
    items: [
      {
        desc: "Especificações técnicas do veículo (ano, modelo, motorização, versão)",
      },
      { desc: "Configuração do modelo avaliado (opcionais e acessórios)" },
      { desc: "Histórico de revisões" },
    ],
  },
  {
    id: 1,
    name: "Análise técnica",
    numero: "02",
    items: [
      { desc: "Avaliação de rodagem e dirigibilidade" },
      { desc: "Avaliação mecânica" },
    ],
  },
  {
    id: 2,
    name: "Análise externa",
    numero: "03",
    items: [
      { desc: "Revitalização da pintura e espelhamento" },
      { desc: "Higienização geral" },
      { desc: "Revisão dos pneus" },
    ],
  },
  {
    id: 3,
    name: "Análise interna",
    numero: "04",
    items: [
      { desc: "Higienização" },
      { desc: "Acabamento interno" },
      { desc: "Funcionalidade e acessórios" },
    ],
  },
  {
    id: 4,
    name: "Revisão dos detalhes",
    numero: "05",
    items: [
      { desc: "Verificação dos serviços realizados" },
      { desc: "Posicionamento em showroom" },
    ],
  },
  {
    id: 5,
    name: "Avaliação pré-entrega",
    numero: "06",
    items: [
      {
        desc: "Revisão dos itens de segurança (iluminação, sinalização, calibragem)",
      },
      { desc: "Posicionamento para entrega" },
    ],
  },
];

export const FabricaDeValor = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const sectionId = useId();
  const titleId = `${sectionId}-title`;
  const contentId = `${sectionId}-content`;

  return (
    <section
      aria-labelledby={titleId}
      className="w-full overflow-hidden rounded-2xl border border-[#00283C]/10 bg-white"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h3
            id={titleId}
            className="text-base font-bold leading-snug text-[#00283C]"
          >
            Fábrica de Valor
          </h3>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-600 sm:text-sm">
            Conheça as 6 etapas de preparação.
          </p>
        </div>
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={contentId}
          onClick={() => setIsExpanded((expanded) => !expanded)}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#23747C]/20 bg-[#eff7f4] px-3 py-2 text-xs font-semibold text-[#075E54] transition-colors hover:bg-[#e5f1ec] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#23747C] focus-visible:ring-offset-2 sm:text-sm"
        >
          {isExpanded ? "Recolher" : "Ver preparação"}
          <ChevronDown
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 ${isExpanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      <div id={contentId} hidden={!isExpanded}>
        <ol className="grid grid-cols-1 gap-3 border-t border-[#00283C]/10 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
          {categories.map((category) => (
            <li
              key={category.id}
              className="min-w-0 rounded-xl border border-[#00283C]/10 bg-[#f7faf8] p-3"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e5f1ec] text-[11px] font-bold text-[#23747C]">
                  {category.numero}
                </span>
                <h4 className="text-sm font-bold leading-snug text-[#00283C]">
                  {category.name}
                </h4>
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px] leading-relaxed text-gray-600 marker:text-[#23747C]/70">
                {category.items.map((item) => (
                  <li key={item.desc}>{item.desc}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};
