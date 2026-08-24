import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileSearch,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import { useMetaTags } from "@/hooks/useMetaTags";
import { buildWhatsAppUrl, siteWhatsAppMessage } from "@/lib/whatsappMessages";
import { emptySeminovosSearch } from "@/lib/seminovos-search";
import { trackSelectionCampaignCta } from "@/lib/analytics";
import { CANONICAL_ORIGIN } from "@/lib/seo";

const canonicalPath = "/como-selecionamos-nossos-carros";

const selectionSteps = [
  {
    label: "NA COMPRA",
    icon: MapPin,
    title: "Compramos no Rio Grande do Sul",
    text: "O estoque que compramos para revender vem do RS. Assim, trabalhamos dentro do mercado que conhecemos e conseguimos avaliar melhor as informações disponíveis.",
  },
  {
    label: "NOSSA ESCOLHA",
    icon: ShieldCheck,
    title: "Carro de locadora não entra",
    text: "A Netcar não compra carro de locadora para revender. É uma escolha ligada ao tipo de uso que aceitamos para o nosso estoque.",
  },
  {
    label: "NA CONFERÊNCIA",
    icon: FileSearch,
    title: "Conferimos o que está disponível",
    text: "O histórico, as consultas e os documentos disponíveis ajudam a decidir se o carro entra ou não. O consultor pode mostrar o que existe para o veículo antes do fechamento.",
  },
  {
    label: "ANTES DA VENDA",
    icon: Wrench,
    title: "Preparamos antes de vender",
    text: "Depois de comprado, o carro passa pela avaliação e pela preparação da Netcar antes de ir para a vitrine e chegar ao cliente.",
  },
] as const;

const customerBenefits = [
  {
    icon: FileSearch,
    title: "Você sabe mais sobre o carro",
    text: "Além de preço, ano e quilometragem, você pode perguntar sobre a origem, o histórico disponível e o que foi preparado.",
  },
  {
    icon: Sparkles,
    title: "Ele é preparado antes da entrega",
    text: "Depois da compra, o carro passa pela avaliação e pela preparação da Netcar. O que foi feito pode variar conforme a necessidade de cada veículo.",
  },
  {
    icon: Building2,
    title: "Duas lojas, a mesma operação",
    text: "As duas lojas de Esteio trabalham juntas. O vendedor pode mostrar carros de qualquer unidade e acompanhar toda a negociação.",
  },
] as const;

const faq = [
  {
    q: "A Netcar vende veículos provenientes de locadoras?",
    a: "Não. Carro de locadora não entra no estoque que a Netcar compra para revender.",
  },
  {
    q: "Os veículos da Netcar são comprados no Rio Grande do Sul?",
    a: "Sim. O estoque que a Netcar compra para revender vem do Rio Grande do Sul. Durante o atendimento, a equipe explica as informações disponíveis sobre o carro escolhido.",
  },
  {
    q: "Isso significa que um seminovo nunca terá problemas?",
    a: "Não. Seminovo não é carro zero e pode precisar de manutenção no futuro. A seleção e a preparação ajudam, mas não são promessa de risco zero. A garantia e as condições da venda são explicadas antes do fechamento.",
  },
  {
    q: "Consigo consultar o histórico do carro antes de comprar?",
    a: "Sim. Quando o veículo possui i-CHECK, o laudo fica disponível na própria página do carro e pode ser aberto e baixado em PDF. O consultor também apresenta as demais consultas e os documentos disponíveis para aquele veículo.",
  },
  {
    q: "As duas lojas possuem estoques separados?",
    a: "Não. As duas lojas ficam na Avenida Presidente Vargas, em Esteio, e trabalham com o mesmo estoque integrado. Um vendedor pode acompanhar você nos veículos disponíveis em qualquer uma das unidades.",
  },
] as const;

export function ComoSelecionamosPage() {
  const { data: whatsapp } = useWhatsAppQuery();
  const whatsappNumber = whatsapp?.numero || "5551997293118";
  const whatsappUrl = buildWhatsAppUrl(
    whatsappNumber,
    siteWhatsAppMessage(
      "quero encontrar um seminovo e entender a origem e a preparação do veículo.",
    ),
  );

  useMetaTags({
    title: "Como selecionamos nossos carros | Netcar Multimarcas",
    description:
      "Conheça os critérios da Netcar: veículos selecionados no RS, sem origem de locadora, análise do histórico disponível e preparação antes da vitrine.",
    url: `${CANONICAL_ORIGIN}${canonicalPath}`,
    image: `${CANONICAL_ORIGIN}/images/loja1.jpg`,
  });

  useEffect(() => {
    const canonical = `${CANONICAL_ORIGIN}${canonicalPath}`;
    const schema = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": `${canonical}#webpage`,
          url: canonical,
          name: "Como a Netcar seleciona seus carros",
          description:
            "Critérios de seleção, análise e preparação dos veículos da Netcar Multimarcas.",
          inLanguage: "pt-BR",
          isPartOf: { "@id": `${CANONICAL_ORIGIN}/#website` },
          about: { "@id": `${CANONICAL_ORIGIN}/#organization` },
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Início",
              item: `${CANONICAL_ORIGIN}/`,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Como selecionamos nossos carros",
              item: canonical,
            },
          ],
        },
        {
          "@type": "FAQPage",
          mainEntity: faq.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        },
      ],
    };

    document.querySelector('script[data-schema="selection-process"]')?.remove();
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-schema", "selection-process");
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      document
        .querySelector('script[data-schema="selection-process"]')
        ?.remove();
    };
  }, []);

  return (
    <main className="flex-1 overflow-x-hidden bg-white pb-24 text-fg md:pb-0">
      <header className="relative isolate overflow-hidden bg-[#F3F8F8]">
        <div className="pointer-events-none absolute -left-32 top-0 h-80 w-80 rounded-full bg-[#5CD29D]/20 blur-3xl" />
        <div className="container-main grid items-center gap-9 px-4 pb-12 pt-24 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 xl:px-12 2xl:px-16">
          <div className="relative z-10 max-w-3xl">
            <nav
              aria-label="Navegação estrutural"
              className="mb-7 text-xs font-bold text-gray-500"
            >
              <Link to="/" className="hover:text-[#006D77]">
                Início
              </Link>
              <span aria-hidden="true" className="mx-2">
                /
              </span>
              <span>Como escolhemos</span>
            </nav>
            <span className="text-xs font-black uppercase tracking-[0.2em] text-[#007B86]">
              Como escolhemos nosso estoque
            </span>
            <h1 className="mt-4 text-4xl font-black leading-[1.02] tracking-[-0.045em] text-[#00283C] sm:text-5xl lg:text-6xl">
              Nem todo carro entra na Netcar.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-600 md:text-xl">
              Antes de anunciar, a gente olha de onde o carro veio, o histórico
              que está disponível e o tipo de uso que teve. Nosso estoque de
              revenda é comprado no RS e não tem carro de locadora.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/seminovos"
                search={emptySeminovosSearch}
                onClick={() =>
                  trackSelectionCampaignCta("view_stock", "campaign_hero")
                }
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#00283C] px-7 py-3.5 text-sm font-black text-white shadow-[0_12px_30px_rgba(0,40,60,0.2)] transition hover:bg-[#00435A] active:scale-[0.98]"
              >
                Ver carros disponíveis
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-wa-source="landing"
                data-wa-intent="selection_process"
                onClick={() =>
                  trackSelectionCampaignCta("whatsapp", "campaign_hero")
                }
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#00283C]/20 bg-white px-7 py-3.5 text-sm font-bold text-[#00283C] transition hover:border-[#007B86]/50 hover:bg-white/80 active:scale-[0.98]"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Falar com um consultor
              </a>
            </div>
          </div>

          <div className="relative min-h-[340px] overflow-hidden rounded-[28px] shadow-[0_25px_70px_rgba(0,40,60,0.18)] sm:min-h-[470px]">
            <img
              src="/images/loja1.webp"
              alt="Fachada e showroom da Netcar Multimarcas em Esteio"
              width={1280}
              height={960}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#001F2F]/80 via-transparent to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 grid grid-cols-2 gap-3 sm:bottom-7 sm:left-7 sm:right-7">
              <div className="rounded-2xl border border-white/20 bg-[#001F2F]/80 p-4 text-white backdrop-blur-md">
                <strong className="block text-2xl font-black">
                  Desde 1997
                </strong>
                <span className="mt-1 block text-xs text-white/75">
                  em Esteio/RS
                </span>
              </div>
              <div className="rounded-2xl border border-white/20 bg-[#001F2F]/80 p-4 text-white backdrop-blur-md">
                <strong className="block text-2xl font-black">2 lojas</strong>
                <span className="mt-1 block text-xs text-white/75">
                  um estoque integrado
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="container-main px-4 py-14 sm:px-6 md:py-20 lg:px-8 xl:px-12 2xl:px-16">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-[#007B86]">
              Da compra até a vitrine
            </span>
            <h2 className="mt-4 text-3xl font-black leading-tight tracking-[-0.03em] text-[#00283C] md:text-4xl">
              Primeiro a gente escolhe o carro. Depois anuncia.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-gray-600 md:text-lg">
              Parece óbvio, mas não é só comprar qualquer carro e colocar uma
              placa de preço. Se a origem e as informações disponíveis não
              ajudam a entender o veículo, ele não combina com o estoque que a
              Netcar quer vender.
            </p>
          </div>

          <ol className="space-y-4">
            {selectionSteps.map((step) => (
              <li
                key={step.label}
                className="grid gap-4 rounded-3xl border border-gray-100 bg-gradient-to-br from-white to-[#F5FAFA] p-5 shadow-sm sm:grid-cols-[64px_1fr] sm:p-7"
              >
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00283C] text-[#5CD29D]">
                  <step.icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <div>
                  <span className="text-xs font-black tracking-[0.14em] text-[#007B86]">
                    {step.label}
                  </span>
                  <h3 className="mt-1.5 text-xl font-black text-[#00283C]">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600 sm:text-base">
                    {step.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-[#00283C] py-14 text-white md:py-20">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <div className="max-w-3xl">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-[#5CD29D]">
              Por que fazemos assim
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] md:text-4xl">
              Porque, depois da venda, o problema também chega até nós.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/75 md:text-lg">
              Um carro mal escolhido na entrada pode virar problema para o
              cliente e para a Netcar. Por isso, preferimos ser seletivos antes
              de anunciar.
            </p>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {customerBenefits.map((benefit) => (
              <article
                key={benefit.title}
                className="rounded-3xl border border-white/[0.12] bg-white/[0.06] p-6"
              >
                <benefit.icon
                  className="h-7 w-7 text-[#5CD29D]"
                  aria-hidden="true"
                />
                <h3 className="mt-5 text-xl font-black">{benefit.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/70 sm:text-base">
                  {benefit.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container-main grid items-center gap-10 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-2 lg:px-8 xl:px-12 2xl:px-16">
        <div className="relative mx-auto w-full max-w-xl">
          <div className="absolute -inset-4 rounded-[36px] bg-[#5CD29D]/12" />
          <img
            src="/images/loja2.webp"
            alt="Showroom da Loja 2 da Netcar Multimarcas em Esteio"
            width={1280}
            height={960}
            loading="lazy"
            decoding="async"
            className="relative aspect-square w-full rounded-[28px] bg-[#EAF4F4] object-cover"
          />
        </div>
        <div>
          <span className="text-xs font-black uppercase tracking-[0.18em] text-[#007B86]">
            Antes de fechar
          </span>
          <h2 className="mt-4 text-3xl font-black leading-tight tracking-[-0.03em] text-[#00283C] md:text-4xl">
            Pergunte isso sobre o carro.
          </h2>
          <ul className="mt-7 space-y-4">
            {[
              "Qual é a origem informada deste veículo?",
              "Quais documentos, consultas ou laudos estão disponíveis?",
              "O que foi avaliado e preparado antes da venda?",
              "Quais são as condições de garantia desta negociação?",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-gray-600">
                <CheckCircle2
                  className="mt-0.5 h-5 w-5 shrink-0 text-[#008C79]"
                  aria-hidden="true"
                />
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-7 rounded-2xl border border-[#0B8F92]/20 bg-[#F1FAFA] p-4 text-sm leading-relaxed text-[#00283C]">
            <strong>Na página e na loja:</strong> mostramos as informações
            disponíveis, deixamos o i-CHECK acessível quando houver e explicamos
            as condições da venda antes do fechamento.
          </p>
        </div>
      </section>

      <section className="bg-[#F3F8F8] py-14 md:py-20">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-[#007B86]">
              Perguntas frequentes
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-[#00283C] md:text-4xl">
              O que os clientes costumam perguntar.
            </h2>
          </div>
          <div className="mx-auto mt-9 max-w-4xl space-y-3">
            {faq.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border border-gray-100 bg-white p-5 shadow-sm open:shadow-md"
              >
                <summary className="cursor-pointer list-none pr-8 font-black text-[#00283C] marker:hidden">
                  {item.q}
                </summary>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-600 sm:text-base">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="container-main px-4 py-14 sm:px-6 md:py-20 lg:px-8 xl:px-12 2xl:px-16">
        <div className="rounded-[28px] bg-gradient-to-br from-[#006D77] to-[#00283C] px-6 py-10 text-center text-white shadow-[0_22px_70px_rgba(0,40,60,0.2)] sm:px-10 md:py-14">
          <h2 className="mx-auto max-w-3xl text-3xl font-black leading-tight tracking-[-0.03em] md:text-4xl">
            Encontre seu carro. A gente mostra por que ele entrou na Netcar.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/75 md:text-lg">
            Veja os carros disponíveis. Quando encontrar uma opção, consulte o
            i-CHECK na página, quando disponível, e converse com o consultor
            sobre a origem e a preparação daquele veículo.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/seminovos"
              search={emptySeminovosSearch}
              onClick={() =>
                trackSelectionCampaignCta("view_stock", "campaign_final")
              }
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#5CD29D] px-7 py-3.5 text-sm font-black text-[#00283C] transition hover:bg-[#76DEB0] active:scale-[0.98]"
            >
              Ver estoque disponível
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-wa-source="landing"
              data-wa-intent="selection_process"
              onClick={() =>
                trackSelectionCampaignCta("whatsapp", "campaign_final")
              }
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/30 px-7 py-3.5 text-sm font-bold text-white transition hover:bg-white/10 active:scale-[0.98]"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Falar sobre um veículo
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
