import { Link } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  CreditCard,
  FileCheck2,
  type LucideIcon,
  Star,
} from "lucide-react";
import { GoogleGIcon } from "@/design-system/components/patterns/social/GoogleGIcon";
import { useGoogleReviewsQuery } from "@/social/queries/useGoogleReviewsQuery";

type RegionalTrustSignalsProps = {
  className?: string;
  /** compact = faixa sob o hero; full = seção com título */
  variant?: "compact" | "full";
};

type TrustItem = {
  key: string;
  icon: LucideIcon;
  title: string;
  text: string;
  href?: "/compra";
  linkLabel?: string;
  externalHref?: string;
  google?: boolean;
  ratingLabel?: string;
};

/**
 * Pilares de confiança das páginas SEO de rankeamento:
 * troca · parcelamento · despachante · Google.
 */
export function RegionalTrustSignals({
  className = "",
  variant = "full",
}: RegionalTrustSignalsProps) {
  const { data } = useGoogleReviewsQuery();
  const summary = data?.summary;
  const rating = summary?.rating ?? 4.9;
  const totalCount = summary?.totalCount;
  const placeUrl = summary?.placeUrl;
  const ratingLabel = rating.toFixed(1).replace(".", ",");

  const items: TrustItem[] = [
    {
      key: "trade",
      icon: ArrowLeftRight,
      title: "Aceitamos seu usado na troca",
      text: "Avaliação justa do seu carro para abater no seminovo. Mesmo financiado — sujeito à análise.",
      href: "/compra",
      linkLabel: "Avaliar usado",
    },
    {
      key: "finance",
      icon: CreditCard,
      title: "Parcelamento facilitado",
      text: "Financiamento em até 60x ou cartão em até 21x. Compare bancos e financeiras parceiras.",
    },
    {
      key: "docs",
      icon: FileCheck2,
      title: "Despachante credenciado",
      text: "Documentação até o DETRAN com suporte da loja. Menos burocracia na hora de transferir.",
    },
    {
      key: "google",
      icon: Star,
      title: "Alto índice de satisfação no Google",
      text: totalCount
        ? `${ratingLabel} de 5 com ${totalCount.toLocaleString("pt-BR")} avaliações — quem compra recomenda.`
        : `${ratingLabel} de 5 no Google — quem compra recomenda a Netcar.`,
      externalHref: placeUrl,
      google: true,
      ratingLabel,
    },
  ];

  const grid = (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <article
            key={item.key}
            className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white/80 p-5 shadow-[0_8px_30px_rgb(0,40,60,0.06)] backdrop-blur-sm transition-transform hover:-translate-y-0.5"
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#00283C]/5 text-[#00283C]">
                {item.google ? (
                  <GoogleGIcon className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </span>
              {item.google && item.ratingLabel && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {item.ratingLabel}
                </span>
              )}
            </div>
            <h3 className="mb-2 text-sm font-bold leading-snug text-[#00283C]">
              {item.title}
            </h3>
            <p className="text-sm leading-relaxed text-gray-600">{item.text}</p>
            {item.href && item.linkLabel && (
              <Link
                to={item.href}
                className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
              >
                {item.linkLabel}
              </Link>
            )}
            {item.externalHref && (
              <a
                href={item.externalHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
              >
                Ver avaliações no Google
              </a>
            )}
          </article>
        );
      })}
    </div>
  );

  if (variant === "compact") {
    return (
      <div className={`mt-8 ${className}`} data-regional-trust="compact">
        {grid}
      </div>
    );
  }

  return (
    <section className={`pb-14 ${className}`} data-regional-trust="full">
      <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        <div className="mb-6 max-w-2xl">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-primary">
            Por que a Netcar
          </span>
          <h2 className="text-2xl font-bold text-fg md:text-3xl">
            Troca, parcelamento, despachante e reputação no Google
          </h2>
          <p className="mt-2 text-gray-600">
            Mesma experiência de loja física em Esteio — do primeiro WhatsApp ao
            carro transferido.
          </p>
        </div>
        {grid}
      </div>
    </section>
  );
}
