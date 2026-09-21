import { ChevronDown, ExternalLink, MapPin, Star } from "lucide-react";
import { useGoogleReviewsQuery } from "@/social/queries/useGoogleReviewsQuery";
import { GOOGLE_REVIEW_STORES } from "@/social/googlePlaces";

/**
 * Combined rating with separate links to both stores' Google profiles.
 */
export function GoogleRatingBadge({ className = "" }: { className?: string }) {
  const { data } = useGoogleReviewsQuery();
  const summary = data?.summary;
  if (!summary?.rating || !summary.totalCount) return null;

  const rating = summary.rating.toFixed(1).replace(".", ",");
  const total = summary.totalCount.toLocaleString("pt-BR");
  const filledStars = Math.round(summary.rating);
  const label = `${rating} de 5 no Google com ${total} avaliações`;

  const content = (
    <>
      <span className="shrink-0 text-lg font-black leading-none text-[#00283C]">
        {rating}
      </span>
      <span className="flex shrink-0 items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <Star
            key={index}
            className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${
              index < filledStars
                ? "fill-[#FBBC04] text-[#FBBC04]"
                : "fill-[#E5E7EB] text-[#E5E7EB]"
            }`}
          />
        ))}
      </span>
      <span className="min-w-0 text-left text-xs font-semibold leading-snug text-[#365565] sm:text-[13px]">
        {total} avaliações no{" "}
        <span className="font-black text-[#00283C]">Google</span>
      </span>
    </>
  );

  return (
    <details
      className={`group w-full max-w-[370px] text-left ${className}`}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.currentTarget.open = false;
        event.currentTarget.querySelector("summary")?.focus();
      }}
    >
      <summary
        aria-label={`${label}. Ver avaliações das duas lojas`}
        className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-full border border-[#00283C]/10 bg-white px-3 py-2 shadow-sm transition-colors hover:border-[#00283C]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#23747C] [&::-webkit-details-marker]:hidden"
      >
        {content}
        <ChevronDown
          className="h-3.5 w-3.5 shrink-0 text-[#365565] transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <nav
        aria-label="Avaliações das lojas no Google"
        className="mt-2 rounded-2xl border border-[#23747C]/15 bg-white p-3 shadow-sm"
      >
        <p className="mb-2 text-center text-xs font-medium text-[#365565]">
          Conheça as avaliações de cada loja
        </p>
        <div className="space-y-2">
          {GOOGLE_REVIEW_STORES.map((store) => (
            <a
              key={store.id}
              href={store.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Ver avaliações da ${store.name} no Google (nova aba)`}
              className="flex min-h-14 items-center gap-3 rounded-xl bg-[#EFF6F1] px-3 py-2.5 text-[#00283C] transition-colors hover:bg-[#DDEEE5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#23747C]"
            >
              <MapPin className="h-4 w-4 shrink-0 text-[#23747C]" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{store.name}</span>
                <span className="block text-[11px] text-[#365565]">{store.address}</span>
              </span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </a>
          ))}
        </div>
        <p className="mt-2 text-center text-[10px] text-[#365565]">
          O selo reúne as avaliações das duas lojas.
        </p>
      </nav>
    </details>
  );
}
