import { motion } from "framer-motion";
import { Heart, ShieldCheck, Zap, Users } from "lucide-react";

export function DNASection() {
  return (
    <section className="py-20 max-w-[1400px] xl:max-w-[1700px] 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
      {/* Dark DNA Block */}
      <div className="bg-white rounded-[40px] p-8 md:p-16 relative overflow-hidden shadow-2xl !border-0" style={{ color: '#00283C', border: 'none' }}>
        {/* Geometric Accents Inside Block */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full -translate-y-1/2 translate-x-1/2" style={{ border: '1.5px solid rgba(0, 40, 60, 0.2)' }}></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full translate-y-1/2 -translate-x-1/4" style={{ border: '1.5px solid rgba(0, 40, 60, 0.2)' }}></div>

        <div className="relative z-10 max-w-6xl mx-auto !border-0" style={{ border: 'none' }}>
          <div className="text-center mb-20 space-y-4 relative !border-0" style={{ border: 'none' }}>
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
            
            {/* Left Column */}
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="space-y-12 relative group !border-0"
              style={{ border: 'none' }}
            >
              <div className="space-y-6">
                <p className="font-medium !border-0">
                  Comprar um carro é uma decisão importante. Envolve expectativa, confiança e a certeza de estar fazendo a escolha certa.
                </p>
                
                <p className="font-bold text-xl md:text-2xl !border-0" style={{ color: '#00283C' }}>
                  É por isso que, na Netcar, cada detalhe importa.
                </p>
              </div>

              <div className="relative pl-8 border-l-2 space-y-4" style={{ borderColor: 'rgba(92, 210, 157, 0.3)' }}>
                <div className="absolute -left-[11px] top-0 bg-white p-1 rounded-full border border-gray-100 shadow-sm">
                  <Heart size={20} className="text-[#5CD29D] fill-[#5CD29D]/20" />
                </div>
                
                <h3 className="font-bold text-xl flex items-center gap-2" style={{ color: '#00283C' }}>
                  Cuidado em cada etapa
                </h3>
                
                <p className="font-medium !border-0 text-base">
                  A gente cuida de todo o processo com atenção, critério e responsabilidade — do administrativo ao atendimento, da avaliação à entrega. Nada é tratado como simples quando o impacto é grande na vida de quem compra.
                </p>
              </div>
              
              <div className="relative pl-8 border-l-2 space-y-4" style={{ borderColor: 'rgba(92, 210, 157, 0.3)' }}>
                 <div className="absolute -left-[11px] top-0 bg-white p-1 rounded-full border border-gray-100 shadow-sm">
                  <ShieldCheck size={20} className="text-[#5CD29D] fill-[#5CD29D]/20" />
                </div>

                <h3 className="font-bold text-xl flex items-center gap-2" style={{ color: '#00283C' }}>
                  Garantia real
                </h3>

                <p className="font-medium !border-0 text-base">
                  Criamos a <span className="font-bold" style={{ color: '#5CD29D' }}>Fábrica de Valor</span>, nosso processo exclusivo de preparação, com mais de 60 itens verificados. E esse cuidado não termina na entrega: com o <span className="font-bold" style={{ color: '#5CD29D' }}>NetHelp</span>, nosso serviço exclusivo de pós-venda, o cliente conta com suporte funcional e de segurança.
                </p>
              </div>
            </motion.div>

            {/* Right Column */}
            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="space-y-12 flex flex-col relative group !border-0"
              style={{ border: 'none' }}
            >
              <div className="relative pl-8 border-l-2 space-y-4" style={{ borderColor: 'rgba(92, 210, 157, 0.3)' }}>
                 <div className="absolute -left-[11px] top-0 bg-white p-1 rounded-full border border-gray-100 shadow-sm">
                  <Zap size={20} className="text-[#5CD29D] fill-[#5CD29D]/20" />
                </div>

                <h3 className="font-bold text-xl flex items-center gap-2" style={{ color: '#00283C' }}>
                  Tecnologia no DNA
                </h3>

                <p className="font-medium !border-0 text-base">
                  A tecnologia faz parte do nosso DNA. Trabalhamos com processos digitais, sistemas próprios e presença ativa nos principais canais, conectando atendimento humano com tecnologia que simplifica, organiza e traz mais clareza para toda a jornada de compra.
                </p>
              </div>

              <div className="relative pl-8 border-l-2 space-y-4" style={{ borderColor: 'rgba(92, 210, 157, 0.3)' }}>
                 <div className="absolute -left-[11px] top-0 bg-white p-1 rounded-full border border-gray-100 shadow-sm">
                  <Users size={20} className="text-[#5CD29D] fill-[#5CD29D]/20" />
                </div>

                <h3 className="font-bold text-xl flex items-center gap-2" style={{ color: '#00283C' }}>
                  Transparência na prática
                </h3>

                <p className="font-medium !border-0 text-base">
                  Aqui, transparência não é discurso. É prática. <br/>
                  A gente escuta, aprende com cada cliente e evolui todos os dias, ajustando processos e melhorando a experiência.
                </p>
              </div>
              
              <div className="relative pl-8 pt-6 mt-8 !border-0" style={{ borderTop: '1px solid rgba(0, 40, 60, 0.05)', borderLeft: 'none', borderRight: 'none', borderBottom: 'none' }}>
                <div className="absolute left-0 top-6 bottom-0 w-[3px] rounded-full !border-0" style={{ backgroundColor: '#5CD29D', border: 'none' }}></div>
                <p className="text-2xl font-serif italic leading-relaxed mb-4 !border-0" style={{ color: '#00283C', border: 'none' }}>
                  "Na Netcar, vender carros faz parte do que fazemos. <br/>
                  Cuidar das pessoas é o que nos move."
                </p>
                
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-sm tracking-widest uppercase" style={{ color: '#00283C' }}>Netcar</span>
                  <span className="text-sm font-medium opacity-80" style={{ color: '#6B7280' }}>A conexão perfeita entre você e seu futuro carro.</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

