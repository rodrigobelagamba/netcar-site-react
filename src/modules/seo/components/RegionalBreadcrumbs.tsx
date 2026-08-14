import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

type RegionalBreadcrumbsProps = {
  cityName: string;
  variant: "buy" | "sell";
};

export function RegionalBreadcrumbs({
  cityName,
  variant,
}: RegionalBreadcrumbsProps) {
  return (
    <nav
      aria-label="Navegação estrutural"
      className="border-b border-slate-100 bg-white"
    >
      <ol className="container-main flex flex-wrap items-center gap-1.5 px-4 py-3 text-xs text-muted-foreground sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        <li>
          <Link to="/" className="hover:text-primary hover:underline">
            Início
          </Link>
        </li>
        <li aria-hidden>
          <ChevronRight className="h-3.5 w-3.5" />
        </li>
        <li>
          <Link
            to="/regioes-atendidas"
            className="hover:text-primary hover:underline"
          >
            Regiões atendidas
          </Link>
        </li>
        <li aria-hidden>
          <ChevronRight className="h-3.5 w-3.5" />
        </li>
        <li className="font-medium text-fg" aria-current="page">
          {variant === "buy"
            ? `Seminovos perto de ${cityName}`
            : `Vender carro em ${cityName}`}
        </li>
      </ol>
    </nav>
  );
}
