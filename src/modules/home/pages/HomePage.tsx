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
import { useMemo, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/design-system/components/ui/button";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const CAR_COVERED_PLACEHOLDER_URL = "/images/semcapa.png";
const PROBLEMATIC_IMAGE_PATTERN = "271_131072IMG_8213";

// Skeleton do HomeHero para evitar layout shift
function HomeHeroSkeleton() {
  return (
      <div className="relative w-full bg-[#F6F6F6] overflow-visible min-h-[600px] md:min-h-[90vh] flex flex-col items-center justify-center pt-16 pb-8 md:pt-16 md:pb-8">
      <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 relative z-10 flex flex-col items-center justify-center w-full">
        {/* Brand Label Skeleton */}
        <div className="h-8 md:h-6 mb-1 overflow-visible relative w-full flex justify-center z-20">
          <div className="flex items-center gap-3">
            <div className="h-[1px] w-8 md:w-12 bg-gray-300 animate-pulse" />
            <div className="h-4 w-24 bg-gray-300 rounded animate-pulse" />
            <div className="h-[1px] w-8 md:w-12 bg-gray-300 animate-pulse" />
          </div>
        </div>

        {/* Image Skeleton */}
        <div className="relative w-full container-main flex items-center justify-center mb-2 md:mb-4 min-h-[45vh] md:min-h-[60vh]">
          <div className="w-full h-[45vh] md:h-[60vh] bg-gray-200 rounded-lg animate-pulse" />
        </div>

        {/* Info Bar Skeleton */}
        <div className="relative w-full max-w-5xl h-[300px] md:h-[150px] mx-4 mt-8 md:mt-24 z-20">
          <div className="absolute inset-0 grid grid-cols-1 md:grid-cols-3 w-full bg-white/70 backdrop-blur-2xl rounded-2xl overflow-hidden border border-white/50 shadow-2xl">
            <div className="p-3 md:p-4 lg:p-8 flex flex-col justify-center items-center bg-gray-200 animate-pulse" />
            <div className="p-2 md:p-4 lg:p-8 flex flex-col justify-center items-center border-y md:border-y-0 md:border-x border-gray-200 bg-gray-100 animate-pulse" />
            <div className="p-2 md:p-4 lg:p-8 flex flex-col justify-center items-center bg-gray-100 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  // Busca mais veículos para telas grandes (4xl mostra 5 cards)
  const { data: vehicles, isLoading } = useVehiclesQuery({ limit: 100 });
  const navigate = useNavigate();
  
  // Detecta número de colunas baseado no tamanho da tela
  const [columnsPerRow, setColumnsPerRow] = useState(4);
  
  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width >= 3360) {
        setColumnsPerRow(5); // 4xl
      } else if (width >= 1920) {
        setColumnsPerRow(5); // 3xl e 2xl
      } else if (width >= 1280) {
        setColumnsPerRow(4); // xl
      } else if (width >= 1024) {
        setColumnsPerRow(4); // lg
      } else if (width >= 768) {
        setColumnsPerRow(2); // md
      } else {
        setColumnsPerRow(1); // mobile
      }
    };
    
    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  useDefaultMetaTags(
    "Seminovos em Esteio",
    "Loja de seminovos em Esteio/RS. Carros com garantia, vistoriados e financiamento facilitado. 2 lojas na Av. Presidente Vargas."
  );

  // Prepara veículos para o HomeHero - filtra PNGs, preço > 80000 e ordena aleatoriamente
  const heroVehicles: HomeHeroVehicle[] = useMemo(() => {
    if (!vehicles) return [];

    // Função para embaralhar array (Fisher-Yates shuffle)
    const shuffleArray = <T,>(array: T[]): T[] => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    const filtered = vehicles
      .filter(vehicle => {
        // Filtra apenas carros com preço maior que 80 mil
        const price = typeof vehicle.price === 'number' ? vehicle.price : Number(vehicle.price);
        if (!price || isNaN(price) || price <= 80000) return false;
        
        // Verifica se tem pelo menos uma imagem PNG válida
        const pngImages = vehicle.images?.filter(img => 
          img && (img.toLowerCase().endsWith('.png') || img.includes('.png'))
        ) || [];
        
        if (pngImages.length === 0) return false;
        
        // Verifica se não é a imagem problemática
        const firstPng = pngImages[0];
        const isProblematic = firstPng?.toLowerCase().includes(PROBLEMATIC_IMAGE_PATTERN.toLowerCase());
        
        return !isProblematic;
      });

    // Embaralha aleatoriamente e pega os 4 primeiros
    return shuffleArray(filtered).slice(0, 4)
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

  // Filtra veículos que têm imagem PNG válida, preço > 0 e ordena por ID maior
  const vehiclesWithPhotos = useMemo(() => {
    if (!vehicles) return [];

    const filtered = vehicles
      .filter(vehicle => {
        // Filtra apenas carros com preço maior que zero (carro vendido tem valor = 0)
        const price = typeof vehicle.price === 'number' ? vehicle.price : Number(vehicle.price);
        if (!price || isNaN(price) || price <= 0) return false;
        
        // Verifica se tem imagens válidas
        if (!vehicle.images || vehicle.images.length === 0) return false;
        
        // Filtra apenas imagens PNG válidas (não vazias, não placeholder, não problemática)
        const validPngImages = vehicle.images.filter(img => {
          if (!img || typeof img !== 'string') return false;
          
          const normalizedImg = img.toLowerCase().trim();
          
          // Deve ser PNG
          if (!normalizedImg.includes('.png')) return false;
          
          // Não deve ser placeholder
          if (normalizedImg.includes('semcapa') || normalizedImg.includes('placeholder')) return false;
          
          // Não deve ser a imagem problemática
          if (normalizedImg.includes(PROBLEMATIC_IMAGE_PATTERN.toLowerCase())) return false;
          
          return true;
        });
        
        // Deve ter pelo menos uma imagem PNG válida
        return validPngImages.length > 0;
      })
      .sort((a, b) => {
        // Ordena por ID maior primeiro (mais recentes)
        const idA = parseInt(a.id) || 0;
        const idB = parseInt(b.id) || 0;
        return idB - idA;
      });
    
    // Limita para completar linhas inteiras (múltiplos do número de colunas)
    const rowsToShow = 1; // Mostra 1 linha completa
    const maxVehicles = columnsPerRow * rowsToShow;
    return filtered.slice(0, maxVehicles);
  }, [vehicles, columnsPerRow]);

  // Pré-carrega a primeira imagem do banner para melhorar a experiência
  useEffect(() => {
    if (heroVehicles.length > 0 && heroVehicles[0].image) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = heroVehicles[0].image;
      document.head.appendChild(link);
      
      return () => {
        document.head.removeChild(link);
      };
    }
  }, [heroVehicles]);

  return (
    <main className="flex-1 overflow-x-hidden max-w-full">
      {/* Banner com skeleton durante loading */}
      {isLoading ? (
        <HomeHeroSkeleton />
      ) : heroVehicles.length > 0 ? (
        <HomeHero vehicles={heroVehicles} />
      ) : null}

      {/* SearchBar logo abaixo do banner */}
      <SearchBar />

      {/* Botão Ver Estoque Completo */}
      <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 mt-8 flex justify-center">
        <Button 
          onClick={() => navigate({ 
            to: "/seminovos",
            search: {
              marca: undefined,
              modelo: undefined,
              precoMin: undefined,
              precoMax: undefined,
              anoMin: undefined,
              anoMax: undefined,
              cambio: undefined,
              cor: undefined,
              categoria: undefined,
            }
          })}
          className="group relative overflow-hidden bg-white hover:bg-white text-[#00283C] font-bold py-6 px-10 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center gap-3 active:scale-95"
        >
          <div className="absolute inset-0 bg-[#00283C] translate-y-[102%] group-hover:translate-y-0 transition-transform duration-300 ease-out" />
          <span className="relative z-10 group-hover:text-white transition-colors duration-300 button-text-shimmer">VER ESTOQUE COMPLETO</span>
          <motion.div
            animate={{
              x: [0, 6, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              repeatDelay: 3,
              ease: "easeInOut",
            }}
            className="relative z-10"
          >
            <ArrowRight className="w-5 h-5 group-hover:text-white group-hover:translate-x-1 transition-all duration-300" />
          </motion.div>
        </Button>
      </div>

      <section className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-fg">Destaques</h2>
          <p className="mt-2 text-gray-600 text-lg font-medium">Novidades da semana, olha só o que separamos para você!</p>
        </div>
        <ProductList vehicles={vehiclesWithPhotos} isLoading={isLoading} />
      </section>

      <ServicesSection />

      <DNASection />

      <EmbedSocialSection />

      <div className="w-full font-sans antialiased text-muted-foreground bg-muted py-12 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 space-y-8">
        <div className="container-main space-y-8">
          <Localizacao />
          <IanBot />
        </div>
      </div>
    </main>
  );
}
