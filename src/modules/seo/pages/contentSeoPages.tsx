import { ContentSeoPage } from "./ContentSeoPage";
import { getContentPage } from "@/data/seo";
import { NotFoundRedirect } from "@/components/NotFoundRedirect";

// Wrappers finos: cada rota fixa lê sua página de content-pages.json.
// Adicionar nova página = nova entrada no JSON + wrapper + rota.

export function FinanciamentoPage() {
  const page = getContentPage("financiamento");
  return page ? <ContentSeoPage page={page} /> : <NotFoundRedirect />;
}

export function Atendimento24hPage() {
  const page = getContentPage("atendimento-24h");
  return page ? <ContentSeoPage page={page} /> : <NotFoundRedirect />;
}

export function MoveBrasilPage() {
  const page = getContentPage("move-brasil");
  return page ? <ContentSeoPage page={page} /> : <NotFoundRedirect />;
}
