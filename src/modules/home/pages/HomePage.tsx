import { useVehiclesQuery } from "@/catalog/queries/useVehiclesQuery";
import { useBannersQuery } from "@/catalog/queries/useSiteQuery";
import { ProductList } from "@/design-system/components/patterns/ProductList";
import { LazyLocalizacao } from "@/design-system/components/layout/LazyLocalizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";
import { useDefaultMetaTags } from "@/hooks/useDefaultMetaTags";
import { HomeHero, HomeHeroVehicle } from "@/design-system/components/patterns/HomeHero";
import { BannerHero } from "@/design-system/components/patterns/BannerHero";
import { SearchBar } from "@/design-system/components/patterns/SearchBar";
import { HomeWhatsAppConversionPanel } from "../components/HomeWhatsAppConversionPanel";
import { HomeMobileWhatsAppBar } from "../components/HomeMobileWhatsAppBar";
import { ServicesSection } from "@/design-system/components/patterns/ServicesSection";
import { DNASection } from "@/design-system/components/patterns/DNASection";
import { NetcarSocialSection } from "@/design-system/components/patterns/social/NetcarSocialSection";
import { useMemo, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import {
  pickFeaturedHomeVehicle,
  pickHomeHighlightVehicles,
} from "@/lib/homeStock";
import { trackHomeScrollDepth } from "@/lib/analytics";

const CAR_COVERED_PLACEHOLDER_URL = "/images/semcapa.png";

function HomeHeroSkeleton() {
  return (
      <div className="relative w-full bg-[#F6F6F6] overflow-visible min-h-[600px] md:min-h-[90vh] flex flex-col items-center justify-center pt-16 pb-8 md:pt-16 md:pb-8">
      <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 relative z-10 flex flex-col items-center justify-center w-full">
        <div className="h-8 md:h-6 mb-1 overflow-visible relative w-full flex justify-center z-20">
          <div className="flex items-center gap-3">
            <div className="h-[1px] w-8 md:w-12 bg-gray-300 animate-pulse" />
            <div className="h-4 w-24 bg-gray-300 rounded animate-pulse" />
            <div className="h-[1px] w-8 md:w-12 bg-gray-300 animate-pulse" />
          </div>
        </div>

        <div className="relative w-full container-main flex items-center justify-center mb-2 md:mb-4 min-h-[45vh] md:min-h-[60vh]">
          <div className="w-full h-[45vh] md:h-[60vh] bg-gray-200 rounded-lg animate-pulse" />
        </div>

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
  const { data: vehicles, isLoading: isLoadingVehicles } = useVehiclesQuery();
  const { data: banners, isLoading: isLoadingBanners } = useBannersQuery();
  const navigate = useNavigate();

  const hasBanners = Boolean(banners && banners.length > 0);
  const showBanners = hasBanners;
  const showVehiclesHero = !showBanners && !isLoadingBanners;
  const isLoadingHero = isLoadingBanners || (showVehiclesHero && isLoadingVehicles);
  
  const [columnsPerRow, setColumnsPerRow] = useState(4);
  
  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width >= 3360) {
        setColumnsPerRow(5);
      } else if (width >= 1920) {
        setColumnsPerRow(5);
      } else if (width >= 1280) {
        setColumnsPerRow(4);
      } else if (width >= 1024) {
        setColumnsPerRow(4);
      } else if (width >= 768) {
        setColumnsPerRow(2);
      } else {
        setColumnsPerRow(1);
      }
    };
    
    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  useDefaultMetaTags(
    "Seminovos em Esteio/RS",
    "Loja de seminovos em Esteio/RS. 2 lojas na Av. Presidente Vargas. Garantia, Fábrica de Valor e Nethelp. Financiamento facilitado."
  );

  const featuredVehicle = useMemo(
    () => (vehicles ? pickFeaturedHomeVehicle(vehicles) : undefined),
    [vehicles],
  );

  const heroVehicles: HomeHeroVehicle[] = useMemo(() => {
    if (!vehicles) return [];

    const shuffleArray = <T,>(array: T[]): T[] => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    const isPngUrl = (img?: string | null): img is string =>
      !!img && img.toLowerCase().includes(".png");

    const filtered = vehicles
      .filter(vehicle => {
        if (featuredVehicle && vehicle.id === featuredVehicle.id) return false;

        const price = typeof vehicle.price === 'number' ? vehicle.price : Number(vehicle.price);
        if (!price || isNaN(price) || price <= 80000) return false;
        
        const temFotos = vehicle.imagens_site?.tem_fotos;
        if (temFotos === 0 || temFotos === undefined) return false;

        if (!isPngUrl(vehicle.imagens_site?.capa)) return false;

        return true;
      });

    return shuffleArray(filtered).slice(0, 4)
      .map(vehicle => {
        const mainImage = vehicle.imagens_site?.capa || CAR_COVERED_PLACEHOLDER_URL;
        
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
          valor_formatado: vehicle.valor_formatado,
          preco_com_troca: vehicle.preco_com_troca,
          preco_com_troca_formatado: vehicle.preco_com_troca_formatado,
          image: mainImage,
          tag: tag || undefined,
          marca: vehicle.marca,
          modelo: vehicle.modelo,
          placa: vehicle.placa,
          combustivel: vehicle.combustivel,
          cambio: vehicle.cambio,
        };
      });
  }, [vehicles, featuredVehicle]);

  const HOME_HIGHLIGHTS_MOBILE = 6;
  const HOME_HIGHLIGHTS_DESKTOP_ROWS = 3;

  const vehiclesWithPhotos = useMemo(() => {
    if (!vehicles) return [];

    const limit =
      columnsPerRow === 1
        ? HOME_HIGHLIGHTS_MOBILE
        : columnsPerRow * HOME_HIGHLIGHTS_DESKTOP_ROWS;

    return pickHomeHighlightVehicles(
      vehicles,
      limit,
      featuredVehicle ? [featuredVehicle.id] : [],
    );
  }, [vehicles, columnsPerRow, featuredVehicle]);

  const featuredVehicleLabel = featuredVehicle
    ? [featuredVehicle.marca, featuredVehicle.modelo, featuredVehicle.year].filter(Boolean).join(" ")
    : undefined;

  const goToStock = () => navigate({
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
    },
  });

  useEffect(() => {
    const url = hasBanners && banners?.[0]?.imagem
      ? banners[0].imagem
      : heroVehicles[0]?.image;
    if (url) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      document.head.appendChild(link);
      return () => {
        document.head.removeChild(link);
      };
    }
  }, [hasBanners, banners, heroVehicles]);

  // GA4: scroll 50% na Home (engajamento)
  useEffect(() => {
    if (typeof window === "undefined") return;
    let fired50 = false;
    const onScroll = () => {
      if (fired50) return;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0 && scrollTop / docHeight >= 0.5) {
        fired50 = true;
        trackHomeScrollDepth(50);
        window.removeEventListener("scroll", onScroll);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main className="flex-1 overflow-x-hidden max-w-full pb-24 md:pb-0">
      {isLoadingHero ? (
        <HomeHeroSkeleton />
      ) : showBanners ? (
        <BannerHero banners={banners!} />
      ) : heroVehicles.length > 0 ? (
        <HomeHero vehicles={heroVehicles} />
      ) : null}

      <HomeWhatsAppConversionPanel
        featuredVehicle={featuredVehicle}
        onViewStock={goToStock}
      />

      <SearchBar />

      <section className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-fg">Destaques do estoque</h2>
          <p className="mt-2 max-w-2xl text-gray-600 text-base md:text-lg font-medium">
            Troca aceita, financiamento facilitado e atendimento 24h no WhatsApp.
          </p>
        </div>
        <ProductList
          vehicles={vehiclesWithPhotos}
          isLoading={isLoadingVehicles}
          showWhatsAppInterest
        />
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={goToStock}
            className="inline-flex w-full max-w-md shrink-0 items-center justify-center gap-2.5 rounded-full bg-[#00283C] px-8 py-4 text-base font-black uppercase tracking-wider text-white shadow-[0_12px_32px_rgba(0,40,60,0.28)] transition-all hover:bg-[#00435a] hover:shadow-[0_16px_40px_rgba(0,40,60,0.34)] active:scale-[0.98] sm:w-auto"
          >
            Ver todos no estoque
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      <ServicesSection />

      <DNASection />

      <NetcarSocialSection />

      <div className="w-full font-sans antialiased text-muted-foreground bg-muted py-12 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 space-y-8">
        <div className="container-main space-y-8">
          <LazyLocalizacao />
          <IanBot />
        </div>
      </div>

      <HomeMobileWhatsAppBar vehicleLabel={featuredVehicleLabel} />
    </main>
  );
}
