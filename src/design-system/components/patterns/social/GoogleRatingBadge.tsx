import { ExternalLink, Star } from "lucide-react";
import { useGoogleReviewsQuery } from "@/social/queries/useGoogleReviewsQuery";
import { GOOGLE_PRIMARY_PROFILE } from "@/social/googlePlaces";

/**
 * Combined rating preserves its scope; new visits go to the principal profile.
 */
export function GoogleRatingBadge({
  className = "",
  variant = "pill",
}: {
  className?: string;
  variant?: "pill" | "inline";
}) {
  const { data } = useGoogleReviewsQuery();
  const summary = data?.summary;
  if (!summary?.rating || !summary.totalCount) return null;

  const rating = summary.rating.toFixed(1).replace(".", ",");
  const total = summary.totalCount.toLocaleString("pt-BR");
  const filledStars = Math.round(summary.rating);
  const isCombined = summary.scope === "all_locations";
  const label = `${rating} de 5 no Google com ${total} avaliações${isCombined ? " das duas unidades" : " da Netcar"}`;

  if (variant === "inline") {
    return (
      <a
        href={GOOGLE_PRIMARY_PROFILE.url}
        target="_blank"
        rel="noopener noreferrer"
        title={isCombined ? "Total das duas unidades em Esteio/RS" : undefined}
        aria-label={`${label}. Ver perfil da Netcar Multimarcas, ${GOOGLE_PRIMARY_PROFILE.address}`}
        className={`group inline-flex items-center gap-1.5 py-0.5 text-left transition-colors hover:text-[#00283C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#23747C] ${className}`}
      >
        <span className="flex shrink-0 items-center gap-0.5" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <Star
              key={index}
              className={`h-3.5 w-3.5 ${
                index < filledStars
                  ? "fill-[#FBBC04] text-[#FBBC04]"
                  : "fill-[#E5E7EB] text-[#E5E7EB]"
              }`}
            />
          ))}
        </span>
        <span className="text-xs font-extrabold tabular-nums text-[#00283C]">
          {rating}
        </span>
        <span className="text-xs font-medium text-[#526974] group-hover:text-[#00283C]">
          ({total} no <strong className="font-bold text-[#00283C]">Google</strong>)
        </span>
        <ExternalLink
          className="h-3 w-3 shrink-0 text-[#526974] opacity-75 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      </a>
    );
  }

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
        {isCombined && <span className="block text-[10px]">Total das duas unidades</span>}
      </span>
    </>
  );

  return (
    <a
      href={GOOGLE_PRIMARY_PROFILE.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label}. Ver perfil da Netcar Multimarcas, ${GOOGLE_PRIMARY_PROFILE.address}`}
      className={`flex min-h-11 w-full max-w-[370px] items-center justify-center gap-2 rounded-full border border-[#00283C]/10 bg-white px-3 py-2 text-left shadow-sm transition-colors hover:border-[#00283C]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#23747C] ${className}`}
    >
      {content}
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#365565]" aria-hidden="true" />
    </a>
  );
}
