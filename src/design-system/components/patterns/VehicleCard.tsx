import { useNavigate } from "@tanstack/react-router";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import { formatPrice, formatYear, formatKm } from "@/lib/formatters";
import { generateVehicleSlug } from "@/lib/slug";
import { buildWhatsAppUrl, vehicleWhatsAppMessages } from "@/lib/whatsappMessages";
import { CardsHero } from "./CardsHero";
import { VehicleImagesSite } from "@/catalog/endpoints/vehicles";

export type VehicleFocusPayload = {
  id: string;
  label: string;
  priceLabel: string;
  image: string;
};

// URL da imagem de carro coberto usada como fallback quando não houver PNG
// A imagem está em public/images/semcapa.png
const CAR_COVERED_PLACEHOLDER_URL = "/images/semcapa.png";

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
  showWhatsAppInterest?: boolean;
  whatsAppSource?: string;
  compact?: boolean;
  /** Marca o card pra sticky contextual (scroll + hover). */
  enableFocusTracking?: boolean;
  onVehicleFocus?: (vehicle: VehicleFocusPayload) => void;
}

export function VehicleCard({
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
  showWhatsAppInterest = false,
  whatsAppSource = "home_destaques",
  compact = false,
  enableFocusTracking = false,
  onVehicleFocus,
}: VehicleCardProps) {
  const navigate = useNavigate();
  const { data: whatsapp } = useWhatsAppQuery();
  
  // PRIORIDADE 1: Usa imagens_site.capa_thumb se disponível
  // PRIORIDADE 2: Usa imagens_site.capa como fallback
  // FALLBACK FINAL: Placeholder
  let mainImage: string = CAR_COVERED_PLACEHOLDER_URL;
  
  if (imagens_site?.capa_thumb) {
    mainImage = imagens_site.capa_thumb;
  } else if (imagens_site?.capa) {
    mainImage = imagens_site.capa;
  } else {
    // FALLBACK: Comportamento anterior - filtra apenas imagens PNG
    const pngImages = images.filter(img => 
      img && (img.toLowerCase().endsWith('.png') || img.includes('.png'))
    );
    
    // Verifica se a primeira imagem PNG é a imagem específica que deve ser substituída
    const firstPngImage = pngImages.length > 0 ? pngImages[0] : null;
    const shouldUsePlaceholder = firstPngImage && (
      firstPngImage.includes('271_131072IMG_8213.png') || 
      firstPngImage.includes('271_131072IMG_8213.PNG')
    );
    
    // Se não tiver PNG ou se for a imagem específica, usa a imagem de carro coberto como fallback
    mainImage = (pngImages.length > 0 && !shouldUsePlaceholder) 
      ? (firstPngImage || CAR_COVERED_PLACEHOLDER_URL)
      : CAR_COVERED_PLACEHOLDER_URL;
  }

  const handleClick = () => {
    sessionStorage.setItem("showroom-scroll", String(window.scrollY));

    const slug = generateVehicleSlug({
      modelo: modelo || name,
      marca,
      year,
      placa,
      id,
    });
    navigate({ to: `/veiculo/${slug}` });
  };

  const sanitizeFormattedPrice = (formatted?: string) =>
    formatted ? formatted.replace(/<[^>]*>/g, "") : "";

  // Preço base (valor)
  const priceFormatted = sanitizeFormattedPrice(valor_formatado) || formatPrice(price);

  const tradePriceValue =
    typeof preco_com_troca === "number" && Number.isFinite(preco_com_troca)
      ? preco_com_troca
      : undefined;
  const basePriceValue =
    typeof price === "number" && Number.isFinite(price) ? price : 0;

  const shouldShowPriceComparison =
    tradePriceValue !== undefined && tradePriceValue !== basePriceValue;

  // Quando houver diferença, mostra:
  // De: preço com troca (riscado)
  // Para: preço normal
  const previousPriceFormatted = shouldShowPriceComparison
    ? sanitizeFormattedPrice(preco_com_troca_formatado) || formatPrice(tradePriceValue!)
    : undefined;

  // Adapta dados para o formato do CardsHero
  const brand = marca || '';
  const model = modelo || name;
  const yearFormatted = formatYear(year);
  const mileageFormatted = formatKm(km);
  const fuel = combustivel || '';
  const transmission = cambio || '';
  const vehicleLabel = [brand, model, year].filter(Boolean).join(" ");
  const isSold = !price || price <= 0;
  const whatsAppHref =
    showWhatsAppInterest && whatsapp?.numero && !isSold
      ? buildWhatsAppUrl(
          whatsapp.numero,
          vehicleWhatsAppMessages(vehicleLabel).info,
        )
      : undefined;
  const tradeModelLabel = model || name;
  const tradeInHref =
    showWhatsAppInterest && whatsapp?.numero && !isSold
      ? buildWhatsAppUrl(
          whatsapp.numero,
          vehicleWhatsAppMessages(vehicleLabel, tradeModelLabel).trade,
        )
      : undefined;
  const financeHref =
    showWhatsAppInterest && whatsapp?.numero && !isSold
      ? buildWhatsAppUrl(
          whatsapp.numero,
          vehicleWhatsAppMessages(vehicleLabel).finance,
        )
      : undefined;

  const card = (
    <CardsHero
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

  const focusPayload: VehicleFocusPayload = {
    id,
    label: vehicleLabel,
    priceLabel: priceFormatted || "Consulte",
    image: mainImage,
  };

  return (
    <div
      className="h-full"
      data-stock-focus-card=""
      data-vehicle-id={id}
      data-vehicle-label={vehicleLabel}
      data-vehicle-price={priceFormatted || "Consulte"}
      data-vehicle-image={mainImage}
      onMouseEnter={() => onVehicleFocus?.(focusPayload)}
    >
      {card}
    </div>
  );
}
