import { Database, Mail, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { openPrivacyPreferences } from "@/components/PrivacyConsent";
import { useMetaTags } from "@/hooks/useMetaTags";

const sections = [
  {
    title: "Quais dados o site pode tratar",
    paragraphs: [
      "Para o site funcionar e permanecer seguro, tratamos informações técnicas necessárias, como endereço IP, data e hora, rota acessada e registros de erro ou segurança.",
      "Quando você permite a medição, também podemos registrar a página de entrada, origem da visita, parâmetros de campanha, páginas vistas e interações com botões. Em um clique para o WhatsApp, geramos identificadores próprios para evitar contagens repetidas e relacionar aquele clique à conversa e, quando houver registro nos sistemas da Netcar, ao atendimento ou à venda.",
      "Se você preencher um formulário ou iniciar uma conversa, os dados que enviar passam a ser tratados para responder ao pedido, avaliar um veículo, preparar uma proposta ou dar continuidade ao atendimento.",
    ],
  },
  {
    title: "Para que usamos essas informações",
    items: [
      "manter o site disponível, seguro e compatível com diferentes dispositivos;",
      "responder contatos, simular condições e acompanhar negociações;",
      "entender quais páginas, cidades e campanhas trazem contatos úteis;",
      "evitar contagens duplicadas e melhorar o estoque, o conteúdo e o atendimento;",
      "cumprir obrigações legais, regulatórias e contratuais quando aplicáveis.",
    ],
  },
  {
    title: "Qual é a base para esse tratamento",
    paragraphs: [
      "A medição opcional é feita com o seu consentimento. Os dados enviados em um contato ou negociação são tratados para atender ao seu pedido, tomar providências antes da contratação e executar a relação comercial. Registros fiscais, documentais e de garantia podem ser mantidos para cumprir obrigações legais.",
      "Informações estritamente técnicas também podem ser usadas para segurança, prevenção a fraude e funcionamento do site, respeitando os direitos do titular e o uso mínimo necessário.",
    ],
  },
  {
    title: "Cookies, medição e publicidade",
    paragraphs: [
      "A opção “Permitir medição e publicidade” libera o armazenamento usado por Google Analytics, Google Ads e Meta para mensuração, publicidade e personalização de anúncios. O Meta Pixel só é carregado depois dessa escolha.",
      "Ao selecionar “Somente essenciais”, o site não grava a origem da visita para atribuição, não envia o clique ao nosso log de campanhas e não carrega o Meta Pixel. As tags do Google podem receber sinais sem cookies, com o consentimento negado, para estatísticas agregadas; elas não recebem autorização para criar cookies de medição ou publicidade.",
    ],
  },
  {
    title: "Com quem os dados podem ser compartilhados",
    paragraphs: [
      "Usamos fornecedores de hospedagem, segurança, análise, publicidade, CRM e comunicação somente na medida necessária para operar o site e atender o cliente. Entre eles podem estar Google, Meta/WhatsApp e os provedores dos sistemas internos da Netcar. Cada plataforma também possui seus próprios termos e práticas de privacidade.",
      "A Netcar não vende dados pessoais. Informações podem ser fornecidas a autoridades quando houver obrigação legal ou ordem válida.",
    ],
  },
  {
    title: "Por quanto tempo mantemos os dados",
    paragraphs: [
      "A origem de tráfego aceita fica armazenada no navegador por até 30 dias. Os registros internos de atribuição podem ser mantidos por até 365 dias para comparação entre campanha, atendimento e venda. Dados de propostas, contratos, garantias e obrigações fiscais seguem os prazos necessários para a relação comercial e para o cumprimento da lei.",
      "Quando um dado deixa de ser necessário, ele é eliminado ou anonimizado, salvo se houver motivo legal para conservá-lo.",
    ],
  },
];

export function PrivacyPage() {
  useMetaTags({
    title: "Privacidade e cookies | Netcar Multimarcas",
    description:
      "Saiba quais dados o site da Netcar utiliza, como funciona a medição de campanhas e como alterar suas preferências de privacidade.",
    url: "https://www.netcarmultimarcas.com.br/privacidade",
  });

  return (
    <main className="flex-1 bg-[#F6F8F8] px-4 pb-20 pt-10 sm:px-6 sm:pt-16 lg:px-8">
      <article className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-[#00283C]/10 bg-white shadow-sm">
        <header className="bg-[#00283C] px-6 py-10 text-white sm:px-10 sm:py-14">
          <div className="flex items-center gap-3 text-sm font-bold uppercase tracking-[0.18em] text-[#62D2CF]">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            Privacidade na Netcar
          </div>
          <h1 className="mt-4 text-3xl font-black leading-tight sm:text-5xl">
            Seus dados, sem letra miúda
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
            Aqui explicamos o que o site registra, por que isso é usado e como
            você pode controlar a medição.
          </p>
          <p className="mt-5 text-sm text-white/60">
            Última atualização: 31 de agosto de 2026
          </p>
        </header>

        <div className="space-y-10 px-6 py-10 sm:px-10 sm:py-12">
          <section className="rounded-2xl border border-[#62D2CF]/40 bg-[#62D2CF]/10 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <Database className="mt-0.5 h-5 w-5 shrink-0 text-[#00616A]" aria-hidden="true" />
              <div>
                <h2 className="text-lg font-black text-[#00283C]">
                  Quem cuida dos dados
                </h2>
                <p className="mt-2 leading-relaxed text-slate-700">
                  R&amp;C Veículos Ltda., CNPJ 02.237.969/0001-06, responsável
                  pelo site e pelo atendimento da Netcar Multimarcas.
                </p>
              </div>
            </div>
          </section>

          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-2xl font-black text-[#00283C]">
                {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-base leading-relaxed text-slate-700">
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.items ? (
                  <ul className="list-disc space-y-2 pl-5">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          ))}

          <section>
            <h2 className="text-2xl font-black text-[#00283C]">
              Suas escolhas e seus direitos
            </h2>
            <p className="mt-3 leading-relaxed text-slate-700">
              Você pode alterar a opção de cookies a qualquer momento. Também
              pode pedir confirmação do tratamento, acesso, correção, eliminação
              quando cabível, informação sobre compartilhamento ou revogação do
              consentimento. Alguns registros precisam ser mantidos para cumprir
              obrigações legais ou resguardar a relação comercial.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={openPrivacyPreferences}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#087A37] px-5 py-3 font-black text-white transition-colors hover:bg-[#075E54]"
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                Alterar preferências
              </button>
              <a
                href="mailto:contato@netcarmultimarcas.com.br?subject=Privacidade%20e%20dados"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#00283C]/20 px-5 py-3 font-bold text-[#00283C] transition-colors hover:bg-slate-50"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                contato@netcarmultimarcas.com.br
              </a>
            </div>
          </section>

          <p className="border-t border-slate-200 pt-6 text-sm leading-relaxed text-slate-500">
            Esta página pode ser atualizada quando o site, os fornecedores ou
            as regras aplicáveis mudarem. A versão publicada sempre mostrará a
            data da revisão mais recente.
          </p>
        </div>
      </article>
    </main>
  );
}
