import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Imports das imagens
import fabrica1 from '@/assets/images/fabrica/1.gif';
import fabrica2 from '@/assets/images/fabrica/2.gif';
import fabrica3 from '@/assets/images/fabrica/3.gif';
import fabrica4 from '@/assets/images/fabrica/4.gif';
import fabrica5 from '@/assets/images/fabrica/5.gif';
import fabrica6 from '@/assets/images/fabrica/6.gif';

import fabricaMb01 from '@/assets/images/fabrica-mb/01.png';
import fabricaMb02 from '@/assets/images/fabrica-mb/02.png';
import fabricaMb03_1 from '@/assets/images/fabrica-mb/03_1.png';
import fabricaMb03_2 from '@/assets/images/fabrica-mb/03_2.png';
import fabricaMb03_3 from '@/assets/images/fabrica-mb/03_3.png';
import fabricaMb04 from '@/assets/images/fabrica-mb/04.png';
import fabricaMb05 from '@/assets/images/fabrica-mb/05.png';
import fabricaMb06 from '@/assets/images/fabrica-mb/06.png';

interface Category {
  id: number;
  name: string;
  image: string;
  alt: string;
  numero: string;
  items: Array<{
    desc: string;
  }>;
}

interface MobileItem {
  image: string;
  desc: string;
}

interface MobileSection {
  title: string;
  numero: string;
  items: MobileItem[];
}

export const FabricaDeValor = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [activeMobileTab, setActiveMobileTab] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorLeft, setIndicatorLeft] = useState(0);

  useEffect(() => {
    // Delay para garantir que o DOM esteja atualizado após renderização
    const timer = setTimeout(() => {
      const activeButton = tabRefs.current[activeTab];
      const container = document.getElementById('fabrica-tabs-container');
      if (activeButton && container) {
        // Calcula a posição relativa ao container pai (barra de tabs)
        const tabsBar = container.parentElement;
        if (tabsBar) {
          const tabsBarRect = tabsBar.getBoundingClientRect();
          const buttonRect = activeButton.getBoundingClientRect();
          // Calcula a posição central do botão relativa à barra de tabs
          const left = buttonRect.left - tabsBarRect.left + buttonRect.width / 2;
          setIndicatorLeft(left);
        }
      }
    }, 10);
    
    return () => clearTimeout(timer);
  }, [activeTab]);

  // Dados das categorias e imagens
  const categories: Category[] = [
    {
      id: 0,
      name: 'Avaliação inicial',
      image: fabrica1,
      alt: 'Avaliação inicial',
      numero: '01',
      items: [
        { desc: 'Especificações técnicas do veículo (ano, modelo, motorização, versão)' },
        { desc: 'Configuração do modelo avaliado (opcionais e acessórios)' },
        { desc: 'Histórico de Revisões' }
      ]
    },
    {
      id: 1,
      name: 'Análise técnica',
      image: fabrica2,
      alt: 'Análise técnica',
      numero: '02',
      items: [
        { desc: 'Avaliação de rodagem - dirigibilidade' },
        { desc: 'Avaliação mecânica' }
      ]
    },
    {
      id: 2,
      name: 'Análise externa',
      image: fabrica3,
      alt: 'Análise externa',
      numero: '03',
      items: [
        { desc: 'Revitalização da pintura e espelhamento' },
        { desc: 'Higienização geral' },
        { desc: 'Revisão dos pneus' }
      ]
    },
    {
      id: 3,
      name: 'Análise interna',
      image: fabrica4,
      alt: 'Análise interna',
      numero: '04',
      items: [
        { desc: 'Higienização' },
        { desc: 'Acabamento interno' },
        { desc: 'Funcionalidade e acessórios' }
      ]
    },
    {
      id: 4,
      name: 'Revisão dos detalhes',
      image: fabrica5,
      alt: 'Revisão dos detalhes',
      numero: '05',
      items: [
        { desc: 'Verificação dos serviços realizados' },
        { desc: 'Posicionamento em showroom' }
      ]
    },
    {
      id: 5,
      name: 'Avaliação pré-entrega',
      image: fabrica6,
      alt: 'Avaliação pré-entrega',
      numero: '06',
      items: [
        { desc: 'Revisão dos itens de segurança (iluminação, sinalização, calibragem)' },
        { desc: 'Posicionamento para entrega' }
      ]
    }
  ];

  // Dados para mobile
  const mobileData: MobileSection[] = [
    {
      title: 'Avaliação Inicial',
      numero: '01',
      items: [
        { image: fabricaMb01, desc: 'Especificações técnicas do veículo (ano, modelo, motorização, versão)' },
        { image: fabricaMb01, desc: 'Configuração do modelo avaliado (opcionais e acessórios)' },
        { image: fabricaMb01, desc: 'Histórico de Revisões' }
      ]
    },
    {
      title: 'Análise Técnica',
      numero: '02',
      items: [
        { image: fabricaMb02, desc: 'Avaliação de rodagem - dirigibilidade' },
        { image: fabricaMb02, desc: 'Avaliação mecânica' }
      ]
    },
    {
      title: 'Análise Externa',
      numero: '03',
      items: [
        { image: fabricaMb03_1, desc: 'Revitalização da pintura e espelhamento' },
        { image: fabricaMb03_2, desc: 'Higienização geral' },
        { image: fabricaMb03_3, desc: 'Revisão dos pneus' }
      ]
    },
    {
      title: 'Análise Interna',
      numero: '04',
      items: [
        { image: fabricaMb04, desc: 'Higienização' },
        { image: fabricaMb04, desc: 'Acabamento interno' },
        { image: fabricaMb04, desc: 'Funcionalidade e acessórios' }
      ]
    },
    {
      title: 'Revisão de Show Room',
      numero: '05',
      items: [
        { image: fabricaMb05, desc: 'Verificação dos serviços realizados' },
        { image: fabricaMb05, desc: 'Posicionamento em showroom' }
      ]
    },
    {
      title: 'Preparação para entrega',
      numero: '06',
      items: [
        { image: fabricaMb06, desc: 'Revisão dos itens de segurança (iluminação, sinalização, calibragem)' },
        { image: fabricaMb06, desc: 'Posicionamento para entrega' }
      ]
    }
  ];

  const currentCategory = categories[activeTab];

  return (
    <>
      {/* GALERIA PARA DESKTOP */}
      <div className="hidden lg:block w-full pb-8">
        {/* Barra de abas no topo */}
        <div className="relative bg-primary py-3 mb-5">
          <div id="fabrica-tabs-container" className="flex items-center justify-center max-w-[990px] mx-auto px-8">
            {categories.map((category, index) => (
              <div key={category.id} className="flex items-center relative">
                <button
                  ref={(el) => {
                    tabRefs.current[index] = el;
                  }}
                  type="button"
                  onClick={() => setActiveTab(index)}
                  className={`bg-transparent border-none text-white text-xs font-semibold tracking-wider uppercase whitespace-nowrap px-4 py-1 cursor-pointer transition-all duration-300 hover:opacity-80 ${
                    activeTab === index ? 'font-bold' : ''
                  }`}
                >
                  {category.name.toUpperCase()}
                </button>
                {index < categories.length - 1 && (
                  <div className="w-px h-4 bg-white/30 mx-1.5" />
                )}
              </div>
            ))}
          </div>
          {/* Indicador de aba ativa (triângulo) */}
          <AnimatePresence>
            {activeTab !== null && (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute -bottom-3 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[12px] border-l-transparent border-r-transparent border-t-primary"
                style={{
                  left: indicatorLeft > 0 ? `${indicatorLeft}px` : '50%',
                  transform: 'translateX(-50%)'
                }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Conteúdo principal */}
        <div className="relative max-w-[990px] mx-auto px-8 min-h-[500px] w-full overflow-visible">
          <div className="grid grid-cols-[140px_1fr] gap-12 items-center relative xl:grid-cols-[140px_1fr] lg:grid-cols-[120px_1fr] lg:gap-8">
            {/* Número da etapa à esquerda */}
            <div className="flex items-center justify-start h-full">
              <div className="flex flex-col items-start">
                <div className="w-[60px] h-0.5 bg-primary mb-2" />
                <div className="bg-white px-7 py-5 rounded shadow-md flex items-center justify-center min-w-[100px] lg:px-6 lg:py-4 lg:min-w-[90px]">
                  <span className="text-[5rem] font-bold text-gray leading-none lg:text-[4rem]">
                    {currentCategory.numero}
                  </span>
                </div>
              </div>
            </div>

            {/* Imagem do carro no centro - todas sobrepostas */}
            <motion.div 
              className="relative w-full max-w-full flex justify-center items-center min-h-[450px] my-8 overflow-visible cursor-grab select-none touch-pan-y active:cursor-grabbing"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.3}
              dragMomentum={false}
              whileDrag={{ cursor: 'grabbing' }}
              onDragEnd={(_event, info) => {
                const threshold = 50;
                if (info.offset.x > threshold) {
                  setActiveTab((prev) => (prev === 0 ? categories.length - 1 : prev - 1));
                } else if (info.offset.x < -threshold) {
                  setActiveTab((prev) => (prev === categories.length - 1 ? 0 : prev + 1));
                }
              }}
            >
              <AnimatePresence mode="wait">
                {categories.map((category, index) => 
                  activeTab === index ? (
                    <motion.img
                      key={category.id}
                      src={category.image}
                      alt={category.alt}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ 
                        duration: 0.8,
                        ease: [0.4, 0, 0.2, 1]
                      }}
                      className="max-w-full max-h-[600px] w-auto h-auto object-contain pointer-events-none select-none will-change-opacity"
                      draggable={false}
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 3,
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden'
                      }}
                    />
                  ) : null
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </div>

      {/* GALERIA PARA MOBILE */}
      <div className="lg:hidden w-full">
        {/* Barra de título no topo */}
        <div className="bg-primary py-6 w-full">
          <div className="flex items-center justify-center max-w-full mx-auto px-8">
            <span className="text-white text-sm font-semibold tracking-wider uppercase whitespace-nowrap">
              {mobileData[activeMobileTab].title.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Conteúdo principal */}
        <div className="relative flex items-center justify-center min-h-[60vh] py-12 px-4 bg-[rgb(247,247,247)]">
          {/* Seta esquerda */}
          <button
            onClick={() => setActiveMobileTab((prev) => (prev === 0 ? mobileData.length - 1 : prev - 1))}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-primary text-white border-none flex items-center justify-center cursor-pointer z-10 transition-all duration-300 hover:bg-primary/90 active:scale-95 shadow-md"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          {/* Conteúdo central */}
          <motion.div 
            className="flex-1 flex flex-col items-center justify-center max-w-full px-16 cursor-grab touch-pan-y active:cursor-grabbing sm:px-12"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_event, info) => {
              const threshold = 50;
              if (info.offset.x > threshold) {
                setActiveMobileTab((prev) => (prev === 0 ? mobileData.length - 1 : prev - 1));
              } else if (info.offset.x < -threshold) {
                setActiveMobileTab((prev) => (prev === mobileData.length - 1 ? 0 : prev + 1));
              }
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeMobileTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="w-full flex flex-col items-center justify-center"
              >
                {/* Número grande centralizado */}
                <div className="text-[8rem] font-bold text-gray leading-none mb-12 text-center sm:text-[6rem] sm:mb-8">
                  {mobileData[activeMobileTab].numero}
                </div>

                {/* Lista de itens */}
                <div className="flex flex-col gap-6 w-full max-w-[500px] items-start">
                  {mobileData[activeMobileTab].items.map((item, itemIndex) => (
                    <motion.div
                      key={itemIndex}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: itemIndex * 0.1, duration: 0.3 }}
                      className="flex items-center gap-4 w-full"
                    >
                      <div className="w-10 h-10 min-w-[40px] rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                          <path d="M8 12L11 15L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <span className="text-base text-gray leading-relaxed text-left sm:text-sm">
                        {item.desc}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* Seta direita */}
          <button
            onClick={() => setActiveMobileTab((prev) => (prev === mobileData.length - 1 ? 0 : prev + 1))}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-primary text-white border-none flex items-center justify-center cursor-pointer z-10 transition-all duration-300 hover:bg-primary/90 active:scale-95 shadow-md"
            aria-label="Próximo"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    </>
  );
};
