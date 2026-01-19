import { motion } from "framer-motion";

export function DNASection() {
  return (
    <section className="py-20 container mx-auto px-4">
      {/* Dark DNA Block */}
      <div className="bg-white rounded-[40px] p-8 md:p-16 relative overflow-hidden shadow-2xl border border-gray-100" style={{ color: '#00283C' }}>
        {/* Geometric Accents Inside Block */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] border-[1.5px] rounded-full -translate-y-1/2 translate-x-1/2" style={{ borderColor: 'rgba(0, 40, 60, 0.2)' }}></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] border-[1.5px] rounded-full translate-y-1/2 -translate-x-1/4" style={{ borderColor: 'rgba(0, 40, 60, 0.2)' }}></div>

        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-4 relative">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex flex-col items-center gap-2"
            >
              <span className="font-bold tracking-[0.2em] uppercase text-xs opacity-90" style={{ color: '#5CD29D' }}>
                Por que a Netcar?
              </span>
              <div className="w-12 h-[2px]" style={{ backgroundColor: 'rgba(92, 210, 157, 0.5)' }}></div>
            </motion.div>
            
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-7xl font-black font-sans tracking-tighter relative z-10"
              style={{ color: '#00283C' }}
            >
              Nosso <span className="relative inline-block" style={{ color: '#5CD29D' }}>
                DNA
                {/* Underline decoration */}
                <motion.div 
                  initial={{ width: 0 }}
                  whileInView={{ width: "100%" }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                  className="absolute bottom-2 left-0 h-[6px] -z-10"
                  style={{ backgroundColor: 'rgba(92, 210, 157, 0.2)' }}
                />
              </span>
            </motion.h2>
          </div>

          <div className="grid md:grid-cols-2 gap-12 md:gap-24 text-lg leading-relaxed relative" style={{ color: '#6B7280' }}>
            {/* Central Divider */}
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-primary/10 to-transparent -translate-x-1/2" style={{ backgroundImage: 'linear-gradient(to bottom, transparent, rgba(0, 40, 60, 0.1), transparent)' }}></div>
            
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="space-y-8 relative group"
            >
              <div>
                <h3 className="font-bold text-2xl mb-4 flex items-center gap-3" style={{ color: '#00283C' }}>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#5CD29D' }}></div>
                  Muito além do preço.
                </h3>
                <p className="font-medium pl-5 border-l" style={{ borderColor: 'rgba(0, 40, 60, 0.1)' }}>
                  Porque a gente acredita que comprar um carro vai muito além do preço. Investimos em tecnologia própria, modernizamos nossos processos e cuidamos de cada detalhe — do administrativo ao comercial.
                </p>
              </div>
              
              <p className="font-medium pl-5">
                Criamos a nossa <span className="font-bold" style={{ color: '#5CD29D' }}>Fábrica de Valor</span>, um processo exclusivo de preparação com mais de 60 itens verificados, para que cada veículo entregue realmente o que promete.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="space-y-8 flex flex-col justify-between relative group"
            >
              <div>
                <h3 className="font-bold text-2xl mb-4 flex items-center gap-3" style={{ color: '#00283C' }}>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#5CD29D' }}></div>
                  Transparência na prática.
                </h3>
                <p className="font-medium mb-8 pl-5 border-l" style={{ borderColor: 'rgba(0, 40, 60, 0.1)' }}>
                  Aqui, transparência não é discurso: é prática. A gente escuta nossos clientes, aprende com eles e evolui o tempo todo.
                </p>
                <p className="font-medium pl-5">
                  Estamos presentes onde as pessoas estão — no digital, nos canais certos, no momento certo — sempre buscando oferecer uma experiência de compra mais simples, segura e humana.
                </p>
              </div>
              
              <div className="relative pl-8 pt-6 border-t mt-4" style={{ borderColor: 'rgba(0, 40, 60, 0.05)' }}>
                <div className="absolute left-0 top-6 bottom-0 w-[3px] rounded-full" style={{ backgroundColor: '#5CD29D' }}></div>
                <p className="text-2xl font-serif italic leading-relaxed" style={{ color: '#00283C' }}>
                  "Na Netcar, vender carros é importante. <br/>
                  Construir confiança é essencial."
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

