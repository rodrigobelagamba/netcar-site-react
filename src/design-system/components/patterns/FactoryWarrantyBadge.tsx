export const FACTORY_WARRANTY_NOTE =
  "*Estimativa pela fabricação e documentação oficial da montadora. Validade, cobertura e km conforme manual do modelo/ano.";
export const FACTORY_TRACTION_BATTERY_NOTE =
  "A revenda não reinicia os prazos.";
export const FACTORY_POWERTRAIN_NOTE =
  "*Ano estimado pela fabricação. Prazo original e condições conforme manual da montadora.";

export interface FactoryWarrantyBadgeProps {
  estimatedEndYear: number;
  manufacturer?: string;
  variant: "card" | "hero";
  design?: "round" | "rectangular";
  scope?: "basic-vehicle" | "traction-battery" | "powertrain";
  /** A apresentação não calcula prazo nem decide a elegibilidade do veículo. */
  mode: "visual-example" | "verified";
}

/** Carimbo vetorial; nota em texto HTML no rodapé do bloco. */
export function FactoryWarrantyBadge({
  estimatedEndYear,
  manufacturer,
  variant,
  design = "round",
  scope = "basic-vehicle",
  mode,
}: FactoryWarrantyBadgeProps) {
  const round = design === "round";
  const tractionBattery = scope === "traction-battery";
  const powertrain = scope === "powertrain";
  const restrictedCoverage = tractionBattery || powertrain;
  return (
    <div
      className="w-full text-center text-[#505A5F]"
      data-factory-warranty-badge={variant}
      data-stamp-design={design}
      data-warranty-scope={scope}
    >
      <svg
        viewBox={round ? "0 0 200 200" : "0 0 200 180"}
        className={`block h-auto w-full overflow-visible ${round ? "-rotate-[6deg]" : "-rotate-[4deg]"}`}
        role="img"
        aria-label={`Garantia de fábrica${tractionBattery ? " da bateria de tração" : powertrain ? " de motor e câmbio" : ""} até ${estimatedEndYear}*. ${mode === "visual-example" ? "Prévia visual; ano estimado." : "Ano estimado pela fabricação."}`}
        aria-description={powertrain ? FACTORY_POWERTRAIN_NOTE : `${FACTORY_WARRANTY_NOTE}${tractionBattery ? ` ${FACTORY_TRACTION_BATTERY_NOTE}` : ""}`}
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
            y={restrictedCoverage ? "42" : round ? "60" : "47"}
            fontSize={restrictedCoverage ? "16" : "21"}
            letterSpacing="1.5"
          >
            GARANTIA
          </text>
          {restrictedCoverage && (
            <text x="100" y="63" fontSize="21" letterSpacing="1">
              {powertrain ? "MOTOR" : "BATERIA"}
            </text>
          )}
          <text
            x="100"
            y={restrictedCoverage ? "84" : round ? "82" : "70"}
            fontSize="18"
            letterSpacing="0.7"
          >
            {tractionBattery ? "DE TRAÇÃO" : powertrain ? "E CÂMBIO" : "DE FÁBRICA"}
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
  tractionBattery = false,
  powertrain,
}: {
  compact?: boolean;
  tractionBattery?: boolean;
  powertrain?: { termYears: number; sourceUrl: string; sourceLabel: string; sourceDescription: string };
}) {
  return (
    <p
      className={`text-[#505A5F] leading-[1.45] ${compact ? "text-[10.5px]" : "text-[11px]"}`}
      data-factory-warranty-note
    >
      {powertrain ? FACTORY_POWERTRAIN_NOTE : FACTORY_WARRANTY_NOTE}
      {tractionBattery && <> {FACTORY_TRACTION_BATTERY_NOTE}</>}
      {powertrain && (
        <>{" "}
          <a
            href={powertrain.sourceUrl}
            title={powertrain.sourceLabel}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
            onClick={(event) => event.stopPropagation()}
          >
            Consultar manual
          </a>.
        </>
      )}
    </p>
  );
}
