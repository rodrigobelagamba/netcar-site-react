import { motion } from "framer-motion";

export function GoogleReviewsSection() {
  return (
    <section className="w-full py-8 sm:py-12 lg:py-16 bg-bg !border-0" style={{ border: 'none' }}>
      <div className="max-w-[1290px] mx-auto px-4 sm:px-6 lg:px-0 !border-0" style={{ border: 'none' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8 !border-0"
          style={{ border: 'none' }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-2" style={{ color: '#00283C' }}>
            O que nossos clientes dizem
          </h2>
          <p className="text-muted-foreground">
            Confira as avaliações reais de quem já comprou conosco
          </p>
        </motion.div>
        
        {/* Google Reviews Widget */}
        <div 
          className="!border-0 rounded-2xl overflow-hidden bg-gray-50 flex items-center justify-center" 
          style={{ border: 'none', minHeight: '400px' }}
        >
          {/* Widget do Google Reviews - Substitua pelo widget real quando disponível */}
          <div className="text-center p-8">
            <p className="text-muted-foreground text-lg">
              Widget de Depoimentos do Google será exibido aqui
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              Configure o widget de avaliações do Google para exibir os depoimentos
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

