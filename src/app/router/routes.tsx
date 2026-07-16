import {
  createRootRoute,
  createRoute,
  Outlet,
  useNavigate,
} from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useRouterState } from "@tanstack/react-router";
import { Suspense, useEffect } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { Header } from "@/design-system/components/layout/Header";
import { Footer } from "@/design-system/components/layout/Footer";
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
import { getCityPage, getLandingPage } from "@/data/seo";

const HomePage = lazyWithRetry(() =>
  import("@/modules/home/pages/HomePage").then((m) => ({ default: m.HomePage }))
);
const SeminovosPage = lazyWithRetry(() =>
  import("@/modules/seminovos/pages/SeminovosPage").then((m) => ({
    default: m.SeminovosPage,
  }))
);
const DetalhesPage = lazyWithRetry(() =>
  import("@/modules/detalhes/pages/DetalhesPage").then((m) => ({
    default: m.DetalhesPage,
  }))
);
const SobrePage = lazyWithRetry(() =>
  import("@/modules/sobre/pages/SobrePage").then((m) => ({ default: m.SobrePage }))
);
const ContatoPage = lazyWithRetry(() =>
  import("@/modules/contato/pages/ContatoPage").then((m) => ({
    default: m.ContatoPage,
  }))
);
const BlogPage = lazyWithRetry(() =>
  import("@/modules/blog/pages/BlogPage").then((m) => ({ default: m.BlogPage }))
);
const CompraPage = lazyWithRetry(() =>
  import("@/modules/compra/pages/CompraPage").then((m) => ({ default: m.CompraPage }))
);
const BlogPostPage = lazyWithRetry(() =>
  import("@/modules/blog/pages/BlogPostPage").then((m) => ({
    default: m.BlogPostPage,
  }))
);
const CityLandingPage = lazyWithRetry(() =>
  import("@/modules/seo/pages/CityLandingPage").then((m) => ({
    default: m.CityLandingPage,
  }))
);
const SeminovosAutomaticosPage = lazyWithRetry(() =>
  import("@/modules/seo/pages/SeminovosAutomaticosPage").then((m) => ({
    default: m.SeminovosAutomaticosPage,
  }))
);
const SellCityLandingPage = lazyWithRetry(() =>
  import("@/modules/seo/pages/SellCityLandingPage").then((m) => ({
    default: m.SellCityLandingPage,
  }))
);
const EstoqueLandingPage = lazyWithRetry(() =>
  import("@/modules/seo/pages/EstoqueLandingPage").then((m) => ({
    default: m.EstoqueLandingPage,
  }))
);
const FinanciamentoPage = lazyWithRetry(() =>
  import("@/modules/seo/pages/contentSeoPages").then((m) => ({
    default: m.FinanciamentoPage,
  }))
);
const Atendimento24hPage = lazyWithRetry(() =>
  import("@/modules/seo/pages/contentSeoPages").then((m) => ({
    default: m.Atendimento24hPage,
  }))
);
const ComparadorPage = lazyWithRetry(() =>
  import("@/modules/seo/pages/ComparadorPage").then((m) => ({
    default: m.ComparadorPage,
  }))
);
const RegionsHubPage = lazyWithRetry(() =>
  import("@/modules/seo/pages/RegionsHubPage").then((m) => ({
    default: m.RegionsHubPage,
  }))
);

// Mensagem do WhatsApp contextual por rota: lead chega no iAN já qualificado
function getContextualMessage(pathname: string): string {
  if (pathname.startsWith("/vender-carro-")) {
    const city = getCityPage(pathname.replace("/vender-carro-", ""));
    if (city) {
      return siteWhatsAppMessage(
        `moro em ${city.name} e quero vender meu carro para a Netcar.`,
      );
    }
  }
  if (pathname.startsWith("/seminovos-") && pathname !== "/seminovos-automaticos") {
    const city = getCityPage(pathname.replace("/seminovos-", ""));
    if (city) {
      return siteWhatsAppMessage(
        `moro em ${city.name} e estou procurando um seminovo.`,
      );
    }
  }
  if (pathname.startsWith("/comprar-")) {
    const landing = getLandingPage(pathname.replace("/comprar-", ""));
    if (landing) {
      return siteWhatsAppMessage(
        `estou procurando um ${landing.name} seminovo em Esteio.`,
      );
    }
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
  if (pathname === "/comparar") {
    return siteWhatsAppMessage("quero ajuda para comparar alguns seminovos.");
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
  const slug = isDetalhesPage ? location.pathname.replace("/veiculo/", "") : "";
  // useVehicleQuery já verifica se slug existe internamente, então não faz query se slug for vazio
  const { data: vehicle } = useVehicleQuery(slug);

  const getIanWhatsAppLink = () => {
    if (!whatsapp?.numero) return "#";

    let message = getContextualMessage(location.pathname);
    if (isDetalhesPage && vehicle) {
      const vehicleLabel = vehicle.modelo || vehicle.name || "veículo";
      message = vehicleWhatsAppMessages(vehicleLabel).info;
    }

    return buildWhatsAppUrl(whatsapp.numero, message);
  };

  // Home: sticky contextual cobre WA. Estoque/detalhe mantêm floater (desktop).
  if (location.pathname === "/") return null;

  return (
    <motion.a
      href={getIanWhatsAppLink()}
      target="_blank"
      rel="noopener noreferrer"
      data-wa-source="ian_floater"
      data-wa-intent={isDetalhesPage && vehicle ? "vehicle_inquiry" : "ian_contact"}
      data-wa-vehicle-id={isDetalhesPage && vehicle?.id ? String(vehicle.id) : undefined}
      data-wa-vehicle-name={
        isDetalhesPage && vehicle ? (vehicle.modelo || vehicle.name || undefined) : undefined
      }
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-6 right-6 z-50 hidden md:flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-all hover:shadow-2xl group"
      style={{ backgroundColor: '#25D366' }}
      aria-label="Fale com iAN no WhatsApp"
      title="Fale com iAN no WhatsApp"
    >
      <motion.div
        className="absolute inset-0 rounded-full bg-[#25D366]"
        animate={{
          boxShadow: [
            "0 0 0 0 rgba(37, 211, 102, 0.7)",
            "0 0 0 15px rgba(37, 211, 102, 0)",
            "0 0 0 0 rgba(37, 211, 102, 0)",
          ],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeOut",
        }}
      />
      <svg className="h-8 w-8 text-white relative z-10" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    </motion.a>
  );
}

function RootComponent() {
  const location = useRouterState({
    select: (state) => state.location,
  });

  // Scroll para o topo quando a rota mudar
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
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

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden max-w-full">
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[10000] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-white focus:outline-none"
      >
        Pular para o conteúdo
      </a>
      <SchemaOrg />
      <Header />
      <div className="relative min-h-[100dvh] flex-1 overflow-x-hidden max-w-full pt-0 sm:pt-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full overflow-x-hidden max-w-full"
            id="conteudo-principal"
            tabIndex={-1}
          >
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}

// Componente para página não encontrada - redireciona automaticamente para home
function NotFound() {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Redireciona automaticamente para a home após um pequeno delay
    const timer = setTimeout(() => {
      navigate({ to: "/" });
    }, 100);
    
    return () => clearTimeout(timer);
  }, [navigate]);
  
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <h1 className="mb-4 text-4xl font-bold text-primary">404</h1>
      <p className="mb-8 text-lg text-muted-foreground">
        Página não encontrada
      </p>
      <p className="text-sm text-muted-foreground">
        Redirecionando para a página inicial...
      </p>
    </div>
  );
}

const rootRoute = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFound,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const seminovosRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/seminovos",
  component: SeminovosPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      marca: (search.marca as string) || undefined,
      modelo: (search.modelo as string) || undefined,
      precoMin: (search.precoMin as string) || undefined,
      precoMax: (search.precoMax as string) || undefined,
      anoMin: (search.anoMin as string) || undefined,
      anoMax: (search.anoMax as string) || undefined,
      cambio: (search.cambio as string) || undefined,
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

export const routeTree = rootRoute.addChildren([
  indexRoute,
  seminovosRoute,
  detalhesRoute,
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
  comparadorRoute,
  regionsHubRoute,
]);

// Exporta NotFound para uso no RouterProvider
export { NotFound };

// O router será criado dinamicamente no RouterProvider
// Isso permite detectar o basepath corretamente após o DOM estar pronto
