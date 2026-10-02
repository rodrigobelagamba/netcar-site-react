import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Pause, Play } from "lucide-react";
import {
  storePhotoSource,
  storePhotoSrcSet,
  type StorePhoto,
} from "../storeGallery";

export function StoreGallery({
  photos,
  name,
}: {
  photos: StorePhoto[];
  name: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [activeSrc, setActiveSrc] = useState(photos[0]?.src);
  const [previousSrc, setPreviousSrc] = useState<string>();
  const [failed, setFailed] = useState<string[]>([]);
  const [ready, setReady] = useState<string[]>([]);
  const [visible, setVisible] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const available = photos.filter((photo) => !failed.includes(photo.src));
  const index = Math.max(
    0,
    available.findIndex((photo) => photo.src === activeSrc),
  );
  const current = available[index];
  const currentSrc = current?.src;
  const previous = available.find(
    (photo) => photo.src === previousSrc && photo.src !== currentSrc,
  );
  const next =
    available.length > 1
      ? available[(index + 1) % available.length]
      : undefined;
  const nextReady = !!next && ready.includes(next.src);
  const nextSrc = next?.src;

  useEffect(() => {
    if (!previousSrc) return;
    const timer = window.setTimeout(() => setPreviousSrc(undefined), 550);
    return () => window.clearTimeout(timer);
  }, [previousSrc]);

  useEffect(() => {
    const node = container.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(preference.matches);
    const updateVisibility = () => setHidden(document.hidden);
    updateMotion();
    updateVisibility();
    preference.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      preference.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (
      !nextSrc ||
      !nextReady ||
      !visible ||
      hidden ||
      reducedMotion ||
      paused ||
      hovered ||
      focused
    )
      return;
    const timer = window.setTimeout(() => {
      setPreviousSrc(currentSrc);
      setActiveSrc(nextSrc);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [
    nextSrc,
    currentSrc,
    nextReady,
    visible,
    hidden,
    reducedMotion,
    paused,
    hovered,
    focused,
  ]);

  return (
    <div
      ref={container}
      role="region"
      aria-label={`Fotos da ${name}`}
      aria-roledescription="carrossel"
      className="relative aspect-video w-full rounded-t-[20px] bg-gray-100"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <div className="absolute inset-0 overflow-hidden rounded-t-[20px]">
        {current ? (
          [
            current,
            ...(next ? [next] : []),
            ...(previous && previous.src !== nextSrc ? [previous] : []),
          ].map((photo) => (
            <img
              key={photo.src}
              src={storePhotoSource(photo.src, 960)}
              srcSet={storePhotoSrcSet(photo.src, [480, 640, 960, 1280])}
              sizes="(min-width: 1024px) 46vw, 94vw"
              alt={photo.src === current.src ? photo.alt : ""}
              aria-hidden={photo.src !== current.src}
              width={960}
              height={540}
              loading={visible ? "eager" : "lazy"}
              decoding="async"
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 motion-reduce:transition-none ${photo.src === current.src ? "opacity-100" : "opacity-0"}`}
              onLoad={() =>
                setReady((sources) =>
                  sources.includes(photo.src)
                    ? sources
                    : [...sources, photo.src],
                )
              }
              onError={() =>
                setFailed((sources) =>
                  sources.includes(photo.src)
                    ? sources
                    : [...sources, photo.src],
                )
              }
            />
          ))
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-slate-500">
            Fotos indisponíveis no momento
          </p>
        )}
      </div>
      {next && (
        <>
          <button
            type="button"
            aria-label={`Mostrar próxima foto da ${name}`}
            disabled={!nextReady}
            onClick={() => {
              setPreviousSrc(currentSrc);
              setActiveSrc(next.src);
            }}
            className="absolute top-3 right-3 z-10 w-24 sm:-top-5 sm:right-4 sm:w-36 overflow-hidden rounded-xl border-[3px] border-white bg-white shadow-lg transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:cursor-wait"
          >
            <img
              src={storePhotoSource(next.src, 320)}
              srcSet={storePhotoSrcSet(next.src, [200, 320])}
              sizes="(max-width: 639px) 96px, 144px"
              alt=""
              width={320}
              height={200}
              loading="lazy"
              decoding="async"
              className="block aspect-[8/5] h-auto w-full object-cover"
              onError={() =>
                setFailed((sources) =>
                  sources.includes(next.src) ? sources : [...sources, next.src],
                )
              }
            />
            <span className="flex items-center justify-between gap-1 px-2 py-1.5 text-[10px] sm:text-xs font-semibold text-fg">
              Próxima foto{" "}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </button>
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <span
              className="rounded-full bg-slate-950/75 px-3 py-1.5 text-xs font-semibold text-white"
              aria-live={focused ? "polite" : "off"}
            >
              {index + 1} / {available.length}
            </span>
            {!reducedMotion && (
              <button
                type="button"
                onClick={() => setPaused((value) => !value)}
                aria-label={`${paused ? "Retomar" : "Pausar"} troca automática de fotos da ${name}`}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950/75 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {paused ? (
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
