import { ProductList } from "@/design-system/components/patterns/ProductList";
import type { VehicleCardProps } from "@/design-system/components/patterns/VehicleCard";
import { useEffect, useRef } from "react";

type HomeStockGridProps = {
  vehicles: VehicleCardProps[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  onRetry: () => void;
  onViewStock: () => void;
};

/** A failed inventory request is not an empty search result. */
export function HomeStockGrid({
  vehicles,
  isLoading,
  isFetching,
  isError,
  onRetry,
  onViewStock,
}: HomeStockGridProps) {
  const recoveryAttempted = useRef(false);
  useEffect(() => {
    if (vehicles.length > 0) {
      recoveryAttempted.current = false;
      return;
    }
    // This grid mounts when scrolled into view. If its earlier request failed,
    // give it one fresh attempt without requiring a whole-page reload.
    if (!isError || isLoading || isFetching || recoveryAttempted.current) return;
    recoveryAttempted.current = true;
    onRetry();
  }, [vehicles.length, isError, isLoading, isFetching, onRetry]);

  // Keep the last successful cars visible while a background refresh retries.
  if (vehicles.length > 0) {
    return <ProductList vehicles={vehicles} showWhatsAppInterest />;
  }

  if (isLoading || isFetching) {
    return (
      <div aria-busy="true">
        <p role="status" className="sr-only">Carregando carros do estoque.</p>
        <ProductList vehicles={[]} isLoading showWhatsAppInterest />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center">
      <h3 className="text-xl font-semibold text-fg">
        {isError ? "Não foi possível carregar os carros agora." : "Explore o estoque completo."}
      </h3>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
        {isError
          ? "Tente novamente ou acesse o estoque completo para continuar sua busca."
          : "Veja todos os carros disponíveis e encontre seu próximo seminovo."}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {isError && (
          <button type="button" onClick={onRetry} className="rounded-full bg-[#00283C] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#00435a]">
            Tentar novamente
          </button>
        )}
        <button type="button" onClick={onViewStock} className="rounded-full border border-[#00283C] px-6 py-3 text-sm font-bold text-[#00283C] transition-colors hover:bg-slate-100">
          Explorar seminovos
        </button>
      </div>
    </div>
  );
}
