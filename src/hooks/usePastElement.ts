import { useEffect, useState, type RefObject } from "react";

/** true quando o fundo do elemento passa acima do topo (ex.: hero rolado). */
export function usePastElement(
  ref: RefObject<HTMLElement | null>,
  /** px abaixo do topo pra considerar “passou” (header). */
  topOffset = 72,
) {
  const [past, setPast] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const node = ref.current;
      if (!node) return;
      setPast(node.getBoundingClientRect().bottom < topOffset);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(update, { threshold: [0, 0.01, 0.1] });
      observer.observe(el);
    }

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [ref, topOffset]);

  return past;
}
