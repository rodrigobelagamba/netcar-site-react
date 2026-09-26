import { useEffect, useMemo } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowRight, Check, ChevronRight } from "lucide-react";
import { useVehiclesQuery } from "@/catalog/queries/useVehiclesQuery";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import { useMetaTags } from "@/hooks/useMetaTags";
import { NotFoundRedirect } from "@/components/NotFoundRedirect";
import { generateVehicleSlug } from "@/lib/slug";
import { comparisonVehicleLabel } from "@/lib/comparisonContact";
import {
  comparisonCandidates,
  comparisonDefinitions,
  closestComparisonPair,
} from "@/lib/vehicleComparisons";
import { ComparisonVehicleImage } from "../components/ComparisonVehicleImage";
import {
  VehicleComparisonTable,
  comparisonPrice,
} from "../components/VehicleComparisonTable";
import "./comparador.css";

const SITE = "https://www.netcarmultimarcas.com.br";

export function ComparisonLandingPage() {
  const { comparisonSlug } = useParams({ from: "/comparar/$comparisonSlug" });
  const definition = comparisonDefinitions.find(
    (item) => item.slug === comparisonSlug,
  );
  const {
    data: vehicles,
    isLoading,
    isError,
  } = useVehiclesQuery({ limit: 500 });
  const { data: whatsapp } = useWhatsAppQuery();
  const navigate = useNavigate();
  const canonical = `${SITE}/comparar/${comparisonSlug}`;
  useMetaTags({
    title: definition?.title,
    description: definition?.description,
    url: canonical,
    robots: definition ? undefined : "noindex, nofollow",
  });
  const selection = useMemo(() => {
    if (!definition) return undefined;
    const left = comparisonCandidates(vehicles || [], definition.left);
    const right = comparisonCandidates(vehicles || [], definition.right);
    return { left, right, pair: closestComparisonPair(left, right) };
  }, [definition, vehicles]);

  useEffect(() => {
    if (!definition) return;
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.schema = "comparison-page";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": `${canonical}#webpage`,
          url: canonical,
          name: definition.h1,
          description: definition.description,
          inLanguage: "pt-BR",
          breadcrumb: { "@id": `${canonical}#breadcrumb` },
        },
        {
          "@type": "BreadcrumbList",
          "@id": `${canonical}#breadcrumb`,
          itemListElement: [
            { name: "Início", item: `${SITE}/` },
            { name: "Comparar carros", item: `${SITE}/comparar` },
            { name: definition.label, item: canonical },
          ].map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            ...item,
          })),
        },
      ],
    });
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [canonical, definition]);

  if (!definition || !selection) return <NotFoundRedirect />;
  const { pair } = selection;
  const available = [selection.left[0], selection.right[0]].filter(Boolean);

  return (
    <main className="comparison-page flex-1 min-w-0 max-w-full">
      <section className="comparison-hero">
        <div className="comparison-shell">
          <nav
            className="comparison-breadcrumbs"
            aria-label="Navegação estrutural"
          >
            <Link to="/">Início</Link>
            <ChevronRight size={12} aria-hidden="true" />
            <Link to="/comparar">Comparar carros</Link>
            <ChevronRight size={12} aria-hidden="true" />
            <span>{definition.label}</span>
          </nav>
          <p className="comparison-eyebrow">
            Comparação de seminovos · Netcar Esteio/RS
          </p>
          <h1>{definition.h1}</h1>
          <p className="comparison-hero__intro">{definition.intro}</p>
        </div>
      </section>

      <div className="comparison-shell comparison-content">
        <div className="comparison-pair-context">
          <div>
            <h2>Compare as unidades, não só os nomes</h2>
            <p>{definition.stockNote}</p>
          </div>
          <Link to="/comparar">
            Escolher outros carros <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        {isLoading ? (
          <div className="comparison-stock-message" role="status">
            Carregando os carros disponíveis…
          </div>
        ) : pair ? (
          <>
            <VehicleComparisonTable
              vehicles={[pair.left, pair.right]}
              title={`${definition.left.label} e ${definition.right.label} no estoque`}
              onAdd={() => {
                void navigate({ to: "/comparar" });
              }}
              whatsAppNumber={whatsapp?.numero?.trim()}
            />
          </>
        ) : (
          <section
            className="comparison-stock-message"
            aria-labelledby="comparison-availability"
          >
            <h2 id="comparison-availability">
              {isError
                ? "Não foi possível atualizar o estoque agora"
                : "Ainda não há duas opções disponíveis para este par"}
            </h2>
            <p>
              {isError
                ? "Tente novamente em instantes ou consulte a equipe. O guia abaixo continua disponível para sua pesquisa."
                : `No momento não encontramos os dois modelos anunciados com preço. Você pode conhecer as opções abaixo ou montar outra comparação.`}
            </p>
            {available.map((vehicle) => (
              <Link
                key={vehicle.id}
                to="/veiculo/$slug"
                params={{ slug: generateVehicleSlug(vehicle) }}
                className="comparison-available-car"
              >
                <span>
                  <ComparisonVehicleImage vehicle={vehicle} sizes="160px" />
                </span>
                <span>
                  <strong>{comparisonVehicleLabel(vehicle)}</strong>
                  <br />
                  {comparisonPrice(vehicle)}
                  <br />
                  Ver ficha <ArrowRight size={14} aria-hidden="true" />
                </span>
              </Link>
            ))}
            <Link to="/comparar" className="comparison-return">
              Ver outras opções do estoque{" "}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </section>
        )}

        <section
          className="comparison-editorial"
          aria-labelledby="comparison-reading-title"
        >
          <div className="comparison-section-heading">
            <div>
              <p className="comparison-eyebrow">Antes de decidir</p>
              <h2 id="comparison-reading-title">
                Como escolher entre {definition.left.label} e{" "}
                {definition.right.label}
              </h2>
            </div>
          </div>
          <div className="comparison-editorial__grid">
            {definition.sections.map((section, index) => (
              <article key={section.title}>
                <span
                  className="comparison-editorial__number"
                  aria-hidden="true"
                >
                  0{index + 1}
                </span>
                <h3>{section.title}</h3>
                <p>{section.text}</p>
              </article>
            ))}
          </div>
          <div className="comparison-checklist">
            <h3>Leve estas perguntas para a visita</h3>
            <ul>
              {definition.checks.map((check) => (
                <li key={check}>
                  <Check size={17} aria-hidden="true" />
                  <span>{check}</span>
                </li>
              ))}
            </ul>
            <Link to="/como-selecionamos-nossos-carros">
              Como a Netcar seleciona os carros{" "}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <nav
          className="comparison-related"
          aria-label="Outras comparações prontas"
        >
          <h2>Continue comparando</h2>
          <div className="comparison-presets__grid">
            {comparisonDefinitions
              .filter((item) => item.slug !== definition.slug)
              .map((item) => (
                <Link
                  key={item.slug}
                  to="/comparar/$comparisonSlug"
                  params={{ comparisonSlug: item.slug }}
                  className="comparison-preset"
                >
                  {item.label}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ))}
            <Link to="/comparar" className="comparison-preset">
              Montar minha comparação{" "}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </nav>
      </div>
    </main>
  );
}
