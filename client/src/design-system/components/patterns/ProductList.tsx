import { VehicleCard, type VehicleCardProps } from "./VehicleCard";
import { Button } from "../ui/button";

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
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8" style={{ overflow: 'visible' }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (vehicles.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8" style={{ overflow: 'visible' }}>
      {vehicles.map((vehicle, index) => (
        <VehicleCard key={vehicle.id} {...vehicle} delay={index} />
      ))}
    </div>
  );
}
