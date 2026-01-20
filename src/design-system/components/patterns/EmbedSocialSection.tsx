import { useEffect, useRef, useState } from "react";

export function EmbedSocialSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    const forceLoadScripts = () => {
      // Remove scripts existentes para forçar reload
      const existingHt = document.getElementById("EmbedSocialHashtagScript");
      const existingSt = document.getElementById("EmbedSocialStoriesScript");
      const existingRv = document.getElementById("EmbedSocialReviewsScript");
      
      if (existingHt) existingHt.remove();
      if (existingSt) existingSt.remove();
      if (existingRv) existingRv.remove();

      // Carrega scripts novamente
      const htScript = document.createElement("script");
      htScript.id = "EmbedSocialHashtagScript";
      htScript.src = "https://embedsocial.com/cdn/ht.js";
      htScript.async = true;
      document.body.appendChild(htScript);

      const stScript = document.createElement("script");
      stScript.id = "EmbedSocialStoriesScript";
      stScript.src = "https://embedsocial.com/embedscript/st.js";
      stScript.async = true;
      document.body.appendChild(stScript);

      const rvScript = document.createElement("script");
      rvScript.id = "EmbedSocialReviewsScript";
      rvScript.src = "https://embedsocial.com/cdn/rv.js";
      rvScript.async = true;
      document.body.appendChild(rvScript);
    };

    // Força reload dos scripts
    forceLoadScripts();

    // Força re-render do componente após um delay
    const timer = setTimeout(() => {
      setKey(prev => prev + 1);
    }, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <section ref={containerRef} className="w-full py-8 sm:py-12 lg:py-16 bg-bg">
      <div key={key} className="max-w-[1290px] mx-auto px-4 sm:px-6 lg:px-0 space-y-10">
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
