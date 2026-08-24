import { useVehiclesQuery } from "@/catalog/queries/useVehiclesQuery";
import { useBannersQuery } from "@/catalog/queries/useSiteQuery";
import { LazyLocalizacao } from "@/design-system/components/layout/LazyLocalizacao";
import { DeferredRender } from "@/design-system/components/layout/DeferredRender";
import { IanBot } from "@/design-system/components/layout/IanBot";
import { useDefaultMetaTags } from "@/hooks/useDefaultMetaTags";
import {
  HomeHero,
  HomeHeroVehicle,
} from "@/design-system/components/patterns/HomeHero";
import { BannerHero } from "@/design-system/components/patterns/BannerHero";
import { HomeWhatsAppConversionPanel } from "../components/HomeWhatsAppConversionPanel";
import { HomeMobileWhatsAppBar } from "../components/HomeMobileWhatsAppBar";
import { lazy, Suspense, useMemo, useEffect, useState, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import {
  pickFeaturedHomeVehicle,
  pickHomeHighlightVehicles,
  sortHomeStockVehicles,
} from "@/lib/homeStock";
import { trackHomeScrollDepth } from "@/lib/analytics";
const CAR_COVERED_PLACEHOLDER_URL = "/images/semcapa.webp";

const ProductList = lazy(() =>
  import("@/design-system/components/patterns/ProductList").then((module) => ({
    default: module.ProductList,
  })),
);
const SearchBar = lazy(() =>
  import("@/design-system/components/patterns/SearchBar").then((module) => ({
    default: module.SearchBar,
  })),
);

const ServicesSection = lazy(() =>
  import("@/design-system/components/patterns/ServicesSection").then(
    (module) => ({
      default: module.ServicesSection,
    }),
  ),
);
const HomePurchaseBenefits = lazy(() =>
  import("../components/HomePurchaseBenefits").then((module) => ({
    default: module.HomePurchaseBenefits,
  })),
);
const HomeSelectionPromise = lazy(() =>
  import("../components/HomeSelectionPromise").then((module) => ({
    default: module.HomeSelectionPromise,
  })),
);
const DNASection = lazy(() =>
  import("@/design-system/components/patterns/DNASection").then((module) => ({
    default: module.DNASection,
  })),
);
const NetcarSocialSection = lazy(() =>
  import("@/design-system/components/patterns/social/NetcarSocialSection").then(
    (module) => ({ default: module.NetcarSocialSection }),
  ),
);

type InitialHomeLcpImage = {
  src: string;
  srcSet?: string;
  sizes?: string;
};

type HomeBootstrapWindow = Window & {
  __NETCAR_HOME_HERO__?: HomeHeroVehicle;
  __NETCAR_HOME_HAS_ACTIVE_BANNER__?: boolean;
  __NETCAR_HOME_LCP_ID__?: string;
};

function readInitialHomeLcpImage(): InitialHomeLcpImage | null {
  if (typeof document === "undefined") return null;

  const preload = document.querySelector<HTMLLinkElement>(
    'link[rel="preload"][as="image"][fetchpriority="high"]',
  );
  if (!preload?.href) return null;

  return {
    src: preload.href,
    srcSet: preload.getAttribute("imagesrcset") || undefined,
    sizes: preload.getAttribute("imagesizes") || "100vw",
  };
}

function readInitialHomeHeroVehicle(): HomeHeroVehicle | null {
  if (typeof window === "undefined") return null;
  const vehicle = (window as HomeBootstrapWindow).__NETCAR_HOME_HERO__;
  if (
    !vehicle ||
    !vehicle.id ||
    !vehicle.brand ||
    !vehicle.model ||
    !vehicle.image ||
    !Number.isFinite(Number(vehicle.year)) ||
    !Number.isFinite(Number(vehicle.price))
  ) {
    return null;
  }

  return {
    ...vehicle,
    id: String(vehicle.id),
    year: Number(vehicle.year),
    price: Number(vehicle.price),
  };
}

function readInitialBannerState(): boolean | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as HomeBootstrapWindow).__NETCAR_HOME_HAS_ACTIVE_BANNER__;
}

function HomeHeroSkeleton() {
  // O PHP já iniciou o download desta imagem no HTML. Mantê-la visível enquanto
  // o estoque carrega evita trocar o LCP por um bloco cinza e pintá-lo novamente
  // apenas depois da consulta à API.
  const initialLcpImage = readInitialHomeLcpImage();

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
          {initialLcpImage ? (
            <img
              src={initialLcpImage.src}
              srcSet={initialLcpImage.srcSet}
              sizes={initialLcpImage.sizes}
              alt="Carro seminovo em destaque"
              width={1280}
              height={960}
              loading="eager"
              decoding="sync"
              fetchPriority="high"
              className="w-full h-auto max-h-[55vh] md:max-h-[75vh] lg:max-h-[80vh] object-contain px-0 scale-[1.4] md:scale-125"
            />
          ) : (
            <div className="w-full h-[45vh] md:h-[60vh] bg-gray-200 rounded-lg animate-pulse" />
          )}
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
  const initialHeroVehicle = useMemo(readInitialHomeHeroVehicle, []);
  const initialBannerState = useMemo(readInitialBannerState, []);

  const hasBanners = Boolean(banners && banners.length > 0);
  const showBanners = hasBanners;
  const showVehiclesHero = !showBanners && !isLoadingBanners;
  const canRenderInitialVehicle =
    initialBannerState === false && initialHeroVehicle !== null;
  const isLoadingHero = isLoadingBanners
    ? !canRenderInitialVehicle
    : showVehiclesHero && isLoadingVehicles && initialHeroVehicle === null;

  const [columnsPerRow, setColumnsPerRow] = useState(4);
  const heroRef = useRef<HTMLDivElement>(null);

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
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  useDefaultMetaTags(
    "Carros Seminovos em Esteio",
    "Veja carros seminovos nas duas lojas integradas da Netcar em Esteio. Consulte fotos, preços, troca, financiamento e i-CHECK quando disponível.",
    { canonicalPath: "/" },
  );

  const featuredVehicle = useMemo(
    () => (vehicles ? pickFeaturedHomeVehicle(vehicles) : undefined),
    [vehicles],
  );

  const heroVehicles: HomeHeroVehicle[] = useMemo(() => {
    if (!vehicles) return [];

    const isPngUrl = (img?: string | null): img is string =>
      !!img && img.toLowerCase().includes(".png");

    const filtered = sortHomeStockVehicles(vehicles).filter((vehicle) => {
      if (featuredVehicle && vehicle.id === featuredVehicle.id) return false;

      const price =
        typeof vehicle.price === "number"
          ? vehicle.price
          : Number(vehicle.price);
      if (!price || isNaN(price) || price <= 80000) return false;

      const temFotos = vehicle.imagens_site?.tem_fotos;
      if (temFotos === 0 || temFotos === undefined || temFotos === null)
        return false;

      if (!isPngUrl(vehicle.imagens_site?.capa)) return false;

      return true;
    });

    const preferredHeroId =
      initialHeroVehicle?.id ||
      (typeof window !== "undefined"
        ? (window as HomeBootstrapWindow).__NETCAR_HOME_LCP_ID__
        : undefined);
    const ordered =
      preferredHeroId &&
      filtered.some((vehicle) => vehicle.id === preferredHeroId)
        ? [
            ...filtered.filter((vehicle) => vehicle.id === preferredHeroId),
            ...filtered.filter((vehicle) => vehicle.id !== preferredHeroId),
          ]
        : filtered;

    return ordered.slice(0, 4).map((vehicle) => {
      const mainImage = vehicle.imagens_site?.capa
        ? vehicle.imagens_site.capa
        : CAR_COVERED_PLACEHOLDER_URL;

      const tagParts = [];
      if (vehicle.combustivel) tagParts.push(vehicle.combustivel);
      if (vehicle.motor) tagParts.push(vehicle.motor);
      const tag = tagParts.join(" ");

      return {
        id: vehicle.id,
        brand: vehicle.marca || vehicle.name?.split(" ")[0] || "",
        model: vehicle.modelo || vehicle.name || "",
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
  }, [vehicles, featuredVehicle, initialHeroVehicle]);

  const displayedHeroVehicles = useMemo(
    () =>
      heroVehicles.length > 0
        ? heroVehicles
        : initialHeroVehicle
          ? [initialHeroVehicle]
          : [],
    [heroVehicles, initialHeroVehicle],
  );

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

  const goToStock = () =>
    navigate({
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
    <main className="flex-1 overflow-x-hidden max-w-full pb-36 md:pb-0">
      <div ref={heroRef}>
        {isLoadingHero ? (
          <HomeHeroSkeleton />
        ) : showBanners ? (
          <BannerHero banners={banners!} />
        ) : displayedHeroVehicles.length > 0 ? (
          <HomeHero vehicles={displayedHeroVehicles} />
        ) : null}
      </div>

      <HomeWhatsAppConversionPanel
        featuredVehicle={featuredVehicle}
        onViewStock={goToStock}
      />

      <DeferredRender minHeight={96} rootMargin="100px">
        <Suspense fallback={null}>
          <SearchBar />
        </Suspense>
      </DeferredRender>

      {/* Estoque sobe na rolagem: prioridade no mobile */}
      <section className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8 md:py-12">
        <div className="mb-6 md:mb-8">
          <h2 className="text-2xl font-bold text-fg md:text-3xl">
            Destaques do estoque
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-medium text-gray-600 md:text-lg">
            <span className="md:hidden">
              Escolha um carro e fale no WhatsApp.
            </span>
            <span className="hidden md:inline">
              Quer trocar de carro? Avaliamos seu usado, mesmo financiado,
              simulamos opções em até 60x e cuidamos da transferência com
              despachante credenciado. A entrada pode ser parcelada no cartão,
              conforme análise.
            </span>
          </p>
        </div>
        <DeferredRender minHeight={900} rootMargin="0px">
          <Suspense fallback={null}>
            <ProductList
              vehicles={vehiclesWithPhotos}
              isLoading={isLoadingVehicles}
              showWhatsAppInterest
            />
          </Suspense>
        </DeferredRender>
        <div className="mt-8 flex justify-center md:mt-10">
          <button
            type="button"
            onClick={goToStock}
            className="inline-flex w-full max-w-md shrink-0 items-center justify-center gap-2.5 rounded-full bg-[#00283C] px-8 py-4 text-base font-black uppercase tracking-wider text-white shadow-[0_12px_32px_rgba(0,40,60,0.28)] transition-all hover:bg-[#00435a] hover:shadow-[0_16px_40px_rgba(0,40,60,0.34)] active:scale-[0.98] sm:w-auto"
          >
            <span className="button-text-shimmer-on-dark">
              Ver estoque completo
            </span>
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      <DeferredRender minHeight={520} rootMargin="300px">
        <Suspense fallback={null}>
          <HomeSelectionPromise />
        </Suspense>
      </DeferredRender>

      <DeferredRender minHeight={480}>
        <Suspense fallback={null}>
          <ServicesSection />
        </Suspense>
      </DeferredRender>

      {/* Desktop only: evita repetir benefícios e DNA longos no mobile */}
      <div className="hidden md:block">
        <DeferredRender minHeight={900}>
          <Suspense fallback={null}>
            <HomePurchaseBenefits />
            <DNASection />
          </Suspense>
        </DeferredRender>
      </div>

      <DeferredRender minHeight={800}>
        <Suspense fallback={null}>
          <NetcarSocialSection />
        </Suspense>
      </DeferredRender>

      <div className="w-full space-y-8 bg-muted px-4 py-8 font-sans text-muted-foreground antialiased sm:px-6 md:py-8 lg:px-8 xl:px-12 2xl:px-16">
        <div className="container-main space-y-8">
          <LazyLocalizacao />
          <div className="hidden md:block">
            <IanBot />
          </div>
        </div>
      </div>

      <HomeMobileWhatsAppBar visible sourceCold="home_sticky_cold" />
    </main>
  );
}
