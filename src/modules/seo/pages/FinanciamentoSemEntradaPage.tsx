import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { useDefaultMetaTags } from "@/hooks/useDefaultMetaTags";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import { formatWhatsAppNumber } from "@/lib/formatters";
import { Localizacao } from "@/design-system/components/layout/Localizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";
import { emptySeminovosSearch } from "@/lib/seminovos-search";

export function FinanciamentoSemEntradaPage() {
  const { data: whatsapp } = useWhatsAppQuery();

  useDefaultMetaTags(
    "Carro Sem Entrada em Esteio",
    "Compre seminovo sem entrada em Esteio/RS. Financiamento em até 60x com aprovação rápida na Netcar Multimarcas."
  );

  const waLink = (() => {
    if (!whatsapp?.numero) return "#";
    const number = formatWhatsAppNumber(whatsapp.numero);
    const text = "Oi! Quero simular financiamento sem entrada para um seminovo.";
    return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
  })();

  return (
    <main className="flex-1 overflow-x-hidden max-w-full bg-gradient-to-b from-white via-gray-50/30 to-white">
      <section className="py-14 md:py-20">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl md:text-4xl font-bold text-fg mb-4">
              Carro sem entrada — financiamento 100%
            </h1>
            <p className="text-lg text-gray-600 mb-6">
              Quer trocar de carro sem desembolsar entrada? Na Netcar você simula com documentos pelo WhatsApp e recebe resposta objetiva antes de ir à loja.
            </p>

            <h2 className="text-xl font-bold text-fg mt-8 mb-3">Como funciona</h2>
            <ol className="list-decimal pl-5 space-y-2 text-gray-600 mb-6">
              <li>Escolha o seminovo no estoque online ou com ajuda do consultor</li>
              <li>Envie RG, CPF, comprovante de renda e endereço</li>
              <li>Receba simulação com bancos e financeiras parceiras</li>
              <li>Assinou? Retire o carro na loja em Esteio</li>
            </ol>

            <h2 className="text-xl font-bold text-fg mt-8 mb-3">Troca com parcela em aberto</h2>
            <p className="text-gray-600 mb-6">
              Se você tem carro para dar na troca — inclusive financiado — o valor entra na negociação e pode reduzir ou eliminar a necessidade de entrada.
            </p>

            <div className="flex flex-wrap gap-3">
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-xl bg-[#25D366] px-5 py-3 text-white font-semibold hover:opacity-90"
              >
                Simular no WhatsApp
              </a>
              <Link
                to="/seminovos"
                search={emptySeminovosSearch}
                className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-white font-semibold hover:bg-primary/90"
              >
                Ver estoque
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="w-full font-sans antialiased text-muted-foreground bg-muted py-12 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 space-y-8">
        <div className="container-main space-y-8">
          <Localizacao />
          <IanBot />
        </div>
      </div>
    </main>
  );
}
