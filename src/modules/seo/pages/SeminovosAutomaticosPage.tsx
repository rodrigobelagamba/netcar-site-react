import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { useDefaultMetaTags } from "@/hooks/useDefaultMetaTags";
import { useVehiclesQuery } from "@/api/queries/useVehiclesQuery";
import { VehicleCard } from "@/design-system/components/patterns/VehicleCard";
import { Localizacao } from "@/design-system/components/layout/Localizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";
import { automaticSeminovosSearch } from "@/lib/seminovos-search";

export function SeminovosAutomaticosPage() {
  const { data: vehicles, isLoading } = useVehiclesQuery({ cambio: "Automatico" });

  useDefaultMetaTags(
    "Seminovos Automáticos em Esteio",
    "Seminovos automáticos e CVT revisados em Esteio/RS. T-Cross, Compass, Kicks, HB20 e mais. Financiamento facilitado na Netcar."
  );

  return (
    <main className="flex-1 overflow-x-hidden max-w-full">
      <section className="py-12 md:py-16 bg-gradient-to-b from-white to-gray-50/50">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-fg mb-4">Seminovos automáticos em Esteio</h1>
            <p className="text-gray-600 leading-relaxed mb-4">
              Conforto no trânsito, praticidade no dia a dia e melhor revenda. Na Netcar você encontra automáticos e CVT revisados pela Fábrica de Valor.
            </p>
            <Link to="/seminovos" search={automaticSeminovosSearch} className="text-primary font-semibold hover:underline">
              Ver todos os automáticos no showroom
            </Link>
          </motion.div>

          {isLoading ? (
            <p className="text-gray-500">Carregando estoque...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {(vehicles || []).map((vehicle, index) => (
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
                  delay={index}
                />
              ))}
            </div>
          )}

          {!isLoading && (!vehicles || vehicles.length === 0) && (
            <p className="text-gray-500">Nenhum automático disponível no momento. Confira o estoque completo.</p>
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
