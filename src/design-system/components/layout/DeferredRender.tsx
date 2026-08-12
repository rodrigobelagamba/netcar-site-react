import { type ReactNode, useEffect, useRef, useState } from "react";

type DeferredRenderProps = {
  children: ReactNode;
  minHeight?: number;
  rootMargin?: string;
  className?: string;
};

/**
 * Mantém conteúdo pesado fora do primeiro render e reserva o espaço necessário
 * para que a entrada da seção não desloque o restante da página.
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

  return (
    <div
      ref={containerRef}
      className={className}
      style={shouldRender ? undefined : { minHeight }}
    >
      {shouldRender ? children : null}
    </div>
  );
}
