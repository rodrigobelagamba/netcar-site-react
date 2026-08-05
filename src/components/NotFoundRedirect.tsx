import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { emptySeminovosSearch } from "@/lib/seminovos-search";

/**
 * Página 404 de verdade: mostra erro e oferece saídas, sem redirecionar para a
 * home. Redirecionar URL inválida para "/" devolve 200 com conteúdo da home —
 * o Google lê isso como soft 404 e desperdiça crawl budget. Aqui o usuário vê
 * o erro e escolhe para onde ir; o crawler recebe 404/410 do .htaccess.
 * Em arquivo próprio para evitar import circular com routes.tsx.
 */
export function NotFoundRedirect() {
  useEffect(() => {
    document.title = "Página não encontrada | Netcar Multimarcas";
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    meta.content = "noindex, nofollow";
  }, []);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-4 text-4xl font-bold text-primary">404</h1>
      <p className="mb-2 text-lg text-muted-foreground">Página não encontrada</p>
      <p className="mb-8 max-w-md text-sm text-muted-foreground">
        O endereço que você tentou acessar não existe ou foi movido.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          to="/seminovos"
          search={emptySeminovosSearch}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Ver seminovos
        </Link>
        <Link
          to="/blog"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Ler o blog
        </Link>
        <Link
          to="/"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Página inicial
        </Link>
      </div>
    </div>
  );
}
