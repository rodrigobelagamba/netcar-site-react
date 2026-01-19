import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useWhatsAppQuery } from "@/api/queries/useSiteQuery";

interface Service {
  title: string;
  image: string;
  desc: string;
  cta: string;
  message: string;
}

export function ServicesSection() {
  const { data: whatsapp } = useWhatsAppQuery();

  const getWhatsAppLink = (message: string) => {
    if (!whatsapp?.numero) return "#";
    
    const cleaned = whatsapp.numero.replace(/\D/g, "");
    return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
  };

  const services: Service[] = [
    {
      title: "Financiamento",
      image: "/images/financing.png",
      desc: "Aprovação rápida com as melhores taxas do mercado.",
      cta: "Simular Agora",
      message: "Olá IAN, tenho interesse em financiar um veículo.",
    },
    {
      title: "Venda seu Veículo",
      image: "/images/vehicle-evaluation.png",
      desc: "Processo simples, negociação transparente!",
      cta: "Avaliar Carro",
      message: "Olá IAN, tenho interesse em vender meu carro para a Netcar.",
    },
  ];

  return (
    <section className="py-24 container mx-auto px-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {services.map((service, i) => (
          <motion.a
            key={i}
            href={getWhatsAppLink(service.message)}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ y: -12 }}
            className="group relative h-[450px] md:h-[500px] rounded-[32px] overflow-hidden cursor-pointer shadow-2xl border border-white/20 block"
          >
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#001524] via-[#001524]/10 to-transparent z-10 opacity-70" />
            
            <img 
              src={service.image} 
              className="absolute inset-0 w-full h-full object-cover object-[center_25%] group-hover:scale-105 transition-transform duration-[1.2s] ease-out" 
              alt={service.title}
              onError={(e) => {
                // Fallback para uma cor sólida se a imagem não carregar
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  parent.style.backgroundColor = '#00283C';
                }
              }}
            />
            
            <div className="absolute inset-0 z-20 p-8 md:p-10 flex flex-col justify-end items-start text-left pb-12">
              <div className="transform transition-transform duration-500 translate-y-2 group-hover:translate-y-0">
                <div className="inline-block px-6 py-2 rounded-full mb-3 shadow-lg" style={{ backgroundColor: '#5CD29D', color: '#00283C' }}>
                  <h3 className="text-sm font-bold uppercase tracking-wider">{service.title}</h3>
                </div>
                <p className="text-white/80 text-sm md:text-base leading-relaxed max-w-[280px] font-medium">
                  {service.desc}
                </p>
              </div>
              
              <div className="mt-6 flex items-center gap-2 font-bold text-sm uppercase tracking-wider group/btn" style={{ color: '#5CD29D' }}>
                <span>{service.cta}</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
              </div>
            </div>
          </motion.a>
        ))}
      </div>
    </section>
  );
}

