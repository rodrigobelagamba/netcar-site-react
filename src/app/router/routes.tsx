import { createRootRoute, createRoute, Outlet } from "@tanstack/react-router";
import { useRouterState } from "@tanstack/react-router";
import { Suspense, useEffect, useLayoutEffect } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { Header } from "@/design-system/components/layout/Header";
import { LazyFooter } from "@/design-system/components/layout/LazyFooter";
import { useWhatsAppQuery } from "@/catalog/queries/useSiteQuery";
import { useVehicleQuery } from "@/catalog/queries/useVehicleQuery";
import { trackPageView } from "@/lib/analytics";
import {
  buildWhatsAppUrl,
  siteWhatsAppMessage,
  vehicleWhatsAppMessages,
} from "@/lib/whatsappMessages";
import { SchemaOrg } from "@/components/seo/SchemaOrg";
import { PageLoader } from "@/components/layout/PageLoader";
import citiesJson from "@/data/seo/cities.json";
import type { CitySeoPage } from "@/data/seo/types";
import { NotFoundRedirect } from "@/components/NotFoundRedirect";

const contextualCityPages = citiesJson as CitySeoPage[];
const getContextualCityPage = (slug: string) =>
  contextualCityPages.find((city) => city.slug === slug);

const HomePage = lazyWithRetry(() =>
  import("@/modules/home/pages/HomePage").then((m) => ({
    default: m.HomePage,
  })),
);
const SeminovosPage = lazyWithRetry(() =>
  import("@/modules/seminovos/pages/SeminovosPage").then((m) => ({
    default: m.SeminovosPage,
  })),
);
const DetalhesPage = lazyWithRetry(() =>
  import("@/modules/detalhes/pages/DetalhesPage").then((m) => ({
    default: m.DetalhesPage,
  })),
);
const ICheckLaudoPage = lazyWithRetry(() =>
  import("@/modules/detalhes/pages/ICheckLaudoPage").then((m) => ({
    default: m.ICheckLaudoPage,
  })),
);
const SobrePage = lazyWithRetry(() =>
  import("@/modules/sobre/pages/SobrePage").then((m) => ({
    default: m.SobrePage,
  })),
);
const ContatoPage = lazyWithRetry(() =>
  import("@/modules/contato/pages/ContatoPage").then((m) => ({
    default: m.ContatoPage,
  })),
);
const BlogPage = lazyWithRetry(() =>
  import("@/modules/blog/pages/BlogPage").then((m) => ({
    default: m.BlogPage,
  })),
);
const CompraPage = lazyWithRetry(() =>
  import("@/modules/compra/pages/CompraPage").then((m) => ({
    default: m.CompraPage,
  })),
);
const BlogPostPage = lazyWithRetry(() =>
  import("@/modules/blog/pages/BlogPostPage").then((m) => ({
    default: m.BlogPostPage,
  })),
);
const CityLandingPage = lazyWithRetry(() =>
  import("@/modules/seo/pages/CityLandingPage").then((m) => ({
    default: m.CityLandingPage,
  })),
);
const SeminovosAutomaticosPage = lazyWithRetry(() =>
  import("@/modules/seo/pages/SeminovosAutomaticosPage").then((m) => ({
    default: m.SeminovosAutomaticosPage,
  })),
);
const SellCityLandingPage = lazyWithRetry(() =>
  import("@/modules/seo/pages/SellCityLandingPage").then((m) => ({
    default: m.SellCityLandingPage,
  })),
);
const EstoqueLandingPage = lazyWithRetry(() =>
  import("@/modules/seo/pages/EstoqueLandingPage").then((m) => ({
    default: m.EstoqueLandingPage,
  })),
);
const FinanciamentoPage = lazyWithRetry(() =>
  import("@/modules/seo/pages/contentSeoPages").then((m) => ({
    default: m.FinanciamentoPage,
  })),
);
const Atendimento24hPage = lazyWithRetry(() =>
  import("@/modules/seo/pages/contentSeoPages").then((m) => ({
    default: m.Atendimento24hPage,
  })),
);
const MoveBrasilPage = lazyWithRetry(() =>
  import("@/modules/seo/pages/contentSeoPages").then((m) => ({
    default: m.MoveBrasilPage,
  })),
);
const PoliticaEditorialPage = lazyWithRetry(() =>
  import("@/modules/seo/pages/contentSeoPages").then((m) => ({
    default: m.PoliticaEditorialPage,
  })),
);
const ComparadorPage = lazyWithRetry(() =>
  import("@/modules/seo/pages/ComparadorPage").then((m) => ({
    default: m.ComparadorPage,
  })),
);
const RegionsHubPage = lazyWithRetry(() =>
  import("@/modules/seo/pages/RegionsHubPage").then((m) => ({
    default: m.RegionsHubPage,
  })),
);
const ComoSelecionamosPage = lazyWithRetry(() =>
  import("@/modules/procedencia/pages/ComoSelecionamosPage").then((m) => ({
    default: m.ComoSelecionamosPage,
  })),
);

// Mensagem do WhatsApp contextual por rota: lead chega no iAN já qualificado
function getContextualMessage(pathname: string): string {
  if (pathname.startsWith("/vender-carro-")) {
    const city = getContextualCityPage(pathname.replace("/vender-carro-", ""));
    if (city) {
      return siteWhatsAppMessage(
        `moro em ${city.name} e quero vender meu carro para a Netcar.`,
      );
    }
  }
  if (
    pathname.startsWith("/seminovos-") &&
    pathname !== "/seminovos-automaticos"
  ) {
    const city = getContextualCityPage(pathname.replace("/seminovos-", ""));
    if (city) {
      return siteWhatsAppMessage(
        `moro em ${city.name} e estou procurando um seminovo.`,
      );
    }
  }
  if (pathname.startsWith("/comprar-")) {
    // O wa_ref já transporta a URL/slug exatos até a Evolution. Evitar carregar
    // toda a copy das landings no bundle inicial preserva o PageSpeed global.
    return siteWhatsAppMessage(
      "estou procurando carros desta seleção de seminovos em Esteio.",
    );
  }
  if (
    pathname === "/compra" ||
    pathname === "/compramos-seu-usado" ||
    pathname === "/vender-meu-carro"
  ) {
    return siteWhatsAppMessage(
      "quero avaliar meu carro para venda ou troca na Netcar.",
    );
  }
  if (pathname === "/financiamento") {
    return siteWhatsAppMessage("quero simular o financiamento de um seminovo.");
  }
  if (pathname === "/atendimento-24h") {
    return siteWhatsAppMessage("quero atendimento agora.");
  }
  if (pathname === "/move-brasil") {
    return siteWhatsAppMessage(
      "sou motorista de aplicativo ou taxista e quero ver seminovos elegíveis ao Move Brasil.",
    );
  }
  if (pathname === "/comparar") {
    return siteWhatsAppMessage("quero ajuda para comparar alguns seminovos.");
  }
  if (pathname === "/como-selecionamos-nossos-carros") {
    return siteWhatsAppMessage(
      "quero encontrar um seminovo e entender a origem e a preparação do veículo.",
    );
  }
  if (pathname === "/seminovos-automaticos") {
    return siteWhatsAppMessage("estou procurando um seminovo automático.");
  }
  return siteWhatsAppMessage("estou procurando um seminovo.");
}

// WhatsApp Button Component - iAN
function WhatsAppButton() {
  const { data: whatsapp } = useWhatsAppQuery();
  const location = useRouterState({
    select: (state) => state.location,
  });
  // Detecta se está na página de detalhes do veículo
  const isDetalhesPage = location.pathname.startsWith("/veiculo/");
  const isLaudoPage = location.pathname.startsWith("/laudo/");
  const slug = isDetalhesPage ? location.pathname.replace("/veiculo/", "") : "";
  // useVehicleQuery já verifica se slug existe internamente, então não faz query se slug for vazio
  const { data: vehicle } = useVehicleQuery(slug);

  if (isLaudoPage) return null;

  const getIanWhatsAppLink = () => {
    if (!whatsapp?.numero) return "#";

    let message = getContextualMessage(location.pathname);
    if (isDetalhesPage && vehicle) {
      const vehicleLabel = vehicle.modelo || vehicle.name || "veículo";
      message = vehicleWhatsAppMessages(vehicleLabel).info;
    }

    return buildWhatsAppUrl(whatsapp.numero, message);
  };

  // Home/detalhe: sticky contextual cobre WA. Floater só nas demais páginas.
  if (location.pathname === "/" || isDetalhesPage) return null;

  return (
    <a
      href={getIanWhatsAppLink()}
      target="_blank"
      rel="noopener noreferrer"
      data-wa-source="ian_floater"
      data-wa-intent={
        isDetalhesPage && vehicle ? "vehicle_inquiry" : "ian_contact"
      }
      data-wa-vehicle-id={
        isDetalhesPage && vehicle?.id ? String(vehicle.id) : undefined
      }
      data-wa-vehicle-name={
        isDetalhesPage && vehicle
          ? vehicle.modelo || vehicle.name || undefined
          : undefined
      }
      className="fixed bottom-6 right-6 z-50 hidden md:flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110 hover:shadow-2xl active:scale-95 group"
      style={{ backgroundColor: "#25D366" }}
      aria-label="Fale com iAN no WhatsApp"
      title="Fale com iAN no WhatsApp"
    >
      <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping" />
      <svg
        className="h-8 w-8 text-white relative z-10"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    </a>
  );
}

function RootComponent() {
  const location = useRouterState({
    select: (state) => state.location,
  });

  // A SPA controla a posição: o navegador não deve reaplicar o scroll da rota
  // anterior depois que o conteúdo assíncrono terminar de montar.
  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  // Scroll para o topo antes de pintar a nova rota.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  useEffect(() => {
    const search =
      typeof location.searchStr === "string"
        ? location.searchStr
        : typeof location.search === "string"
          ? location.search
          : "";
    trackPageView(`${location.pathname}${search}`);
  }, [location.pathname, location.search, location.searchStr]);

  const isLaudoPage = location.pathname.startsWith("/laudo/");

  return (
    <div className="flex min-h-screen max-w-full flex-col overflow-x-clip">
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[10000] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-white focus:outline-none"
      >
        Pular para o conteúdo
      </a>
      {!isLaudoPage ? <SchemaOrg /> : null}
      {/* Laudo i-CHECK = documento isolado (sem header/footer do site) */}
      {!isLaudoPage ? (
        <div className="print:hidden">
          <Header />
        </div>
      ) : null}
      <div
        className={`relative max-w-full flex-1 overflow-x-clip print:min-h-0 print:pt-0 ${
          isLaudoPage ? "min-h-[100dvh] pt-0" : "min-h-[100dvh] pt-0 sm:pt-20"
        }`}
      >
        <div
          key={location.pathname}
          className="h-full max-w-full overflow-x-clip"
          id="conteudo-principal"
          tabIndex={-1}
        >
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </div>
      </div>
      {!isLaudoPage ? (
        <div className="print:hidden">
          <LazyFooter />
          <WhatsAppButton />
        </div>
      ) : null}
    </div>
  );
}

const rootRoute = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundRedirect,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

type SeminovosRouteSearch = {
  marca?: string;
  modelo?: string;
  precoMin?: string;
  precoMax?: string;
  anoMin?: string;
  anoMax?: string;
  cambio?: string;
  combustivel?: string;
  cor?: string;
  categoria?: string;
};

const seminovosRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/seminovos",
  component: SeminovosPage,
  validateSearch: (search: Record<string, unknown>): SeminovosRouteSearch => {
    return {
      marca: (search.marca as string) || undefined,
      modelo: (search.modelo as string) || undefined,
      precoMin: (search.precoMin as string) || undefined,
      precoMax: (search.precoMax as string) || undefined,
      anoMin: (search.anoMin as string) || undefined,
      anoMax: (search.anoMax as string) || undefined,
      cambio: (search.cambio as string) || undefined,
      combustivel: (search.combustivel as string) || undefined,
      cor: (search.cor as string) || undefined,
      categoria: (search.categoria as string) || undefined,
    };
  },
});

const detalhesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/veiculo/$slug",
  component: DetalhesPage,
  // Removido o loader para evitar problemas em produção
  // O componente usa useParams e useLocation diretamente, que são mais confiáveis
});

const icheckLaudoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/laudo/$slug",
  component: ICheckLaudoPage,
});

const sobreRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sobre",
  component: SobrePage,
});

const contatoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/contato",
  component: ContatoPage,
});

const blogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/blog",
  component: BlogPage,
});

const blogPostRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/blog/$slug",
  component: BlogPostPage,
});

const compraRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/compra",
  component: CompraPage,
});

const compramosSeuUsadoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/compramos-seu-usado",
  component: CompraPage,
});

const venderMeuCarroRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/vender-meu-carro",
  component: CompraPage,
});

const seminovosAutomaticosRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/seminovos-automaticos",
  component: SeminovosAutomaticosPage,
});

const cityLandingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/seminovos-{$citySlug}",
  component: CityLandingPage,
});

const sellCityLandingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/vender-carro-{$citySlug}",
  component: SellCityLandingPage,
});

const estoqueLandingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/comprar-{$landingSlug}",
  component: EstoqueLandingPage,
});

const financiamentoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/financiamento",
  component: FinanciamentoPage,
});

const atendimento24hRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/atendimento-24h",
  component: Atendimento24hPage,
});

const moveBrasilRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/move-brasil",
  component: MoveBrasilPage,
});

const politicaEditorialRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/politica-editorial",
  component: PoliticaEditorialPage,
});

const comparadorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/comparar",
  component: ComparadorPage,
});

const regionsHubRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/regioes-atendidas",
  component: RegionsHubPage,
});

const comoSelecionamosRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/como-selecionamos-nossos-carros",
  component: ComoSelecionamosPage,
});

export const routeTree = rootRoute.addChildren([
  indexRoute,
  seminovosRoute,
  detalhesRoute,
  icheckLaudoRoute,
  sobreRoute,
  contatoRoute,
  blogRoute,
  blogPostRoute,
  compraRoute,
  compramosSeuUsadoRoute,
  venderMeuCarroRoute,
  seminovosAutomaticosRoute,
  cityLandingRoute,
  sellCityLandingRoute,
  estoqueLandingRoute,
  financiamentoRoute,
  atendimento24hRoute,
  moveBrasilRoute,
  politicaEditorialRoute,
  comparadorRoute,
  regionsHubRoute,
  comoSelecionamosRoute,
]);

// O router será criado dinamicamente no RouterProvider
// Isso permite detectar o basepath corretamente após o DOM estar pronto
