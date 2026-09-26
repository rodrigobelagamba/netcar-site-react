import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useVehiclesQuery } from "@/catalog/queries/useVehiclesQuery";
import { VehicleCard } from "@/design-system/components/patterns/VehicleCard";
import { emptySeminovosSearch } from "@/lib/seminovos-search";
import { isAvailableHomeStockVehicle } from "@/lib/homeStock";
import { sortShowroomVehicles } from "@/lib/showroomStock";

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
  const {
    data: vehicles,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useVehiclesQuery({ fetchAll: true }, { refreshImmediately: true });
  const list = useMemo(
    () =>
      sortShowroomVehicles(
        (vehicles ?? []).filter(isAvailableHomeStockVehicle),
        "az",
      ).slice(0, limit),
    [vehicles, limit],
  );
  const hasStockData = Array.isArray(vehicles);
  const waitingForStock = isLoading || (isFetching && list.length === 0);

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
            Carros do estoque
          </span>
          <h2 className="text-2xl font-bold text-fg md:text-3xl">{title}</h2>
        </div>

        {waitingForStock && (
          <p role="status" className="text-gray-500">
            Carregando estoque...
          </p>
        )}

        {isError && (
          <div
            role="status"
            className="mb-6 rounded-2xl border border-gray-200 bg-gray-50 p-5"
          >
            <p className="text-gray-600">
              {list.length > 0
                ? "Não foi possível atualizar o estoque. Os anúncios já carregados continuam abaixo; confirme a disponibilidade com a equipe."
                : "Não foi possível carregar o estoque. Tente novamente ou consulte os carros com a equipe."}
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="mt-3 min-h-11 font-semibold text-[#00283C] underline underline-offset-4 disabled:opacity-50"
            >
              {isFetching ? "Atualizando estoque..." : "Tentar novamente"}
            </button>
          </div>
        )}

        {list.length > 0 && (
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
                  anoFabricacao={vehicle.anoFabricacao}
                  km={vehicle.km || 0}
                  images={vehicle.images || vehicle.fotos || []}
                  imagens_site={vehicle.imagens_site}
                  marca={vehicle.marca}
                  modelo={vehicle.modelo}
                  placa={vehicle.placa}
                  potencia={vehicle.potencia}
                  pdf={vehicle.pdf}
                  pdf_url={vehicle.pdf_url}
                  diferenciais={vehicle.diferenciais}
                  showWhatsAppInterest
                  whatsAppSource="regional_stock"
                  delay={index}
                />
              ))}
            </div>
          </>
        )}

        {hasStockData && !isError && !waitingForStock && list.length === 0 && (
          <p className="text-gray-500">
            Não há veículos para exibir nesta seleção no momento. Consulte o
            estoque completo ou fale com a equipe.
          </p>
        )}

        {(!waitingForStock || list.length > 0) && moreCarsBtn}
      </div>
    </section>
  );
}
