import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Plus, X, Car } from "lucide-react";
import { useMetaTags } from "@/hooks/useMetaTags";
import { useVehiclesQuery } from "@/catalog/queries/useVehiclesQuery";
import type { Vehicle } from "@/catalog/endpoints/vehicles";
import { LazyLocalizacao } from "@/design-system/components/layout/LazyLocalizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";
import { emptySeminovosSearch } from "@/lib/seminovos-search";
import { RegionalActionCtas } from "@/modules/seo/components/RegionalActionCtas";
import { RegionalTrustSignals } from "@/modules/seo/components/RegionalTrustSignals";
import { RegionalSeoHero } from "@/modules/seo/components/RegionalSeoHero";
import { trackCompareInteraction } from "@/lib/analytics";
import { generateVehicleSlug } from "@/lib/slug";
import { resolvedVehicleCategory } from "@/lib/vehicleCategory";
import {
  optimizeStockImage,
  stockGalleryPreviewSource,
  stockImageSrcSet,
} from "@/lib/images";

const MAX_COMPARE = 4;
const COMPARISON_PRESETS = [
  {
    label: "Jeep Compass x Honda HR-V",
    left: { brand: "JEEP", model: "COMPASS" },
    right: { brand: "HONDA", model: "HRV" },
  },
  {
    label: "Chevrolet Tracker x Hyundai Creta",
    left: { brand: "CHEVROLET", model: "TRACKER" },
    right: { brand: "HYUNDAI", model: "CRETA" },
  },
  {
    label: "Volkswagen Nivus x Fiat Fastback",
    left: { brand: "VOLKSWAGEN", model: "NIVUS" },
    right: { brand: "FIAT", model: "FASTBACK" },
  },
  {
    label: "Volkswagen Tera x Volkswagen T-Cross",
    left: { brand: "VOLKSWAGEN", model: "TERA" },
    right: { brand: "VOLKSWAGEN", model: "T CROSS" },
  },
] as const;

function normalized(value: unknown) {
  return String(value || "")
    .trim()
    .toLocaleUpperCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function compact(value: unknown) {
  return normalized(value).replace(/\s+/g, "");
}

function closestPricePair(left: Vehicle[], right: Vehicle[]) {
  let result: { left: Vehicle; right: Vehicle; difference: number } | null =
    null;
  for (const leftVehicle of left) {
    for (const rightVehicle of right) {
      const difference = Math.abs(
        Number(leftVehicle.price || 0) - Number(rightVehicle.price || 0),
      );
      if (!result || difference < result.difference) {
        result = { left: leftVehicle, right: rightVehicle, difference };
      }
    }
  }
  return result;
}

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

  useMetaTags({
    title: "Comparar carros seminovos lado a lado | Netcar",
    description:
      "Compare até 4 carros seminovos lado a lado: preço, ano, câmbio, motor e características. Use o estoque atual da Netcar em Esteio/RS.",
    url: "https://www.netcarmultimarcas.com.br/comparar",
  });

  const list = useMemo(
    () => (vehicles ?? []).filter((vehicle) => Number(vehicle.price || 0) > 0),
    [vehicles],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((v) =>
      `${v.marca || ""} ${v.modelo || ""}`.toLowerCase().includes(q),
    );
  }, [list, query]);

  const presets = useMemo(
    () =>
      COMPARISON_PRESETS.map((preset) => {
        const left = list.filter(
          (vehicle) =>
            normalized(vehicle.marca) === normalized(preset.left.brand) &&
            compact(vehicle.modelo).includes(compact(preset.left.model)),
        );
        const right = list.filter(
          (vehicle) =>
            normalized(vehicle.marca) === normalized(preset.right.brand) &&
            compact(vehicle.modelo).includes(compact(preset.right.model)),
        );
        const pair = closestPricePair(left, right);
        return pair ? { label: preset.label, ...pair } : null;
      }).filter((preset): preset is NonNullable<typeof preset> =>
        Boolean(preset),
      ),
    [list],
  );

  const chosen: Vehicle[] = selected
    .map((id) => list.find((v) => v.id === id))
    .filter((v): v is Vehicle => !!v);

  function toggle(id: string) {
    const isRemoving = selected.includes(id);
    const next = isRemoving
      ? selected.filter((item) => item !== id)
      : selected.length >= MAX_COMPARE
        ? selected
        : [...selected, id];
    if (next === selected) return;
    setSelected(next);
    const nextVehicles = next
      .map((vehicleId) => list.find((vehicle) => vehicle.id === vehicleId))
      .filter((vehicle): vehicle is Vehicle => Boolean(vehicle));
    trackCompareInteraction({
      action: isRemoving ? "remove" : "select",
      vehicleIds: next,
      vehicleNames: nextVehicles.map((vehicle) =>
        `${vehicle.marca || ""} ${vehicle.modelo || vehicle.name}`.trim(),
      ),
    });
  }

  function applyPreset(preset: (typeof presets)[number]) {
    const next = [preset.left.id, preset.right.id];
    setSelected(next);
    trackCompareInteraction({
      action: "preset",
      vehicleIds: next,
      vehicleNames: [
        `${preset.left.marca || ""} ${preset.left.modelo || preset.left.name}`.trim(),
        `${preset.right.marca || ""} ${preset.right.modelo || preset.right.name}`.trim(),
      ],
      preset: preset.label,
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
    { label: "Categoria", get: (v) => resolvedVehicleCategory(v) || "—" },
  ];

  return (
    <main className="flex-1 overflow-x-hidden max-w-full bg-white">
      <RegionalSeoHero
        eyebrow="Estoque atual"
        title="Comparar carros seminovos lado a lado"
        intro={`Escolha de 2 a ${MAX_COMPARE} carros do estoque e compare preço, ano, câmbio, motor e outros dados da ficha na mesma tela.`}
      >
        <RegionalActionCtas
          className="mt-8"
          waText="vim pelo comparador e quero ajuda para escolher um seminovo."
          primary="whatsapp"
        />
      </RegionalSeoHero>

      <RegionalTrustSignals />

      <section className="pb-16">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <div className="mb-8 min-h-[260px] rounded-2xl border border-gray-200 bg-[#F7FAFA] p-5 sm:min-h-[160px] sm:p-6">
            {isLoading ? (
              <div aria-live="polite" aria-busy="true">
                <div className="h-6 w-72 max-w-full animate-pulse rounded bg-gray-200" />
                <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded bg-gray-200" />
                <div className="mt-5 flex flex-wrap gap-3">
                  {[0, 1, 2].map((item) => (
                    <div
                      key={item}
                      className="h-10 w-48 animate-pulse rounded-full bg-gray-200"
                    />
                  ))}
                </div>
                <span className="sr-only">Carregando comparações rápidas</span>
              </div>
            ) : presets.length > 0 ? (
              <>
                <h2 className="text-lg font-bold text-fg">
                  Comparações rápidas com o estoque atual
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Cada atalho escolhe dois carros de preço próximo que estão no
                  estoque.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {presets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="rounded-full border border-[#00283C]/15 bg-white px-4 py-2.5 text-sm font-bold text-[#00283C] transition-colors hover:border-primary hover:text-primary"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-fg">
                  Monte sua comparação
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  Selecione de dois a quatro carros abaixo para comparar os
                  dados disponíveis na ficha.
                </p>
              </>
            )}
          </div>

          {/* Tabela comparativa */}
          {chosen.length > 0 && (
            <div className="mb-10 overflow-x-auto rounded-2xl border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left p-4 w-32 align-bottom text-gray-500 font-medium">
                      Comparando {chosen.length}
                    </th>
                    {chosen.map((v) => (
                      <th
                        key={v.id}
                        className="text-left p-4 min-w-[160px] align-bottom"
                      >
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
                      <td className="p-4 font-medium text-gray-500">
                        {row.label}
                      </td>
                      {chosen.map((v) => (
                        <td key={v.id} className="p-4 text-fg">
                          {row.get(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-t border-gray-100">
                    <td className="p-4" />
                    {chosen.map((v) => (
                      <td key={v.id} className="p-4">
                        <Link
                          to="/veiculo/$slug"
                          params={{ slug: generateVehicleSlug(v) }}
                          onClick={() =>
                            trackCompareInteraction({
                              action: "view_details",
                              vehicleIds: [v.id],
                              vehicleNames: [
                                `${v.marca || ""} ${v.modelo || v.name}`.trim(),
                              ],
                            })
                          }
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
            <p className="mb-6 text-sm text-amber-600">
              Selecione pelo menos mais um carro para comparar.
            </p>
          )}

          {/* Seleção */}
          <div className="mb-5 flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-xl font-bold text-fg">
              Escolha os carros{" "}
              {selected.length > 0 && `(${selected.length}/${MAX_COMPARE})`}
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
                const coverSource = stockGalleryPreviewSource(
                  v.imagens_site?.capa_thumb ||
                    v.imagens_site?.capa ||
                    v.images?.[0] ||
                    "/images/semcapa.webp",
                );
                const cover = optimizeStockImage(coverSource, 480);
                const coverSrcSet = stockImageSrcSet(
                  coverSource,
                  [240, 320, 480, 640],
                );
                return (
                  <button
                    key={v.id}
                    onClick={() => toggle(v.id)}
                    disabled={full}
                    className={[
                      "text-left rounded-xl border bg-white overflow-hidden transition-all",
                      isSel
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-gray-200 hover:border-primary/40",
                      full ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                    ].join(" ")}
                  >
                    <div className="relative aspect-[4/3] bg-gray-100">
                      <img
                        src={cover}
                        srcSet={coverSrcSet}
                        sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 20vw"
                        alt={`${v.marca} ${v.modelo}`}
                        loading="lazy"
                        decoding="async"
                        width={480}
                        height={360}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.removeAttribute("srcset");
                          e.currentTarget.src = optimizeStockImage(
                            "/images/semcapa.webp",
                            480,
                          );
                        }}
                      />
                      <span
                        className={[
                          "absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full text-white",
                          isSel ? "bg-primary" : "bg-black/40",
                        ].join(" ")}
                      >
                        {isSel ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
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
              <Link
                to="/seminovos"
                search={emptySeminovosSearch}
                className="text-primary font-semibold hover:underline"
              >
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
          <LazyLocalizacao />
          <IanBot />
        </div>
      </div>
    </main>
  );
}
