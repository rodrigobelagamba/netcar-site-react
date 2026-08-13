import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Banner } from "@/catalog/endpoints/site";
import { optimizeStockImage, stockImageSrcSet } from "@/lib/images";

interface BannerHeroProps {
  banners: Banner[];
}

const SWIPE_THRESHOLD_PX = 45;

export function BannerHero({ banners }: BannerHeroProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const pointerStart = useRef<{
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);
  const suppressLinkClick = useRef(false);

  useEffect(() => {
    if (banners.length <= 1) return;

    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, [banners.length, currentIndex]);

  useEffect(() => {
    setCurrentIndex((prev) => (prev < banners.length ? prev : 0));
  }, [banners.length]);

  if (!banners || banners.length === 0) {
    return null;
  }

  const currentBanner = banners[currentIndex];
  const bannerLink = currentBanner.link?.trim() || "";
  const isExternalLink = /^https?:\/\//i.test(bannerLink);

  const next = () => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  const prev = () => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) return;
    suppressLinkClick.current = false;
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
    if (
      Math.abs(deltaX) >= SWIPE_THRESHOLD_PX &&
      Math.abs(deltaX) > Math.abs(deltaY)
    ) {
      suppressLinkClick.current = true;
      if (deltaX < 0) next();
      else prev();
    }
  };

  const imageContent = (
    <>
      <img
        src={optimizeStockImage(currentBanner.imagem, 1280)}
        srcSet={stockImageSrcSet(
          currentBanner.imagem,
          [480, 768, 960, 1280, 1920],
        )}
        sizes="100vw"
        alt={currentBanner.titulo || "Banner"}
        width={1920}
        height={823}
        className="w-full h-auto md:h-full object-contain md:object-cover object-center"
        loading={currentIndex === 0 ? "eager" : "lazy"}
        decoding="async"
        {...(currentIndex === 0 && { fetchPriority: "high" })}
      />
      {currentBanner.titulo && (
        <div
          className="absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 px-4 md:px-6 py-1.5 md:py-2 bg-black/50 text-white text-center text-sm md:text-lg font-semibold rounded-lg backdrop-blur-sm"
          style={{ color: "#fff" }}
        >
          {currentBanner.titulo}
        </div>
      )}
    </>
  );

  return (
    <div className="relative w-full bg-[#F6F6F6] overflow-hidden max-w-full pt-16 md:pt-0 z-0">
      {/* Máscara em desktop: altura fixa proporcional (21:9). No mobile a altura acompanha a imagem inteira. */}
      <div
        className="relative aspect-[21/9] w-full touch-pan-y overflow-hidden bg-gray-200"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          pointerStart.current = null;
          suppressLinkClick.current = false;
        }}
      >
        <div
          key={currentBanner.id}
          className="flex items-center justify-center w-full h-full md:absolute md:inset-0"
        >
          {bannerLink ? (
            <a
              href={bannerLink}
              target={isExternalLink ? "_blank" : undefined}
              rel={isExternalLink ? "noopener noreferrer" : undefined}
              onClick={(event) => {
                if (!suppressLinkClick.current) return;
                event.preventDefault();
                suppressLinkClick.current = false;
              }}
              className="block w-full h-full"
            >
              {imageContent}
            </a>
          ) : (
            imageContent
          )}
        </div>
      </div>

      {/* Navigation */}
      <div
        className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 hidden md:flex flex-col items-center gap-4 cursor-pointer z-30"
        onClick={prev}
        onKeyDown={(e) => e.key === "Enter" && prev()}
        role="button"
        tabIndex={0}
        aria-label="Banner anterior"
      >
        <div
          className="w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center bg-white/10 backdrop-blur-md transition-all shadow-xl hover:bg-[#00283C]"
          style={{ border: "1px solid rgba(0, 40, 60, 0.05)" }}
        >
          <ChevronLeft
            className="w-6 h-6 md:w-8 md:h-8"
            style={{ color: "#00283C" }}
          />
        </div>
      </div>

      <div
        className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 hidden md:flex flex-col items-center gap-4 cursor-pointer z-30"
        onClick={next}
        onKeyDown={(e) => e.key === "Enter" && next()}
        role="button"
        tabIndex={0}
        aria-label="Próximo banner"
      >
        <div
          className="w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center bg-white/10 backdrop-blur-md transition-all shadow-xl hover:bg-[#00283C]"
          style={{ border: "1px solid rgba(0, 40, 60, 0.05)" }}
        >
          <ChevronRight
            className="w-6 h-6 md:w-8 md:h-8"
            style={{ color: "#00283C" }}
          />
        </div>
      </div>

      {/* Dots */}
      {banners.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 justify-center z-20">
          {banners.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setCurrentIndex(idx);
              }}
              aria-label={`Ir para banner ${idx + 1}`}
              className={`w-2 h-2 rounded-full transition-all ${
                idx === currentIndex
                  ? "bg-[#00283C] scale-125"
                  : "bg-gray-300 hover:bg-gray-400"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
