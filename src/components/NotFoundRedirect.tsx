import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

/**
 * Fallback 404: redireciona para home.
 * Em arquivo próprio para evitar import circular com routes.tsx.
 */
export function NotFoundRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate({ to: "/" });
    }, 100);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <h1 className="mb-4 text-4xl font-bold text-primary">404</h1>
      <p className="mb-8 text-lg text-muted-foreground">Página não encontrada</p>
      <p className="text-sm text-muted-foreground">
        Redirecionando para a página inicial...
      </p>
    </div>
  );
}
