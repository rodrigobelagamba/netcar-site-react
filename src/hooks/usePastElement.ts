import { useEffect, useState, type RefObject } from "react";

/** true quando o elemento sai do viewport (ex.: hero rolado pra cima). */
export function usePastElement(ref: RefObject<HTMLElement | null>) {
  const [past, setPast] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setPast(!entry.isIntersecting);
      },
      { threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return past;
}
