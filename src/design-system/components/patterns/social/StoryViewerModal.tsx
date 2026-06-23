import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StoryGroup } from "@/social/types";
import {
  findFlatIndex,
  flattenStoryItems,
  type FlatStoryItem,
} from "@/hooks/useStoryViewer";

interface StoryViewerModalProps {
  stories: StoryGroup[];
  initialGroupIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_IMAGE_DURATION_MS = 5000;
const FALLBACK_VIDEO_DURATION_MS = 15000;

export function StoryViewerModal({
  stories,
  initialGroupIndex,
  isOpen,
  onClose,
}: StoryViewerModalProps) {
  const flatItems = useMemo(() => flattenStoryItems(stories), [stories]);
  const [flatIndex, setFlatIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const progressRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const elapsedRef = useRef(0);
  const pausedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  const current: FlatStoryItem | undefined = flatItems[flatIndex];
  const isVideo = current?.item.type === "video";

  const setPausedState = useCallback((value: boolean) => {
    pausedRef.current = value;
    setPaused(value);
  }, []);

  const clearProgress = useCallback(() => {
    if (progressRef.current !== null) {
      window.cancelAnimationFrame(progressRef.current);
      progressRef.current = null;
    }
  }, []);

  const goNext = useCallback(() => {
    setFlatIndex((prev) => {
      if (prev >= flatItems.length - 1) {
        onClose();
        return prev;
      }
      return prev + 1;
    });
  }, [flatItems.length, onClose]);

  const goPrev = useCallback(() => {
    setFlatIndex((prev) => Math.max(0, prev - 1));
  }, []);

  /** Timer por rAF — usado só para imagens (vídeo é guiado pelo próprio elemento) */
  const startImageProgress = useCallback(
    (durationMs: number) => {
      clearProgress();
      elapsedRef.current = 0;
      startedAtRef.current = performance.now();

      const tick = (now: number) => {
        if (pausedRef.current) {
          startedAtRef.current = now - elapsedRef.current;
          progressRef.current = window.requestAnimationFrame(tick);
          return;
        }

        const elapsed = now - startedAtRef.current;
        elapsedRef.current = elapsed;
        const nextProgress = Math.min(elapsed / durationMs, 1);
        setProgress(nextProgress);

        if (nextProgress >= 1) {
          goNext();
          return;
        }

        progressRef.current = window.requestAnimationFrame(tick);
      };

      progressRef.current = window.requestAnimationFrame(tick);
    },
    [clearProgress, goNext]
  );

  useEffect(() => {
    if (!isOpen) return;

    const initialFlatIndex = findFlatIndex(flatItems, initialGroupIndex, 0);
    setFlatIndex(initialFlatIndex >= 0 ? initialFlatIndex : 0);
    setProgress(0);
    setPausedState(false);
    setMuted(false);
  }, [isOpen, initialGroupIndex, flatItems, setPausedState]);

  useEffect(() => {
    if (!isOpen || !current) return;

    document.body.style.overflow = "hidden";
    setProgress(0);

    if (current.item.type === "image") {
      const durationMs = current.item.durationMs ?? DEFAULT_IMAGE_DURATION_MS;
      startImageProgress(durationMs);
    } else {
      clearProgress();
    }

    return () => {
      document.body.style.overflow = "";
      clearProgress();
    };
  }, [isOpen, current, flatIndex, startImageProgress, clearProgress]);

  /** Vídeo: tenta tocar com som; se o navegador bloquear, cai pra mudo */
  useEffect(() => {
    if (!isOpen || !isVideo) return;
    const video = videoRef.current;
    if (!video) return;

    video.muted = muted;

    if (pausedRef.current) {
      video.pause();
      return;
    }

    const attempt = video.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(() => {
        if (!video.muted) {
          video.muted = true;
          setMuted(true);
          video.play().catch(() => undefined);
        }
      });
    }
  }, [isOpen, isVideo, current, muted]);

  /** Segurar (hold) pausa o vídeo; soltar retoma */
  useEffect(() => {
    if (!isVideo) return;
    const video = videoRef.current;
    if (!video) return;

    if (paused) {
      video.pause();
    } else {
      video.play().catch(() => undefined);
    }
  }, [paused, isVideo]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") goNext();
      if (event.key === "ArrowLeft") goPrev();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose, goNext, goPrev]);

  const handlePointerUp = (clientX: number, width: number) => {
    const ratio = clientX / width;
    if (ratio < 0.3) {
      goPrev();
    } else if (ratio > 0.7) {
      goNext();
    }
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartY.current = event.touches[0]?.clientY ?? null;
    touchStartX.current = event.touches[0]?.clientX ?? null;
    setPausedState(true);
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const startY = touchStartY.current;
    const startX = touchStartX.current;
    const endY = event.changedTouches[0]?.clientY;
    const endX = event.changedTouches[0]?.clientX;
    touchStartY.current = null;
    touchStartX.current = null;
    setPausedState(false);

    if (startY !== null && endY !== undefined && endY - startY > 80) {
      onClose();
      return;
    }

    if (startX !== null && endX !== undefined) {
      const bounds = event.currentTarget.getBoundingClientRect();
      handlePointerUp(endX - bounds.left, bounds.width);
    }
  };

  if (!current) return null;

  const segments = current.group.items;
  const segmentProgress = segments.map((_, index) => {
    if (index < current.itemIndex) return 1;
    if (index > current.itemIndex) return 0;
    return progress;
  });

  const mediaUrl = current.item.url;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="story-viewer-modal fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="story-viewer-modal__frame relative h-[min(720px,85vh)] w-auto max-w-[calc(100vw-2rem)] sm:max-w-[360px] aspect-[9/16] rounded-2xl overflow-hidden bg-black shadow-2xl"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            onClick={(event) => event.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseDown={() => setPausedState(true)}
            onMouseUp={() => setPausedState(false)}
          >
            <div className="absolute top-0 left-0 right-0 z-20 px-3 pt-3 pb-2 flex gap-1">
              {segments.map((segment, index) => (
                <div
                  key={segment.id}
                  className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden"
                >
                  <div
                    className="h-full bg-white"
                    style={{ width: `${segmentProgress[index] * 100}%` }}
                  />
                </div>
              ))}
            </div>

            {isVideo && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setMuted((prev) => !prev);
                }}
                className="absolute top-3 right-12 z-30 text-white/90 hover:text-white p-1.5"
                aria-label={muted ? "Ativar som" : "Desativar som"}
              >
                {muted ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9l4 4m0-4l-4 4" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-3 z-30 text-white/90 hover:text-white p-1.5"
              aria-label="Fechar stories"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div
              className="absolute inset-0"
              onClick={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                handlePointerUp(event.clientX - bounds.left, bounds.width);
              }}
            >
              {current.item.type === "video" ? (
                <video
                  key={current.item.id}
                  ref={videoRef}
                  src={mediaUrl}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  onTimeUpdate={(event) => {
                    const video = event.currentTarget;
                    const total = Number.isFinite(video.duration) && video.duration > 0
                      ? video.duration
                      : FALLBACK_VIDEO_DURATION_MS / 1000;
                    setProgress(Math.min(video.currentTime / total, 1));
                  }}
                  onEnded={goNext}
                />
              ) : (
                <img
                  key={current.item.id}
                  src={mediaUrl}
                  alt={current.item.caption ?? current.group.title}
                  className="w-full h-full object-cover"
                />
              )}

              {current.item.caption && (
                <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-12 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
                  <p className="text-white text-sm font-semibold drop-shadow-lg text-center">
                    {current.item.caption}
                  </p>
                  {current.item.link && (
                    <a
                      href={current.item.link.href}
                      className="inline-block mt-2 px-4 py-2 rounded-full bg-white text-black text-sm font-bold pointer-events-auto mx-auto block w-fit"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {current.item.link.label ?? "Saiba mais"}
                    </a>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
