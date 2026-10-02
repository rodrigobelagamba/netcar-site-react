import { useRef } from "react";
import { Search, X } from "lucide-react";

type StockSearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

export function StockSearchField({ value, onChange }: StockSearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form
      role="search"
      aria-label="Busca de veículos no estoque"
      onSubmit={(event) => {
        event.preventDefault();
        inputRef.current?.blur();
      }}
      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-[#008C95]/20 bg-[#F3F8F8] px-3 py-2 transition-colors focus-within:border-[#008C95] focus-within:ring-2 focus-within:ring-[#008C95]/15"
    >
      <Search className="h-5 w-5 shrink-0 text-[#007A83]" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <label
          htmlFor="stock-search"
          className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[#007A83]"
        >
          Buscar no estoque
        </label>
        <input
          ref={inputRef}
          id="stock-search"
          type="search"
          name="busca"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Marca, modelo, ano ou cor"
          autoComplete="off"
          enterKeyHint="search"
          maxLength={120}
          aria-controls="stock-results"
          className="block w-full min-w-0 appearance-none border-0 bg-transparent p-0 text-base leading-7 text-[#00283C] outline-none placeholder:text-[#627780] [&::-webkit-search-cancel-button]:appearance-none"
        />
      </div>
      {value && (
        <button
          type="button"
          aria-label="Limpar busca"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#627780] transition-colors hover:bg-[#00283C]/5 hover:text-[#00283C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008C95]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </form>
  );
}
