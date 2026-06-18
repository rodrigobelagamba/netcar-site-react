import { useEffect, useRef, useState } from "react";
import { EmbedSocialSection } from "../EmbedSocialSection";
import { NetcarGoogleReviewsSection } from "./NetcarGoogleReviewsSection";
import { NetcarStoriesSection } from "./NetcarStoriesSection";

const useNetcarSocial =
  import.meta.env.VITE_USE_NETCAR_SOCIAL === "true" ||
  import.meta.env.VITE_USE_NETCAR_SOCIAL === undefined;

const qaSideBySide = import.meta.env.VITE_SOCIAL_QA_SIDE_BY_SIDE === "true";

function NetcarSocialContent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px", threshold: 0.01 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={containerRef} className="w-full py-8 sm:py-12 lg:py-16 bg-bg">
      <div className="container-main max-[393px]:px-0 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 space-y-10">
        {isVisible ? (
          <>
            <NetcarGoogleReviewsSection />
            <NetcarStoriesSection />
          </>
        ) : (
          <div className="h-96 rounded-xl bg-gray-50 animate-pulse" aria-hidden />
        )}
      </div>
    </section>
  );
}

export function NetcarSocialSection() {
  if (qaSideBySide) {
    return (
      <>
        <EmbedSocialSection />
        <div className="border-t-4 border-dashed border-primary/40">
          <NetcarSocialContent />
        </div>
      </>
    );
  }

  if (useNetcarSocial) {
    return <NetcarSocialContent />;
  }

  return <EmbedSocialSection />;
}
