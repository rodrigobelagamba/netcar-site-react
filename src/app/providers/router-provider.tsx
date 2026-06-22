import { RouterProvider as TanStackRouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "../router/routes";
import { getBasePath } from "@/lib/base-path";
import { NotFound } from "../router/routes";

// Cria o router com basepath configurado
const router = createRouter({
  routeTree,
  basepath: getBasePath(),
  defaultNotFoundComponent: NotFound,
  defaultErrorComponent: ({ error }) => (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <h1 className="mb-4 text-4xl font-bold text-destructive">Erro</h1>
      <p className="mb-4 text-lg text-muted-foreground text-center max-w-md">
        {error instanceof Error ? error.message : "Ocorreu um erro inesperado"}
      </p>
      <p className="mb-8 text-sm text-muted-foreground text-center max-w-md">
        Se acabou de sair uma atualização do site, recarregue a página.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-primary px-6 py-3 text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Recarregar página
        </button>
        <a
          href="/"
          className="rounded-md border border-primary px-6 py-3 text-primary transition-colors hover:bg-primary/5 text-center"
        >
          Voltar para a página inicial
        </a>
      </div>
    </div>
  ),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function RouterProvider() {
  return <TanStackRouterProvider router={router} />;
}
