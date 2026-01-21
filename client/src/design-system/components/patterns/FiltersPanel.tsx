import { useEffect } from "react";
import { useFiltersStore } from "@/store/filters.store";
import { cn } from "@/lib/cn";

interface FiltersPanelProps {
  className?: string;
  onFiltersChange?: (filters: Record<string, string>) => void;
}

// TODO: Conectar com API real para buscar marcas e cores disponíveis
const mockMarcas = ["Honda", "Toyota", "Volkswagen", "Ford", "Chevrolet"];
const mockCores = ["Branco", "Preto", "Prata", "Vermelho", "Azul"];

export function FiltersPanel({ className, onFiltersChange }: FiltersPanelProps) {
  const {
    marca,
    modelo,
    precoMin,
    precoMax,
    anoMin,
    anoMax,
    setMarca,
    setModelo,
    setPrecoMin,
    setPrecoMax,
    setAnoMin,
    setAnoMax,
    reset,
  } = useFiltersStore();

  useEffect(() => {
    if (onFiltersChange) {
      onFiltersChange({
        marca,
        modelo,
        precoMin,
        precoMax,
        anoMin,
        anoMax,
      });
    }
  }, [marca, modelo, precoMin, precoMax, anoMin, anoMax, onFiltersChange]);

  return (
    <div className={cn("rounded-lg border border-border bg-surface p-6", className)}>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg">Filtros</h2>
        <button
          onClick={reset}
          className="text-sm text-primary hover:text-primary/80"
        >
          Limpar
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-fg">
            Marca
          </label>
          <div className="space-y-2">
            {mockMarcas.map((m) => (
              <label
                key={m}
                className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-fg"
              >
                <input
                  type="checkbox"
                  checked={marca === m}
                  onChange={(e) => setMarca(e.target.checked ? m : "")}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span>{m}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-fg">
            Cor
          </label>
          <div className="space-y-2">
            {mockCores.map((cor) => (
              <label
                key={cor}
                className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-fg"
              >
                <input
                  type="checkbox"
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span>{cor}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-fg">
            Modelo
          </label>
          <input
            type="text"
            placeholder="Ex: Civic"
            value={modelo}
            onChange={(e) => setModelo(e.target.value)}
            className={cn(
              "w-full rounded-md border border-border bg-bg px-3 py-2",
              "text-sm text-fg placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-primary"
            )}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-fg">
            Preço
          </label>
          <div className="space-y-2">
            <input
              type="number"
              placeholder="Mínimo"
              value={precoMin}
              onChange={(e) => setPrecoMin(e.target.value)}
              className={cn(
                "w-full rounded-md border border-border bg-bg px-3 py-2",
                "text-sm text-fg placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary"
              )}
            />
            <input
              type="number"
              placeholder="Máximo"
              value={precoMax}
              onChange={(e) => setPrecoMax(e.target.value)}
              className={cn(
                "w-full rounded-md border border-border bg-bg px-3 py-2",
                "text-sm text-fg placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary"
              )}
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-fg">
            Ano
          </label>
          <div className="space-y-2">
            <input
              type="number"
              placeholder="Mínimo"
              value={anoMin}
              onChange={(e) => setAnoMin(e.target.value)}
              className={cn(
                "w-full rounded-md border border-border bg-bg px-3 py-2",
                "text-sm text-fg placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary"
              )}
            />
            <input
              type="number"
              placeholder="Máximo"
              value={anoMax}
              onChange={(e) => setAnoMax(e.target.value)}
              className={cn(
                "w-full rounded-md border border-border bg-bg px-3 py-2",
                "text-sm text-fg placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary"
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
