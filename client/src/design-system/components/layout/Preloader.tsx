import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
const logoPreloader = "/images/Logotipo8_1768863996715.png";

interface PreloaderProps {
  onComplete?: () => void;
}

export function Preloader({ onComplete }: PreloaderProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isRevealing, setIsRevealing] = useState(false);

  useEffect(() => {
    const revealTimer = setTimeout(() => {
      setIsRevealing(true);
    }, 3000);

    const hideTimer = setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, 4200);

    return () => {
      clearTimeout(revealTimer);
      clearTimeout(hideTimer);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="absolute inset-0 bg-[#0a0a0a] origin-top"
            initial={{ scaleY: 1 }}
            animate={{ scaleY: isRevealing ? 0 : 1 }}
            transition={{ 
              duration: 1,
              ease: [0.76, 0, 0.24, 1]
            }}
          />

          <motion.div
            className="relative z-10 flex flex-col items-center"
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: isRevealing ? 0 : 1,
              y: isRevealing ? -50 : 0
            }}
            transition={{ 
              opacity: { duration: 0.4 },
              y: { duration: 0.6, ease: "easeIn" }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ 
                duration: 1.5, 
                ease: [0.25, 0.46, 0.45, 0.94]
              }}
            >
              <motion.img
                src={logoPreloader}
                alt="Netcar Multimarcas"
                className="w-[160px] h-[160px] sm:w-[200px] sm:h-[200px] lg:w-[240px] lg:h-[240px] object-contain"
              />
            </motion.div>
            
            <motion.div
              className="mt-8 h-[1px] bg-white/40"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 200, opacity: 1 }}
              transition={{ 
                duration: 1.5,
                ease: [0.25, 0.46, 0.45, 0.94]
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
