import { motion } from "framer-motion";

export function DNASection() {
  return (
    <section className="py-20 container mx-auto px-4">
      {/* Dark DNA Block */}
      <div className="bg-white rounded-[40px] p-8 md:p-16 relative overflow-hidden shadow-2xl !border-0" style={{ color: '#00283C', border: 'none' }}>
        {/* Geometric Accents Inside Block */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full -translate-y-1/2 translate-x-1/2" style={{ border: '1.5px solid rgba(0, 40, 60, 0.2)' }}></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full translate-y-1/2 -translate-x-1/4" style={{ border: '1.5px solid rgba(0, 40, 60, 0.2)' }}></div>

        <div className="relative z-10 max-w-6xl mx-auto !border-0" style={{ border: 'none' }}>
          <div className="text-center mb-16 space-y-4 relative !border-0" style={{ border: 'none' }}>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex flex-col items-center gap-2 !border-0"
              style={{ border: 'none' }}
            >
              <span className="font-bold tracking-[0.2em] uppercase text-xs opacity-90 !border-0" style={{ color: '#5CD29D', border: 'none' }}>
                Por que a Netcar?
              </span>
              <div className="w-12 h-[2px] !border-0" style={{ backgroundColor: 'rgba(92, 210, 157, 0.5)', border: 'none' }}></div>
            </motion.div>
            
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-7xl font-black font-sans tracking-tighter relative z-10 !border-0"
              style={{ color: '#00283C', border: 'none' }}
            >
              Nosso <span className="relative inline-block !border-0" style={{ color: '#5CD29D', border: 'none' }}>
                DNA
                {/* Underline decoration */}
                <motion.div 
                  initial={{ width: 0 }}
                  whileInView={{ width: "100%" }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                  className="absolute bottom-2 left-0 h-[6px] -z-10 !border-0"
                  style={{ backgroundColor: 'rgba(92, 210, 157, 0.2)', border: 'none' }}
                />
              </span>
            </motion.h2>
          </div>

          <div className="grid md:grid-cols-2 gap-12 md:gap-24 text-lg leading-relaxed relative !border-0" style={{ color: '#6B7280', border: 'none' }}>
            {/* Central Divider */}
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-primary/10 to-transparent -translate-x-1/2 !border-0" style={{ backgroundImage: 'linear-gradient(to bottom, transparent, rgba(0, 40, 60, 0.1), transparent)', border: 'none' }}></div>
            
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="space-y-8 relative group !border-0"
              style={{ border: 'none' }}
            >
              <div className="!border-0" style={{ border: 'none' }}>
                <h3 className="font-bold text-2xl mb-4 flex items-center gap-3 !border-0" style={{ color: '#00283C', border: 'none' }}>
                  <div className="w-2 h-2 rounded-full !border-0" style={{ backgroundColor: '#5CD29D', border: 'none' }}></div>
                  Muito além do preço.
                </h3>
                <p className="font-medium pl-5 !border-0" style={{ borderLeft: '1px solid rgba(0, 40, 60, 0.1)', borderTop: 'none', borderRight: 'none', borderBottom: 'none' }}>
                  Porque a gente acredita que comprar um carro vai muito além do preço. Investimos em tecnologia própria, modernizamos nossos processos e cuidamos de cada detalhe — do administrativo ao comercial.
                </p>
              </div>
              
              <p className="font-medium pl-5 !border-0" style={{ border: 'none' }}>
                Criamos a nossa <span className="font-bold !border-0" style={{ color: '#5CD29D', border: 'none' }}>Fábrica de Valor</span>, um processo exclusivo de preparação com mais de 60 itens verificados, para que cada veículo entregue realmente o que promete.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="space-y-8 flex flex-col justify-between relative group !border-0"
              style={{ border: 'none' }}
            >
              <div className="!border-0" style={{ border: 'none' }}>
                <h3 className="font-bold text-2xl mb-4 flex items-center gap-3 !border-0" style={{ color: '#00283C', border: 'none' }}>
                  <div className="w-2 h-2 rounded-full !border-0" style={{ backgroundColor: '#5CD29D', border: 'none' }}></div>
                  Transparência na prática.
                </h3>
                <p className="font-medium mb-8 pl-5 !border-0" style={{ borderLeft: '1px solid rgba(0, 40, 60, 0.1)', borderTop: 'none', borderRight: 'none', borderBottom: 'none' }}>
                  Aqui, transparência não é discurso: é prática. A gente escuta nossos clientes, aprende com eles e evolui o tempo todo.
                </p>
                <p className="font-medium pl-5 !border-0" style={{ border: 'none' }}>
                  Estamos presentes onde as pessoas estão — no digital, nos canais certos, no momento certo — sempre buscando oferecer uma experiência de compra mais simples, segura e humana.
                </p>
              </div>
              
              <div className="relative pl-8 pt-6 mt-4 !border-0" style={{ borderTop: '1px solid rgba(0, 40, 60, 0.05)', borderLeft: 'none', borderRight: 'none', borderBottom: 'none' }}>
                <div className="absolute left-0 top-6 bottom-0 w-[3px] rounded-full !border-0" style={{ backgroundColor: '#5CD29D', border: 'none' }}></div>
                <p className="text-2xl font-serif italic leading-relaxed !border-0" style={{ color: '#00283C', border: 'none' }}>
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

