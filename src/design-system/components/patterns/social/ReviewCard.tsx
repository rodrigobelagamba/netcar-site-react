import { useEffect, useState } from "react";
import type { GoogleReview } from "@/social/types";
import { photoReviewHeadline, pickReviewPhotoUrl } from "@/lib/socialMedia";
import { ReviewDetailModal } from "./ReviewDetailModal";
import { ReviewPhotoLightbox } from "./ReviewPhotoLightbox";
import { GoogleGIcon } from "./GoogleGIcon";
import { StarRating } from "./StarRating";

interface ReviewCardProps {
  review: GoogleReview;
  googlePlaceUrl?: string;
}

const REVIEW_CARD_HEIGHT = "h-full w-full";

function AuthorAvatar({ review }: { review: GoogleReview }) {
  const initial = review.authorName.charAt(0).toUpperCase();

  if (review.authorPhotoUrl) {
    return (
      <img
        src={review.authorPhotoUrl}
        alt={review.authorName}
        className="w-8 h-8 rounded-full object-cover shrink-0"
        loading="lazy"
        decoding="async"
      />
    );
  }

  const colors = ["#6cc4ca", "#005b66", "#6cbe9d", "#9c63a6"];
  const colorIndex = review.authorName.charCodeAt(0) % colors.length;

  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
      style={{ backgroundColor: colors[colorIndex] }}
    >
      {initial}
    </div>
  );
}

function TextReviewCard({
  review,
  isDark,
  onOpen,
}: {
  review: GoogleReview;
  isDark: boolean;
  onOpen: () => void;
}) {
  const needsTruncate = review.text.length > 160;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className={`flex flex-col ${REVIEW_CARD_HEIGHT} rounded-xl border overflow-hidden cursor-pointer transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        isDark ? "border-[#3a3a3a]" : "border-[#E5E7EB] bg-white"
      }`}
      style={isDark ? { backgroundColor: "#333333" } : undefined}
      aria-label={`Abrir avaliação de ${review.authorName}`}
    >
      <div className="flex flex-1 flex-col px-4 pt-4 pb-2 min-h-0">
        <StarRating rating={review.rating} color={isDark ? "white" : "gold"} className="mb-3 shrink-0" />

        <div className="flex justify-center my-2 shrink-0">
          <GoogleGIcon variant={isDark ? "white" : "color"} className="w-8 h-8" />
        </div>

        <p
          className={`text-sm leading-relaxed text-center line-clamp-4 min-h-[5.5rem] ${
            isDark ? "text-white/95" : "text-[#374151]"
          }`}
        >
          {review.text}
        </p>

        <p
          className={`mt-auto pt-2 text-sm font-medium text-center text-[#6cc4ca] shrink-0 ${
            needsTruncate ? "visible" : "invisible"
          }`}
        >
          Ver mais
        </p>
      </div>

      <div
        className={`flex items-center gap-2 px-4 py-3 border-t shrink-0 ${
          isDark ? "border-[#3a3a3a]" : "border-[#F3F4F6]"
        }`}
      >
        <AuthorAvatar review={review} />
        <div className="min-w-0">
          <p
            className={`text-[13px] font-bold truncate ${
              isDark ? "text-white" : "text-[#111827]"
            }`}
          >
            {review.authorName}
          </p>
          <p className={`text-xs ${isDark ? "text-gray-400" : "text-[#6B7280]"}`}>
            {review.relativeTime}
          </p>
        </div>
      </div>
    </article>
  );
}

function PhotoReviewCard({
  review,
  onOpen,
}: {
  review: GoogleReview;
  onOpen: () => void;
}) {
  const imageSrc = pickReviewPhotoUrl(review.photoUrl, review.largePhotoUrl);
  const headline = photoReviewHeadline(review.text);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full text-left rounded-xl overflow-hidden border border-[#E5E7EB] relative ${REVIEW_CARD_HEIGHT} cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
      aria-label={`Ampliar foto da avaliação de ${review.authorName}`}
    >
      <img
        src={imageSrc}
        alt={`Avaliação de ${review.authorName}`}
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
        decoding="async"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 p-2.5 sm:p-4 flex items-end justify-between gap-2 pointer-events-none">
        <div className="min-w-0 flex items-end gap-2">
          <AuthorAvatar review={review} />
          <div className="min-w-0">
            {headline && (
              <p className="text-white text-xs font-bold uppercase tracking-wide mb-2 line-clamp-2 drop-shadow">
                {headline}
              </p>
            )}
            <StarRating rating={review.rating} color="white" className="justify-start mb-1" />
            <p className="text-white text-sm font-bold truncate">{review.authorName}</p>
          </div>
        </div>
        <GoogleGIcon variant="white" className="w-6 h-6 shrink-0" />
      </div>
    </button>
  );
}

export function ReviewCard({ review, googlePlaceUrl }: ReviewCardProps) {
  const hasReviewPhoto = Boolean(pickReviewPhotoUrl(review.photoUrl, review.largePhotoUrl));
  const isPhoto = review.variant === "photo" && hasReviewPhoto;
  const isDark = !isPhoto && review.variant === "dark" && Boolean(review.pinned);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (!lightboxOpen && !detailOpen) return;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightboxOpen(false);
        setDetailOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [lightboxOpen, detailOpen]);

  if (isPhoto) {
    return (
      <>
        <PhotoReviewCard review={review} onOpen={() => setLightboxOpen(true)} />
        <ReviewPhotoLightbox
          review={review}
          googlePlaceUrl={googlePlaceUrl}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <TextReviewCard
        review={review}
        isDark={isDark}
        onOpen={() => setDetailOpen(true)}
      />
      <ReviewDetailModal
        review={review}
        googlePlaceUrl={googlePlaceUrl}
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </>
  );
}
