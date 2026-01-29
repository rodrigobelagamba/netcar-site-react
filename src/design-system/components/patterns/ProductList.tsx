import { VehicleCard, type VehicleCardProps } from "./VehicleCard";
import { Button } from "../ui/button";
import { useEmbla } from "@/hooks/useEmbla";
import { useEffect, useRef } from "react";

interface ProductListProps {
  vehicles: VehicleCardProps[];
  isLoading?: boolean;
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="aspect-video w-full animate-pulse bg-muted" />
      <div className="p-4 space-y-3">
        <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-8 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-10 w-full animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 text-6xl">🚗</div>
      <h3 className="mb-2 text-xl font-semibold text-fg">
        Nenhum veículo encontrado
      </h3>
      <p className="mb-6 text-sm text-muted-foreground max-w-md">
        Tente ajustar os filtros de busca ou explore outras opções disponíveis.
      </p>
      <Button variant="outline">Limpar Filtros</Button>
    </div>
  );
}

export function ProductList({ vehicles, isLoading }: ProductListProps) {
  const { emblaRef, emblaApi } = useEmbla({
    slidesToScroll: 1,
    align: "start",
    loop: true,
  });

  const autoplayIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasUserInteractedRef = useRef(false);

  // Para o autoplay definitivamente após primeira interação
  const handleUserInteraction = () => {
    if (!hasUserInteractedRef.current) {
      hasUserInteractedRef.current = true;
      if (autoplayIntervalRef.current) {
        clearInterval(autoplayIntervalRef.current);
        autoplayIntervalRef.current = null;
      }
    }
  };

  // Autoplay - passa automaticamente a cada 4 segundos (apenas se não houver interação)
  useEffect(() => {
    if (!emblaApi || vehicles.length <= 1 || hasUserInteractedRef.current) return;

    const startAutoplay = () => {
      if (autoplayIntervalRef.current) {
        clearInterval(autoplayIntervalRef.current);
      }
      autoplayIntervalRef.current = setInterval(() => {
        if (emblaApi && vehicles.length > 1 && !hasUserInteractedRef.current) {
          emblaApi.scrollNext();
        }
      }, 4000);
    };

    const stopAutoplay = () => {
      if (autoplayIntervalRef.current) {
        clearInterval(autoplayIntervalRef.current);
        autoplayIntervalRef.current = null;
      }
    };

    // Detecta interações do usuário através do Embla (arrastar, toque)
    const onPointerDown = () => handleUserInteraction();

    emblaApi.on("pointerDown", onPointerDown);

    startAutoplay();

    return () => {
      stopAutoplay();
      emblaApi.off("pointerDown", onPointerDown);
    };
  }, [emblaApi, vehicles.length]);

  if (isLoading) {
    return (
      <>
        {/* Mobile Skeleton - Carrossel */}
        <div className="md:hidden">
          <div className="embla overflow-hidden" ref={emblaRef}>
            <div className="embla__container flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="embla__slide flex-[0_0_100%] min-w-0 px-2">
                  <SkeletonCard />
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Desktop Skeleton - Grid */}
        <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-5 gap-8" style={{ overflow: 'visible' }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </>
    );
  }

  if (vehicles.length === 0) {
    return <EmptyState />;
  }

  return (
    <>
      {/* Mobile - Carrossel */}
      <div 
        className="md:hidden relative"
        onMouseEnter={handleUserInteraction}
        onTouchStart={handleUserInteraction}
        onPointerDown={handleUserInteraction}
      >
        <div className="embla overflow-hidden" ref={emblaRef}>
          <div className="embla__container flex">
            {vehicles.map((vehicle, index) => (
              <div
                key={vehicle.id}
                className="embla__slide flex-[0_0_100%] min-w-0 px-2"
              >
                <VehicleCard {...vehicle} delay={index} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop - Grid */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-5 gap-8" style={{ overflow: 'visible' }}>
        {vehicles.map((vehicle, index) => (
          <VehicleCard key={vehicle.id} {...vehicle} delay={index} />
        ))}
      </div>
    </>
  );
}
