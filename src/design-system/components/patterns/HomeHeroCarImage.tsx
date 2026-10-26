import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ImgHTMLAttributes,
  type ReactNode,
} from "react";
import {
  fitHeroImage,
  getAlphaBounds,
  type HeroImageBounds,
  type HeroImageFit,
} from "@/lib/homeHeroImageFraming";

const SAMPLE_EDGE = 128;
const boundsCache = new Map<string, HeroImageBounds>();
const FULL_IMAGE: HeroImageBounds = { x: 0, y: 0, width: 1, height: 1 };

function readBounds(
  image: HTMLImageElement,
  sourceKey: string,
): HeroImageBounds {
  const cached = boundsCache.get(sourceKey);
  if (cached) return cached;
  let bounds = FULL_IMAGE;
  try {
    const ratio = Math.min(
      1,
      SAMPLE_EDGE / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context) {
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      bounds = getAlphaBounds(
        context.getImageData(0, 0, canvas.width, canvas.height).data,
        canvas.width,
        canvas.height,
      );
    }
  } catch {
    // A non-readable external cover still fits safely without inspecting its pixels.
  }
  if (boundsCache.size >= 64)
    boundsCache.delete(boundsCache.keys().next().value!);
  boundsCache.set(sourceKey, bounds);
  return bounds;
}

/** Reuses the loaded image; only a tiny, cached alpha sample determines framing. */
export function HomeHeroCarImage({
  sourceKey,
  overlay,
  onLoad,
  className = "",
  ...imageProps
}: ImgHTMLAttributes<HTMLImageElement> & {
  sourceKey: string;
  overlay?: ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [framing, setFraming] = useState<HeroImageFit | null>(null);

  const updateFraming = useCallback(() => {
    const frame = frameRef.current;
    const image = imageRef.current;
    if (
      !frame ||
      !image?.complete ||
      !image.naturalWidth ||
      !image.naturalHeight
    )
      return;
    const bounds = readBounds(image, sourceKey);
    const height = Math.max(0, frame.clientHeight - 8);
    const width = Math.min(frame.clientWidth, height * 1.4);
    const next = fitHeroImage(
      bounds,
      { width: image.naturalWidth, height: image.naturalHeight },
      { width, height },
    );
    next.left += (frame.clientWidth - width) / 2;
    next.top += (height - bounds.height * next.height) / 2;
    setFraming((previous) =>
      previous &&
      Object.keys(next).every(
        (key) =>
          previous[key as keyof HeroImageFit] ===
          next[key as keyof HeroImageFit],
      )
        ? previous
        : next,
    );
  }, [sourceKey]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    updateFraming();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateFraming);
      return () => window.removeEventListener("resize", updateFraming);
    }
    const observer = new ResizeObserver(updateFraming);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [updateFraming]);

  const bounds = boundsCache.get(sourceKey) || FULL_IMAGE;
  const visibleWidth = framing ? bounds.width * framing.width : 0;
  const overlayStyle: CSSProperties = framing
    ? {
        left: framing.left + bounds.x * framing.width,
        top: framing.top + bounds.y * framing.height,
        width: visibleWidth,
        height: bounds.height * framing.height,
      }
    : { inset: 0 };
  const stampStyle = {
    ...overlayStyle,
    "--home-hero-stamp-size": `${visibleWidth ? Math.min(152, Math.max(40, visibleWidth * 0.22)) : 64}px`,
  } as CSSProperties;

  return (
    <div ref={frameRef} className="home-hero-car-frame relative z-10 shrink-0">
      <img
        {...imageProps}
        ref={imageRef}
        className={`home-hero-car-image absolute max-w-none object-contain ${className}`}
        style={framing || { left: 0, top: 0, width: "100%", height: "100%" }}
        onLoad={(event) => {
          updateFraming();
          onLoad?.(event);
        }}
      />
      {overlay && (
        <div className="pointer-events-none absolute z-20" style={stampStyle}>
          {overlay}
        </div>
      )}
    </div>
  );
}
