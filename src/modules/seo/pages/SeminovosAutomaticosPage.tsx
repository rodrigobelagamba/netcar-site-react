import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useDefaultMetaTags } from "@/hooks/useDefaultMetaTags";
import { useVehiclesQuery } from "@/catalog/queries/useVehiclesQuery";
import { VehicleCard } from "@/design-system/components/patterns/VehicleCard";
import { Localizacao } from "@/design-system/components/layout/Localizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";
import { automaticSeminovosSearch } from "@/lib/seminovos-search";
import { isAvailableHomeStockVehicle } from "@/lib/homeStock";
import { RegionalActionCtas } from "@/modules/seo/components/RegionalActionCtas";
import { RegionalTrustSignals } from "@/modules/seo/components/RegionalTrustSignals";
import { RegionalSeoHero } from "@/modules/seo/components/RegionalSeoHero";

export function SeminovosAutomaticosPage() {
  const { data: vehicles, isLoading } = useVehiclesQuery({ cambio: "Automatico" });
  const availableVehicles = useMemo(
    () => (vehicles ?? []).filter(isAvailableHomeStockVehicle),
    [vehicles],
  );

  useDefaultMetaTags(
    "Seminovos Automáticos em Esteio",
    "Seminovos automáticos e CVT revisados em Esteio/RS. Troca, parcelamento e despachante. Financiamento facilitado na Netcar."
  );

  return (
    <main className="flex-1 overflow-x-hidden max-w-full bg-white">
      <RegionalSeoHero
        eyebrow="Câmbio automático · Esteio/RS"
        title="Seminovos automáticos em Esteio"
        intro="Conforto no trânsito, praticidade no dia a dia e melhor revenda. Automáticos e CVT revisados pela Fábrica de Valor — com troca, parcelamento e despachante."
      >
        <RegionalActionCtas
          className="mt-8"
          waText="estou procurando um seminovo automático em Esteio."
          stockSearch={automaticSeminovosSearch}
          stockLabel="Ver automáticos nos seminovos"
          primary="stock"
        />
      </RegionalSeoHero>

      <RegionalTrustSignals />

      <section className="pb-16">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          {isLoading ? (
            <p className="text-gray-500">Carregando estoque...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {availableVehicles.map((vehicle, index) => (
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
                  whatsAppSource="automaticos_landing"
                  delay={index}
                />
              ))}
            </div>
          )}

          {!isLoading && availableVehicles.length === 0 && (
            <p className="text-gray-500">
              Nenhum automático disponível no momento.
            </p>
          )}

          {!isLoading && (
            <div className="mt-10 flex justify-center">
              <Link
                to="/seminovos"
                search={automaticSeminovosSearch}
                data-regional-action="view_stock_more"
                className="inline-flex w-full max-w-md items-center justify-center gap-2.5 rounded-full bg-[#00283C] px-8 py-4 text-base font-black uppercase tracking-wider text-white shadow-[0_12px_32px_rgba(0,40,60,0.28)] transition-all hover:bg-[#00435a] hover:shadow-[0_16px_40px_rgba(0,40,60,0.34)] active:scale-[0.98] sm:w-auto"
              >
                <span className="button-text-shimmer-on-dark">Ver mais carros</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          )}
        </div>
      </section>

      <div className="w-full font-sans antialiased text-muted-foreground bg-muted py-12 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 space-y-8">
        <div className="container-main space-y-8">
          <Localizacao />
          <IanBot />
        </div>
      </div>
    </main>
  );
}
