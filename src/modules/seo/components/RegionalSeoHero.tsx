import type { ReactNode } from "react";

type RegionalSeoHeroProps = {
  eyebrow?: string;
  title: string;
  intro?: string;
  accent?: "primary" | "secondary";
  badges?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/**
 * Hero moderno compartilhado das landings SEO de rankeamento.
 */
export function RegionalSeoHero({
  eyebrow,
  title,
  intro,
  accent = "primary",
  badges,
  children,
  className = "",
}: RegionalSeoHeroProps) {
  const accentColor = accent === "secondary" ? "#5CD29D" : "#0033ff";

  return (
    <section
      className={`relative overflow-hidden py-14 md:py-20 ${className}`}
      data-regional-hero
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 10% -10%, ${accentColor}18, transparent 55%),
            radial-gradient(ellipse 60% 50% at 95% 20%, #00283C12, transparent 50%),
            linear-gradient(180deg, #f8fafc 0%, #ffffff 55%, #ffffff 100%)
          `,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-10 h-64 w-64 rounded-full blur-3xl opacity-30"
        style={{ background: accentColor }}
      />

      <div className="container-main relative px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        <div className="max-w-3xl">
          {eyebrow && (
            <span
              className="mb-4 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest"
              style={{
                color: accent === "secondary" ? "#0f766e" : "#0033ff",
                background:
                  accent === "secondary"
                    ? "rgba(92, 210, 157, 0.15)"
                    : "rgba(0, 51, 255, 0.08)",
              }}
            >
              {eyebrow}
            </span>
          )}
          <h1 className="mb-5 text-3xl font-bold tracking-tight text-[#00283C] md:text-5xl md:leading-[1.1]">
            {title}
          </h1>
          {intro && (
            <p className="max-w-2xl text-lg leading-relaxed text-gray-600">
              {intro}
            </p>
          )}
          {badges && <div className="mt-6 flex flex-wrap gap-3">{badges}</div>}
          {children}
        </div>
      </div>
    </section>
  );
}
