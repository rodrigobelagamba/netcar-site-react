import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import selection from "@/data/seo/regional-selection.json";

export function RegionalSelectionNote() {
  return (
    <section className="pb-12" aria-labelledby="regional-selection-title">
      <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        <div className="flex items-start gap-4 rounded-2xl border border-primary/15 bg-primary/[0.03] p-5 sm:p-6">
          <ShieldCheck
            className="mt-1 h-6 w-6 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div className="max-w-3xl">
            <h2
              id="regional-selection-title"
              className="text-lg font-bold text-fg"
            >
              {selection.heading}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 sm:text-base">
              {selection.text}
            </p>
            <Link
              to="/como-selecionamos-nossos-carros"
              data-regional-action="selection_criteria"
              className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4"
            >
              {selection.linkLabel}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
