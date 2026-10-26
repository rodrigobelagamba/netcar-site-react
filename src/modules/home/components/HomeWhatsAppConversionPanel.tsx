import { ArrowRight } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { Vehicle } from "@/catalog/endpoints/vehicles";
import { formatKm, formatPrice, formatYear } from "@/lib/formatters";
import { generateVehicleSlug } from "@/lib/slug";
import { optimizeStockImage, stockImageSrcSet } from "@/lib/images";
import { VehicleWarrantySummary } from "@/design-system/components/patterns/VehicleWarrantySummary";

const CAR_COVERED_PLACEHOLDER_URL = "/images/semcapa.webp";

interface HomeWhatsAppConversionPanelProps {
  featuredVehicle?: Vehicle;
  onViewStock: () => void;
}

function vehicleImage(vehicle?: Vehicle): string {
  return (
    vehicle?.imagens_site?.capa ||
    vehicle?.imagens_site?.capa_thumb ||
    vehicle?.images?.[0] ||
    CAR_COVERED_PLACEHOLDER_URL
  );
}

function vehicleLabel(vehicle?: Vehicle): string {
  if (!vehicle) return "seminovo";
  return [vehicle.marca, vehicle.modelo, vehicle.year]
    .filter(Boolean)
    .join(" ");
}

function vehiclePrice(vehicle?: Vehicle): string {
  if (!vehicle) return "";
  const formatted = vehicle.valor_formatado?.replace(/<[^>]*>/g, "");
  return formatted || formatPrice(vehicle.price);
}

export function HomeWhatsAppConversionPanel({
  featuredVehicle,
  onViewStock,
}: HomeWhatsAppConversionPanelProps) {
  const navigate = useNavigate();
  const label = vehicleLabel(featuredVehicle);
  const title = featuredVehicle
    ? [featuredVehicle.marca, featuredVehicle.modelo || featuredVehicle.name]
        .filter(Boolean)
        .join(" ")
    : "Destaque do estoque";
  const image = vehicleImage(featuredVehicle);
  const price = vehiclePrice(featuredVehicle);

  const goToFeaturedVehicle = () => {
    if (!featuredVehicle) {
      onViewStock();
      return;
    }

    const slug = generateVehicleSlug({
      modelo: featuredVehicle.modelo || featuredVehicle.name,
      marca: featuredVehicle.marca,
      year: featuredVehicle.year,
      placa: featuredVehicle.placa,
      id: featuredVehicle.id,
    });
    navigate({ to: "/veiculo/$slug", params: { slug } });
  };

  return (
    <section className="relative overflow-hidden bg-[#00283C] px-4 py-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
      <div className="pointer-events-none absolute -left-20 top-0 hidden h-56 w-56 rounded-full bg-[#5CD29D]/20 blur-3xl md:block" />
      <div className="pointer-events-none absolute -right-16 bottom-0 hidden h-64 w-64 rounded-full bg-white/10 blur-3xl md:block" />

      <div className="container-main relative grid gap-4 md:grid-cols-2 md:items-stretch">
        <div className="rounded-3xl border border-white/10 bg-white/[0.07] p-3 text-white shadow-sm md:flex md:flex-col md:justify-between md:p-5 md:backdrop-blur">
          <div>
            <h1 className="text-xl font-black leading-tight [text-wrap:balance] md:text-[30px] xl:text-[32px]">
              Seu próximo carro, com o cuidado Netcar.
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-white/78 md:text-base">
              Seminovos selecionados no RS e preparados na Fábrica de Valor.
            </p>
          </div>

          <div
            data-home-conversion-cta
            className="mt-3 grid grid-cols-2 gap-2 md:mt-4 md:flex md:flex-wrap"
          >
            <button
              type="button"
              onClick={onViewStock}
              className="inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl bg-[#087A37] px-3 py-2 text-sm font-black text-white transition-colors"
            >
              Ver estoque
              <ArrowRight className="hidden h-4 w-4 shrink-0 md:block" aria-hidden="true" />
            </button>
            <Link
              to="/sobre"
              className="inline-flex min-h-11 min-w-0 items-center justify-center rounded-2xl border border-white/20 bg-white px-3 py-2 text-center text-sm font-black leading-tight text-[#00283C] transition-colors hover:bg-white/90 md:bg-white/10 md:text-white md:hover:bg-white/18"
            >
              Conheça a Netcar
            </Link>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-white/90">
            Desde 1997 · 2 lojas em Esteio
          </p>
        </div>

        <div className="hidden min-w-0 rounded-3xl border border-white/12 bg-white p-4 shadow-sm md:block">
          <h2 className="text-lg font-black leading-snug text-[#00283C]" title={label}>
            {title}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-gray-600">
            <span>{featuredVehicle ? formatYear(featuredVehicle.year) : "—"}</span>
            <span aria-hidden="true">·</span>
            <span>{featuredVehicle ? formatKm(featuredVehicle.km) : "—"}</span>
            <span aria-hidden="true">·</span>
            <span>{featuredVehicle?.cambio || "—"}</span>
          </p>

          <div className="mt-1 flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={goToFeaturedVehicle}
              className="block h-[168px] min-w-0 flex-1 overflow-hidden rounded-2xl bg-transparent p-0"
            >
              <img
                src={optimizeStockImage(image, 768)}
                srcSet={stockImageSrcSet(image, [480, 640, 768, 960])}
                sizes="(min-width: 768px) 35vw, 100vw"
                alt={label}
                width={960}
                height={640}
                className="mx-auto h-full w-full -translate-y-3 scale-[1.6] object-contain"
                loading="eager"
                decoding="async"
              />
            </button>
            <VehicleWarrantySummary
              vehicle={featuredVehicle}
              className="shrink-0 [&>div]:flex-col [&>div>div]:w-[60px]"
              showNote={false}
            />
          </div>

          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <p className="whitespace-nowrap text-xl font-black leading-tight text-[#00283C]">
              {price || "Consulte"}
            </p>
            <div data-home-conversion-cta>
              <button
                type="button"
                onClick={goToFeaturedVehicle}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#00283C] px-3 py-2 text-sm font-black text-white transition-colors hover:bg-[#00435a]"
              >
                Ver carro
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
