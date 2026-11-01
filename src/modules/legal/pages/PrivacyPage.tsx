import { Database, Mail, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { openPrivacyPreferences } from "@/components/PrivacyConsent";
import { privacyPage } from "@/data/legal/privacy.mjs";
import { useMetaTags } from "@/hooks/useMetaTags";

const sections = privacyPage.sections;

export function PrivacyPage() {
  useMetaTags({
    title: privacyPage.title,
    description: privacyPage.description,
    url: "https://www.netcarmultimarcas.com.br/privacidade",
  });

  return (
    <main className="flex-1 bg-[#F6F8F8] px-4 pb-20 pt-10 sm:px-6 sm:pt-16 lg:px-8">
      <article className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-[#00283C]/10 bg-white shadow-sm">
        <header className="bg-[#00283C] px-6 py-10 text-white sm:px-10 sm:py-14">
          <div className="flex items-center gap-3 text-sm font-bold uppercase tracking-[0.18em] text-[#62D2CF]">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            Privacidade na Netcar
          </div>
          <h1 className="mt-4 text-3xl font-black leading-tight sm:text-5xl">
            {privacyPage.h1}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
            {privacyPage.intro}
          </p>
          <p className="mt-5 text-sm text-white/60">{privacyPage.updated}</p>
        </header>

        <div className="space-y-10 px-6 py-10 sm:px-10 sm:py-12">
          <section className="rounded-2xl border border-[#62D2CF]/40 bg-[#62D2CF]/10 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <Database className="mt-0.5 h-5 w-5 shrink-0 text-[#00616A]" aria-hidden="true" />
              <div>
                <h2 className="text-lg font-black text-[#00283C]">
                  {privacyPage.controllerTitle}
                </h2>
                <p className="mt-2 leading-relaxed text-slate-700">
                  {privacyPage.controller}
                </p>
              </div>
            </div>
          </section>

          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-2xl font-black text-[#00283C]">
                {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-base leading-relaxed text-slate-700">
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.items ? (
                  <ul className="list-disc space-y-2 pl-5">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          ))}

          <section>
            <h2 className="text-2xl font-black text-[#00283C]">
              {privacyPage.rightsTitle}
            </h2>
            <p className="mt-3 leading-relaxed text-slate-700">
              {privacyPage.rights}
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={openPrivacyPreferences}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#087A37] px-5 py-3 font-black text-white transition-colors hover:bg-[#075E54]"
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                Alterar preferências
              </button>
              <a
                href="mailto:contato@netcarmultimarcas.com.br?subject=Privacidade%20e%20dados"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#00283C]/20 px-5 py-3 font-bold text-[#00283C] transition-colors hover:bg-slate-50"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                contato@netcarmultimarcas.com.br
              </a>
            </div>
          </section>

          <p className="border-t border-slate-200 pt-6 text-sm leading-relaxed text-slate-500">
            {privacyPage.footnote}
          </p>
        </div>
      </article>
    </main>
  );
}
