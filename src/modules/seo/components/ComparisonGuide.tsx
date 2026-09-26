import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import comparison from "@/data/seo/comparison.json";

export function ComparisonGuide() {
  return (
    <section
      aria-labelledby="comparison-guide-title"
      className="mt-10 sm:mt-14"
    >
      <div className="max-w-2xl">
        <h2
          id="comparison-guide-title"
          className="text-xl font-bold tracking-tight text-[#00283C] sm:text-2xl"
        >
          {comparison.guideTitle}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[#52666D]">
          {comparison.guideIntro}
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {comparison.criteria.map((criterion, index) => (
          <article
            key={criterion.title}
            className="rounded-2xl border border-[#DFE8E7] bg-white p-5"
          >
            <span
              className="text-xs font-bold text-[#00877D]"
              aria-hidden="true"
            >
              0{index + 1}
            </span>
            <h3 className="mt-2 text-base font-bold text-[#00283C]">
              {criterion.title}
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#52666D]">
              {criterion.text}
            </p>
          </article>
        ))}
      </div>

      <nav
        aria-label="Continue sua pesquisa de seminovos"
        className="mt-5 flex flex-wrap gap-x-6 gap-y-1"
      >
        {comparison.links.map(({ label, path }) => (
          <Link
            key={path}
            to={path}
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[#006D66] underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00877D]"
          >
            {label}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ))}
      </nav>
    </section>
  );
}
