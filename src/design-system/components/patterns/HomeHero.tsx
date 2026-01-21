import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { Button } from "@/design-system/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { formatPrice, formatYear } from "@/lib/formatters";
import { generateVehicleSlug } from "@/lib/slug";

const CAR_COVERED_PLACEHOLDER_URL = "/images/semcapa.png";

export interface HomeHeroVehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  image: string;
  tag?: string;
  marca?: string;
  modelo?: string;
  placa?: string;
  combustivel?: string;
  cambio?: string;
}

interface HomeHeroProps {
  vehicles: HomeHeroVehicle[];
}

export function HomeHero({ vehicles }: HomeHeroProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const navigate = useNavigate();
  
  if (!vehicles || vehicles.length === 0) {
    return null;
  }

  const vehicle = vehicles[currentIndex];

  const next = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % vehicles.length);
  };
  
  const prev = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + vehicles.length) % vehicles.length);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % vehicles.length);
    }, 12000);
    return () => clearInterval(timer);
  }, [currentIndex, vehicles.length]);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? "100%" : "-100%",
      opacity: 0,
      scale: 1.1
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? "100%" : "-100%",
      opacity: 0,
      scale: 0.9
    })
  };

  const handleViewDetails = () => {
    const slug = generateVehicleSlug({
      modelo: vehicle.modelo || vehicle.model,
      marca: vehicle.marca || vehicle.brand,
      year: vehicle.year,
      placa: vehicle.placa,
      id: vehicle.id,
    });
    navigate({ to: `/veiculo/${slug}` });
  };

  const priceFormatted = formatPrice(vehicle.price);
  const yearFormatted = formatYear(vehicle.year);
  const tag = vehicle.tag || vehicle.combustivel || "";

  return (
    <div className="relative w-full bg-[#F6F6F6] overflow-visible min-h-[600px] md:min-h-[90vh] flex flex-col items-center justify-center pt-16 pb-8 md:pt-16 md:pb-8">
      
      {/* Background Typography */}
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.div 
          key={vehicle.id}
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
          custom={direction}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 0.04, scale: 1.2 }}
          exit={{ opacity: 0, scale: 1.3 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-[25vw] md:text-[32vw] font-black tracking-tighter whitespace-nowrap leading-none text-center" style={{ color: '#00283C' }}>
            {vehicle.model}
          </h2>
        </motion.div>
      </AnimatePresence>

      <div className="container mx-auto px-4 md:px-6 relative z-10 flex flex-col items-center justify-center w-full">
        
        {/* Brand Label */}
        <div className="h-8 md:h-6 mb-1 overflow-visible relative w-full flex justify-center z-20">
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.div 
              key={`${vehicle.id}-brand`}
              custom={direction}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              className="flex items-center gap-3"
            >
              <div className="h-[1px] w-8 md:w-12" style={{ backgroundColor: 'rgba(0, 40, 60, 0.2)' }} />
              <span className="text-[14px] md:text-[16px] font-bold uppercase tracking-[0.5em] whitespace-nowrap" style={{ color: '#00283C' }}>{vehicle.brand}</span>
              <div className="h-[1px] w-8 md:w-12" style={{ backgroundColor: 'rgba(0, 40, 60, 0.2)' }} />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="relative w-full max-w-[1400px] flex items-center justify-center mb-2 md:mb-4 min-h-[45vh] md:min-h-[60vh]">
          {/* Main Car Image - MAXIMIZED SIZE */}
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.div
              key={`${vehicle.id}-image`}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                const swipeThreshold = 50;
                if (info.offset.x > swipeThreshold) {
                  prev();
                } else if (info.offset.x < -swipeThreshold) {
                  next();
                }
              }}
              transition={{
                x: { type: "spring", stiffness: 200, damping: 25, mass: 1 },
                opacity: { duration: 0.5, ease: "easeInOut" },
                scale: { duration: 0.5 }
              }}
              className="absolute inset-0 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
            >
              <img 
                src={vehicle.image || CAR_COVERED_PLACEHOLDER_URL} 
                alt={vehicle.model}
                loading={currentIndex === 0 ? "eager" : "lazy"}
                fetchPriority={currentIndex === 0 ? "high" : "auto"}
                className="w-full h-auto drop-shadow-[0_40px_50px_rgba(0,0,0,0.15)] md:drop-shadow-[0_80px_60px_rgba(0,0,0,0.18)] hover:scale-[1.02] transition-transform duration-700 ease-out max-h-[55vh] md:max-h-[75vh] lg:max-h-[80vh] object-contain px-0 scale-[1.4] md:scale-125"
                style={{ mixBlendMode: 'multiply' }}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Info Bar */}
        <div className="relative w-full max-w-5xl h-[300px] md:h-[150px] mx-4 mt-8 md:mt-24 z-20">
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.div 
              key={`${vehicle.id}-info`}
              custom={direction}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 grid grid-cols-1 md:grid-cols-3 w-full bg-white/70 backdrop-blur-2xl rounded-2xl md:rounded-2xl overflow-hidden border border-white/50 shadow-2xl"
            >
              <div className="p-3 md:p-4 lg:p-8 flex flex-col justify-center items-center text-white h-full" style={{ backgroundColor: '#00283C' }}>
                <span className="text-[8px] md:text-[10px] uppercase tracking-widest opacity-60 mb-0.5 md:mb-1 font-bold">{vehicle.model}</span>
                <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-center">
                  <span className="text-base md:text-xl lg:text-2xl font-bold whitespace-nowrap">{yearFormatted}</span>
                  {tag && (
                    <>
                      <span className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full shrink-0" style={{ backgroundColor: '#5CD29D' }} />
                      <span className="text-base md:text-xl lg:text-2xl font-bold text-gray-400 whitespace-nowrap">{tag}</span>
                    </>
                  )}
                </div>
                <div className="mt-1 md:mt-2 lg:mt-4 text-xl md:text-2xl lg:text-3xl font-black whitespace-nowrap" style={{ color: '#5CD29D' }}>{priceFormatted}</div>
              </div>
              
              <div 
                className="p-2 md:p-4 lg:p-8 flex flex-col justify-center items-center border-y md:border-y-0 md:border-x border-black/5 hover:bg-white/40 transition-colors cursor-pointer group h-full"
                onClick={handleViewDetails}
              >
                <Maximize2 className="w-5 h-5 md:w-6 lg:w-8 md:h-6 lg:h-8 mb-0.5 md:mb-2 transition-colors group-hover:text-secondary" style={{ color: '#00283C' }} />
                <span className="text-[9px] md:text-[10px] lg:text-[11px] font-bold uppercase tracking-widest text-center transition-colors group-hover:text-primary" style={{ color: 'rgba(0, 40, 60, 0.6)' }}>Ver Fotos</span>
              </div>

              <div 
                className="p-2 md:p-4 lg:p-8 flex flex-col justify-center items-center hover:bg-white/40 transition-colors cursor-pointer group h-full"
                onClick={handleViewDetails}
              >
                <div className="flex items-center gap-2 mb-0.5 md:mb-2 justify-center">
                  <motion.div 
                    animate={{ scale: [1, 1.3, 1], opacity: [1, 0.4, 1] }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                    className="w-3 h-3 md:w-3.5 lg:w-4 md:h-3.5 lg:h-4 rounded-full flex items-center justify-center shrink-0"
                    style={{ border: '2px solid #5CD29D' }}
                  >
                    <div className="w-1.5 h-1.5 md:w-1.5 lg:w-2 md:h-1.5 lg:h-2 rounded-full shadow-[0_0_12px_rgba(92,210,157,1)]" style={{ backgroundColor: '#5CD29D' }} />
                  </motion.div>
                  <motion.span 
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                    className="text-[9px] md:text-[10px] lg:text-[11px] font-bold uppercase tracking-widest whitespace-nowrap"
                    style={{ color: '#5CD29D' }}
                  >
                    Vistoriado
                  </motion.span>
                </div>
                <Button 
                  variant="ghost" 
                  className="font-black hover:text-secondary p-0 h-auto text-xs md:text-sm lg:text-base whitespace-nowrap"
                  style={{ color: '#00283C' }}
                  onClick={handleViewDetails}
                >
                  QUERO ESTE CARRO
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation - Hidden on Mobile */}
        <div 
          className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 hidden md:flex flex-col items-center gap-4 group cursor-pointer z-30" 
          onClick={prev}
        >
          <div 
            className="w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center bg-white/10 backdrop-blur-md transition-all shadow-xl"
            style={{ border: '1px solid rgba(0, 40, 60, 0.05)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#00283C';
              const icon = e.currentTarget.querySelector('svg');
              if (icon) icon.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              const icon = e.currentTarget.querySelector('svg');
              if (icon) icon.style.color = '#00283C';
            }}
          >
            <ChevronLeft className="w-6 h-6 md:w-8 md:h-8 transition-colors" style={{ color: '#00283C' }} />
          </div>
        </div>

        <div 
          className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 hidden md:flex flex-col items-center gap-4 group cursor-pointer z-30" 
          onClick={next}
        >
          <div 
            className="w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center bg-white/10 backdrop-blur-md transition-all shadow-xl"
            style={{ border: '1px solid rgba(0, 40, 60, 0.05)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#00283C';
              const icon = e.currentTarget.querySelector('svg');
              if (icon) icon.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              const icon = e.currentTarget.querySelector('svg');
              if (icon) icon.style.color = '#00283C';
            }}
          >
            <ChevronRight className="w-6 h-6 md:w-8 md:h-8 transition-colors" style={{ color: '#00283C' }} />
          </div>
        </div>

      </div>
    </div>
  );
}

