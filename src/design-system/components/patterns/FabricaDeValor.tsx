import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Caminhos das imagens no public
const fabrica1 = "/images/fabrica/1.gif";
const fabrica2 = "/images/fabrica/2.gif";
const fabrica3 = "/images/fabrica/3.gif";
const fabrica4 = "/images/fabrica/4.gif";
const fabrica5 = "/images/fabrica/5.gif";
const fabrica6 = "/images/fabrica/6.gif";

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

export const FabricaDeValor = () => {
  const [activeTab, setActiveTab] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorLeft, setIndicatorLeft] = useState(0);

  useEffect(() => {
    // Delay para garantir que o DOM esteja atualizado após renderização
    const timer = setTimeout(() => {
      const activeButton = tabRefs.current[activeTab];
      const container = document.getElementById("fabrica-tabs-container");
      if (activeButton && container) {
        // Calcula a posição relativa ao container pai (barra de tabs)
        const tabsBar = container.parentElement;
        if (tabsBar) {
          const tabsBarRect = tabsBar.getBoundingClientRect();
          const buttonRect = activeButton.getBoundingClientRect();
          // Calcula a posição central do botão relativa à barra de tabs
          const left =
            buttonRect.left - tabsBarRect.left + buttonRect.width / 2;
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
      name: "Avaliação inicial",
      image: fabrica1,
      alt: "Avaliação inicial",
      numero: "01",
      items: [
        {
          desc: "Especificações técnicas do veículo (ano, modelo, motorização, versão)",
        },
        { desc: "Configuração do modelo avaliado (opcionais e acessórios)" },
        { desc: "Histórico de revisões" },
      ],
    },
    {
      id: 1,
      name: "Análise técnica",
      image: fabrica2,
      alt: "Análise técnica",
      numero: "02",
      items: [
        { desc: "Avaliação de rodagem e dirigibilidade" },
        { desc: "Avaliação mecânica" },
      ],
    },
    {
      id: 2,
      name: "Análise externa",
      image: fabrica3,
      alt: "Análise externa",
      numero: "03",
      items: [
        { desc: "Revitalização da pintura e espelhamento" },
        { desc: "Higienização geral" },
        { desc: "Revisão dos pneus" },
      ],
    },
    {
      id: 3,
      name: "Análise interna",
      image: fabrica4,
      alt: "Análise interna",
      numero: "04",
      items: [
        { desc: "Higienização" },
        { desc: "Acabamento interno" },
        { desc: "Funcionalidade e acessórios" },
      ],
    },
    {
      id: 4,
      name: "Revisão dos detalhes",
      image: fabrica5,
      alt: "Revisão dos detalhes",
      numero: "05",
      items: [
        { desc: "Verificação dos serviços realizados" },
        { desc: "Posicionamento em showroom" },
      ],
    },
    {
      id: 5,
      name: "Avaliação pré-entrega",
      image: fabrica6,
      alt: "Avaliação pré-entrega",
      numero: "06",
      items: [
        {
          desc: "Revisão dos itens de segurança (iluminação, sinalização, calibragem)",
        },
        { desc: "Posicionamento para entrega" },
      ],
    },
  ];

  const currentCategory = categories[activeTab];

  return (
    <>
      {/* GALERIA PARA DESKTOP */}
      <div className="hidden lg:block w-full pb-8">
        {/* Barra de abas no topo */}
        <div className="relative bg-primary py-3 mb-5">
          <div
            id="fabrica-tabs-container"
            className="flex items-center justify-center max-w-[990px] mx-auto px-8"
          >
            {categories.map((category, index) => (
              <div key={category.id} className="flex items-center relative">
                <button
                  ref={(el) => {
                    tabRefs.current[index] = el;
                  }}
                  type="button"
                  onClick={() => setActiveTab(index)}
                  className={`bg-transparent border-none text-white text-xs font-semibold tracking-wider uppercase whitespace-nowrap px-4 py-1 cursor-pointer transition-all duration-300 hover:opacity-80 ${
                    activeTab === index ? "font-bold" : ""
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
                  left: indicatorLeft > 0 ? `${indicatorLeft}px` : "50%",
                  transform: "translateX(-50%)",
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
              whileDrag={{ cursor: "grabbing" }}
              onDragEnd={(_event, info) => {
                const threshold = 50;
                if (info.offset.x > threshold) {
                  setActiveTab((prev) =>
                    prev === 0 ? categories.length - 1 : prev - 1,
                  );
                } else if (info.offset.x < -threshold) {
                  setActiveTab((prev) =>
                    prev === categories.length - 1 ? 0 : prev + 1,
                  );
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
                        ease: [0.4, 0, 0.2, 1],
                      }}
                      className="max-w-full max-h-[600px] w-auto h-auto object-contain pointer-events-none select-none will-change-opacity"
                      draggable={false}
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        zIndex: 3,
                        backfaceVisibility: "hidden",
                        WebkitBackfaceVisibility: "hidden",
                      }}
                    />
                  ) : null,
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </div>

      {/* MOBILE: lista compacta das 6 etapas (sem carrossel, sem número gigante) */}
      <div className="w-full lg:hidden">
        <div className="mb-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">
            i-CHECK Netcar
          </p>
          <h3 className="mt-1 text-lg font-black leading-tight text-[#00283C]">
            Como este carro foi preparado
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            6 etapas antes de entrar na vitrine.
          </p>
        </div>
        <ol className="divide-y divide-[#00283C]/10 overflow-hidden rounded-2xl border border-[#00283C]/10 bg-white">
          {categories.map((category) => (
            <li key={category.id} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-black text-white">
                {category.numero}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight text-[#00283C]">
                  {category.name}
                </p>
                <p className="mt-0.5 text-[13px] leading-snug text-gray-600">
                  {category.items.map((item) => item.desc).join(" · ")}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
};
