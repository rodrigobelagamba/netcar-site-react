import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/design-system/components/ui/button";
import { useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import { prefetchVehicleDetails } from "@/catalog/queries/useVehicleQuery";
import { formatPrice, formatYear } from "@/lib/formatters";
import { generateVehicleSlug } from "@/lib/slug";
import {
  buildWhatsAppUrl,
  DEFAULT_SALES_WHATSAPP,
  homeWhatsAppMessages,
} from "@/lib/whatsappMessages";
import { optimizeStockImage, stockImageSrcSet } from "@/lib/images";
import { SHOW_CAMPAIGN_STAMP } from "@/config/features";
import { VehicleWarrantySummary } from "./VehicleWarrantySummary";
import type { Vehicle } from "@/catalog/endpoints/vehicles";
import { HERO_PHOTO_FADE_MS, useHomeHeroCarousel } from "./useHomeHeroCarousel";
import { HomeHeroCarImage } from "./HomeHeroCarImage";
import "./HomeHero.css";

const CAR_COVERED_PLACEHOLDER_URL = "/images/semcapa.webp";
const SWIPE_THRESHOLD_PX = 45;
const TAP_THRESHOLD_PX = 10;

export interface HomeHeroVehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  km?: number;
  tem_fotos?: number;
  price: number;
  valor_formatado?: string;
  preco_com_troca?: number;
  preco_com_troca_formatado?: string;
  image: string;
  tag?: string;
  marca?: string;
  modelo?: string;
  placa?: string;
  combustivel?: string;
  cambio?: string;
  proofLabel?: string;
  /** Preserve current catalog evidence instead of hero presentation fallbacks. */
  warrantyVehicle?: Vehicle;
}

interface HomeHeroProps {
  vehicles: HomeHeroVehicle[];
}

export function HomeHero({ vehicles }: HomeHeroProps) {
  const {
    active: vehicle,
    slides,
    hasSwitched,
    step,
    ready,
    failed,
  } = useHomeHeroCarousel(vehicles);
  const pointerStart = useRef<{
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: whatsapp } = useWhatsAppQuery();

  if (!vehicle) {
    return null;
  }

  const next = () => step(1);
  const prev = () => step(-1);

  const vehicleSlug = generateVehicleSlug({
    modelo: vehicle.modelo || vehicle.model,
    marca: vehicle.marca || vehicle.brand,
    year: vehicle.year,
    placa: vehicle.placa,
    id: vehicle.id,
  });

  const preloadDetails = () => {
    void import("@/modules/detalhes/pages/DetalhesPage");
    void prefetchVehicleDetails(queryClient, vehicleSlug);
  };

  const handleViewDetails = () => {
    preloadDetails();
    navigate({ to: `/veiculo/${vehicleSlug}` });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) return;
    pointerStart.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || start.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const horizontalDistance = Math.abs(deltaX);
    const verticalDistance = Math.abs(deltaY);

    if (
      horizontalDistance >= SWIPE_THRESHOLD_PX &&
      horizontalDistance > verticalDistance
    ) {
      if (deltaX < 0) next();
      else prev();
      return;
    }

    if (
      horizontalDistance < TAP_THRESHOLD_PX &&
      verticalDistance < TAP_THRESHOLD_PX
    ) {
      handleViewDetails();
    }
  };

  const heroVehicleLabel = [
    vehicle.marca || vehicle.brand,
    vehicle.modelo || vehicle.model,
    vehicle.year,
  ]
    .filter(Boolean)
    .join(" ");
  const heroWhatsAppHref = heroVehicleLabel
    ? buildWhatsAppUrl(
        whatsapp?.numero || DEFAULT_SALES_WHATSAPP,
        homeWhatsAppMessages({
          vehicleLabel: heroVehicleLabel,
        }).vehicleInterest,
      )
    : undefined;

  const sanitizeFormattedPrice = (formatted?: string) =>
    formatted ? formatted.replace(/<[^>]*>/g, "") : "";
  const priceFormatted =
    sanitizeFormattedPrice(vehicle.valor_formatado) ||
    formatPrice(vehicle.price);
  const tradePriceValue =
    typeof vehicle.preco_com_troca === "number" &&
    Number.isFinite(vehicle.preco_com_troca)
      ? vehicle.preco_com_troca
      : undefined;
  const showPriceComparison =
    SHOW_CAMPAIGN_STAMP &&
    tradePriceValue !== undefined &&
    tradePriceValue > vehicle.price;
  const previousPriceFormatted = showPriceComparison
    ? sanitizeFormattedPrice(vehicle.preco_com_troca_formatado) ||
      formatPrice(tradePriceValue!)
    : "";
  const yearFormatted = formatYear(vehicle.year);
  const tag = vehicle.tag || vehicle.combustivel || "";

  // Extrai apenas o primeiro nome do modelo para o texto de fundo (ex: "COMPASS" ao invés de "COMPASS LIMITED")
  const primeiroNomeModelo = vehicle.model
    ? vehicle.model.trim().split(/\s+/)[0].toUpperCase()
    : "";

  return (
    <div className="home-hero-stage relative w-full bg-[#F6F6F6] overflow-hidden max-w-full flex flex-col items-center justify-center">
      <div
        aria-hidden="true"
        className="home-hero-spotlight pointer-events-none absolute inset-0"
      />
      {/* Background Typography */}
      <div
        key={vehicle.id}
        className="home-hero-background-type absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
        style={{ opacity: 0.14 }}
      >
        <div
          aria-hidden="true"
          className="home-hero-word-enter text-[25vw] md:text-[32vw] font-black tracking-tighter whitespace-nowrap leading-none text-center overflow-hidden max-w-full w-full"
          style={{ color: "#00283C" }}
        >
          {primeiroNomeModelo}
        </div>
      </div>

      <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 relative z-10 flex h-full min-h-0 flex-col items-center w-full">
        {/* Brand Label */}
        <div className="h-8 md:h-6 mb-1 shrink-0 overflow-visible relative w-full flex justify-center z-20">
          <div key={`${vehicle.id}-brand`} className="flex items-center gap-3">
            <div
              className="h-[1px] w-8 md:w-12"
              style={{ backgroundColor: "rgba(0, 40, 60, 0.2)" }}
            />
            <span
              className="text-[14px] md:text-[16px] font-bold uppercase tracking-[0.5em] whitespace-nowrap"
              style={{ color: "#00283C" }}
            >
              {vehicle.brand}
            </span>
            <div
              className="h-[1px] w-8 md:w-12"
              style={{ backgroundColor: "rgba(0, 40, 60, 0.2)" }}
            />
          </div>
        </div>

        <div className="relative w-full container-main flex flex-1 min-h-0 items-center justify-center">
          {/* Main Car Image - MAXIMIZED SIZE */}
          <div
            className="absolute inset-0 flex touch-pan-y items-center justify-center cursor-grab active:cursor-grabbing"
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") preloadDetails();
            }}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => {
              pointerStart.current = null;
            }}
            aria-label="Arraste para trocar o veículo ou toque para ver os detalhes"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 bottom-0 h-10 w-[78%] -translate-x-1/2 rounded-[50%] md:h-14 md:w-[68%]"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0.08) 44%, rgba(0, 0, 0, 0) 74%)",
              }}
            />
            {slides.map(({ vehicle: photo, state, request }) => (
              <div
                key={photo.id}
                data-home-hero-photo={state}
                aria-hidden={state !== "active"}
                className="home-hero-photo pointer-events-none absolute inset-0 flex items-center justify-center"
                style={{ transitionDuration: `${HERO_PHOTO_FADE_MS}ms` }}
              >
                <HomeHeroCarImage
                  sourceKey={photo.image || CAR_COVERED_PLACEHOLDER_URL}
                  overlay={
                    <VehicleWarrantySummary
                      showNote={false}
                      vehicle={
                        photo.warrantyVehicle?.id === photo.id
                          ? photo.warrantyVehicle
                          : undefined
                      }
                      className="home-hero-warranty"
                    />
                  }
                  src={optimizeStockImage(
                    photo.image || CAR_COVERED_PLACEHOLDER_URL,
                    960,
                  )}
                  srcSet={stockImageSrcSet(
                    photo.image,
                    [480, 640, 768, 960, 1280],
                  )}
                  sizes="(max-width: 767px) 50vw, 70vw"
                  alt={state === "active" ? photo.model : ""}
                  width={1280}
                  height={960}
                  loading="eager"
                  decoding={
                    !hasSwitched && state === "active" ? "sync" : "async"
                  }
                  {...(!hasSwitched &&
                    state === "active" && { fetchPriority: "high" as const })}
                  onLoad={
                    state === "pending"
                      ? async (event) => {
                          const image = event.currentTarget;
                          try {
                            await image.decode();
                            // Let a cached photo paint at opacity 0 before fading it in.
                            window.requestAnimationFrame(() => {
                              window.requestAnimationFrame(() => {
                                if (request !== undefined) ready(request);
                              });
                            });
                          } catch {
                            if (request !== undefined) failed(request);
                          }
                        }
                      : undefined
                  }
                  onError={
                    state === "pending" && request !== undefined
                      ? () => failed(request)
                      : undefined
                  }
                  draggable={false}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Info Bar */}
        <div className="home-hero-info relative w-full max-w-5xl h-32 md:h-24 shrink-0 mt-1 md:mt-2 z-20">
          <div
            key={`${vehicle.id}-info`}
            className="absolute inset-0 grid grid-cols-2 grid-rows-2 md:grid-cols-3 md:grid-rows-1 w-full bg-white/70 backdrop-blur-2xl rounded-2xl overflow-hidden border border-white/50 shadow-lg"
          >
            <div
              className="col-span-2 md:col-span-1 px-3 py-2 md:px-4 flex justify-between items-center gap-2 md:flex-col md:justify-center md:gap-0 lg:flex-row lg:justify-between lg:gap-2 text-white h-full"
              style={{ backgroundColor: "#00283C" }}
            >
              <div className="min-w-0 max-w-full md:text-center lg:text-left">
                <span className="block truncate text-[8px] md:text-[9px] leading-tight uppercase tracking-widest opacity-60 mb-0.5 font-bold">
                  {vehicle.model}
                </span>
                <div className="flex items-center gap-1.5 flex-wrap md:justify-center lg:justify-start">
                  <span className="text-sm lg:text-base font-bold whitespace-nowrap">
                    {yearFormatted}
                  </span>
                  {tag && (
                    <>
                      <span
                        className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: "#5CD29D" }}
                      />
                      <span className="text-sm lg:text-base font-bold text-gray-400 whitespace-nowrap">
                        {tag}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                {showPriceComparison ? (
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] leading-tight font-semibold text-gray-300">
                      De:{" "}
                      <span className="line-through">
                        {previousPriceFormatted}
                      </span>
                    </span>
                    <span className="text-[9px] font-semibold uppercase text-gray-400 leading-none">
                      Para:
                    </span>
                    <span
                      className="text-xl lg:text-2xl leading-tight font-black whitespace-nowrap"
                      style={{ color: "#5CD29D" }}
                    >
                      {priceFormatted}
                    </span>
                  </div>
                ) : (
                  <span
                    className="text-xl lg:text-2xl leading-tight font-black whitespace-nowrap"
                    style={{ color: "#5CD29D" }}
                  >
                    {priceFormatted}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              className="p-2 flex min-h-11 justify-center items-center gap-2 border-r md:border-x border-black/5 hover:bg-white/40 transition-colors cursor-pointer group h-full"
              onClick={handleViewDetails}
            >
              <Maximize2
                className="w-4 h-4 md:w-5 md:h-5 transition-colors group-hover:text-secondary"
                style={{ color: "#00283C" }}
              />
              <span
                className="text-[9px] md:text-[10px] lg:text-[11px] font-bold uppercase tracking-widest text-center transition-colors group-hover:text-primary"
                style={{ color: "#365565" }}
              >
                Ver Fotos
              </span>
            </button>

            <div className="p-1 md:p-2 flex flex-col justify-center items-center hover:bg-white/40 transition-colors group h-full">
              <div className="flex items-center gap-1.5 mb-0.5 justify-center">
                <div
                  className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full flex items-center justify-center shrink-0"
                  style={{ border: "2px solid #5CD29D" }}
                >
                  <div
                    className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full"
                    style={{ backgroundColor: "#5CD29D" }}
                  />
                </div>
                <span
                  className="text-[8px] leading-[10px] md:text-[9px] font-bold uppercase tracking-wider whitespace-nowrap"
                  style={{ color: "#0B6B4B" }}
                >
                  {vehicle.proofLabel || "Critérios Netcar"}
                </span>
              </div>
              {heroWhatsAppHref ? (
                <a
                  href={heroWhatsAppHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-wa-source="home_hero"
                  data-wa-intent="vehicle_interest"
                  data-wa-vehicle-id={vehicle.id}
                  data-wa-vehicle-name={heroVehicleLabel}
                  className="inline-flex min-h-11 w-full justify-center items-center gap-1 font-black text-xs md:text-sm whitespace-nowrap text-[#087A37] hover:text-[#075E54]"
                >
                  <MessageCircle className="h-4 w-4" />
                  TENHO INTERESSE
                </a>
              ) : (
                <Button
                  variant="ghost"
                  className="font-black hover:text-secondary p-0 h-11 w-full text-xs md:text-sm whitespace-nowrap"
                  style={{ color: "#00283C" }}
                  onClick={handleViewDetails}
                >
                  QUERO ESTE CARRO
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Navigation - Hidden on Mobile */}
        <div
          className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 hidden md:flex flex-col items-center gap-4 group cursor-pointer z-30"
          onClick={prev}
        >
          <div
            className="w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center bg-white/10 backdrop-blur-md transition-all shadow-xl"
            style={{ border: "1px solid rgba(0, 40, 60, 0.05)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#00283C";
              const icon = e.currentTarget.querySelector("svg");
              if (icon) icon.style.color = "white";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                "rgba(255, 255, 255, 0.1)";
              const icon = e.currentTarget.querySelector("svg");
              if (icon) icon.style.color = "#00283C";
            }}
          >
            <ChevronLeft
              className="w-6 h-6 md:w-8 md:h-8 transition-colors"
              style={{ color: "#00283C" }}
            />
          </div>
        </div>

        <div
          className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 hidden md:flex flex-col items-center gap-4 group cursor-pointer z-30"
          onClick={next}
        >
          <div
            className="w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center bg-white/10 backdrop-blur-md transition-all shadow-xl"
            style={{ border: "1px solid rgba(0, 40, 60, 0.05)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#00283C";
              const icon = e.currentTarget.querySelector("svg");
              if (icon) icon.style.color = "white";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                "rgba(255, 255, 255, 0.1)";
              const icon = e.currentTarget.querySelector("svg");
              if (icon) icon.style.color = "#00283C";
            }}
          >
            <ChevronRight
              className="w-6 h-6 md:w-8 md:h-8 transition-colors"
              style={{ color: "#00283C" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
