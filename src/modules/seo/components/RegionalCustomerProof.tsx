import { ArrowUpRight, MapPin } from "lucide-react";
import { ReviewCard } from "@/design-system/components/patterns/social/ReviewCard";
import { getRegionalCustomerStories, type RegionalCustomerStory } from "@/lib/regionalCustomerProof";

function publicationDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: /^\d{4}-\d{2}-\d{2}$/.test(value) ? "UTC" : "America/Sao_Paulo",
      }).format(date)
    : null;
}

function DeliveryTestimonialCard({ story }: { story: RegionalCustomerStory }) {
  const date = publicationDate(story.publishedAt);
  const hasText = story.text.trim().length > 0;
  const longText = hasText && story.text.length > 240;

  return (
    <article className={`flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white ${hasText ? "min-h-[300px]" : ""}`}>
      {story.photoUrl && (
        <img
          src={story.photoUrl}
          alt="Foto publicada no álbum da Netcar"
          className="aspect-[16/9] w-full bg-[#F3F5F6] object-contain"
          loading="lazy"
          decoding="async"
        />
      )}
      <div className="flex flex-1 flex-col p-5">
        {hasText && <p className="mb-3 text-xs font-semibold text-[#007A83]">Álbum da Netcar</p>}
        {longText ? (
          <details className="group text-sm leading-relaxed text-[#374151]">
            <summary className="cursor-pointer list-none rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007A83] [&::-webkit-details-marker]:hidden">
              <span className="line-clamp-4 break-words whitespace-pre-line group-open:hidden">{story.text}</span>
              <span className="mt-2 block min-h-11 content-center font-semibold text-[#007A83] underline underline-offset-4">
                <span className="group-open:hidden">Ler depoimento completo</span>
                <span className="hidden group-open:inline">Recolher depoimento</span>
              </span>
            </summary>
            <blockquote className="break-words whitespace-pre-line">{story.text}</blockquote>
          </details>
        ) : hasText ? (
          <blockquote className="break-words whitespace-pre-line text-sm leading-relaxed text-[#374151]">{story.text}</blockquote>
        ) : null}
        <footer className={hasText ? "mt-auto border-t border-[#F3F4F6] pt-4" : ""}>
          <p className={`break-words text-sm font-bold text-[#00283C] ${hasText ? "mt-4" : ""}`}>{story.displayName}</p>
          {date && <time dateTime={story.publishedAt} className="mt-1 block text-xs text-gray-500">Registro de {date}</time>}
        </footer>
      </div>
    </article>
  );
}

/** A city is shown only after matching a published story to a confirmed customer. */
export function RegionalCustomerProof({
  citySlug,
  cityName,
}: {
  citySlug: string;
  cityName: string;
}) {
  const stories = getRegionalCustomerStories(citySlug);
  if (stories.length === 0) return null;
  const hasAlbum = stories.some((story) => story.sourceType === "delivery_testimonial");
  const hasGoogle = stories.some((story) => story.sourceType !== "delivery_testimonial");
  const albumHasText = stories.some((story) => story.sourceType === "delivery_testimonial" && story.text.trim().length > 0);
  const title = hasAlbum && !albumHasText
    ? hasGoogle
      ? `Clientes de ${cityName} na Netcar`
      : `Clientes de ${cityName} no álbum da Netcar`
    : `Clientes de ${cityName} contam como foi`;
  const subtitle = hasAlbum
    ? hasGoogle
      ? albumHasText
        ? "Avaliações publicadas no Google e depoimentos do álbum de clientes da Netcar."
        : "Avaliações publicadas no Google e fotos do álbum de entregas da Netcar."
      : albumHasText
        ? "Depoimentos do álbum de clientes da Netcar, com a data original de cada registro."
        : "Fotos do nosso álbum de entregas."
    : "Comentários que nossos clientes publicaram no Google sobre a experiência com a Netcar.";

  const grid =
    stories.length === 1
      ? "max-w-lg"
      : stories.length === 2
        ? "md:grid-cols-2"
        : "md:grid-cols-3";

  return (
    <section className="pb-12" aria-labelledby="regional-customer-proof-title">
      <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        <div className="rounded-3xl border border-[#007A83]/15 bg-[#EFF6F3] p-5 sm:p-8">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#007A83]">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            Clientes Netcar
          </p>
          <h2
            id="regional-customer-proof-title"
            className="text-2xl font-bold text-[#00283C] sm:text-3xl"
          >
            {title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-600 sm:text-base">
            {subtitle}
          </p>
          <div className={`mt-6 grid gap-5 ${grid}`}>
            {stories.map((story) => (
              <div key={story.id} className="min-w-0">
                {story.sourceType === "delivery_testimonial" ? (
                  <DeliveryTestimonialCard story={story} />
                ) : (
                  <div className="h-[300px] min-w-0">
                  <ReviewCard
                    review={{
                      id: story.id,
                      authorName: story.displayName,
                      text: story.text,
                      rating: story.rating,
                      publishedAt: story.publishedAt,
                      relativeTime: publicationDate(story.publishedAt) || "",
                      reviewUrl: story.sourceUrl,
                      photoUrl: story.photoUrl,
                      variant: story.photoUrl ? "photo" : "text",
                    }}
                    googlePlaceUrl={story.sourceUrl}
                  />
                  </div>
                )}
                <a
                  href={story.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-[#007A83] underline underline-offset-4"
                >
                  {story.sourceLabel}{" "}
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
