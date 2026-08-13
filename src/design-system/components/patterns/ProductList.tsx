import { useEffect, useRef, useState } from "react";
import {
  VehicleCardStatic,
  type VehicleCardProps,
} from "./VehicleCard";
import { Button } from "../ui/button";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import {
  useStockFocusObserver,
  type VehicleFocusHandler,
} from "@/hooks/useStockFocusObserver";
import { DEFAULT_SALES_WHATSAPP } from "@/lib/whatsappMessages";

interface ProductListProps {
  vehicles: VehicleCardProps[];
  isLoading?: boolean;
  showWhatsAppInterest?: boolean;
  whatsAppSource?: string;
  onVehicleFocus?: VehicleFocusHandler;
  /** Pausa foco por scroll (ex.: ponteiro no sticky WA). */
  scrollFocusPaused?: boolean;
}

function SkeletonCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-lg border border-border bg-surface ${compact ? "mt-14" : "mt-24 short1600:mt-16"}`}>
      <div className={`w-full animate-pulse bg-muted ${compact ? "aspect-[4/3]" : "aspect-video"}`} />
      <div className={`space-y-3 ${compact ? "p-3" : "p-4"}`}>
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

function getCompactLayout() {
  return typeof window !== "undefined" && window.innerWidth < 768;
}

/** Renderiza apenas o grid que o usuário realmente vê, inclusive ao redimensionar. */
function useCompactLayout() {
  const [compact, setCompact] = useState(getCompactLayout);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return compact;
}

export function ProductList({
  vehicles,
  isLoading,
  showWhatsAppInterest = false,
  whatsAppSource = "home_destaques",
  onVehicleFocus,
  scrollFocusPaused = false,
}: ProductListProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const compact = useCompactLayout();
  const { data: whatsapp } = useWhatsAppQuery();
  const whatsAppNumber = whatsapp?.numero || DEFAULT_SALES_WHATSAPP;
  useStockFocusObserver(
    rootRef,
    isLoading ? undefined : onVehicleFocus,
    vehicles,
    scrollFocusPaused,
  );

  if (isLoading) {
    return (
      <div
        className={
          compact
            ? "grid grid-cols-2 items-stretch gap-2"
            : "grid grid-cols-2 gap-8 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-5 short1600:gap-5"
        }
        style={{ overflow: "visible" }}
      >
        {Array.from({ length: compact ? 6 : 8 }).map((_, i) => (
          <SkeletonCard key={i} compact={compact} />
        ))}
      </div>
    );
  }

  if (vehicles.length === 0) {
    return <EmptyState />;
  }

  const trackFocus = Boolean(onVehicleFocus);

  return (
    <div ref={rootRef}>
      <div
        className={
          compact
            ? "grid grid-cols-2 items-stretch gap-2"
            : "grid grid-cols-2 gap-8 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-5 short1600:gap-5"
        }
        style={{ overflow: "visible" }}
      >
        {vehicles.map((vehicle, index) => (
          <VehicleCardStatic
            key={vehicle.id}
            {...vehicle}
            delay={index}
            showWhatsAppInterest={showWhatsAppInterest}
            whatsAppSource={whatsAppSource}
            whatsAppNumber={whatsAppNumber}
            enableFocusTracking={trackFocus}
            onVehicleFocus={onVehicleFocus}
            compact={compact}
            fastAnimation={compact}
          />
        ))}
      </div>
    </div>
  );
}
