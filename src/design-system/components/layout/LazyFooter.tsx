import { lazy, Suspense, useEffect, useRef, useState } from "react";

const Footer = lazy(() =>
  import("./Footer").then((module) => ({ default: module.Footer })),
);

function FooterSkeleton() {
  return (
    <div
      className="min-h-[320px] w-full bg-muted"
      aria-label="Carregando informações das lojas"
      role="status"
    />
  );
}

/** Adia consultas, imagens e JavaScript do rodapé até ele se aproximar da tela. */
export function LazyFooter() {
  const ref = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShouldLoad(true);
        observer.disconnect();
      },
      { rootMargin: "500px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ contentVisibility: "auto", containIntrinsicSize: "320px" }}>
      {shouldLoad ? (
        <Suspense fallback={<FooterSkeleton />}>
          <Footer />
        </Suspense>
      ) : (
        <FooterSkeleton />
      )}
    </div>
  );
}
