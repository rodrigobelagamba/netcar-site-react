import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useVehiclesQuery } from "@/catalog/queries/useVehiclesQuery";
import { VehicleCard } from "@/design-system/components/patterns/VehicleCard";
import { emptySeminovosSearch } from "@/lib/seminovos-search";
import { isAvailableHomeStockVehicle } from "@/lib/homeStock";

type StockSearch = typeof emptySeminovosSearch;

type RegionalStockPreviewProps = {
  title?: string;
  limit?: number;
  stockSearch?: StockSearch;
  moreLabel?: string;
};

/** Grade de seminovos reais da loja — páginas SEO regionais. */
export function RegionalStockPreview({
  title = "Seminovos disponíveis agora em Esteio",
  limit = 8,
  stockSearch = emptySeminovosSearch,
  moreLabel = "Ver mais carros",
}: RegionalStockPreviewProps) {
  const { data: vehicles, isLoading } = useVehiclesQuery({ limit: 120 });
  const list = useMemo(
    () => (vehicles ?? []).filter(isAvailableHomeStockVehicle).slice(0, limit),
    [vehicles, limit],
  );

  const moreCarsBtn = (
    <div className="mt-10 flex justify-center">
      <Link
        to="/seminovos"
        search={stockSearch}
        data-regional-action="view_stock_more"
        className="inline-flex w-full max-w-md items-center justify-center gap-2.5 rounded-full bg-[#00283C] px-8 py-4 text-base font-black uppercase tracking-wider text-white shadow-[0_12px_32px_rgba(0,40,60,0.28)] transition-all hover:bg-[#00435a] hover:shadow-[0_16px_40px_rgba(0,40,60,0.34)] active:scale-[0.98] sm:w-auto"
      >
        <span className="button-text-shimmer-on-dark">{moreLabel}</span>
        <ArrowRight className="h-5 w-5" />
      </Link>
    </div>
  );

  return (
    <section className="relative pb-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-slate-50 to-transparent"
      />
      <div className="container-main relative px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        <div className="mb-6">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-primary">
            Estoque real
          </span>
          <h2 className="text-2xl font-bold text-fg md:text-3xl">{title}</h2>
        </div>

        {isLoading ? (
          <p className="text-gray-500">Carregando estoque...</p>
        ) : list.length === 0 ? (
          <>
            <p className="text-gray-500">Nenhum veículo listado no momento.</p>
            {moreCarsBtn}
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {list.map((vehicle, index) => (
                <VehicleCard
                  key={vehicle.id}
                  id={vehicle.id}
                  name={vehicle.modelo || vehicle.name}
                  price={vehicle.price || 0}
                  valor_formatado={vehicle.valor_formatado}
                  year={vehicle.year || new Date().getFullYear()}
                  km={vehicle.km || 0}
                  images={vehicle.images || vehicle.fotos || []}
                  imagens_site={vehicle.imagens_site}
                  marca={vehicle.marca}
                  modelo={vehicle.modelo}
                  placa={vehicle.placa}
                  pdf={vehicle.pdf}
                  pdf_url={vehicle.pdf_url}
                  diferenciais={vehicle.diferenciais}
                  showWhatsAppInterest
                  whatsAppSource="regional_stock"
                  delay={index}
                />
              ))}
            </div>
            {moreCarsBtn}
          </>
        )}
      </div>
    </section>
  );
}
