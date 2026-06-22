import type { StoryGroup } from "@/social/types";

interface StoryPreviewCardProps {
  story: StoryGroup;
  profileAvatar?: string;
  profileUsername?: string;
  priority?: boolean;
  flexBasis: string;
  onClick: () => void;
}

export function StoryPreviewCard({
  story,
  profileAvatar,
  profileUsername = "netcar_rc",
  priority = false,
  flexBasis,
  onClick,
}: StoryPreviewCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className="relative shrink-0 min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary select-none"
      style={{ flex: `0 0 ${flexBasis}` }}
      aria-label={`Abrir story ${story.title}`}
    >
      <div className="social-story-card relative w-full overflow-hidden rounded-[10px] border border-[#d6dae4] shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
        <div className="social-story-card__media relative w-full">
          <img
            src={story.coverImage}
            alt={story.title}
            className="social-story-cover"
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
          />
        </div>

        {/* Só faixa superior leve p/ legibilidade do @user — sem película no card inteiro */}
        <div className="absolute top-0 left-0 right-0 h-[28%] bg-gradient-to-b from-black/50 to-transparent pointer-events-none hidden md:block" />

        {/* Barra superior — cards pequenos no mobile (<768) ficam só thumbnail */}
        <div className="absolute top-0 left-0 right-0 z-10 hidden md:flex items-center gap-2 px-3 py-2.5">
          {profileAvatar && (
            <img
              src={profileAvatar}
              alt=""
              className="w-6 h-6 rounded-full border border-white/80 object-cover shrink-0"
              loading="lazy"
            />
          )}
          <span className="text-white text-xs font-semibold drop-shadow truncate">
            {profileUsername}
          </span>
          {story.relativeTime && (
            <span className="ml-auto text-white/90 text-[11px] font-medium drop-shadow shrink-0">
              {story.relativeTime}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
