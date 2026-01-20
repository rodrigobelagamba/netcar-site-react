import { motion } from "framer-motion";
import { useDefaultMetaTags } from "@/hooks/useDefaultMetaTags";
import { useWhatsAppQuery } from "@/api/queries/useSiteQuery";
import { CheckCircle2, Clock, Shield, Banknote, Car, MapPin, Calendar, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";

export function CompraPage() {
  const { data: whatsapp } = useWhatsAppQuery();

  useDefaultMetaTags(
    "Venda seu Carro",
    "Vendemos seu carro de forma rápida, segura e sem complicações. Avaliação gratuita e valores justos."
  );

  const benefits = [
    {
      icon: Clock,
      title: "Processo rápido e descomplicado",
      description: "Sem necessidade de anúncios, fotos ou negociações demoradas.",
    },
    {
      icon: Shield,
      title: "Negociação transparente",
      description: "Avaliação justa do seu veículo, com critérios claros e objetivos.",
    },
    {
      icon: Banknote,
      title: "Transferência rápida",
      description: "Realizamos a transferência do veículo em até 72 horas após a confirmação.",
    },
    {
      icon: CheckCircle2,
      title: "Valores justos e coerentes",
      description: "Pagamos o valor que seu carro realmente vale, de acordo com o mercado.",
    },
  ];

  const requirements = [
    { icon: Calendar, text: "Até 7 anos de uso" },
    { icon: Car, text: "Fabricação nacional" },
    { icon: MapPin, text: "Veículos de origem do Rio Grande do Sul" },
    { icon: AlertCircle, text: "Não compramos veículos com passagem por leilão" },
  ];

  return (
    <main className="flex-1 overflow-x-hidden max-w-full bg-gradient-to-b from-white via-gray-50/30 to-white">
      {/* Hero Section */}
      <header className="relative py-20 md:py-28 overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-primary/8 rounded-full blur-3xl" />
        </div>
        
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-3xl"
          >
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-primary text-xs font-semibold tracking-widest uppercase mb-6 block"
            >
              Compramos seu veículo
            </motion.span>
            <h1 className="text-4xl md:text-5xl lg:text-[56px] font-bold leading-tight mb-6 text-fg">
              Está pensando em vender seu carro de forma rápida e segura?
            </h1>
            <p className="text-muted-foreground text-lg md:text-xl leading-relaxed mb-8">
              A NETCAR está pronta para te ajudar. Compramos seu veículo por meio de um processo simples, transparente e confiável, sempre oferecendo valores justos e alinhados com o mercado.
            </p>
            
            {whatsapp?.link && (
              <motion.a
                href={`${whatsapp.link.replace(/text=.*$/, '')}text=${encodeURIComponent("Olá! Gostaria de solicitar uma avaliação do meu veículo para venda.")}`}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className={cn(
                  "inline-flex items-center gap-3 px-8 py-4 rounded-full font-semibold text-lg",
                  "bg-primary text-white shadow-lg transition-all",
                  "hover:bg-primary/90 hover:shadow-xl hover:-translate-y-0.5"
                )}
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Solicitar avaliação gratuita
              </motion.a>
            )}
          </motion.div>
        </div>
      </header>

      {/* Benefícios */}
      <section className="py-16 md:py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <span className="text-primary text-xs font-semibold uppercase tracking-widest mb-3 block">Vantagens</span>
            <h2 className="text-2xl md:text-[32px] font-bold">Por que vender seu carro com a NETCAR?</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {benefits.map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group flex gap-5 p-6 rounded-2xl bg-white border border-gray-100 hover:border-primary/20 hover:shadow-lg transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <benefit.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-fg mb-1 group-hover:text-primary transition-colors">
                    {benefit.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Requisitos */}
      <section className="py-16 md:py-24 bg-[#fafafa]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <span className="text-primary text-xs font-semibold uppercase tracking-widest mb-3 block">Critérios</span>
              <h2 className="text-2xl md:text-[32px] font-bold mb-4">Quais veículos compramos?</h2>
              <p className="text-muted-foreground mb-8">
                Para garantir a qualidade do nosso estoque e a satisfação dos nossos clientes, trabalhamos com critérios específicos na aquisição de veículos.
              </p>

              <div className="space-y-4">
                {requirements.map((req, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    className="flex items-center gap-4 py-3 border-b border-gray-200 last:border-0"
                  >
                    <req.icon className={cn(
                      "w-5 h-5 flex-shrink-0",
                      index === 3 ? "text-orange-500" : "text-primary"
                    )} />
                    <span className="text-fg font-medium">{req.text}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="bg-white rounded-3xl p-8 md:p-10 shadow-xl border border-gray-100">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Car className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-fg mb-2">Avaliação Gratuita</h3>
                  <p className="text-muted-foreground text-sm">
                    Solicite agora mesmo uma avaliação e venda seu carro com tranquilidade e segurança.
                  </p>
                </div>

                {whatsapp?.link && (
                  <a
                    href={`${whatsapp.link.replace(/text=.*$/, '')}text=${encodeURIComponent("Olá! Gostaria de solicitar uma avaliação do meu veículo para venda.")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold",
                      "bg-primary text-white transition-all",
                      "hover:bg-primary/90 hover:shadow-lg"
                    )}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Quero vender meu carro
                  </a>
                )}

                <p className="text-center text-muted-foreground text-xs mt-4">
                  Resposta em até 24 horas úteis
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 md:py-28">
        <div className="max-w-[900px] mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-center"
          >
            <h3 className="text-3xl md:text-4xl font-bold mb-4 text-fg">
              Venda seu carro com tranquilidade
            </h3>
            <p className="text-muted-foreground mb-8 text-lg max-w-xl mx-auto">
              Entre em contato conosco e descubra quanto vale o seu veículo. Processo rápido, seguro e sem complicações.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              {whatsapp?.link && (
                <a
                  href={`${whatsapp.link.replace(/text=.*$/, '')}text=${encodeURIComponent("Olá! Gostaria de solicitar uma avaliação do meu veículo para venda.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "px-8 py-4 rounded-full font-semibold text-lg",
                    "bg-primary text-white transition-all",
                    "hover:bg-primary/90 hover:shadow-lg"
                  )}
                >
                  Solicitar avaliação
                </a>
              )}
              <a
                href="/contato"
                className={cn(
                  "px-8 py-4 rounded-full font-semibold text-lg",
                  "text-primary underline underline-offset-4 transition-all",
                  "hover:text-primary/80"
                )}
              >
                Fale conosco
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
