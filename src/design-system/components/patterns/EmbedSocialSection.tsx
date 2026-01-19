import { useEffect } from "react";

export function EmbedSocialSection() {
  useEffect(() => {
    // EmbedSocial Hashtag script
    if (!document.getElementById("EmbedSocialHashtagScript")) {
      const script = document.createElement("script");
      script.id = "EmbedSocialHashtagScript";
      script.src = "https://embedsocial.com/cdn/ht.js";
      document.head.appendChild(script);
    }

    // EmbedSocial Stories script
    if (!document.getElementById("EmbedSocialStoriesScript")) {
      const script = document.createElement("script");
      script.id = "EmbedSocialStoriesScript";
      script.src = "https://embedsocial.com/embedscript/st.js";
      document.head.appendChild(script);
    }
  }, []);

  return (
    <section className="w-full py-8 sm:py-12 lg:py-16 bg-bg !border-0" style={{ border: 'none' }}>
      <div className="max-w-[1290px] mx-auto px-4 sm:px-6 lg:px-0 space-y-10 !border-0" style={{ border: 'none' }}>
        {/* Hashtag Feed */}
        <div
          className="embedsocial-hashtag !border-0"
          data-ref="811726996bfe08c76a3bd507a02fcebb16fc6ad1"
          style={{ border: 'none' }}
        />

        {/* Stories */}
        <div
          className="embedsocial-stories !border-0"
          data-ref="b86f52e1790e82bd3b547af9c36814370d2526d7"
          style={{ border: 'none' }}
        />
      </div>
    </section>
  );
}

