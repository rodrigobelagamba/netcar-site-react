import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";

// Tipagem simples para evitar conflito com tipos da lib
type EmblaOptions = Parameters<typeof useEmblaCarousel>[0];

export function useEmbla(options?: EmblaOptions) {
  const [emblaRef, emblaApi] = useEmblaCarousel(options);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);

    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  return {
    emblaRef,
    emblaApi,
    selectedIndex,
  };
}
