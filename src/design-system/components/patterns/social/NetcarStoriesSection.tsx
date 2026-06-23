import { useCallback, useEffect, useRef, useState } from "react";
import { useStoriesQuery } from "@/social/queries/useStoriesQuery";
import { useEmbla } from "@/hooks/useEmbla";
import { useStoryCarouselLayout } from "@/hooks/useStoryCarouselLayout";
import logoNetcar from "@/assets/images/logo-netcar.png";
import { StoryPreviewCard } from "./StoryPreviewCard";
import { StoryViewerModal } from "./StoryViewerModal";

/** Limite de stories visíveis — mostra os mais recentes (igual EmbedSocial) */
const MAX_VISIBLE_STORIES = 10;

function StoriesSkeleton({ flexBasis, gap }: { flexBasis: string; gap: number }) {
  return (
    <div className="flex overflow-hidden" style={{ gap }}>
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="shrink-0 min-w-0 rounded-[10px] bg-gray-100 animate-pulse border border-[#d6dae4] social-story-card__media"
          style={{ flex: `0 0 ${flexBasis}` }}
        />
      ))}
    </div>
  );
}

export function NetcarStoriesSection() {
  const { data, isLoading, isError } = useStoriesQuery();
  const { emblaRef, emblaApi } = useEmbla({
    align: "start",
    containScroll: "trimSnaps",
    dragFree: false,
    slidesToScroll: 1,
  });
  const visibleStories = (data?.stories ?? []).slice(-MAX_VISIBLE_STORIES);
  const storyCount = visibleStories.length || 4;
  const carouselLayout = useStoryCarouselLayout(emblaApi, storyCount);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
  const dragMovedRef = useRef(false);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;

    const onPointerDown = () => {
      dragMovedRef.current = false;
    };
    const onScroll = () => {
      dragMovedRef.current = true;
    };

    emblaApi.on("pointerDown", onPointerDown);
    emblaApi.on("scroll", onScroll);

    return () => {
      emblaApi.off("pointerDown", onPointerDown);
      emblaApi.off("scroll", onScroll);
    };
  }, [emblaApi]);

  const openViewer = (groupIndex: number) => {
    setSelectedGroupIndex(groupIndex);
    setViewerOpen(true);
  };

  const handleStoryTap = useCallback((groupIndex: number) => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    openViewer(groupIndex);
  }, []);

  if (isLoading) {
    return (
      <div>
        <div className="h-12 rounded-lg bg-gray-100 animate-pulse mb-6" />
        <StoriesSkeleton flexBasis={carouselLayout.flexBasis} gap={carouselLayout.gap} />
      </div>
    );
  }

  if (isError || !data?.success || data.stories.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-[#6B7280] mb-4">Stories indisponíveis no momento.</p>
        <a
          href="https://www.instagram.com/netcar_rc"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium hover:underline text-[#6cc4ca]"
        >
          Seguir @netcar_rc no Instagram
        </a>
      </div>
    );
  }

  const { profile } = data;
  const stories = visibleStories;
  const avatar = profile.avatarUrl || logoNetcar;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-[30px] pb-[15px] border-b border-[#d6dae4]">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <img
            src={avatar}
            alt={profile.displayName}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border border-[#d6dae4] shrink-0"
            onError={(event) => {
              event.currentTarget.src = logoNetcar;
            }}
          />
          <p className="font-bold text-lg text-[#111111] truncate">{profile.displayName}</p>
        </div>

        <a
          href={profile.followUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-[5px] border border-[#0081ff] bg-[#0081ff] px-3.5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-80 shrink-0"
        >
          <svg className="w-4 h-4 mr-2 shrink-0" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="#ffffff"
              d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a3.16 3.16 0 110 6.32 3.16 3.16 0 010-6.32zm0 10.162a7 7 0 110-14 7 7 0 010 14zm6.406-11.845a1.44 1.44 0 110 2.881 1.44 1.44 0 010-2.881z"
            />
          </svg>
          Follow
        </a>
      </div>

      <div className="relative">
        {stories.length > 3 && (
          <>
            <button
              type="button"
              onClick={scrollPrev}
              className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 items-center justify-center rounded-full bg-white/95 shadow border border-[#d6dae4] text-[#505a5f] text-xl leading-none"
              aria-label="Story anterior"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={scrollNext}
              className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 items-center justify-center rounded-full bg-white/95 shadow border border-[#d6dae4] text-[#505a5f] text-xl leading-none"
              aria-label="Próximo story"
            >
              ›
            </button>
          </>
        )}

        <div className="overflow-hidden -mx-1 px-1 touch-pan-x cursor-grab active:cursor-grabbing" ref={emblaRef}>
          <div className="flex" style={{ gap: carouselLayout.gap }}>
            {stories.map((story, index) => (
              <StoryPreviewCard
                key={story.id}
                story={story}
                profileAvatar={avatar}
                profileUsername={profile.username}
                priority={index < 2}
                flexBasis={carouselLayout.flexBasis}
                onClick={() => handleStoryTap(index)}
              />
            ))}
          </div>
        </div>
      </div>

      <StoryViewerModal
        stories={stories}
        initialGroupIndex={selectedGroupIndex}
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  );
}
