import {
  MessageCircle,
  ShieldCheck,
  MapPin,
  Clock,
  Car,
  ArrowRight,
  Calculator,
  Sparkles,
  Gauge,
  Bot,
} from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import type { Vehicle } from "@/catalog/endpoints/vehicles";
import { formatKm, formatPrice, formatYear } from "@/lib/formatters";
import { generateVehicleSlug } from "@/lib/slug";
import {
  buildWhatsAppUrl,
  homeWhatsAppMessages,
  vehicleWhatsAppMessages,
} from "@/lib/whatsappMessages";

const CAR_COVERED_PLACEHOLDER_URL = "/images/semcapa.png";

interface HomeWhatsAppConversionPanelProps {
  featuredVehicle?: Vehicle;
  onViewStock: () => void;
}

function vehicleImage(vehicle?: Vehicle): string {
  return (
    vehicle?.imagens_site?.capa_thumb ||
    vehicle?.imagens_site?.capa ||
    vehicle?.images?.[0] ||
    CAR_COVERED_PLACEHOLDER_URL
  );
}

function vehicleLabel(vehicle?: Vehicle): string {
  if (!vehicle) return "seminovo";
  return [vehicle.marca, vehicle.modelo, vehicle.year].filter(Boolean).join(" ");
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
  const { data: whatsapp } = useWhatsAppQuery();
  const navigate = useNavigate();
  const label = vehicleLabel(featuredVehicle);
  const image = vehicleImage(featuredVehicle);
  const price = vehiclePrice(featuredVehicle);
  const homeMessages = homeWhatsAppMessages({
    vehicleLabel: label,
  });
  const vehicleMessages = featuredVehicle
    ? vehicleWhatsAppMessages(label)
    : null;

  const wa = (message: string) =>
    whatsapp?.numero ? buildWhatsAppUrl(whatsapp.numero, message) : "#";

  const primaryHref = wa(homeMessages.vehicleInterest);
  const financeHref = wa(
    vehicleMessages?.finance ?? homeMessages.simulateFinance,
  );
  const similarHref = wa(homeMessages.similarOptions);
  const ianHref = wa(homeMessages.talkToIan);
  const kmHref = wa(vehicleMessages?.km ?? homeMessages.askKm);

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
    navigate({ to: `/veiculo/${slug}` });
  };

  const ctaDisabled = !whatsapp?.numero;

  const quickActionClass =
    "inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-white/16";

  return (
    <section className="relative overflow-hidden bg-[#00283C] px-4 py-4 md:py-6 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
      <div className="pointer-events-none absolute -left-20 top-0 h-56 w-56 rounded-full bg-[#5CD29D]/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

      <div className="container-main relative grid gap-4 md:gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="rounded-3xl border border-white/10 bg-white/[0.07] p-4 text-white shadow-2xl backdrop-blur md:p-7 lg:p-8"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-[#5CD29D]/30 bg-[#5CD29D]/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#5CD29D]">
            <MessageCircle className="h-4 w-4" />
            <span className="md:hidden">Atendimento 24h</span>
            <span className="hidden md:inline">
              Atendimento 24h · iAN + consultor
            </span>
          </span>

          <h1 className="mt-3 text-2xl font-black leading-tight md:mt-4 md:text-4xl lg:text-[2.75rem]">
            <span className="md:hidden">Seminovos em Esteio/RS</span>
            <span className="hidden md:inline">
              Seminovos em Esteio/RS com garantia
            </span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/78 md:mt-3 md:text-lg">
            <span className="md:hidden">
              Veja o estoque ou chame no WhatsApp — mensagem pronta.
            </span>
            <span className="hidden md:inline">
              Encontre seu seminovo no estoque e fale com a Netcar em um clique.
              Diga qual carro te interessou, peça opções parecidas ou compare
              financiamento em bancos e financeiras parceiras. A mensagem já vai
              pronta no WhatsApp — condições sujeitas à análise.
            </span>
          </p>

          {/* Chips — só desktop (md+), igual master */}
          <div className="mt-5 hidden gap-3 text-sm font-semibold text-white/90 md:grid md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-3">
              <MapPin className="h-4 w-4 shrink-0 text-[#5CD29D]" />
              2 lojas Esteio
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-3">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#5CD29D]" />
              Fábrica de Valor
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-3">
              <Clock className="h-4 w-4 shrink-0 text-[#5CD29D]" />
              Atendimento 24h, 7 dias
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-3">
              <Bot className="h-4 w-4 shrink-0 text-[#5CD29D]" />
              Nethelp pós-venda
            </div>
          </div>

          {/* CTAs mobile: estoque primeiro */}
          <div className="mt-4 flex flex-col gap-2.5 md:hidden">
            <button
              type="button"
              onClick={onViewStock}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-base font-black text-[#00283C] shadow-[0_10px_28px_rgba(92,210,157,0.35)] transition-colors hover:bg-white/90"
            >
              <span className="button-text-shimmer">Ver estoque</span>
              <ArrowRight className="h-5 w-5 text-[#00283C]" />
            </button>
            <a
              href={primaryHref}
              target="_blank"
              rel="noopener noreferrer"
              data-wa-source="home_conversion"
              data-wa-intent="vehicle_interest"
              data-wa-vehicle-id={featuredVehicle?.id}
              data-wa-vehicle-name={label}
              aria-disabled={ctaDisabled}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-base font-black shadow-[0_14px_34px_rgba(92,210,157,0.28)] transition-transform hover:scale-[1.02] ${
                ctaDisabled
                  ? "pointer-events-none bg-white/20 text-white/60"
                  : "bg-[#25D366] text-white"
              }`}
            >
              <MessageCircle className="h-5 w-5" />
              WhatsApp
            </a>
          </div>

          {/* CTAs desktop — igual master */}
          <div className="mt-6 hidden flex-col gap-3 md:flex md:flex-row">
            <a
              href={primaryHref}
              target="_blank"
              rel="noopener noreferrer"
              data-wa-source="home_conversion"
              data-wa-intent="vehicle_interest"
              data-wa-vehicle-id={featuredVehicle?.id}
              data-wa-vehicle-name={label}
              aria-disabled={ctaDisabled}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-4 text-base font-black shadow-[0_14px_34px_rgba(92,210,157,0.28)] transition-transform hover:scale-[1.02] ${
                ctaDisabled
                  ? "pointer-events-none bg-white/20 text-white/60"
                  : "bg-[#25D366] text-white"
              }`}
            >
              <MessageCircle className="h-5 w-5" />
              Tenho interesse neste carro
            </a>
            <button
              type="button"
              onClick={onViewStock}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-4 text-base font-black text-white transition-colors hover:bg-white/18"
            >
              <span className="button-text-shimmer-on-dark">
                Ver estoque completo
              </span>
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>

          {/* Quick actions — só desktop */}
          <div className="mt-4 hidden gap-2 md:grid md:grid-cols-2 lg:grid-cols-4">
            <a
              href={financeHref}
              target="_blank"
              rel="noopener noreferrer"
              data-wa-source="home_conversion"
              data-wa-intent="simulate_finance"
              data-wa-vehicle-id={featuredVehicle?.id}
              data-wa-vehicle-name={label}
              className={quickActionClass}
            >
              <Calculator className="h-4 w-4 text-[#5CD29D]" />
              Comparar financiamento
            </a>
            <a
              href={kmHref}
              target="_blank"
              rel="noopener noreferrer"
              data-wa-source="home_conversion"
              data-wa-intent="ask_km"
              data-wa-vehicle-id={featuredVehicle?.id}
              data-wa-vehicle-name={label}
              className={quickActionClass}
            >
              <Gauge className="h-4 w-4 text-[#5CD29D]" />
              Saber sobre a KM
            </a>
            <a
              href={similarHref}
              target="_blank"
              rel="noopener noreferrer"
              data-wa-source="home_conversion"
              data-wa-intent="similar_options"
              data-wa-vehicle-name={label}
              className={quickActionClass}
            >
              <Sparkles className="h-4 w-4 text-[#5CD29D]" />
              Opções parecidas
            </a>
            <a
              href={ianHref}
              target="_blank"
              rel="noopener noreferrer"
              data-wa-source="home_conversion"
              data-wa-intent="talk_to_ian"
              className={quickActionClass}
            >
              <Bot className="h-4 w-4 text-[#5CD29D]" />
              Falar com a iAN
            </a>
          </div>
        </motion.div>

        {/* Card destaque — só md+ (no mobile poluia rolagem) */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="hidden rounded-3xl border border-white/12 bg-white p-4 shadow-2xl md:block md:p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-black uppercase tracking-[0.18em] text-[#128C7E]">
                Destaque do estoque
              </span>
              <h2 className="mt-1 text-2xl font-black leading-tight text-[#00283C]">
                {label}
              </h2>
            </div>
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#5CD29D]/15 text-[#128C7E]">
              <Car className="h-5 w-5" />
            </span>
          </div>

          <button
            type="button"
            onClick={goToFeaturedVehicle}
            className="mt-4 block w-full overflow-hidden rounded-2xl bg-[#F6F6F6] p-2 transition-transform hover:scale-[1.01]"
          >
            <img
              src={image}
              alt={label}
              className="mx-auto h-56 w-full object-contain drop-shadow-[0_24px_28px_rgba(0,0,0,0.16)] md:h-64"
              loading="eager"
            />
          </button>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-bold text-gray-600">
            <div className="rounded-2xl bg-gray-50 px-2 py-3">
              <span className="block text-[10px] uppercase tracking-wider text-gray-400">
                Ano
              </span>
              {featuredVehicle ? formatYear(featuredVehicle.year) : "—"}
            </div>
            <div className="rounded-2xl bg-gray-50 px-2 py-3">
              <span className="block text-[10px] uppercase tracking-wider text-gray-400">
                KM
              </span>
              {featuredVehicle ? formatKm(featuredVehicle.km) : "—"}
            </div>
            <div className="rounded-2xl bg-gray-50 px-2 py-3">
              <span className="block text-[10px] uppercase tracking-wider text-gray-400">
                Câmbio
              </span>
              {featuredVehicle?.cambio || "—"}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Até 60x · cartão 21x · troca
              </span>
              <p className="text-2xl font-black text-[#00283C]">
                {price || "Consulte"}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <a
                href={primaryHref}
                target="_blank"
                rel="noopener noreferrer"
                data-wa-source="home_conversion"
                data-wa-intent="featured_card_whatsapp"
                data-wa-vehicle-id={featuredVehicle?.id}
                data-wa-vehicle-name={label}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-black text-white"
              >
                <MessageCircle className="h-4 w-4" />
                Tenho interesse
              </a>
              <button
                type="button"
                onClick={goToFeaturedVehicle}
                className="rounded-xl bg-[#00283C] px-4 py-3 text-sm font-black text-white transition-colors hover:bg-[#00435a]"
              >
                Ver detalhes
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
