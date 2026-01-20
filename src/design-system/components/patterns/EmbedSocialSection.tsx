import { useEffect, useRef } from "react";

declare global {
  interface Window {
    EmbedSocialHashtagScript?: { init?: () => void };
    EmbedSocialStoriesScript?: { init?: () => void };
    EmbedSocialReviewsScript?: { init?: () => void };
  }
}

export function EmbedSocialSection() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadScript = (id: string, src: string) => {
      return new Promise<void>((resolve) => {
        if (document.getElementById(id)) {
          resolve();
          return;
        }
        const script = document.createElement("script");
        script.id = id;
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => resolve();
        document.head.appendChild(script);
      });
    };

    const initWidgets = async () => {
      await Promise.all([
        loadScript("EmbedSocialHashtagScript", "https://embedsocial.com/cdn/ht.js"),
        loadScript("EmbedSocialStoriesScript", "https://embedsocial.com/embedscript/st.js"),
        loadScript("EmbedSocialReviewsScript", "https://embedsocial.com/cdn/rv.js"),
      ]);

      setTimeout(() => {
        if (typeof (window as any).EmbedSocialHashtagWidget !== "undefined") {
          (window as any).EmbedSocialHashtagWidget?.init?.();
        }
        if (typeof (window as any).EmbedSocialStoriesWidget !== "undefined") {
          (window as any).EmbedSocialStoriesWidget?.init?.();
        }
        if (typeof (window as any).EmbedSocialReviewsWidget !== "undefined") {
          (window as any).EmbedSocialReviewsWidget?.init?.();
        }
      }, 500);
    };

    initWidgets();
  }, []);

  return (
    <section ref={containerRef} className="w-full py-8 sm:py-12 lg:py-16 bg-bg">
      <div className="max-w-[1290px] mx-auto px-4 sm:px-6 lg:px-0 space-y-10">
        {/* Google Reviews / Depoimentos */}
        <div
          className="embedsocial-reviews"
          data-ref="811726996bfe08c76a3bd507a02fcebb16fc6ad1"
        />

        {/* Hashtag Feed */}
        <div
          className="embedsocial-hashtag"
          data-ref="811726996bfe08c76a3bd507a02fcebb16fc6ad1"
        />

        {/* Stories */}
        <div
          className="embedsocial-stories"
          data-ref="b86f52e1790e82bd3b547af9c36814370d2526d7"
        />
      </div>
    </section>
  );
}
