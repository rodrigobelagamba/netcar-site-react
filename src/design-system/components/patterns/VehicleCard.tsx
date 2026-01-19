import { useNavigate } from "@tanstack/react-router";
import { formatPrice, formatYear, formatKm } from "@/lib/formatters";
import { generateVehicleSlug } from "@/lib/slug";
import { CardsHero } from "./CardsHero";

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
  badges?: string[];
  valor_formatado?: string;
  marca?: string;
  modelo?: string;
  placa?: string;
  combustivel?: string;
  cambio?: string;
  delay?: number;
}

export function VehicleCard({
  id,
  name,
  price,
  year,
  km,
  images,
  valor_formatado,
  marca,
  modelo,
  placa,
  combustivel,
  cambio,
  delay = 0,
}: VehicleCardProps) {
  const navigate = useNavigate();
  
  // Filtra apenas imagens PNG
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
  const mainImage: string = (pngImages.length > 0 && !shouldUsePlaceholder) 
    ? (firstPngImage || CAR_COVERED_PLACEHOLDER_URL)
    : CAR_COVERED_PLACEHOLDER_URL;

  const handleClick = () => {
    // Gera slug amigável para a URL
    const slug = generateVehicleSlug({
      modelo: modelo || name,
      marca,
      year,
      placa,
      id,
    });
    navigate({ to: `/veiculo/${slug}` });
  };

  // Remove HTML tags se houver no valor_formatado
  const priceFormatted = valor_formatado 
    ? valor_formatado.replace(/<[^>]*>/g, '') 
    : formatPrice(price);

  // Adapta dados para o formato do CardsHero
  const brand = marca || '';
  const model = modelo || name;
  const yearFormatted = formatYear(year);
  const mileageFormatted = formatKm(km);
  const fuel = combustivel || '';
  const transmission = cambio || '';

  return (
    <CardsHero
      image={mainImage}
      brand={brand}
      model={model}
      year={yearFormatted}
      fuel={fuel}
      transmission={transmission}
      mileage={mileageFormatted}
      price={priceFormatted}
      delay={delay}
      onClick={handleClick}
    />
  );
}
