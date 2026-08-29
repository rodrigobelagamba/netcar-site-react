import { ExternalLink, MapPin, Navigation } from "lucide-react";
import { useState } from "react";
import type { CityRouteOrigin } from "@/data/seo/types";

type RegionalVisitPlannerProps = {
  cityName: string;
  origins?: CityRouteOrigin[];
  intent?: "buy" | "sell";
};

const STORES = [
  {
    id: "loja_1",
    name: "Loja 1",
    address: "Av. Presidente Vargas, 740, Centro, Esteio, RS",
  },
  {
    id: "loja_2",
    name: "Loja 2",
    address: "Av. Presidente Vargas, 1106, Centro, Esteio, RS",
  },
] as const;

function buildDirectionsUrl(origin: string, destination: string): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

export function RegionalVisitPlanner({
  cityName,
  origins,
  intent = "buy",
}: RegionalVisitPlannerProps) {
  const [selectedOriginId, setSelectedOriginId] = useState(
    origins?.[0]?.id ?? "",
  );

  if (!origins?.length) return null;

  const selectedOrigin =
    origins.find((origin) => origin.id === selectedOriginId) ?? origins[0];
  const isSell = intent === "sell";

  return (
    <section className="pb-16" aria-labelledby="planejador-visita-titulo">
      <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        <div className="overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/5 via-white to-secondary/10 shadow-sm">
          <div className="p-6 sm:p-8">
            <div className="flex items-start gap-3">
              <span className="rounded-2xl bg-primary p-3 text-white shadow-sm">
                <Navigation className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-primary">
                  {isSell ? "Vistoria em Esteio" : `Saindo de ${cityName}`}
                </p>
                <h2
                  id="planejador-visita-titulo"
                  className="mt-1 text-2xl font-bold text-fg"
                >
                  {isSell
                    ? `Rotas de ${cityName} até as lojas em Esteio`
                    : `Rotas de ${cityName} até as duas lojas`}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600 sm:text-base">
                  {isSell
                    ? "Escolha a região mais próxima e abra o caminho até cada loja. Antes de sair, envie os dados do carro pelo WhatsApp e combine a vistoria."
                    : "Escolha uma região de saída para abrir o trajeto até cada loja. No Google Maps, ajuste o endereço inicial se precisar."}
                </p>
              </div>
            </div>

            <fieldset className="mt-6">
              <legend className="text-sm font-semibold text-fg">
                De qual região de {cityName} você pretende sair?
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {origins.map((origin) => {
                  const active = origin.id === selectedOrigin.id;
                  return (
                    <button
                      key={origin.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelectedOriginId(origin.id)}
                      className={
                        active
                          ? "rounded-full bg-[#00283C] px-4 py-2 text-sm font-semibold text-white shadow-sm"
                          : "rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#00283C] ring-1 ring-[#00283C]/15 transition-colors hover:bg-gray-50"
                      }
                    >
                      {origin.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {STORES.map((store) => (
                <article
                  key={store.id}
                  className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <MapPin
                      className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-fg">{store.name}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-gray-600">
                        {store.address}
                      </p>
                    </div>
                  </div>
                  <a
                    href={buildDirectionsUrl(
                      selectedOrigin.query,
                      store.address,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-regional-action={`route_${store.id}_from_${selectedOrigin.id}`}
                    className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#00283C] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#00435a]"
                  >
                    {isSell ? "Traçar rota saindo do" : "Abrir rota do"} {selectedOrigin.label}
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                </article>
              ))}
            </div>

            <p className="mt-5 rounded-xl bg-white/80 p-4 text-sm leading-relaxed text-gray-600 ring-1 ring-black/5">
              {isSell
                ? "A vistoria é feita nas lojas de Esteio. As duas unidades ficam a cerca de 400 m uma da outra e trabalham com a mesma equipe e estrutura. O valor final depende da avaliação presencial."
                : "As duas lojas ficam somente em Esteio, a cerca de 400 m uma da outra, e trabalham com estoque, vendedores e atendimento integrados. Confirme pelo WhatsApp a disponibilidade e onde estão os carros escolhidos antes de sair."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
