import { Suspense, type ReactNode, useEffect, useRef, useState } from "react";

type DeferredRenderProps = {
  children: ReactNode;
  minHeight?: number;
  rootMargin?: string;
  className?: string;
};

/**
 * Adia o conteúdo pesado e mantém a mesma reserva enquanto seu chunk carrega.
 * Os filhos lazy devem usar esta fronteira, não um Suspense com fallback nulo.
 * Depois do carregamento, a altura volta a ser a natural do conteúdo.
 */
export function DeferredRender({
  children,
  minHeight = 320,
  rootMargin = "400px",
  className,
}: DeferredRenderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    if (typeof IntersectionObserver === "undefined") {
      setShouldRender(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShouldRender(true);
        observer.disconnect();
      },
      { rootMargin },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin]);

  const placeholder = <div style={{ minHeight }} aria-hidden="true" />;

  return (
    <div ref={containerRef} className={className}>
      {shouldRender ? (
        <Suspense fallback={placeholder}>{children}</Suspense>
      ) : (
        placeholder
      )}
    </div>
  );
}
