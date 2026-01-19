import { useVehiclesQuery } from "@/api/queries/useVehiclesQuery";
import { ProductList } from "@/design-system/components/patterns/ProductList";
import { cn } from "@/lib/cn";
import { Localizacao } from "@/design-system/components/layout/Localizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";
import { useDefaultMetaTags } from "@/hooks/useDefaultMetaTags";
import { HomeHero, HomeHeroVehicle } from "@/design-system/components/patterns/HomeHero";
import { SearchBar } from "@/design-system/components/patterns/SearchBar";
import { useMemo } from "react";

const CAR_COVERED_PLACEHOLDER_URL = "/images/semcapa.png";
const PROBLEMATIC_IMAGE_PATTERN = "271_131072IMG_8213";

export function HomePage() {
  const { data: vehicles, isLoading } = useVehiclesQuery();

  useDefaultMetaTags(
    "Home",
    "Netcar - Seminovos com procedência e qualidade. Confira nossos veículos em destaque."
  );

  // Prepara veículos para o HomeHero - filtra PNGs e pega os primeiros 5
  const heroVehicles: HomeHeroVehicle[] = useMemo(() => {
    if (!vehicles) return [];

    return vehicles
      .filter(vehicle => {
        // Verifica se tem pelo menos uma imagem PNG válida
        const pngImages = vehicle.images?.filter(img => 
          img && (img.toLowerCase().endsWith('.png') || img.includes('.png'))
        ) || [];
        
        if (pngImages.length === 0) return false;
        
        // Verifica se não é a imagem problemática
        const firstPng = pngImages[0];
        const isProblematic = firstPng?.toLowerCase().includes(PROBLEMATIC_IMAGE_PATTERN.toLowerCase());
        
        return !isProblematic;
      })
      .slice(0, 5)
      .map(vehicle => {
        const pngImages = vehicle.images?.filter(img => 
          img && (img.toLowerCase().endsWith('.png') || img.includes('.png'))
        ) || [];
        
        const mainImage = pngImages.length > 0 ? pngImages[0] : CAR_COVERED_PLACEHOLDER_URL;
        
        // Monta a tag (combustível + motor se disponível)
        const tagParts = [];
        if (vehicle.combustivel) tagParts.push(vehicle.combustivel);
        if (vehicle.motor) tagParts.push(vehicle.motor);
        const tag = tagParts.join(' ');

        return {
          id: vehicle.id,
          brand: vehicle.marca || vehicle.name?.split(' ')[0] || '',
          model: vehicle.modelo || vehicle.name || '',
          year: vehicle.year,
          price: vehicle.price,
          image: mainImage,
          tag: tag || undefined,
          marca: vehicle.marca,
          modelo: vehicle.modelo,
          placa: vehicle.placa,
          combustivel: vehicle.combustivel,
          cambio: vehicle.cambio,
        };
      });
  }, [vehicles]);

  // Filtra veículos que têm imagem PNG e pega apenas os 5 primeiros para a lista
  const vehiclesWithPhotos = vehicles
    ? vehicles.filter(vehicle => {
        // Verifica se tem pelo menos uma imagem PNG
        return vehicle.images?.some(img => 
          img && (img.toLowerCase().endsWith('.png') || img.includes('.png'))
        );
      }).slice(0, 5)
    : [];

  return (
    <main className="flex-1 overflow-x-hidden max-w-full">
      {heroVehicles.length > 0 && (
        <HomeHero vehicles={heroVehicles} />
      )}

      <SearchBar />

      <section className="container mx-auto px-4 py-12">
        <h2 className="mb-8 text-3xl font-bold text-fg">Destaques</h2>
        <ProductList vehicles={vehiclesWithPhotos} isLoading={isLoading} />
      </section>

      <section className="bg-surface-alt py-12">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold text-fg">
              Receba ofertas exclusivas
            </h2>
            <p className="mb-6 text-muted-foreground">
              Cadastre-se para receber novidades e promoções.
            </p>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                // TODO: Implementar newsletter
              }}
            >
              <input
                type="email"
                placeholder="Seu e-mail"
                className={cn(
                  "flex-1 rounded-md border border-border bg-bg px-4 py-2",
                  "text-fg placeholder:text-muted-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-primary"
                )}
              />
              <button
                type="submit"
                className={cn(
                  "rounded-md bg-primary px-6 py-2 text-primary-foreground",
                  "hover:bg-primary/90 transition-colors"
                )}
              >
                Cadastrar
              </button>
            </form>
          </div>
        </div>
      </section>

      <div className="w-full font-sans antialiased text-muted-foreground bg-muted py-12 px-4 md:px-8 space-y-8">
        <Localizacao />
        <IanBot />
      </div>
    </main>
  );
}
