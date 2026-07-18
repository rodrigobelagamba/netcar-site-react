import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Plus, X, Car } from "lucide-react";
import { useDefaultMetaTags } from "@/hooks/useDefaultMetaTags";
import { useVehiclesQuery } from "@/catalog/queries/useVehiclesQuery";
import type { Vehicle } from "@/catalog/endpoints/vehicles";
import { Localizacao } from "@/design-system/components/layout/Localizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";
import { emptySeminovosSearch } from "@/lib/seminovos-search";
import { isAvailableHomeStockVehicle } from "@/lib/homeStock";
import { RegionalActionCtas } from "@/modules/seo/components/RegionalActionCtas";
import { RegionalTrustSignals } from "@/modules/seo/components/RegionalTrustSignals";
import { RegionalSeoHero } from "@/modules/seo/components/RegionalSeoHero";

const MAX_COMPARE = 4;

/** API manda preço com HTML (`<span>R$</span>`); remove tags. */
function fmtPrice(vehicle: Vehicle) {
  const cleaned = vehicle.valor_formatado?.replace(/<[^>]*>/g, "").trim();
  if (cleaned) return cleaned;
  if (vehicle.price) return `R$ ${vehicle.price.toLocaleString("pt-BR")}`;
  return "—";
}

export function ComparadorPage() {
  const { data: vehicles, isLoading } = useVehiclesQuery({ limit: 500 });
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  useDefaultMetaTags(
    "Comparar seminovos lado a lado",
    "Compare até 4 seminovos do estoque da Netcar lado a lado: preço, ano, câmbio, motor e itens. Escolha o seu em Esteio/RS."
  );

  const list = useMemo(
    () => (vehicles ?? []).filter(isAvailableHomeStockVehicle),
    [vehicles],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((v) =>
      `${v.marca || ""} ${v.modelo || ""}`.toLowerCase().includes(q)
    );
  }, [list, query]);

  const chosen: Vehicle[] = selected
    .map((id) => list.find((v) => v.id === id))
    .filter((v): v is Vehicle => !!v);

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
  }

  const rows: { label: string; get: (v: Vehicle) => string }[] = [
    { label: "Preço", get: (v) => fmtPrice(v) },
    { label: "Ano", get: (v) => (v.year ? String(v.year) : "—") },
    { label: "Câmbio", get: (v) => v.cambio || "—" },
    { label: "Motor", get: (v) => v.motor || "—" },
    { label: "Combustível", get: (v) => v.combustivel || "—" },
    { label: "Potência", get: (v) => v.potencia || "—" },
    { label: "Portas", get: (v) => (v.portas ? String(v.portas) : "—") },
    { label: "Cor", get: (v) => v.cor || "—" },
    { label: "Categoria", get: (v) => v.categoria || "—" },
  ];

  return (
    <main className="flex-1 overflow-x-hidden max-w-full bg-white">
      <RegionalSeoHero
        eyebrow="Ferramenta de escolha"
        title="Comparar seminovos lado a lado"
        intro={`Escolha de 2 a ${MAX_COMPARE} carros do estoque e compare preço, ano, câmbio e itens. Depois avance com troca, parcelamento ou WhatsApp.`}
      >
        <RegionalActionCtas
          className="mt-8"
          waText="vim pelo comparador e quero ajuda para escolher um seminovo."
          primary="stock"
        />
      </RegionalSeoHero>

      <RegionalTrustSignals />

      <section className="pb-16">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          {/* Tabela comparativa */}
          {chosen.length > 0 && (
            <div className="mb-10 overflow-x-auto rounded-2xl border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left p-4 w-32 align-bottom text-gray-500 font-medium">Comparando {chosen.length}</th>
                    {chosen.map((v) => (
                      <th key={v.id} className="text-left p-4 min-w-[160px] align-bottom">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-fg leading-snug">
                            {v.marca} {v.modelo}
                          </span>
                          <button
                            onClick={() => toggle(v.id)}
                            aria-label="Remover do comparativo"
                            className="text-gray-400 hover:text-red-500 shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.label} className="border-t border-gray-100">
                      <td className="p-4 font-medium text-gray-500">{row.label}</td>
                      {chosen.map((v) => (
                        <td key={v.id} className="p-4 text-fg">{row.get(v)}</td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-t border-gray-100">
                    <td className="p-4" />
                    {chosen.map((v) => (
                      <td key={v.id} className="p-4">
                        <Link
                          to="/veiculo/$slug"
                          params={{ slug: v.slug }}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-white text-xs font-semibold hover:bg-primary/90"
                        >
                          Ver detalhes
                        </Link>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {chosen.length === 1 && (
            <p className="mb-6 text-sm text-amber-600">Selecione pelo menos mais um carro para comparar.</p>
          )}

          {/* Seleção */}
          <div className="mb-5 flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-xl font-bold text-fg">
              Escolha os carros {selected.length > 0 && `(${selected.length}/${MAX_COMPARE})`}
            </h2>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por marca ou modelo..."
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {isLoading ? (
            <p className="text-gray-500">Carregando estoque...</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filtered.map((v) => {
                const isSel = selected.includes(v.id);
                const full = selected.length >= MAX_COMPARE && !isSel;
                const cover = v.imagens_site?.capa_thumb || v.images?.[0] || "/images/loja1.jpg";
                return (
                  <button
                    key={v.id}
                    onClick={() => toggle(v.id)}
                    disabled={full}
                    className={[
                      "text-left rounded-xl border bg-white overflow-hidden transition-all",
                      isSel ? "border-primary ring-2 ring-primary/30" : "border-gray-200 hover:border-primary/40",
                      full ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                    ].join(" ")}
                  >
                    <div className="relative aspect-[4/3] bg-gray-100">
                      <img
                        src={cover}
                        alt={`${v.marca} ${v.modelo}`}
                        loading="lazy"
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.src = "/images/loja1.jpg"; }}
                      />
                      <span
                        className={[
                          "absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full text-white",
                          isSel ? "bg-primary" : "bg-black/40",
                        ].join(" ")}
                      >
                        {isSel ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-fg text-sm leading-snug line-clamp-2">
                        {v.marca} {v.modelo}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {v.year || "—"}
                      </p>
                      <p className="text-sm font-bold text-primary mt-1">
                        {fmtPrice(v)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <p className="text-gray-500">
              Nenhum carro encontrado.{" "}
              <Link to="/seminovos" search={emptySeminovosSearch} className="text-primary font-semibold hover:underline">
                Ver estoque completo
              </Link>
              .
            </p>
          )}

          <div className="mt-10">
            <Link
              to="/seminovos"
              search={emptySeminovosSearch}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-white font-semibold hover:bg-primary/90"
            >
              <Car className="w-4 h-4" />
              Ver estoque completo
            </Link>
          </div>
        </div>
      </section>

      <div className="w-full font-sans antialiased text-muted-foreground bg-muted py-12 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 space-y-8">
        <div className="container-main space-y-8">
          <Localizacao />
          <IanBot />
        </div>
      </div>
    </main>
  );
}
