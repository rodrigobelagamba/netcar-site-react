import { useVehiclesQuery } from "@/api/queries/useVehiclesQuery";
import { ProductList } from "@/design-system/components/patterns/ProductList";
import { Localizacao } from "@/design-system/components/layout/Localizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";
import { useDefaultMetaTags } from "@/hooks/useDefaultMetaTags";
import { HomeHero, HomeHeroVehicle } from "@/design-system/components/patterns/HomeHero";
import { SearchBar } from "@/design-system/components/patterns/SearchBar";
import { ServicesSection } from "@/design-system/components/patterns/ServicesSection";
import { DNASection } from "@/design-system/components/patterns/DNASection";
import { EmbedSocialSection } from "@/design-system/components/patterns/EmbedSocialSection";
import { useMemo } from "react";

const CAR_COVERED_PLACEHOLDER_URL = "/images/semcapa.png";
const PROBLEMATIC_IMAGE_PATTERN = "271_131072IMG_8213";

export function HomePage() {
  const { data: vehicles, isLoading } = useVehiclesQuery();

  useDefaultMetaTags(
    "Home",
    "Netcar - Seminovos com procedência e qualidade. Confira nossos veículos em destaque."
  );

  // Prepara veículos para o HomeHero - filtra PNGs e pega os primeiros 4
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
      .slice(0, 4)
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

  // Filtra veículos que têm imagem PNG e pega apenas os 4 primeiros para a lista
  const vehiclesWithPhotos = vehicles
    ? vehicles.filter(vehicle => {
        // Verifica se tem pelo menos uma imagem PNG
        return vehicle.images?.some(img => 
          img && (img.toLowerCase().endsWith('.png') || img.includes('.png'))
        );
      }).slice(0, 4)
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

      <ServicesSection />

      <DNASection />

      <EmbedSocialSection />

      <div className="w-full font-sans antialiased text-muted-foreground bg-muted py-12 px-4 md:px-8 space-y-8">
        <Localizacao />
        <IanBot />
      </div>
    </main>
  );
}
