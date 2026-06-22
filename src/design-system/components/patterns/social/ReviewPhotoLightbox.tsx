import { AnimatePresence, motion } from "framer-motion";
import type { GoogleReview } from "@/social/types";
import { pickReviewPhotoUrl } from "@/lib/socialMedia";
import { StarRating } from "./StarRating";

interface ReviewPhotoLightboxProps {
  review: GoogleReview | null;
  googlePlaceUrl?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ReviewPhotoLightbox({
  review,
  googlePlaceUrl,
  isOpen,
  onClose,
}: ReviewPhotoLightboxProps) {
  if (!review) return null;

  const imageUrl = pickReviewPhotoUrl(review.photoUrl, review.largePhotoUrl);
  const externalUrl = review.reviewUrl || googlePlaceUrl;

  return (
    <AnimatePresence>
      {isOpen && imageUrl && (
        <motion.div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`Foto da avaliação de ${review.authorName}`}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-10 text-white/90 hover:text-white p-2"
            aria-label="Fechar imagem"
          >
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div
            className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={imageUrl}
              alt={`Foto da avaliação de ${review.authorName}`}
              className="max-h-[80vh] w-auto max-w-full object-contain rounded-lg"
            />

            <div className="mt-4 text-center max-w-lg">
              <StarRating rating={review.rating} color="white" className="mb-2" />
              <p className="text-white font-bold">{review.authorName}</p>
              {review.relativeTime && (
                <p className="text-white/70 text-sm mt-1">{review.relativeTime}</p>
              )}
              {review.text && (
                <p className="text-white/90 text-sm mt-3 leading-relaxed line-clamp-6">{review.text}</p>
              )}
              {externalUrl && (
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-4 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90"
                  style={{ backgroundColor: "#0033ff" }}
                  onClick={(event) => event.stopPropagation()}
                >
                  Ver no Google
                </a>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
