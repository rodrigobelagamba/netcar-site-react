import { Calculator, CreditCard, RefreshCw, FileCheck } from "lucide-react";

const benefits = [
  {
    icon: Calculator,
    title: "Financiamento até 60x",
    desc: "Com bancos parceiros, sujeito à análise de crédito.",
  },
  {
    icon: CreditCard,
    title: "Entrada no cartão",
    desc: "Parcelamento conforme disponibilidade e análise.",
  },
  {
    icon: RefreshCw,
    title: "Seu usado na troca",
    desc: "Inclusive com parcelas em aberto.",
  },
  {
    icon: FileCheck,
    title: "Documentação",
    desc: "Transferência com despachante credenciado.",
  },
] as const;

export function HomePurchaseBenefits() {
  return (
    <section className="container-main px-4 py-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
      <h2 className="mb-3 text-lg font-bold text-fg">
        Da simulação à documentação
      </h2>

      <ul className="grid gap-px overflow-hidden rounded-2xl border border-gray-100 bg-gray-100 sm:grid-cols-2 lg:grid-cols-4">
        {benefits.map((item) => (
          <li
            key={item.title}
            className="flex items-start gap-3 bg-white p-3 sm:p-4"
          >
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#00283C] text-[#5CD29D]">
              <item.icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold leading-snug text-fg">
                {item.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-gray-600">
                {item.desc}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
