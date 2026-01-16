import { useNavigate } from "@tanstack/react-router";
import { formatPrice, formatYear } from "@/lib/formatters";
import { generateVehicleSlug } from "@/lib/slug";
import { cn } from "@/lib/cn";
import { Plus } from "lucide-react";

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
}

export function VehicleCard({
  id,
  name,
  price,
  year,
  images,
  valor_formatado,
  marca,
  modelo,
  placa,
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleClick();
  };

  // Extrai modelo e versão do name se não tiver separados
  // Se tiver marca e modelo separados, usa modelo
  // Senão, tenta extrair do name (assumindo formato "Marca Modelo Versão")
  let displayModelo = modelo || name;
  let displayVersao = '';
  
  if (marca && !modelo) {
    // Se tem marca mas não modelo, remove a marca do name
    displayModelo = name.replace(new RegExp(`^${marca}\\s*`, 'i'), '').trim() || name;
  }
  
  // Se o name tem mais de 2 palavras e não tem modelo separado, assume que a última parte é versão
  if (!modelo && name.split(' ').length > 2) {
    const parts = name.split(' ');
    if (marca) {
      displayModelo = parts.slice(1, -1).join(' ');
      displayVersao = parts[parts.length - 1];
    } else {
      displayModelo = parts.slice(0, -1).join(' ');
      displayVersao = parts[parts.length - 1];
    }
  }

  return (
    <div
      className={cn(
        "group relative",
        "transition-all hover:shadow-xl cursor-pointer",
        "focus-within:ring-2 focus-within:ring-primary"
      )}
      role="article"
      aria-label={name}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {/* Imagem PNG do veículo - posicionamento absoluto para transbordar */}
      <div className="absolute left-1/2 transform -translate-x-1/2 z-20" style={{ top: '-45%', width: '110%' }}>
        <div className="relative mx-auto w-full aspect-[4/3] overflow-hidden bg-gray-100">
          <img
            src={mainImage}
            alt={name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        </div>
      </div>

      {/* Informações do veículo - parte branca */}
      <div className="p-4 pt-[55%] pb-3 relative z-10 bg-white rounded-lg shadow-lg">
        {/* Tag da marca abaixo da imagem */}
        {marca && (
          <div className="mb-2">
            <span className="px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wide rounded-full inline-block" style={{ backgroundColor: 'rgb(3, 54, 61)' }}>
              {marca}
            </span>
          </div>
        )}

        {/* Informações do veículo */}
        <div className="mb-3 space-y-0.5">
          <h3 className="text-base font-semibold text-gray-800 leading-tight">
            {displayModelo}
          </h3>
          {displayVersao && displayVersao !== displayModelo && (
            <p className="text-sm text-gray-600 leading-tight">
              {displayVersao}
            </p>
          )}
          <p className="text-sm text-gray-600 leading-tight">
            {formatYear(year)}
          </p>
        </div>

        {/* Preço */}
        <div className="mb-3">
          <p
            className="text-xl font-bold leading-tight"
            style={{ color: 'rgb(3, 54, 61)' }}
            dangerouslySetInnerHTML={{
              __html: valor_formatado || formatPrice(price),
            }}
          />
        </div>

        {/* Botão circular no canto inferior direito */}
        <button
          onClick={handleButtonClick}
          className={cn(
            "absolute bottom-3 right-3 w-10 h-10 rounded-full",
            "text-white flex items-center justify-center",
            "transition-all hover:scale-110",
            "focus:outline-none focus:ring-2 focus:ring-offset-2",
            "shadow-md"
          )}
          style={{ 
            backgroundColor: 'rgb(3, 54, 61)',
            '--hover-bg': 'rgb(2, 40, 45)'
          } as React.CSSProperties & { '--hover-bg': string }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgb(2, 40, 45)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgb(3, 54, 61)';
          }}
          aria-label={`Ver detalhes de ${name}`}
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
