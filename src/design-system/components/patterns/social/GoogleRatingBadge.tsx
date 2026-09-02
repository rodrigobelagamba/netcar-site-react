import { Star } from "lucide-react";
import { useGoogleReviewsQuery } from "@/social/queries/useGoogleReviewsQuery";

/**
 * Selo compacto "4,8 no Google · 871 avaliações". Substitui a seção inteira
 * de avaliações na ficha, que ocupava ~5 telas no mobile.
 */
export function GoogleRatingBadge({ className = "" }: { className?: string }) {
  const { data } = useGoogleReviewsQuery();
  const summary = data?.summary;
  if (!summary?.rating || !summary.totalCount) return null;

  const rating = summary.rating.toFixed(1).replace(".", ",");
  const total = summary.totalCount.toLocaleString("pt-BR");
  const label = `${rating} de 5 no Google com ${total} avaliações`;

  const content = (
    <>
      <Star
        className="h-3.5 w-3.5 fill-[#FBBC04] text-[#FBBC04]"
        aria-hidden="true"
      />
      <span className="font-black text-fg">{rating}</span>
      <span>no Google</span>
      <span aria-hidden="true">·</span>
      <span>{total} avaliações</span>
    </>
  );

  const classes = `inline-flex items-center gap-1.5 text-xs font-semibold text-[#365565] ${className}`;

  return summary.placeUrl ? (
    <a
      href={summary.placeUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label}. Abrir no Google Maps`}
      className={`${classes} underline-offset-2 hover:underline`}
    >
      {content}
    </a>
  ) : (
    <span aria-label={label} className={classes}>
      {content}
    </span>
  );
}
