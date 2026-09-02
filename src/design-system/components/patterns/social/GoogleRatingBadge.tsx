import { Star } from "lucide-react";
import { useGoogleReviewsQuery } from "@/social/queries/useGoogleReviewsQuery";

/**
 * Selo "4,8 ★★★★★ · 871 avaliações no Google". Substitui a seção inteira
 * de avaliações na ficha, que ocupava ~5 telas no mobile.
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
      <span className="text-lg font-black leading-none text-[#00283C]">
        {rating}
      </span>
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <Star
            key={index}
            className={`h-4 w-4 ${
              index < filledStars
                ? "fill-[#FBBC04] text-[#FBBC04]"
                : "fill-[#E5E7EB] text-[#E5E7EB]"
            }`}
          />
        ))}
      </span>
      <span className="text-[13px] font-semibold text-[#365565]">
        {total} avaliações no{" "}
        <span className="font-black text-[#00283C]">Google</span>
      </span>
    </>
  );

  const classes = `inline-flex items-center gap-2 rounded-full border border-[#00283C]/10 bg-white px-3.5 py-2 shadow-sm ${className}`;

  return summary.placeUrl ? (
    <a
      href={summary.placeUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label}. Abrir no Google Maps`}
      className={`${classes} transition-colors hover:border-[#00283C]/30`}
    >
      {content}
    </a>
  ) : (
    <span aria-label={label} className={classes}>
      {content}
    </span>
  );
}
