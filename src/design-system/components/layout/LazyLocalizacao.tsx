import { lazy, Suspense, useEffect, useRef, useState } from "react";

const Localizacao = lazy(() =>
  import("./Localizacao").then((module) => ({ default: module.Localizacao }))
);

function MapSkeleton() {
  return (
    <section
      className="container-main w-full h-[450px] bg-gray-100 rounded-[32px] animate-pulse border border-gray-200"
      aria-label="Carregando mapa das lojas Netcar"
      role="region"
    />
  );
}

export function LazyLocalizacao() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef}>
      {shouldLoad ? (
        <Suspense fallback={<MapSkeleton />}>
          <Localizacao />
        </Suspense>
      ) : (
        <MapSkeleton />
      )}
    </div>
  );
}
