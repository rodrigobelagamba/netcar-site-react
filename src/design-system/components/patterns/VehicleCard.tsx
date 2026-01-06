import { useNavigate } from "@tanstack/react-router";
import { formatPrice, formatKm, formatYear } from "@/lib/formatters";
import { Button } from "../ui/button";
import { cn } from "@/lib/cn";

export interface VehicleCardProps {
  id: string;
  name: string;
  price: number;
  year: number;
  km: number;
  images: string[];
  badges?: string[];
  valor_formatado?: string;
}

export function VehicleCard({
  id,
  name,
  price,
  year,
  km,
  images,
  badges = [],
  valor_formatado,
}: VehicleCardProps) {
  const navigate = useNavigate();
  const mainImage =
    images[0] ||
    "https://via.placeholder.com/400x300/6cc4ca/ffffff?text=Sem+Imagem";

  const handleClick = () => {
    // Usa o ID para navegação, já que a API busca por ID
    navigate({ to: `/detalhes/${id}` });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border",
        "bg-surface transition-all hover:shadow-lg",
        "focus-within:ring-2 focus-within:ring-primary"
      )}
      role="article"
      aria-label={name}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="aspect-video w-full overflow-hidden bg-muted relative">
        <img
          src={mainImage}
          alt={name}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          loading="lazy"
        />
        {badges.length > 0 && (
          <div className="absolute top-2 left-2 flex flex-wrap gap-1">
            {badges.map((badge, index) => (
              <span
                key={index}
                className={cn(
                  "px-2 py-1 text-xs font-medium rounded",
                  "bg-primary text-primary-foreground"
                )}
              >
                {badge}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="mb-2 text-lg font-semibold text-fg line-clamp-1">
          {name}
        </h3>
        <div className="mb-4 space-y-1 text-sm text-muted-foreground">
          <p>{formatYear(year)}</p>
          <p>{formatKm(km)}</p>
        </div>
        <div className="mb-4">
          <p
            className="text-2xl font-bold text-primary"
            dangerouslySetInnerHTML={{
              __html: valor_formatado || formatPrice(price),
            }}
          />
        </div>
        <Button
          className="w-full"
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
          aria-label={`Ver detalhes de ${name}`}
        >
          Ver Detalhes
        </Button>
      </div>
    </div>
  );
}
