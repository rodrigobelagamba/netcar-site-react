import { useEffect, useRef, useState } from "react";

export function EmbedSocialSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);
  const hashtagRef = useRef<HTMLDivElement>(null);
  const storiesRef = useRef<HTMLDivElement>(null);
  const scriptsLoadedRef = useRef(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const [forceReload, setForceReload] = useState(0);

  // Função para verificar se os widgets realmente carregaram
  const checkWidgetsLoaded = (): boolean => {
    const reviewsEl = reviewsRef.current;
    const hashtagEl = hashtagRef.current;
    const storiesEl = storiesRef.current;

    if (!reviewsEl || !hashtagEl || !storiesEl) {
      return false;
    }

    // Verifica se há conteúdo dentro dos widgets (iframe, conteúdo renderizado, etc)
    const reviewsHasContent = reviewsEl.children.length > 0 || reviewsEl.innerHTML.trim().length > 0;
    const hashtagHasContent = hashtagEl.children.length > 0 || hashtagEl.innerHTML.trim().length > 0;
    const storiesHasContent = storiesEl.children.length > 0 || storiesEl.innerHTML.trim().length > 0;

    // Verifica também se há iframes (os widgets geralmente renderizam iframes)
    const hasIframes = 
      reviewsEl.querySelector('iframe') !== null ||
      hashtagEl.querySelector('iframe') !== null ||
      storiesEl.querySelector('iframe') !== null;

    return (reviewsHasContent || hashtagHasContent || storiesHasContent) || hasIframes;
  };

  // Função para forçar reload dos widgets
  const forceReloadWidgets = () => {
    console.log("Forcing EmbedSocial widgets reload...");
    retryCountRef.current++;
    
    // Remove os scripts existentes para forçar reload
    const scriptIds = ["EmbedSocialHashtagScript", "EmbedSocialStoriesScript", "EmbedSocialReviewsScript"];
    scriptIds.forEach(id => {
      const script = document.getElementById(id);
      if (script) {
        script.remove();
      }
    });

    // Reseta a flag para permitir recarregar
    scriptsLoadedRef.current = false;
    
    // Força re-render dos elementos
    setForceReload(prev => prev + 1);
  };

  useEffect(() => {
    // Garante que os elementos DOM existam antes de carregar scripts
    if (!reviewsRef.current || !hashtagRef.current || !storiesRef.current) {
      return;
    }

    const loadScript = (id: string, src: string): Promise<void> => {
      return new Promise((resolve) => {
        // Verifica se o script já existe
        const existing = document.getElementById(id);
        if (existing) {
          resolve();
          return;
        }

        const script = document.createElement("script");
        script.id = id;
        script.src = src;
        script.async = true;
        script.onload = () => {
          console.log(`EmbedSocial script loaded: ${id}`);
          resolve();
        };
        script.onerror = () => {
          console.error(`Failed to load EmbedSocial script: ${src}`);
          resolve(); // Resolve mesmo com erro para não bloquear
        };
        
        // Adiciona no head conforme recomendação do EmbedSocial
        const head = document.head || document.getElementsByTagName("head")[0];
        head.appendChild(script);
      });
    };

    const initializeWidgets = async () => {
      try {
        scriptsLoadedRef.current = true;

        // Carrega os scripts necessários
        await Promise.all([
          loadScript("EmbedSocialHashtagScript", "https://embedsocial.com/cdn/ht.js"),
          loadScript("EmbedSocialStoriesScript", "https://embedsocial.com/embedscript/st.js"),
          loadScript("EmbedSocialReviewsScript", "https://embedsocial.com/cdn/rv.js"),
        ]);

        // Aguarda os scripts processarem e inicializarem os widgets
        // Tenta múltiplas vezes com delays progressivos
        const tryInit = (attempt: number = 1) => {
          setTimeout(() => {
            if (typeof window !== "undefined") {
              try {
                // Verifica se os elementos ainda existem
                const reviewsEl = document.querySelector('.embedsocial-reviews[data-ref="811726996bfe08c76a3bd507a02fcebb16fc6ad1"]');
                const hashtagEl = document.querySelector('.embedsocial-hashtag[data-ref="811726996bfe08c76a3bd507a02fcebb16fc6ad1"]');
                const storiesEl = document.querySelector('.embedsocial-stories[data-ref="b86f52e1790e82bd3b547af9c36814370d2526d7"]');

                if (!reviewsEl || !hashtagEl || !storiesEl) {
                  console.warn("EmbedSocial elements not found in DOM");
                  if (attempt < 5) {
                    tryInit(attempt + 1);
                  }
                  return;
                }

                // Tenta usar a função de parsing do EmbedSocial
                if ((window as any).emdsParse && typeof (window as any).emdsParse === "function") {
                  (window as any).emdsParse();
                  console.log("Called emdsParse()");
                }
                
                // Tenta outras funções de inicialização
                if ((window as any).embedsocial && typeof (window as any).embedsocial.init === "function") {
                  (window as any).embedsocial.init();
                  console.log("Called embedsocial.init()");
                }
                
                if ((window as any).EmbedSocial && typeof (window as any).EmbedSocial.init === "function") {
                  (window as any).EmbedSocial.init();
                  console.log("Called EmbedSocial.init()");
                }

                // Dispara evento que alguns widgets podem escutar
                if (typeof document !== "undefined") {
                  const event = new Event("embedsocial:ready", { bubbles: true });
                  document.dispatchEvent(event);
                }

                // Verifica se os widgets carregaram após a inicialização
                const widgetsLoaded = checkWidgetsLoaded();
                
                if (!widgetsLoaded && attempt < 5) {
                  console.log(`EmbedSocial widgets not loaded yet, attempt ${attempt}/5`);
                  tryInit(attempt + 1);
                } else if (widgetsLoaded) {
                  console.log("EmbedSocial widgets loaded successfully!");
                  // Limpa o intervalo de verificação se existir
                  if (checkIntervalRef.current) {
                    clearInterval(checkIntervalRef.current);
                    checkIntervalRef.current = null;
                  }
                } else if (attempt >= 5) {
                  console.warn("EmbedSocial widgets failed to load after 5 attempts");
                  // Agenda uma verificação periódica para tentar recarregar
                  if (!checkIntervalRef.current && retryCountRef.current < 3) {
                    checkIntervalRef.current = setInterval(() => {
                      if (!checkWidgetsLoaded()) {
                        console.log("Widgets still not loaded, attempting reload...");
                        forceReloadWidgets();
                      } else {
                        if (checkIntervalRef.current) {
                          clearInterval(checkIntervalRef.current);
                          checkIntervalRef.current = null;
                        }
                      }
                    }, 10000); // Verifica a cada 10 segundos
                  }
                }
              } catch (e) {
                console.error("EmbedSocial init error:", e);
                if (attempt < 5) {
                  tryInit(attempt + 1);
                }
              }
            }
          }, attempt * 1000); // Delay progressivo: 1s, 2s, 3s, 4s, 5s
        };

        tryInit();
      } catch (error) {
        console.error("Error initializing EmbedSocial:", error);
      }
    };

    // Pequeno delay para garantir que o DOM está totalmente renderizado
    const timer = setTimeout(() => {
      initializeWidgets();
    }, 100);

    // Verificação periódica para detectar se os widgets não carregaram
    const verificationTimer = setTimeout(() => {
      if (!checkWidgetsLoaded() && scriptsLoadedRef.current) {
        console.warn("EmbedSocial widgets verification: widgets not loaded after 8 seconds");
        // Tenta recarregar se ainda não carregou
        if (retryCountRef.current < 3) {
          forceReloadWidgets();
        }
      }
    }, 8000);

    return () => {
      clearTimeout(timer);
      clearTimeout(verificationTimer);
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [forceReload]);

  // IntersectionObserver para detectar quando a seção está visível e tentar recarregar se necessário
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Quando a seção fica visível, verifica se os widgets carregaram
            setTimeout(() => {
              if (!checkWidgetsLoaded() && scriptsLoadedRef.current && retryCountRef.current < 3) {
                console.log("Section visible but widgets not loaded, attempting reload...");
                forceReloadWidgets();
              }
            }, 2000);
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [forceReload]);

  return (
    <section ref={containerRef} className="w-full py-8 sm:py-12 lg:py-16 bg-bg">
      <div className="max-w-[1290px] mx-auto px-4 sm:px-6 lg:px-0 space-y-10">
        {/* Google Reviews / Depoimentos */}
        <div
          key={`reviews-${forceReload}`}
          ref={reviewsRef}
          className="embedsocial-reviews"
          data-ref="811726996bfe08c76a3bd507a02fcebb16fc6ad1"
        />

        {/* Hashtag Feed */}
        <div
          key={`hashtag-${forceReload}`}
          ref={hashtagRef}
          className="embedsocial-hashtag"
          data-ref="811726996bfe08c76a3bd507a02fcebb16fc6ad1"
        />

        {/* Stories */}
        <div
          key={`stories-${forceReload}`}
          ref={storiesRef}
          className="embedsocial-stories"
          data-ref="b86f52e1790e82bd3b547af9c36814370d2526d7"
        />
      </div>
    </section>
  );
}
