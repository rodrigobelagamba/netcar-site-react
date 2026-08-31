import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUp,
  Car,
  Check,
  MessageCircle,
  Plus,
  X,
} from "lucide-react";
import { useMetaTags } from "@/hooks/useMetaTags";
import { useVehiclesQuery } from "@/catalog/queries/useVehiclesQuery";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import type { Vehicle } from "@/catalog/endpoints/vehicles";
import { LazyLocalizacao } from "@/design-system/components/layout/LazyLocalizacao";
import { IanBot } from "@/design-system/components/layout/IanBot";
import { emptySeminovosSearch } from "@/lib/seminovos-search";
import { RegionalTrustSignals } from "@/modules/seo/components/RegionalTrustSignals";
import { RegionalSeoHero } from "@/modules/seo/components/RegionalSeoHero";
import { trackCompareInteraction } from "@/lib/analytics";
import { generateVehicleSlug } from "@/lib/slug";
import { resolvedVehicleCategory } from "@/lib/vehicleCategory";
import { buildWhatsAppUrl, siteWhatsAppMessage } from "@/lib/whatsappMessages";
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
  const { data: whatsapp } = useWhatsAppQuery();
  const { veiculo: initialVehicleId } = useSearch({ from: "/comparar" });
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const comparisonRef = useRef<HTMLDivElement>(null);
  const trackedPreselectionRef = useRef<string | null>(null);

  useMetaTags({
    title: "Comparar carros lado a lado | Preço e ficha | Netcar",
    description:
      "Escolha de 2 a 4 carros do estoque e compare preço, ano, câmbio, motor e outros dados na mesma tela. Abra as fichas e veja qual combina mais com você.",
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

  useEffect(() => {
    const vehicleId = String(initialVehicleId || "").trim();
    if (!vehicleId || list.length === 0) return;

    const vehicle = list.find((item) => String(item.id) === vehicleId);
    if (!vehicle) return;

    setSelected((current) =>
      current.includes(vehicleId)
        ? current
        : [vehicleId, ...current].slice(0, MAX_COMPARE),
    );

    if (trackedPreselectionRef.current !== vehicleId) {
      trackedPreselectionRef.current = vehicleId;
      trackCompareInteraction({
        action: "preselect",
        vehicleIds: [vehicleId],
        vehicleNames: [
          `${vehicle.marca || ""} ${vehicle.modelo || vehicle.name}`.trim(),
        ],
      });
    }
  }, [initialVehicleId, list]);

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

  const comparisonNames = chosen.map((vehicle) =>
    `${vehicle.marca || ""} ${vehicle.modelo || vehicle.name} ${vehicle.year || ""}`
      .trim()
      .replace(/\s+/g, " "),
  );
  const comparisonWhatsAppUrl = whatsapp?.numero
    ? buildWhatsAppUrl(
        whatsapp.numero,
        siteWhatsAppMessage(
          `comparei ${comparisonNames.join(" x ")} e quero ajuda para escolher entre eles`,
        ),
      )
    : "#";

  function showComparison() {
    comparisonRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

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
        eyebrow="Comparador Netcar"
        title="Compare carros lado a lado"
        intro={`Escolha de 2 a ${MAX_COMPARE} carros do estoque e veja preço, ano, câmbio, motor e outros dados na mesma tela. Depois, abra as fichas ou peça ajuda para decidir.`}
        badges={
          <>
            {[
              "1. Escolha os carros",
              "2. Veja as diferenças",
              "3. Abra a ficha",
            ].map((step) => (
              <span
                key={step}
                className="rounded-full border border-[#00283C]/10 bg-white px-4 py-2 text-sm font-bold text-[#00283C] shadow-sm"
              >
                {step}
              </span>
            ))}
          </>
        }
      />

      <section className="pb-16">
        <div className="container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <div className="mb-8 rounded-2xl border border-gray-200 bg-[#F7FAFA] p-5 sm:p-6">
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
                  Comece com dois carros
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Escolha um dos pares prontos ou monte a sua própria
                  comparação logo abaixo.
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
            <div
              ref={comparisonRef}
              className="mb-10 scroll-mt-28 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_16px_44px_rgba(0,40,60,0.08)]"
            >
              <div className="flex flex-col gap-2 border-b border-gray-100 bg-[#00283C] px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5CD29D]">
                    Sua comparação
                  </p>
                  <h2 className="mt-1 text-xl font-black">
                    {chosen.length === 1
                      ? "Escolha mais um carro"
                      : `${chosen.length} carros lado a lado`}
                  </h2>
                </div>
                {chosen.length >= 2 && (
                  <span className="text-sm font-semibold text-white/75">
                    Compare os dados e abra a ficha para ver fotos e opcionais.
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 w-32 min-w-32 bg-white p-4 text-left align-bottom font-medium text-gray-500">
                        Item
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
                        <td className="sticky left-0 z-10 bg-white p-4 font-medium text-gray-500">
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

              {chosen.length >= 2 && (
                <div className="border-t border-gray-100 bg-[#F7FAFA] p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="max-w-xl">
                      <h3 className="text-lg font-black text-[#00283C]">
                        Quer ajuda para decidir?
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-gray-600">
                        A mensagem já leva os carros que você comparou. Nossa
                        equipe pode explicar as diferenças e confirmar quais
                        continuam disponíveis.
                      </p>
                    </div>
                    <a
                      href={comparisonWhatsAppUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-wa-source="comparison"
                      data-wa-intent="comparison_help"
                      onClick={() =>
                        trackCompareInteraction({
                          action: "whatsapp",
                          vehicleIds: chosen.map((vehicle) => vehicle.id),
                          vehicleNames: comparisonNames,
                        })
                      }
                      className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#087A37] px-5 py-3 font-black text-white shadow-[0_10px_28px_rgba(8,122,55,0.25)] transition-colors hover:bg-[#075E54]"
                    >
                      <MessageCircle className="h-5 w-5" />
                      Quero ajuda para escolher
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {chosen.length === 1 && (
            <p className="mb-6 text-sm text-amber-600">
              Selecione pelo menos mais um carro para comparar.
            </p>
          )}

          {/* Seleção */}
          <div className="mb-5 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-bold text-fg">
                {presets.length > 0
                  ? "Ou monte a sua comparação"
                  : "Escolha os carros"}{" "}
                {selected.length > 0 && `(${selected.length}/${MAX_COMPARE})`}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Busque por marca ou modelo e selecione de 2 a {MAX_COMPARE}
                carros.
              </p>
            </div>
            {selected.length >= 2 && (
              <button
                type="button"
                onClick={showComparison}
                className="inline-flex items-center gap-2 rounded-xl bg-[#00283C] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#00435a]"
              >
                Ver comparação
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
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

      <RegionalTrustSignals />

      <div className="w-full font-sans antialiased text-muted-foreground bg-muted py-12 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 space-y-8">
        <div className="container-main space-y-8">
          <LazyLocalizacao />
          <IanBot />
        </div>
      </div>
    </main>
  );
}
