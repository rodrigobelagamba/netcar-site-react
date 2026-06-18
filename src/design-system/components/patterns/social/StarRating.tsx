interface StarRatingProps {
  rating?: number;
  size?: "sm" | "md";
  className?: string;
  color?: "gold" | "white";
}

export function StarRating({
  rating = 5,
  size = "sm",
  className = "",
  color = "gold",
}: StarRatingProps) {
  const starSize = size === "sm" ? "w-3.5 h-3.5" : "w-[18px] h-[18px]";
  const fillColor = color === "gold" ? "#FBBC04" : "#FFFFFF";

  return (
    <div className={`flex items-center justify-center gap-0.5 ${className}`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <svg
          key={index}
          className={starSize}
          viewBox="0 0 24 24"
          fill={index < rating ? fillColor : "none"}
          stroke={index < rating ? fillColor : color === "white" ? "#FFFFFF" : "#D1D5DB"}
          strokeWidth={1.5}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
      ))}
    </div>
  );
}
