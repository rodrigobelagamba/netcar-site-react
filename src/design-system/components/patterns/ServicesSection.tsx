import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import { buildWhatsAppUrl, siteWhatsAppMessage } from "@/lib/whatsappMessages";

interface Service {
  title: string;
  image: string;
  desc: string;
  cta: string;
  message: string;
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
      image: "/images/financing.png",
      desc: "Financiamento em até 60x ou cartão em até 21x. Compare bancos e financeiras parceiras — sujeito à análise.",
      cta: "Comparar Condições",
      message: "quero simular um financiamento e comparar condições entre os bancos e financeiras parceiras.",
      objectPosition: "30% center",
    },
    {
      title: "Venda seu Veículo",
      image: "/images/vehicle-evaluation.png",
      desc: "Avaliamos seu veículo na troca. Documentação com despachante credenciado até o DETRAN.",
      cta: "Avaliar Carro",
      message: "tenho interesse em vender meu carro para a Netcar.",
      objectPosition: "center 25%",
    },
  ];

  return (
    <section className="container-main px-4 py-10 sm:px-6 md:py-24 lg:px-8 xl:px-12 2xl:px-16">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-8">
        {services.map((service, i) => (
          <motion.a
            key={i}
            href={getWhatsAppLink(service.message)}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ y: -12 }}
            className="group relative block h-[220px] cursor-pointer overflow-hidden rounded-[24px] shadow-xl !border-0 md:h-[500px] md:rounded-[32px] md:shadow-2xl"
            style={{ border: 'none' }}
          >
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#001524] via-[#001524]/10 to-transparent z-10 opacity-70 !border-0" style={{ border: 'none' }} />
            
            <img 
              src={service.image} 
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-[1.2s] ease-out !border-0" 
              alt={service.title}
              style={{ border: 'none', objectPosition: service.objectPosition || 'center 25%' }}
              onError={(e) => {
                // Fallback para uma cor sólida se a imagem não carregar
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  parent.style.backgroundColor = '#00283C';
                }
              }}
            />
            
            <div className="absolute inset-0 z-20 p-8 md:p-10 flex flex-col justify-end items-start text-left pb-12 !border-0" style={{ border: 'none' }}>
              <div className="transform transition-transform duration-500 translate-y-2 group-hover:translate-y-0 !border-0" style={{ border: 'none' }}>
                <div className="inline-block px-6 py-2 rounded-full mb-3 shadow-lg !border-0" style={{ backgroundColor: '#5CD29D', color: '#00283C', border: 'none' }}>
                  <h3 className="text-sm font-bold uppercase tracking-wider !border-0" style={{ border: 'none' }}>{service.title}</h3>
                </div>
                <p className="text-white/80 text-sm md:text-base leading-relaxed max-w-[280px] font-medium !border-0" style={{ border: 'none' }}>
                  {service.desc}
                </p>
              </div>
              
              <div className="mt-6 flex items-center gap-2 font-bold text-sm uppercase tracking-wider group/btn !border-0" style={{ color: '#5CD29D', border: 'none' }}>
                <span className="!border-0" style={{ border: 'none' }}>{service.cta}</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1 !border-0" style={{ border: 'none' }} />
              </div>
            </div>
          </motion.a>
        ))}
      </div>
    </section>
  );
}

