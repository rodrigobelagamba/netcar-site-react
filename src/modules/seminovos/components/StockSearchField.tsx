import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { Vehicle } from "@/catalog/endpoints/vehicles";
import { getVehicleSearchAssist } from "@/lib/vehicleSearchAssist";

type StockSearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  vehicles?: readonly Partial<Vehicle>[];
  resetKey?: string;
};

const NO_VEHICLES: readonly Partial<Vehicle>[] = [];

export function StockSearchField({
  value,
  onChange,
  vehicles = NO_VEHICLES,
  resetKey = "",
}: StockSearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedOptionRef = useRef<HTMLLIElement>(null);
  const [draftValue, setDraftValue] = useState(value);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRouteValues = useRef<string[]>([]);
  const lastRequestedValue = useRef(value);
  const previousRoute = useRef({ value, resetKey });
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const [focused, setFocused] = useState(false);
  const [selectedQuery, setSelectedQuery] = useState<{
    value: string;
    query: string;
  } | null>(null);
  const cancelPendingChange = useCallback(() => {
    if (pendingTimer.current !== null) clearTimeout(pendingTimer.current);
    pendingTimer.current = null;
  }, []);

  const commitDraft = useCallback(
    (nextValue: string) => {
      cancelPendingChange();
      setDraftValue(nextValue);
      if (nextValue === lastRequestedValue.current) return;
      lastRequestedValue.current = nextValue;
      pendingRouteValues.current.push(nextValue);
      changeRef.current(nextValue);
    },
    [cancelPendingChange],
  );

  useEffect(() => {
    const previous = previousRoute.current;
    if (previous.value === value && previous.resetKey === resetKey) return;
    previousRoute.current = { value, resetKey };
    const acknowledged = pendingRouteValues.current.indexOf(value);
    if (previous.resetKey === resetKey && acknowledged >= 0) {
      // A delayed URL update must not overwrite characters typed after it.
      pendingRouteValues.current.splice(0, acknowledged + 1);
      return;
    }
    // Back/forward and clearing applied filters replace any unfinished query.
    cancelPendingChange();
    pendingRouteValues.current = [];
    lastRequestedValue.current = value;
    setDraftValue(value);
    setSelectedQuery(null);
  }, [value, resetKey, cancelPendingChange]);

  useEffect(() => cancelPendingChange, [cancelPendingChange]);

  const assist = useMemo(
    () => getVehicleSearchAssist(draftValue, vehicles),
    [draftValue, vehicles],
  );
  const hasValue = Boolean(draftValue.trim());
  const suggestions = hasValue ? assist.suggestions.slice(0, 4) : [];
  const showSuggestions = focused && suggestions.length > 0;
  const selectedIndex = suggestions.findIndex(
    (item) =>
      selectedQuery?.value === draftValue && item.query === selectedQuery.query,
  );
  const understanding = [
    assist.uncertain || assist.invalid ? "Vamos refinar:" : "Entendi assim:",
    assist.labels.join(" · "),
    assist.guidance,
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    if (showSuggestions && selectedIndex >= 0) {
      selectedOptionRef.current?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [showSuggestions, selectedIndex, draftValue]);

  const chooseSuggestion = (query: string) => {
    commitDraft(query);
    setSelectedQuery(null);
    setFocused(false);
    inputRef.current?.focus();
  };

  return (
    <form
      role="search"
      aria-label="Busca de veículos no estoque"
      onSubmit={(event) => {
        event.preventDefault();
        if (showSuggestions && selectedIndex >= 0) {
          chooseSuggestion(suggestions[selectedIndex].query);
          return;
        }
        commitDraft(draftValue);
        setFocused(false);
        inputRef.current?.blur();
      }}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false);
          setSelectedQuery(null);
        }
      }}
      className="min-w-0 flex-1 overflow-hidden rounded-lg border border-[#008C95]/20 bg-[#F3F8F8] transition-colors focus-within:border-[#008C95] focus-within:ring-2 focus-within:ring-[#008C95]/15"
    >
      <div className="flex h-11 items-center gap-2 px-3">
        <Search
          className="h-5 w-5 shrink-0 text-[#007A83]"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <label htmlFor="stock-search" className="sr-only">
            Buscar no estoque
          </label>
          <input
            ref={inputRef}
            id="stock-search"
            type="search"
            role="combobox"
            name="busca"
            value={draftValue}
            onChange={(event) => {
              const nextValue = event.target.value;
              setSelectedQuery(null);
              setFocused(true);
              setDraftValue(nextValue);
              cancelPendingChange();
              if (!nextValue) {
                commitDraft(nextValue);
                return;
              }
              // Paint the typed text now; update the route and full grid once
              // the user pauses, instead of doing that work on every keypress.
              pendingTimer.current = setTimeout(
                () => commitDraft(nextValue),
                200,
              );
            }}
            onClick={() => setFocused(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setFocused(false);
                setSelectedQuery(null);
              } else if (
                (event.key === "ArrowDown" || event.key === "ArrowUp") &&
                suggestions.length
              ) {
                event.preventDefault();
                setFocused(true);
                const next =
                  event.key === "ArrowDown"
                    ? Math.min(selectedIndex + 1, suggestions.length - 1)
                    : Math.max(selectedIndex - 1, -1);
                setSelectedQuery(
                  next < 0
                    ? null
                    : { value: draftValue, query: suggestions[next].query },
                );
              }
            }}
            placeholder="Ex.: hatch até 100 mil"
            autoComplete="off"
            enterKeyHint="search"
            maxLength={120}
            aria-autocomplete="list"
            aria-expanded={showSuggestions}
            aria-controls={
              showSuggestions ? "stock-search-suggestions" : undefined
            }
            aria-activedescendant={
              showSuggestions && selectedIndex >= 0
                ? `stock-search-suggestion-${selectedIndex}`
                : undefined
            }
            aria-describedby={
              hasValue ? "stock-search-understanding" : undefined
            }
            className="block w-full min-w-0 appearance-none border-0 bg-transparent p-0 text-base leading-7 text-[#00283C] outline-none placeholder:text-[#627780] [&::-webkit-search-cancel-button]:appearance-none"
          />
        </div>
        {draftValue && (
          <button
            type="button"
            aria-label="Limpar busca"
            onClick={() => {
              commitDraft("");
              setSelectedQuery(null);
              inputRef.current?.focus();
            }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#627780] transition-colors hover:bg-[#00283C]/5 hover:text-[#00283C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008C95]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {hasValue && (
        <div
          data-search-assist-line
          className="flex h-9 min-w-0 items-center gap-1 overflow-hidden border-t border-[#008C95]/10 bg-white/75 px-3 text-xs text-[#627780]"
        >
          <p
            id="stock-search-understanding"
            aria-label="Como a busca foi interpretada"
            title={understanding}
            className={showSuggestions ? "sr-only" : "min-w-0 truncate"}
          >
            {understanding}
          </p>
          {showSuggestions && (
            <>
              <span className="shrink-0">Sugestões:</span>
              <ul
                id="stock-search-suggestions"
                role="listbox"
                aria-label="Sugestões de busca"
                aria-orientation="horizontal"
                className="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {suggestions.map((suggestion, index) => (
                  <li
                    ref={
                      selectedIndex === index ? selectedOptionRef : undefined
                    }
                    id={`stock-search-suggestion-${index}`}
                    key={suggestion.query}
                    role="option"
                    aria-selected={selectedIndex === index}
                    title={suggestion.detail}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => chooseSuggestion(suggestion.query)}
                    className={`flex h-7 shrink-0 cursor-pointer items-center rounded px-2 font-medium text-[#007A83] underline decoration-[#008C95]/25 underline-offset-2 transition-colors ${selectedIndex === index ? "bg-[#EAF4F2] decoration-[#007A83]" : "hover:bg-[#EAF4F2] hover:decoration-[#007A83]"}`}
                  >
                    {suggestion.label}
                    {suggestion.detail && (
                      <span className="sr-only">{suggestion.detail}</span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </form>
  );
}
