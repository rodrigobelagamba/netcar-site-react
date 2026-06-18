import { AnimatePresence, motion } from "framer-motion";
import type { GoogleReview } from "@/api/types/social";
import { StarRating } from "./StarRating";

interface ReviewDetailModalProps {
  review: GoogleReview | null;
  googlePlaceUrl?: string;
  isOpen: boolean;
  onClose: () => void;
}

function AuthorAvatar({ review }: { review: GoogleReview }) {
  const initial = review.authorName.charAt(0).toUpperCase();

  if (review.authorPhotoUrl) {
    return (
      <img
        src={review.authorPhotoUrl}
        alt={review.authorName}
        className="w-10 h-10 rounded-full object-cover shrink-0"
      />
    );
  }

  const colors = ["#6cc4ca", "#005b66", "#6cbe9d", "#9c63a6"];
  const colorIndex = review.authorName.charCodeAt(0) % colors.length;

  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
      style={{ backgroundColor: colors[colorIndex] }}
    >
      {initial}
    </div>
  );
}

export function ReviewDetailModal({
  review,
  googlePlaceUrl,
  isOpen,
  onClose,
}: ReviewDetailModalProps) {
  if (!review) return null;

  const externalUrl = review.reviewUrl || googlePlaceUrl;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="review-detail-modal fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`Avaliação de ${review.authorName}`}
        >
          <motion.div
            className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-3 z-10 text-[#6B7280] hover:text-[#111827] p-2"
              aria-label="Fechar avaliação"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="px-6 pt-6 pb-4 text-center border-b border-[#F3F4F6]">
              <StarRating rating={review.rating} color="gold" className="mb-4" />
              <img
                src="/icons/google-g-color.svg"
                alt="Google"
                className="w-9 h-9 mx-auto"
                width={36}
                height={36}
              />
            </div>

            <div className="px-6 py-5">
              <p className="text-sm sm:text-base leading-relaxed text-[#374151] whitespace-pre-line text-center">
                {review.text}
              </p>
            </div>

            <div className="flex items-center gap-3 px-6 py-4 border-t border-[#F3F4F6]">
              <AuthorAvatar review={review} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#111827] truncate">{review.authorName}</p>
                {review.relativeTime && (
                  <p className="text-xs text-[#6B7280]">{review.relativeTime}</p>
                )}
              </div>
            </div>

            {externalUrl && (
              <div className="px-6 pb-6">
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "#0033ff" }}
                >
                  Ver no Google
                </a>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
