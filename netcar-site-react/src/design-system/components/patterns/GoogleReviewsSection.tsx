import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function GoogleReviewsSection() {
  const [widgetLoaded, setWidgetLoaded] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let intervalId: NodeJS.Timeout;
    let checkCount = 0;
    const maxChecks = 10; // Verifica por até 10 segundos

    // Verifica se o widget do Google Reviews foi carregado
    const checkWidget = () => {
      checkCount++;
      
      // Procura por elementos comuns de widgets do Google Reviews
      const googleWidget = document.querySelector('[data-google-reviews]') || 
                          document.querySelector('.google-reviews-widget') ||
                          document.querySelector('[id*="google-reviews"]') ||
                          document.querySelector('[class*="google-reviews"]') ||
                          document.querySelector('iframe[src*="google.com"]') ||
                          document.querySelector('[data-elfsight-app]');
      
      // Verifica se há conteúdo renderizado (mais de apenas espaços em branco)
      const hasContent = googleWidget && (
        googleWidget.children.length > 0 ||
        googleWidget.textContent?.trim().length > 0 ||
        googleWidget.querySelector('iframe')
      );
      
      if (hasContent) {
        setWidgetLoaded(true);
        setShowFallback(false);
        if (intervalId) clearInterval(intervalId);
        if (timeoutId) clearTimeout(timeoutId);
      } else if (checkCount >= maxChecks) {
        // Se após várias verificações não carregou, mostra fallback
        setShowFallback(true);
        if (intervalId) clearInterval(intervalId);
      }
    };

    // Verifica periodicamente se o widget carregou (a cada 1 segundo)
    intervalId = setInterval(checkWidget, 1000);
    
    // Primeira verificação após 2 segundos
    timeoutId = setTimeout(checkWidget, 2000);

    // Timeout de segurança: se após 8 segundos não carregou, mostra fallback
    const safetyTimeout = setTimeout(() => {
      if (!widgetLoaded) {
        setShowFallback(true);
        if (intervalId) clearInterval(intervalId);
      }
    }, 8000);

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
      if (safetyTimeout) clearTimeout(safetyTimeout);
    };
  }, [widgetLoaded]);

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
          className="!border-0 rounded-2xl overflow-hidden bg-gray-50" 
          style={{ border: 'none', minHeight: '400px' }}
        >
          {/* Widget do Google Reviews - Substitua pelo widget real quando disponível */}
          {showFallback && !widgetLoaded ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="mb-4">
                <svg 
                  className="w-16 h-16 mx-auto text-muted-foreground" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" 
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2" style={{ color: '#00283C' }}>
                Avaliações do Google
              </h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                As avaliações não estão disponíveis no momento. 
                Confira nossas avaliações diretamente no Google Maps.
              </p>
              <a
                href="https://maps.google.com/?q=Netcar+Esteio"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-white transition-colors hover:opacity-90"
                style={{ backgroundColor: '#00283C' }}
              >
                Ver no Google Maps
                <svg 
                  className="w-5 h-5" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
                  />
                </svg>
              </a>
            </motion.div>
          ) : (
            <div className="flex items-center justify-center p-8">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                <p className="text-muted-foreground text-lg">
                  Carregando avaliações...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

