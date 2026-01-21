import {  ReactNode } from "react";
import { useEmbla } from "@/hooks/useEmbla";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/cn";

interface HeroSliderProps {
  children: ReactNode;
  className?: string;
}

// TODO: Implementar lazy-loading para imagens dos slides
export function HeroSlider({ children, className }: HeroSliderProps) {
  const { emblaRef, emblaApi } = useEmbla({
    loop: true,
    align: "start",
  });

  const scrollPrev = () => {
    emblaApi?.scrollPrev();
  };

  const scrollNext = () => {
    emblaApi?.scrollNext();
  };

  return (
    <div className={cn("relative", className)}>
      <div className="embla overflow-hidden" ref={emblaRef}>
        <div className="embla__container flex">
          {children}
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={scrollPrev}
          aria-label="Slide anterior"
          className="bg-surface/80 backdrop-blur-sm"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={scrollNext}
          aria-label="Próximo slide"
          className="bg-surface/80 backdrop-blur-sm"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
