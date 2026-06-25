import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { useDefaultMetaTags } from "@/hooks/useDefaultMetaTags";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import { buildWhatsAppUrl, siteWhatsAppMessage } from "@/lib/whatsappMessages";
import { Localizacao } from "@/design-system/components/layout/Localizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";
import { emptySeminovosSearch } from "@/lib/seminovos-search";

export function FinanciamentoSemEntradaPage() {
  const { data: whatsapp } = useWhatsAppQuery();

  useDefaultMetaTags(
    "Financiamento de Seminovos em Esteio",
    "Financie seu seminovo na Netcar em até 60x, com primeira parcela para 60 dias e entrada parcelada em até 10x sem juros. Sujeito a análise de crédito."
  );

  const waLink = (() => {
    if (!whatsapp?.numero) return "#";
    const text = siteWhatsAppMessage(
      "quero simular o financiamento de um seminovo na Netcar.",
    );
    return buildWhatsAppUrl(whatsapp.numero, text);
  })();

  return (
    <main className="flex-1 overflow-x-hidden max-w-full bg-gradient-to-b from-white via-gray-50/30 to-white">
      <section className="py-14 md:py-20">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl md:text-4xl font-bold text-fg mb-4">
              Financiamento de seminovos em Esteio
            </h1>
            <p className="text-lg text-gray-600 mb-6">
              Quer financiar seu próximo seminovo? Na Netcar você simula com documentos pelo WhatsApp e recebe resposta objetiva antes de ir à loja. Trabalhamos com bancos e financeiras parceiras — tudo mediante análise de crédito.
            </p>

            <h2 className="text-xl font-bold text-fg mt-8 mb-3">Condições</h2>
            <ul className="list-disc pl-5 space-y-2 text-gray-600 mb-3">
              <li>Financiamento em 24x, 36x, 48x ou 60x</li>
              <li>Primeira parcela para 60 dias</li>
              <li>Entrada de 20% a 30%, parcelável em até 10x sem juros</li>
              <li>Financiamento também pelo cartão de crédito em até 24x</li>
              <li>Avaliamos seu usado na troca como parte do pagamento</li>
            </ul>
            <p className="text-sm text-gray-500 mb-6">
              Condições sujeitas a análise de crédito.
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
              Se você tem carro para dar na troca — inclusive financiado — o valor entra na negociação e pode abater parte da entrada.
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
