export const FACTORY_WARRANTY_NOTE =
  "*Ano estimado pela fabricação. Vencimento exato, cobertura e limite de km conforme manual da montadora.";

export interface FactoryWarrantyBadgeProps {
  estimatedEndYear: number;
  manufacturer?: string;
  variant: "card" | "hero";
  design?: "round" | "rectangular";
  /** A apresentação não calcula prazo nem decide a elegibilidade do veículo. */
  mode: "visual-example" | "verified";
}

/** Carimbo vetorial; nota em texto HTML no rodapé do bloco. */
export function FactoryWarrantyBadge({
  estimatedEndYear,
  manufacturer,
  variant,
  design = "round",
  mode,
}: FactoryWarrantyBadgeProps) {
  const round = design === "round";
  return (
    <div
      className="w-full text-center text-[#505A5F]"
      data-factory-warranty-badge={variant}
      data-stamp-design={design}
    >
      <svg
        viewBox={round ? "0 0 200 200" : "0 0 200 180"}
        className={`block h-auto w-full overflow-visible ${round ? "-rotate-[6deg]" : "-rotate-[4deg]"}`}
        role="img"
        aria-label={`Garantia de fábrica até ${estimatedEndYear}*. ${mode === "visual-example" ? "Prévia visual; ano estimado." : "Ano estimado pela fabricação."}`}
        aria-description={FACTORY_WARRANTY_NOTE}
      >
        {round ? (
          <>
            <circle
              cx="100"
              cy="100"
              r="92"
              fill="none"
              stroke="#505A5F"
              strokeWidth="2.5"
            />
            <circle
              cx="100"
              cy="100"
              r="84"
              fill="none"
              stroke="#6BC4CA"
              strokeWidth="3"
            />
          </>
        ) : (
          <>
            <rect
              x="6"
              y="8"
              width="188"
              height="162"
              rx="2"
              fill="none"
              stroke="#505A5F"
              strokeWidth="3"
            />
            <rect
              x="14"
              y="16"
              width="172"
              height="146"
              rx="1"
              fill="none"
              stroke="#6BC4CA"
              strokeWidth="2"
            />
          </>
        )}
        <g
          fill="#505A5F"
          textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif"
          fontWeight="800"
        >
          <text
            x="100"
            y={round ? "60" : "47"}
            fontSize="21"
            letterSpacing="1.5"
          >
            GARANTIA
          </text>
          <text
            x="100"
            y={round ? "82" : "70"}
            fontSize="18"
            letterSpacing="0.7"
          >
            DE FÁBRICA
          </text>
          {!round && <path d="M35 82H165" stroke="#6BC4CA" strokeWidth="2" />}
          <text
            x="100"
            y={round ? "105" : "102"}
            fontSize="13"
            letterSpacing="2"
          >
            ATÉ
          </text>
          <text
            x="94"
            y={round ? "149" : "143"}
            fontSize="56"
            fontWeight="900"
            letterSpacing="-2.5"
          >
            {estimatedEndYear}
          </text>
          <text
            x="162"
            y={round ? "126" : "120"}
            fontSize="24"
            fontWeight="700"
          >
            *
          </text>
          {variant === "hero" && manufacturer && (
            <text
              x="100"
              y={round ? "169" : "159"}
              fontSize="10"
              fontWeight="700"
              letterSpacing="0.7"
            >
              {manufacturer}
            </text>
          )}
        </g>
      </svg>
      {mode === "visual-example" && (
        <p className="mt-1.5 text-[8px] font-semibold uppercase leading-tight tracking-[0.07em] sm:text-[9px]">
          Prévia visual
        </p>
      )}
    </div>
  );
}

export function FactoryWarrantyNote({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <p
      className={`text-[#505A5F] leading-[1.45] ${compact ? "text-[11px]" : "text-xs"}`}
      data-factory-warranty-note
    >
      {FACTORY_WARRANTY_NOTE}
    </p>
  );
}
