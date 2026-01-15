import { useEmbla } from "@/hooks/useEmbla";
import { useVehiclesQuery } from "@/api/queries/useVehiclesQuery";
import { ProductList } from "@/design-system/components/patterns/ProductList";
import { cn } from "@/lib/cn";
import { Localizacao } from "@/design-system/components/layout/Localizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";

export function HomePage() {
  const { emblaRef } = useEmbla({ loop: true });
  const { data: vehicles, isLoading } = useVehiclesQuery();

  const heroImages = [
    "https://via.placeholder.com/1920x600/6cc4ca/ffffff?text=Hero+1",
    "https://via.placeholder.com/1920x600/6cc4ca/ffffff?text=Hero+2",
    "https://via.placeholder.com/1920x600/6cc4ca/ffffff?text=Hero+3",
  ];

  return (
    <main className="flex-1">
      <section className="relative overflow-hidden">
        <div className="embla" ref={emblaRef}>
          <div className="embla__container flex">
            {heroImages.map((img, i) => (
              <div key={i} className="embla__slide flex-[0_0_100%]">
                <div className="relative h-[400px] md:h-[600px]">
                  <img
                    src={img}
                    alt={`Hero ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12">
        <h2 className="mb-8 text-3xl font-bold text-fg">Destaques</h2>
        <ProductList vehicles={vehicles || []} isLoading={isLoading} />
      </section>

      <section className="bg-surface-alt py-12">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold text-fg">
              Receba ofertas exclusivas
            </h2>
            <p className="mb-6 text-muted-foreground">
              Cadastre-se para receber novidades e promoções.
            </p>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                // TODO: Implementar newsletter
              }}
            >
              <input
                type="email"
                placeholder="Seu e-mail"
                className={cn(
                  "flex-1 rounded-md border border-border bg-bg px-4 py-2",
                  "text-fg placeholder:text-muted-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-primary"
                )}
              />
              <button
                type="submit"
                className={cn(
                  "rounded-md bg-primary px-6 py-2 text-primary-foreground",
                  "hover:bg-primary/90 transition-colors"
                )}
              >
                Cadastrar
              </button>
            </form>
          </div>
        </div>
      </section>

      <div className="w-full font-sans antialiased text-muted-foreground bg-muted py-12 px-4 md:px-8 space-y-8">
        <Localizacao />
        <IanBot />
      </div>
    </main>
  );
}
