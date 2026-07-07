import { VehicleCard, type VehicleCardProps } from "./VehicleCard";
import { Button } from "../ui/button";

interface ProductListProps {
  vehicles: VehicleCardProps[];
  isLoading?: boolean;
  showWhatsAppInterest?: boolean;
  whatsAppSource?: string;
}

function SkeletonCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-lg border border-border bg-surface ${compact ? "mt-14" : "mt-24"}`}>
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

export function ProductList({
  vehicles,
  isLoading,
  showWhatsAppInterest = false,
  whatsAppSource = "home_destaques",
}: ProductListProps) {
  if (isLoading) {
    return (
      <>
        <div className="md:hidden grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} compact />
          ))}
        </div>
        <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-5 gap-8" style={{ overflow: 'visible' }}>
          {Array.from({ length: 8 }).map((_, i) => (
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
      <div className="md:hidden grid grid-cols-2 gap-3">
        {vehicles.map((vehicle, index) => (
          <VehicleCard
            key={vehicle.id}
            {...vehicle}
            delay={index}
            showWhatsAppInterest={showWhatsAppInterest}
            whatsAppSource={whatsAppSource}
            compact
            fastAnimation
          />
        ))}
      </div>

      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-5 gap-8" style={{ overflow: 'visible' }}>
        {vehicles.map((vehicle, index) => (
          <VehicleCard
            key={vehicle.id}
            {...vehicle}
            delay={index}
            showWhatsAppInterest={showWhatsAppInterest}
            whatsAppSource={whatsAppSource}
          />
        ))}
      </div>
    </>
  );
}
