import { memo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import { formatPrice, formatYear, formatKm } from "@/lib/formatters";
import { generateVehicleSlug } from "@/lib/slug";
import {
  buildWhatsAppUrl,
  DEFAULT_SALES_WHATSAPP,
  vehicleWhatsAppMessages,
} from "@/lib/whatsappMessages";
import { CardsHero } from "./CardsHero";
import type { VehicleImagesSite } from "@/catalog/endpoints/vehicles";
import { SHOW_CAMPAIGN_STAMP } from "@/config/features";

export type VehicleFocusPayload = {
  id: string;
  label: string;
  priceLabel: string;
  image: string;
};

// URL da imagem de carro coberto usada como fallback quando não houver PNG
// A imagem está em public/images/semcapa.png
const CAR_COVERED_PLACEHOLDER_URL = "/images/semcapa.webp";

export interface VehicleCardProps {
  id: string;
  name: string;
  price: number;
  year: number;
  km: number;
  images: string[];
  imagens_site?: VehicleImagesSite;
  badges?: string[];
  valor_formatado?: string;
  preco_com_troca?: number;
  preco_com_troca_formatado?: string;
  marca?: string;
  modelo?: string;
  placa?: string;
  combustivel?: string;
  cambio?: string;
  delay?: number;
  fastAnimation?: boolean;
  eagerImage?: boolean;
  showWhatsAppInterest?: boolean;
  whatsAppSource?: string;
  /** Número já resolvido pelo componente da lista, evitando uma query por card. */
  whatsAppNumber?: string;
  compact?: boolean;
  /** Preserva o ponto exato do showroom ao abrir a ficha do veículo. */
  preserveShowroomPosition?: boolean;
  /** Marca o card pra sticky contextual (scroll / visibilidade). */
  enableFocusTracking?: boolean;
  onVehicleFocus?: (
    vehicle: VehicleFocusPayload,
    source: "scroll" | "click",
  ) => void;
}

export const VehicleCardStatic = memo(function VehicleCardStatic({
  id,
  name,
  price,
  year,
  km,
  images,
  imagens_site,
  valor_formatado,
  preco_com_troca,
  preco_com_troca_formatado,
  marca,
  modelo,
  placa,
  combustivel,
  cambio,
  delay = 0,
  fastAnimation = false,
  eagerImage = false,
  showWhatsAppInterest = false,
  whatsAppSource = "home_destaques",
  whatsAppNumber = DEFAULT_SALES_WHATSAPP,
  compact = false,
  preserveShowroomPosition = false,
  enableFocusTracking = false,
  onVehicleFocus,
}: VehicleCardProps) {
  const navigate = useNavigate();

  // Cards compactos usam a miniatura; cards desktop precisam da capa maior para
  // não ampliar o arquivo *_small.png (200 px) em uma área de quase 300 px.
  let mainImage: string = CAR_COVERED_PLACEHOLDER_URL;

  if (compact && imagens_site?.capa_thumb) {
    mainImage = imagens_site.capa_thumb;
  } else if (imagens_site?.capa) {
    mainImage = imagens_site.capa;
  } else if (imagens_site?.capa_thumb) {
    mainImage = imagens_site.capa_thumb;
  } else {
    // FALLBACK: Comportamento anterior - filtra apenas imagens PNG
    const pngImages = images.filter(
      (img) =>
        img && (img.toLowerCase().endsWith(".png") || img.includes(".png")),
    );

    // Verifica se a primeira imagem PNG é a imagem específica que deve ser substituída
    const firstPngImage = pngImages.length > 0 ? pngImages[0] : null;
    const shouldUsePlaceholder =
      firstPngImage &&
      (firstPngImage.includes("271_131072IMG_8213.png") ||
        firstPngImage.includes("271_131072IMG_8213.PNG"));

    // Se não tiver PNG ou se for a imagem específica, usa a imagem de carro coberto como fallback
    mainImage =
      pngImages.length > 0 && !shouldUsePlaceholder
        ? firstPngImage || CAR_COVERED_PLACEHOLDER_URL
        : CAR_COVERED_PLACEHOLDER_URL;
  }

  const sanitizeFormattedPrice = (formatted?: string) =>
    formatted ? formatted.replace(/<[^>]*>/g, "") : "";

  // Preço base (valor)
  const priceFormatted =
    sanitizeFormattedPrice(valor_formatado) || formatPrice(price);

  const tradePriceValue =
    typeof preco_com_troca === "number" && Number.isFinite(preco_com_troca)
      ? preco_com_troca
      : undefined;
  const basePriceValue =
    typeof price === "number" && Number.isFinite(price) ? price : 0;

  const shouldShowPriceComparison =
    SHOW_CAMPAIGN_STAMP &&
    tradePriceValue !== undefined &&
    tradePriceValue > basePriceValue;

  // Quando houver diferença, mostra:
  // De: preço com troca (riscado)
  // Para: preço normal
  const previousPriceFormatted = shouldShowPriceComparison
    ? sanitizeFormattedPrice(preco_com_troca_formatado) ||
      formatPrice(tradePriceValue!)
    : undefined;

  // Adapta dados para o formato do CardsHero
  const brand = marca || "";
  const model = modelo || name;
  const yearFormatted = formatYear(year);
  const mileageFormatted = formatKm(km);
  const fuel = combustivel || "";
  const transmission = cambio || "";
  const vehicleLabel = [brand, model, year].filter(Boolean).join(" ");
  const isSold = !price || price <= 0;

  const emitFocus = () => {
    if (!onVehicleFocus || isSold) return;
    onVehicleFocus(
      {
        id,
        label: vehicleLabel,
        priceLabel: priceFormatted || "Consulte",
        image: mainImage,
      },
      "click",
    );
  };

  const handleClick = () => {
    emitFocus();
    if (preserveShowroomPosition) {
      try {
        const selector = `[data-showroom-vehicle-id="${CSS.escape(String(id))}"]`;
        const card = document.querySelector<HTMLElement>(selector);
        sessionStorage.setItem(
          "showroom-return",
          JSON.stringify({
            vehicleId: String(id),
            scrollY: window.scrollY,
            cardViewportTop: card?.getBoundingClientRect().top ?? 0,
            savedAt: Date.now(),
          }),
        );
      } catch {
        // A navegação não pode falhar quando o Safari bloquear o storage.
      }
    }
    window.scrollTo({ top: 0, behavior: "instant" });

    const slug = generateVehicleSlug({
      modelo: modelo || name,
      marca,
      year,
      placa,
      id,
    });
    navigate({ to: `/veiculo/${slug}` });
  };

  const whatsAppHref =
    showWhatsAppInterest && !isSold
      ? buildWhatsAppUrl(
          whatsAppNumber,
          vehicleWhatsAppMessages(vehicleLabel).info,
        )
      : undefined;
  const tradeModelLabel = model || name;
  const tradeInHref =
    showWhatsAppInterest && !isSold
      ? buildWhatsAppUrl(
          whatsAppNumber,
          vehicleWhatsAppMessages(vehicleLabel, tradeModelLabel).trade,
        )
      : undefined;
  const financeHref =
    showWhatsAppInterest && !isSold
      ? buildWhatsAppUrl(
          whatsAppNumber,
          vehicleWhatsAppMessages(vehicleLabel).finance,
        )
      : undefined;

  const card = (
    <CardsHero
      vehicleId={id}
      image={mainImage}
      brand={brand}
      model={model}
      year={yearFormatted}
      fuel={fuel}
      transmission={transmission}
      mileage={mileageFormatted}
      price={priceFormatted}
      previousPrice={previousPriceFormatted}
      showPriceComparison={shouldShowPriceComparison}
      delay={delay}
      fastAnimation={fastAnimation}
      eagerImage={eagerImage}
      onClick={handleClick}
      whatsAppHref={whatsAppHref}
      tradeInHref={tradeInHref}
      financeHref={financeHref}
      whatsAppVehicleId={id}
      whatsAppVehicleName={vehicleLabel}
      whatsAppSource={whatsAppSource}
      compact={compact}
      isSold={isSold}
    />
  );

  if (!enableFocusTracking || isSold) {
    return card;
  }

  return (
    <div
      className="h-full"
      data-stock-focus-card=""
      data-vehicle-id={id}
      data-vehicle-label={vehicleLabel}
      data-vehicle-price={priceFormatted || "Consulte"}
      data-vehicle-image={mainImage}
    >
      {card}
    </div>
  );
});

/**
 * Compatibilidade para usos isolados do card. Listas devem resolver o número
 * uma vez e usar `VehicleCardStatic`, evitando dezenas de observers e renders.
 */
export function VehicleCard(props: VehicleCardProps) {
  const { data: whatsapp } = useWhatsAppQuery();
  return (
    <VehicleCardStatic
      {...props}
      whatsAppNumber={
        props.whatsAppNumber || whatsapp?.numero || DEFAULT_SALES_WHATSAPP
      }
    />
  );
}
