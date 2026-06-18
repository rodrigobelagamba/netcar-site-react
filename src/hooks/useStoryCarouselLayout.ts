import { useEffect, useState } from "react";
import type { EmblaCarouselType } from "embla-carousel";

export interface StoryCarouselLayout {
  gap: number;
  flexBasis: string;
}

function layoutForWidth(viewportWidth: number, storyCount: number): StoryCarouselLayout {
  const count = Math.max(storyCount, 1);
  const gap = viewportWidth >= 992 ? 10 : 20;
  const maxPerView = viewportWidth >= 992 ? 5 : viewportWidth >= 768 ? 3 : 2.15;
  const perView = Math.min(count, maxPerView);
  const gapCount = Math.max(0, Math.ceil(perView) - 1);
  const flexBasis = `calc((100% - ${gapCount * gap}px) / ${perView})`;

  return { gap, flexBasis };
}

export function useStoryCarouselLayout(
  emblaApi: EmblaCarouselType | undefined,
  storyCount: number
): StoryCarouselLayout {
  const [layout, setLayout] = useState<StoryCarouselLayout>(() =>
    layoutForWidth(typeof window !== "undefined" ? window.innerWidth : 1024, storyCount)
  );

  useEffect(() => {
    if (!emblaApi || storyCount === 0) return;

    const viewport = emblaApi.rootNode();
    if (!viewport) return;

    const update = () => {
      const next = layoutForWidth(viewport.clientWidth, storyCount);
      setLayout((prev) => {
        if (prev.gap === next.gap && prev.flexBasis === next.flexBasis) return prev;
        return next;
      });
      emblaApi.reInit();
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);

    return () => observer.disconnect();
  }, [emblaApi, storyCount]);

  return layout;
}
