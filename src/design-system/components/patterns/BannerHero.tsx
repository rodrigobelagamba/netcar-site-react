import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import type { Banner } from "@/api/endpoints/site";

interface BannerHeroProps {
  banners: Banner[];
}

export function BannerHero({ banners }: BannerHeroProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  if (!banners || banners.length === 0) {
    return null;
  }

  const currentBanner = banners[currentIndex];

  const next = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  const prev = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [currentIndex, banners.length]);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? "100%" : "-100%",
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? "100%" : "-100%",
      opacity: 0,
    }),
  };

  const imageContent = (
    <>
      <img
        src={currentBanner.imagem}
        alt={currentBanner.titulo || "Banner"}
        className="w-full h-auto md:h-full object-contain md:object-cover object-center"
        loading={currentIndex === 0 ? "eager" : "lazy"}
        {...(currentIndex === 0 && { fetchPriority: "high" })}
      />
      {currentBanner.titulo && (
        <div
          className="absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 px-4 md:px-6 py-1.5 md:py-2 bg-black/50 text-white text-center text-sm md:text-lg font-semibold rounded-lg backdrop-blur-sm"
          style={{ color: "#fff" }}
        >
          {currentBanner.titulo}
        </div>
      )}
    </>
  );

  return (
    <div className="relative w-full bg-[#F6F6F6] overflow-hidden max-w-full md:aspect-[21/9]">
      {/* Máscara em desktop: altura fixa proporcional (21:9). No mobile a altura acompanha a imagem inteira. */}
      <div className="relative w-full h-full overflow-hidden bg-gray-200 md:absolute md:inset-0">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={currentBanner.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.3 },
            }}
            className="flex items-center justify-center w-full h-full md:absolute md:inset-0"
          >
            {currentBanner.link ? (
              <a
                href={currentBanner.link}
                target={currentBanner.link.startsWith("http") ? "_blank" : undefined}
                rel={currentBanner.link.startsWith("http") ? "noopener noreferrer" : undefined}
                className="block w-full h-full"
              >
                {imageContent}
              </a>
            ) : (
              imageContent
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div
        className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 hidden md:flex flex-col items-center gap-4 cursor-pointer z-30"
        onClick={prev}
        onKeyDown={(e) => e.key === "Enter" && prev()}
        role="button"
        tabIndex={0}
        aria-label="Banner anterior"
      >
        <div
          className="w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center bg-white/10 backdrop-blur-md transition-all shadow-xl hover:bg-[#00283C]"
          style={{ border: "1px solid rgba(0, 40, 60, 0.05)" }}
        >
          <ChevronLeft className="w-6 h-6 md:w-8 md:h-8" style={{ color: "#00283C" }} />
        </div>
      </div>

      <div
        className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 hidden md:flex flex-col items-center gap-4 cursor-pointer z-30"
        onClick={next}
        onKeyDown={(e) => e.key === "Enter" && next()}
        role="button"
        tabIndex={0}
        aria-label="Próximo banner"
      >
        <div
          className="w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center bg-white/10 backdrop-blur-md transition-all shadow-xl hover:bg-[#00283C]"
          style={{ border: "1px solid rgba(0, 40, 60, 0.05)" }}
        >
          <ChevronRight className="w-6 h-6 md:w-8 md:h-8" style={{ color: "#00283C" }} />
        </div>
      </div>

      {/* Dots */}
      {banners.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 justify-center z-20">
          {banners.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setDirection(idx > currentIndex ? 1 : -1);
                setCurrentIndex(idx);
              }}
              aria-label={`Ir para banner ${idx + 1}`}
              className={`w-2 h-2 rounded-full transition-all ${
                idx === currentIndex ? "bg-[#00283C] scale-125" : "bg-gray-300 hover:bg-gray-400"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
