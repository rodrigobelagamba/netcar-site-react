import { useSearch } from "@tanstack/react-router";
import { useVehiclesQuery } from "@/api/queries/useVehiclesQuery";
import { ProductList } from "@/design-system/components/patterns/ProductList";
import { cn } from "@/lib/cn";
import { Footer } from "@/design-system/components/layout/Footer";

export function SeminovosPage() {
  const search = useSearch({ from: "/seminovos" });
  const { data: vehicles, isLoading } = useVehiclesQuery(search);

  return (
    <>
      <main className="container mx-auto flex-1 px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-4 text-4xl font-bold text-fg">Carros Seminovos</h1>
        <p className="text-muted-foreground">
          Encontre o carro ideal para você
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        <aside className="lg:col-span-1">
          <div className="rounded-lg border border-border bg-surface p-6">
            <h2 className="mb-4 text-lg font-semibold text-fg">Filtros</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-fg">
                  Marca
                </label>
                <input
                  type="text"
                  placeholder="Ex: Honda"
                  className={cn(
                    "w-full rounded-md border border-border bg-bg px-3 py-2",
                    "text-sm text-fg placeholder:text-muted-foreground",
                    "focus:outline-none focus:ring-2 focus:ring-primary"
                  )}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-fg">
                  Modelo
                </label>
                <input
                  type="text"
                  placeholder="Ex: Civic"
                  className={cn(
                    "w-full rounded-md border border-border bg-bg px-3 py-2",
                    "text-sm text-fg placeholder:text-muted-foreground",
                    "focus:outline-none focus:ring-2 focus:ring-primary"
                  )}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-fg">
                  Preço Mínimo
                </label>
                <input
                  type="number"
                  placeholder="R$ 0"
                  className={cn(
                    "w-full rounded-md border border-border bg-bg px-3 py-2",
                    "text-sm text-fg placeholder:text-muted-foreground",
                    "focus:outline-none focus:ring-2 focus:ring-primary"
                  )}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-fg">
                  Preço Máximo
                </label>
                <input
                  type="number"
                  placeholder="R$ 500.000"
                  className={cn(
                    "w-full rounded-md border border-border bg-bg px-3 py-2",
                    "text-sm text-fg placeholder:text-muted-foreground",
                    "focus:outline-none focus:ring-2 focus:ring-primary"
                  )}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-fg">
                  Ano Mínimo
                </label>
                <input
                  type="number"
                  placeholder="2020"
                  className={cn(
                    "w-full rounded-md border border-border bg-bg px-3 py-2",
                    "text-sm text-fg placeholder:text-muted-foreground",
                    "focus:outline-none focus:ring-2 focus:ring-primary"
                  )}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-fg">
                  Ano Máximo
                </label>
                <input
                  type="number"
                  placeholder="2024"
                  className={cn(
                    "w-full rounded-md border border-border bg-bg px-3 py-2",
                    "text-sm text-fg placeholder:text-muted-foreground",
                    "focus:outline-none focus:ring-2 focus:ring-primary"
                  )}
                />
              </div>
            </div>
          </div>
        </aside>

        <div className="lg:col-span-3">
          <ProductList vehicles={vehicles || []} isLoading={isLoading} />
        </div>
      </div>
      </main>
      <div className="w-full font-sans antialiased text-muted-foreground bg-muted py-12 px-4 md:px-8">
        <Footer />
      </div>
    </>
  );
}
