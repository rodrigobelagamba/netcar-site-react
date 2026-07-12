import { Calculator, CreditCard, RefreshCw, FileCheck } from "lucide-react";
import { motion } from "framer-motion";

const benefits = [
  {
    icon: Calculator,
    title: "Financiamento em até 60x",
    desc: "Simule parcelas e compare condições entre bancos e financeiras parceiras.",
  },
  {
    icon: CreditCard,
    title: "Cartão de crédito em até 21x",
    desc: "Opção de parcelamento no cartão, conforme disponibilidade e análise.",
  },
  {
    icon: RefreshCw,
    title: "Avaliamos seu veículo na troca",
    desc: "Seu usado entra na negociação — inclusive com parcela em aberto.",
  },
  {
    icon: FileCheck,
    title: "Levamos ao Detran",
    desc: "Transferência com despachante credenciado — você não precisa se preocupar.",
  },
] as const;

export function HomePurchaseBenefits() {
  return (
    <section className="container-main px-4 py-10 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 md:py-14">
      <div className="mb-8 max-w-2xl">
        <h2 className="text-2xl font-bold text-fg md:text-3xl">
          Facilidades na compra
        </h2>
        <p className="mt-2 text-base font-medium text-gray-600 md:text-lg">
          Financiamento, cartão, troca e documentação — tudo no mesmo atendimento.
          Condições sujeitas à análise.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {benefits.map((item, i) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: i * 0.06 }}
            className="rounded-3xl border border-gray-100 bg-gradient-to-b from-white to-gray-50/80 p-5 shadow-sm"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#00283C] text-[#5CD29D]">
              <item.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-base font-bold leading-snug text-fg">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              {item.desc}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
