import { motion } from "framer-motion";
import { useDefaultMetaTags } from "@/hooks/useDefaultMetaTags";
import { useWhatsAppQuery } from "@/api/queries/useSiteQuery";
import { ArrowRight, Check, X } from "lucide-react";
import { cn } from "@/lib/cn";

export function CompraPage() {
  const { data: whatsapp } = useWhatsAppQuery();

  useDefaultMetaTags(
    "Venda seu Carro",
    "Vendemos seu carro de forma rápida, segura e sem complicações. Avaliação gratuita e valores justos."
  );

  const getWhatsAppLink = (message: string) => {
    if (!whatsapp?.link) return "#";
    return `${whatsapp.link.replace(/text=.*$/, '')}text=${encodeURIComponent(message)}`;
  };

  return (
    <main className="flex-1 overflow-x-hidden max-w-full">
      {/* Hero - Full width com gradiente */}
      <header className="relative min-h-[70vh] flex items-center bg-gradient-to-br from-[#00283C] via-[#003a52] to-[#004d6b] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 right-0 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-white/5 rounded-full blur-[100px]" />
        </div>
        
        <div className="relative z-10 max-w-[1200px] mx-auto px-6 py-20 md:py-28">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl"
          >
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-8"
            >
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              <span className="text-white/80 text-sm font-medium">Compramos seu veículo</span>
            </motion.div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.1] mb-6 text-white">
              Venda seu carro<br />
              <span className="text-primary">sem complicações</span>
            </h1>
            
            <p className="text-white/70 text-lg md:text-xl leading-relaxed mb-10 max-w-xl">
              Processo simples, transparente e confiável. Valores justos e alinhados com o mercado.
            </p>
            
            <motion.a
              href={getWhatsAppLink("Olá! Gostaria de vender meu carro.")}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "inline-flex items-center gap-3 px-8 py-4 rounded-full font-semibold text-lg",
                "bg-primary text-white transition-all",
                "hover:shadow-[0_0_40px_rgba(108,196,202,0.4)]"
              )}
            >
              Solicitar avaliação gratuita
              <ArrowRight className="w-5 h-5" />
            </motion.a>
          </motion.div>
        </div>
      </header>

      {/* Por que vender com a Netcar */}
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-fg mb-4">
              Por que vender com a NETCAR?
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Simplificamos todo o processo para você.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                number: "01",
                title: "Rápido",
                description: "Sem anúncios, fotos ou negociações demoradas.",
              },
              {
                number: "02",
                title: "Transparente",
                description: "Avaliação justa com critérios claros e objetivos.",
              },
              {
                number: "03",
                title: "Ágil",
                description: "Transferência em até 72h após confirmação.",
              },
              {
                number: "04",
                title: "Justo",
                description: "Pagamos o valor real do seu veículo.",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group relative p-6 rounded-2xl border border-gray-100 hover:border-primary/30 hover:shadow-lg transition-all"
              >
                <span className="text-6xl font-black text-gray-100 absolute top-4 right-4 group-hover:text-primary/10 transition-colors">
                  {item.number}
                </span>
                <div className="relative z-10 pt-8">
                  <h3 className="text-xl font-bold text-fg mb-2 group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Requisitos */}
      <section className="py-20 md:py-28 bg-[#fafafa]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-fg mb-6">
                Quais veículos<br />compramos?
              </h2>
              <p className="text-muted-foreground text-lg mb-10">
                Para manter a qualidade do nosso estoque, trabalhamos com critérios específicos.
              </p>

              <div className="space-y-5">
                {[
                  { ok: true, text: "Até 7 anos de uso" },
                  { ok: true, text: "Fabricação nacional" },
                  { ok: true, text: "Origem do Rio Grande do Sul" },
                  { ok: false, text: "Veículos com passagem por leilão" },
                ].map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    className="flex items-center gap-4"
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                      item.ok ? "bg-primary/10" : "bg-red-50"
                    )}>
                      {item.ok ? (
                        <Check className="w-4 h-4 text-primary" />
                      ) : (
                        <X className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <span className={cn(
                      "text-lg",
                      item.ok ? "text-fg" : "text-muted-foreground line-through"
                    )}>
                      {item.text}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="bg-white rounded-3xl p-10 shadow-xl">
                <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-fg mb-2">Avaliação Gratuita</h3>
                  <p className="text-muted-foreground">
                    Receba uma proposta em até 24 horas úteis
                  </p>
                </div>

                <a
                  href={getWhatsAppLink("Olá! Gostaria de solicitar uma avaliação do meu veículo para venda.")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold text-lg",
                    "bg-[#25D366] text-white transition-all",
                    "hover:bg-[#20bd5a] hover:shadow-lg"
                  )}
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Quero vender meu carro
                </a>

                <div className="flex items-center justify-center gap-6 mt-6 pt-6 border-t border-gray-100">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-fg">72h</div>
                    <div className="text-xs text-muted-foreground">Transferência</div>
                  </div>
                  <div className="w-px h-10 bg-gray-200" />
                  <div className="text-center">
                    <div className="text-2xl font-bold text-fg">100%</div>
                    <div className="text-xs text-muted-foreground">Seguro</div>
                  </div>
                  <div className="w-px h-10 bg-gray-200" />
                  <div className="text-center">
                    <div className="text-2xl font-bold text-fg">0</div>
                    <div className="text-xs text-muted-foreground">Burocracia</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-[800px] mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <h3 className="text-3xl md:text-4xl font-bold mb-6 text-fg">
              Pronto para vender?
            </h3>
            <p className="text-muted-foreground text-lg mb-10 max-w-md mx-auto">
              Entre em contato e descubra quanto vale seu veículo. Sem compromisso.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={getWhatsAppLink("Olá! Gostaria de vender meu carro.")}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full font-semibold text-lg",
                  "bg-primary text-white transition-all",
                  "hover:bg-primary/90 hover:shadow-lg"
                )}
              >
                Solicitar avaliação
                <ArrowRight className="w-5 h-5" />
              </a>
              <a
                href="/contato"
                className={cn(
                  "inline-flex items-center justify-center px-8 py-4 rounded-full font-semibold text-lg",
                  "border-2 border-gray-200 text-fg transition-all",
                  "hover:border-primary hover:text-primary"
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
