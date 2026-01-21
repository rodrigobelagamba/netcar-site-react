import { useEmbla } from "@/hooks/useEmbla";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { VehicleCard, type VehicleCardProps } from "./VehicleCard";
import { cn } from "@/lib/cn";

interface ProductsCarouselProps {
  vehicles: VehicleCardProps[];
  className?: string;
}

// TODO: Implementar lazy-loading para VehicleCards
export function ProductsCarousel({
  vehicles,
  className,
}: ProductsCarouselProps) {
  const { emblaRef, emblaApi } = useEmbla({
    slidesToScroll: 1,
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
        <div className="embla__container flex gap-4">
          {vehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              className="embla__slide flex-[0_0_280px] sm:flex-[0_0_320px]"
            >
              <VehicleCard {...vehicle} />
            </div>
          ))}
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4"
        onClick={scrollPrev}
        aria-label="Carrossel anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4"
        onClick={scrollNext}
        aria-label="Próximo carrossel"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
