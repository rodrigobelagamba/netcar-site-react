/**
 * Selo vetorial de procedência da Netcar para a ficha de cada veículo.
 * Mantém linguagem factual sobre os critérios de compra do estoque próprio.
 */
export function ProvenanceSealBadge() {
  return (
    <div className="flex items-center gap-3.5 rounded-xl bg-[#00283C] px-3.5 py-3 text-white shadow-[0_6px_18px_rgba(0,40,60,0.14)] sm:gap-4 sm:px-4 sm:py-3.5">
      <svg
        viewBox="0 0 64 72"
        className="h-12 w-11 shrink-0 sm:h-14 sm:w-12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M32 3L58 13.5V34.5C58 51.2 46.7 63.4 32 69C17.3 63.4 6 51.2 6 34.5V13.5L32 3Z"
          fill="#063B52"
          stroke="#5CD29D"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M32 10L51.5 18V34C51.5 47.4 42.8 57.2 32 62C21.2 57.2 12.5 47.4 12.5 34V18L32 10Z"
          fill="#087A37"
        />
        <path
          d="M22.5 35.5L29 42L42.5 28"
          stroke="#FFFFFF"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5CD29D] sm:text-[11px]">
          Selo de Procedência RS · Netcar desde 1997
        </p>
        <p className="mt-0.5 text-sm font-black leading-snug tracking-[-0.015em] text-white sm:text-base">
          Sem enchente, leilão, sinistro ou locadora
        </p>
        <p className="mt-0.5 text-[11px] font-medium leading-snug text-white/75 sm:text-xs">
          Critério de seleção do estoque próprio em Esteio/RS
        </p>
      </div>
    </div>
  );
}
