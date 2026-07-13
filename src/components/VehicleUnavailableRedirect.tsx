import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { emptySeminovosSearch } from "@/lib/seminovos-search";

/**
 * Veículo ausente na API (slug inválido / removido): redireciona para o estoque.
 * Carros vendidos (price=0) continuam na página de detalhe.
 */
export function VehicleUnavailableRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({
      to: "/seminovos",
      search: emptySeminovosSearch,
      replace: true,
    });
  }, [navigate]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-4">
      <p className="text-center text-muted-foreground">
        Este veículo não está mais disponível. Redirecionando para o estoque...
      </p>
    </div>
  );
}
