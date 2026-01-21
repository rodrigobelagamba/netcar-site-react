import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { Button } from "@/design-system/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { formatPrice } from "@/lib/formatters";
import { generateVehicleSlug } from "@/lib/slug";

export interface HeroVehicle {
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
}

interface HeroProps {
  vehicles: HeroVehicle[];
}

export function Hero({ vehicles }: HeroProps) {
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

  return (
    <div className="relative w-full bg-[#F6F6F6] overflow-hidden min-h-[600px] md:h-[90vh] flex flex-col items-center justify-center py-8 md:py-0">
      
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
          <h2 className="text-[25vw] md:text-[32vw] font-black tracking-tighter text-primary whitespace-nowrap leading-none text-center">
            {vehicle.model}
          </h2>
        </motion.div>
      </AnimatePresence>

      <div className="container mx-auto px-4 md:px-6 relative z-10 flex flex-col items-center h-full justify-center">
        
        {/* Brand Label */}
        <div className="h-6 mb-1 overflow-hidden relative w-full flex justify-center">
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.div 
              key={`${vehicle.id}-brand`}
              custom={direction}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              className="flex items-center gap-3 absolute"
            >
              <div className="h-[1px] w-8 md:w-12 bg-primary/20" />
              <span className="text-[14px] md:text-[16px] font-bold uppercase tracking-[0.5em] text-primary">{vehicle.brand}</span>
              <div className="h-[1px] w-8 md:w-12 bg-primary/20" />
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
                src={vehicle.image} 
                alt={vehicle.model}
                className="w-full h-auto drop-shadow-[0_40px_50px_rgba(0,0,0,0.15)] md:drop-shadow-[0_80px_60px_rgba(0,0,0,0.18)] hover:scale-[1.02] transition-transform duration-700 ease-out max-h-[55vh] md:max-h-[75vh] lg:max-h-[80vh] object-contain px-0 scale-[1.4] md:scale-125"
                style={{ mixBlendMode: 'multiply' }}
                loading="eager"
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Info Bar */}
        <div className="relative w-full max-w-5xl h-[300px] md:h-[150px] mx-4 mt-8 md:mt-24">
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
              <div className="bg-primary p-3 md:p-4 lg:p-8 flex flex-col justify-center items-center text-white h-full">
                <span className="text-[8px] md:text-[10px] uppercase tracking-widest opacity-60 mb-0.5 md:mb-1 font-bold">{vehicle.model}</span>
                <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-center">
                  <span className="text-base md:text-xl lg:text-2xl font-bold whitespace-nowrap">{vehicle.year}</span>
                  {vehicle.tag && (
                    <>
                      <span className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-secondary shrink-0" />
                      <span className="text-base md:text-xl lg:text-2xl font-bold text-gray-400 whitespace-nowrap">{vehicle.tag}</span>
                    </>
                  )}
                </div>
                <div className="mt-1 md:mt-2 lg:mt-4 text-xl md:text-2xl lg:text-3xl font-black text-secondary whitespace-nowrap">{priceFormatted}</div>
              </div>
              
              <div 
                className="p-2 md:p-4 lg:p-8 flex flex-col justify-center items-center border-y md:border-y-0 md:border-x border-black/5 hover:bg-white/40 transition-colors cursor-pointer group h-full"
                onClick={handleViewDetails}
              >
                <Maximize2 className="w-5 h-5 md:w-6 lg:w-8 md:h-6 lg:h-8 mb-0.5 md:mb-2 text-primary group-hover:text-secondary transition-colors" />
                <span className="text-[9px] md:text-[10px] lg:text-[11px] font-bold uppercase tracking-widest text-primary/60 group-hover:text-primary transition-colors text-center">Ver Fotos</span>
              </div>

              <div 
                className="p-2 md:p-4 lg:p-8 flex flex-col justify-center items-center hover:bg-white/40 transition-colors cursor-pointer group h-full"
                onClick={handleViewDetails}
              >
                <div className="flex items-center gap-2 mb-0.5 md:mb-2 justify-center">
                  <motion.div 
                    animate={{ scale: [1, 1.3, 1], opacity: [1, 0.4, 1] }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                    className="w-3 h-3 md:w-3.5 lg:w-4 md:h-3.5 lg:h-4 rounded-full border-2 border-secondary flex items-center justify-center shrink-0"
                  >
                    <div className="w-1.5 h-1.5 md:w-1.5 lg:w-2 md:h-1.5 lg:h-2 rounded-full bg-secondary shadow-[0_0_12px_rgba(96,206,205,1)]" />
                  </motion.div>
                  <motion.span 
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                    className="text-[9px] md:text-[10px] lg:text-[11px] font-bold uppercase tracking-widest text-secondary whitespace-nowrap"
                  >
                    Vistoriado
                  </motion.span>
                </div>
                <Button 
                  variant="ghost" 
                  className="text-primary font-black hover:text-secondary p-0 h-auto text-xs md:text-sm lg:text-base whitespace-nowrap"
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
          <div className="w-12 h-12 md:w-16 md:h-16 rounded-full border border-primary/5 flex items-center justify-center bg-white/10 backdrop-blur-md hover:bg-primary hover:text-white transition-all shadow-xl">
            <ChevronLeft className="w-6 h-6 md:w-8 md:h-8" />
          </div>
        </div>

        <div 
          className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 hidden md:flex flex-col items-center gap-4 group cursor-pointer z-30" 
          onClick={next}
        >
          <div className="w-12 h-12 md:w-16 md:h-16 rounded-full border border-primary/5 flex items-center justify-center bg-white/10 backdrop-blur-md hover:bg-primary hover:text-white transition-all shadow-xl">
            <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />
          </div>
        </div>

      </div>
    </div>
  );
}

