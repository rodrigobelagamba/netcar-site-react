import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, FileSearch, MapPin, ShieldCheck } from "lucide-react";
import { emptySeminovosSearch } from "@/lib/seminovos-search";
import {
  trackSelectionCampaignCta,
  trackTrustSectionView,
} from "@/lib/analytics";

const trustPoints = [
  { icon: MapPin, label: "Comprados no RS" },
  { icon: ShieldCheck, label: "Sem origem de locadora" },
  {
    icon: FileSearch,
    label: "Sem leilão, sinistro, furto ou roubo",
  },
] as const;

export function HomeSelectionPromise() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        trackTrustSectionView("selection_campaign_home");
        observer.disconnect();
      },
      { threshold: 0.35 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="criterio-netcar-title"
      className="container-main px-4 pb-10 sm:px-6 md:pb-16 lg:px-8 xl:px-12 2xl:px-16"
    >
      <div className="relative isolate overflow-hidden rounded-[28px] bg-[#00283C] text-white shadow-[0_22px_70px_rgba(0,40,60,0.2)] lg:grid lg:grid-cols-[1.15fr_0.85fr]">
        {/* Mobile: título + 3 critérios + 1 CTA. Texto longo, foto e 2º botão só a partir de sm. */}
        <div className="relative z-10 px-5 py-6 sm:px-9 sm:py-9 md:py-12 lg:px-12 lg:py-14">
          <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5CD29D]">
            Como escolhemos o estoque
          </span>
          <h2
            id="criterio-netcar-title"
            className="mt-2 max-w-3xl text-2xl font-black leading-[1.06] tracking-[-0.03em] sm:mt-4 sm:text-4xl lg:text-5xl"
          >
            Nem todo carro entra na Netcar.
          </h2>
          <p className="mt-5 hidden max-w-2xl text-base leading-relaxed text-white/80 sm:block sm:text-lg">
            Na compra de um seminovo, preço e aparência não contam toda a
            história. Origem e registros anteriores podem pesar no seguro, no
            financiamento e numa futura revenda. Nosso estoque é comprado no RS
            e não tem veículos de locadora, leilão, sinistro, furto ou roubo.
          </p>

          <div className="mt-4 flex flex-wrap gap-2 sm:mt-7 sm:gap-2.5">
            {trustPoints.map((point) => (
              <span
                key={point.label}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3.5 py-2 text-xs font-bold text-white/90 sm:text-sm"
              >
                <point.icon
                  className="h-4 w-4 shrink-0 text-[#5CD29D]"
                  aria-hidden="true"
                />
                {point.label}
              </span>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:mt-8 sm:flex-row">
            <Link
              to="/como-selecionamos-nossos-carros"
              onClick={() => trackSelectionCampaignCta("learn_process", "home")}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#5CD29D] px-6 py-3 text-sm font-black text-[#00283C] transition hover:bg-[#76deb0] active:scale-[0.98]"
            >
              Entenda por que isso importa
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/seminovos"
              search={emptySeminovosSearch}
              onClick={() => trackSelectionCampaignCta("view_stock", "home")}
              className="hidden min-h-12 items-center justify-center rounded-full border border-white/30 px-6 py-3 text-sm font-bold text-white transition hover:border-white/60 hover:bg-white/10 active:scale-[0.98] sm:inline-flex"
            >
              Ver estoque disponível
            </Link>
          </div>
        </div>

        <div className="relative hidden min-h-[260px] overflow-hidden sm:block sm:min-h-[340px] lg:min-h-full">
          <img
            src="/images/loja1.webp"
            alt="Fachada da Loja 1 da Netcar Multimarcas em Esteio"
            width={1280}
            height={960}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#00283C]/80 via-[#00283C]/5 to-transparent lg:bg-gradient-to-r lg:from-[#00283C] lg:via-[#00283C]/10 lg:to-transparent" />
          <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/20 bg-[#001F2F]/75 p-4 backdrop-blur-md sm:bottom-7 sm:left-7 sm:right-auto sm:max-w-xs">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#5CD29D]">
              Esteio, desde 1997
            </p>
            <p className="mt-1.5 text-sm font-semibold leading-snug text-white">
              Duas lojas na mesma avenida, com equipe e estoque integrados.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
