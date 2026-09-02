import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, MessageCircle, Search } from "lucide-react";
import type { Vehicle } from "@/catalog/endpoints/vehicles";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import { formatKm, formatPrice } from "@/lib/formatters";
import { optimizeStockImage } from "@/lib/images";
import { emptySeminovosSearch } from "@/lib/seminovos-search";
import { generateVehicleSlug } from "@/lib/slug";
import {
  buildWhatsAppUrl,
  DEFAULT_SALES_WHATSAPP,
  homeWhatsAppMessages,
} from "@/lib/whatsappMessages";

const PLACEHOLDER = "/images/semcapa.webp";
const CARDS = 3;

interface HomeMobileFirstScreenProps {
  vehicles: Vehicle[];
  totalAvailable: number;
  isLoading: boolean;
}

function priceLabel(vehicle: Vehicle): string {
  return (
    vehicle.valor_formatado?.replace(/<[^>]*>/g, "") ||
    formatPrice(vehicle.price)
  );
}

function CardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#00283C]/8 bg-white p-2.5">
      <div className="h-[72px] w-[104px] shrink-0 animate-pulse rounded-xl bg-gray-200" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-3/4 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
        <div className="h-4 w-2/5 animate-pulse rounded bg-gray-200" />
      </div>
    </div>
  );
}

/**
 * Primeira tela da Home no mobile (< md): busca, 3 carros com preço e um
 * único WhatsApp. Substitui hero de vídeo/imagem que empurrava tudo pra baixo.
 */
export function HomeMobileFirstScreen({
  vehicles,
  totalAvailable,
  isLoading,
}: HomeMobileFirstScreenProps) {
  const navigate = useNavigate();
  const { data: whatsapp } = useWhatsAppQuery();
  const [query, setQuery] = useState("");

  const brands = useMemo(() => {
    const set = new Set<string>();
    vehicles.forEach((v) => v.marca && set.add(v.marca));
    return [...set];
  }, [vehicles]);

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    const term = query.trim();
    if (!term) {
      navigate({ to: "/seminovos", search: emptySeminovosSearch });
      return;
    }
    const lower = term.toLowerCase();
    const brand = brands.find(
      (b) =>
        lower === b.toLowerCase() || lower.startsWith(`${b.toLowerCase()} `),
    );
    const rest = brand ? term.slice(brand.length).trim() : "";
    navigate({
      to: "/seminovos",
      search: {
        ...emptySeminovosSearch,
        marca: brand,
        modelo: brand ? rest || undefined : term,
      },
    });
  };

  const waHref = buildWhatsAppUrl(
    whatsapp?.numero || DEFAULT_SALES_WHATSAPP,
    homeWhatsAppMessages().vehicleInterest,
  );

  const cards = vehicles.slice(0, CARDS);

  return (
    <section aria-labelledby="home-mobile-title" className="md:hidden">
      {/* Topo escuro: header transparente com logo branco senta aqui. */}
      <div className="bg-[#00283C] px-4 pb-8 pt-[4.75rem] text-white">
        <h1
          id="home-mobile-title"
          className="text-[1.4rem] font-black leading-tight"
        >
          Seminovos em Esteio/RS
        </h1>
        <p className="mt-1 text-[13px] font-medium text-white/75">
          Preço na tela, troca aceita e até 60x. Fale direto no WhatsApp.
        </p>

        <form
          role="search"
          onSubmit={onSearch}
          className="mt-3 flex items-center gap-2 rounded-2xl bg-white p-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.25)]"
        >
          <Search
            className="ml-2 h-4 w-4 shrink-0 text-[#00283C]/50"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Marca ou modelo (ex.: Corolla)"
            aria-label="Buscar carro por marca ou modelo"
            enterKeyHint="search"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-[#00283C] outline-none placeholder:text-[#00283C]/40"
          />
          <button
            type="submit"
            className="shrink-0 rounded-xl bg-[#087A37] px-3.5 py-2.5 text-xs font-black uppercase tracking-wide text-white"
          >
            Buscar
          </button>
        </form>
      </div>

      <div className="bg-[#F6F8F9] px-4 pb-4">
        <ul className="-mt-5 space-y-2" aria-label="Carros em destaque">
          {isLoading && cards.length === 0
            ? Array.from({ length: CARDS }).map((_, i) => (
                <li key={i}>
                  <CardSkeleton />
                </li>
              ))
            : cards.map((vehicle, index) => {
                const slug = generateVehicleSlug({
                  modelo: vehicle.modelo || vehicle.name,
                  marca: vehicle.marca,
                  year: vehicle.year,
                  placa: vehicle.placa,
                  id: vehicle.id,
                });
                const image =
                  vehicle.imagens_site?.capa_thumb ||
                  vehicle.imagens_site?.capa ||
                  PLACEHOLDER;
                const title = [vehicle.marca, vehicle.modelo || vehicle.name]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <li key={vehicle.id}>
                    <Link
                      to="/veiculo/$slug"
                      params={{ slug }}
                      className="flex items-center gap-3 rounded-2xl border border-[#00283C]/8 bg-white p-2.5 shadow-[0_4px_14px_rgba(0,40,60,0.05)] active:scale-[0.99]"
                    >
                      <img
                        src={optimizeStockImage(image, 320)}
                        alt={title}
                        width={104}
                        height={72}
                        loading={index === 0 ? "eager" : "lazy"}
                        fetchPriority={index === 0 ? "high" : undefined}
                        decoding="async"
                        className="h-[72px] w-[104px] shrink-0 rounded-xl bg-[#F3F5F6] object-contain"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[14px] font-black leading-tight text-[#00283C]">
                          {title}
                        </p>
                        <p className="mt-0.5 text-[12px] text-[#00283C]/60">
                          {vehicle.year}
                          {vehicle.km ? ` · ${formatKm(vehicle.km)}` : ""}
                          {vehicle.cambio ? ` · ${vehicle.cambio}` : ""}
                        </p>
                        <p className="mt-1 text-[16px] font-black leading-none text-[#087A37]">
                          {priceLabel(vehicle)}
                        </p>
                      </div>
                      <ArrowRight
                        className="h-4 w-4 shrink-0 text-[#00283C]/40"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                );
              })}
        </ul>

        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            data-wa-source="home_first_screen"
            data-wa-intent="vehicle_interest"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#087A37] px-4 text-[15px] font-black text-white shadow-[0_10px_26px_rgba(8,122,55,0.28)] active:scale-[0.98]"
          >
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
            Falar no WhatsApp
          </a>
          <Link
            to="/seminovos"
            search={emptySeminovosSearch}
            className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-2xl border border-[#00283C]/15 bg-white px-3.5 text-[13px] font-black text-[#00283C]"
          >
            {totalAvailable > 0 ? `${totalAvailable} carros` : "Estoque"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
