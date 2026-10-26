import { ArrowRight } from "lucide-react";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import { buildWhatsAppUrl, siteWhatsAppMessage } from "@/lib/whatsappMessages";

interface Service {
  title: string;
  image: string;
  imageAlt: string;
  desc: string;
  cta: string;
  message: string;
  intent: "simulate_finance" | "sell_evaluation";
  objectPosition?: string;
}

export function ServicesSection() {
  const { data: whatsapp } = useWhatsAppQuery();

  const getWhatsAppLink = (message: string) => {
    if (!whatsapp?.numero) return "#";
    return buildWhatsAppUrl(whatsapp.numero, siteWhatsAppMessage(message));
  };

  const services: Service[] = [
    {
      title: "Financiamento",
      image: "/images/financing-scene-v2.jpg",
      imageAlt: "Cena ilustrativa de clientes conversando sobre financiamento de um carro",
      desc: "Até 60x e entrada no cartão, conforme disponibilidade e análise de crédito.",
      cta: "Simular financiamento",
      message:
        "quero simular um financiamento e comparar condições entre os bancos e financeiras parceiras.",
      intent: "simulate_finance",
      objectPosition: "center 7%",
    },
    {
      title: "Venda seu veículo",
      image: "/images/vehicle-evaluation-scene-v2.jpg",
      imageAlt: "Cena ilustrativa de uma avaliação de veículo junto ao cliente",
      desc: "Venda ou use seu carro na troca, com avaliação e apoio na documentação.",
      cta: "Avaliar meu carro",
      message: "tenho interesse em vender meu carro para a Netcar.",
      intent: "sell_evaluation",
      objectPosition: "center 7%",
    },
  ];

  return (
    <section className="container-main px-4 py-8 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {services.map((service) => (
          <article
            key={service.intent}
            className="grid overflow-hidden rounded-3xl border border-[#00283C]/10 bg-white shadow-sm sm:grid-cols-[0.42fr_0.58fr]"
          >
            <div className="relative aspect-[16/9] overflow-hidden bg-[#00283C] sm:aspect-auto sm:h-full sm:min-h-[280px]">
              <img
                src={service.image}
                width={1024}
                height={1024}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
                alt={service.imageAlt}
                style={{ objectPosition: service.objectPosition }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <span className="absolute bottom-2 left-2 rounded bg-white/90 px-1.5 py-0.5 text-[9px] leading-tight text-[#00283C]/75">
                Imagem ilustrativa
              </span>
            </div>

            <div className="flex min-w-0 flex-col items-start p-4 sm:p-5 xl:p-6">
              <div>
                <h3 className="text-xl font-black leading-tight text-[#00283C]">
                  {service.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#00283C]/75">
                  {service.desc}
                </p>
              </div>

              <div className="mt-auto w-full pt-4">
                <a
                  href={getWhatsAppLink(service.message)}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-wa-source="home_service"
                  data-wa-intent={service.intent}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#5CD29D] px-3 py-2 text-center text-sm font-bold leading-tight text-[#00283C] transition-colors hover:bg-[#5CD29D]/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00283C]"
                >
                  <span>{service.cta}</span>
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
