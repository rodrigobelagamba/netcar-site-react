import {
  createRootRoute,
  createRoute,
  Outlet,
} from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { MessageCircle } from "lucide-react";
import { Header } from "@/design-system/components/layout/Header";
import { Footer } from "@/design-system/components/layout/Footer";
import { HomePage } from "@/modules/home/pages/HomePage";
import { SeminovosPage } from "@/modules/seminovos/pages/SeminovosPage";
import { DetalhesPage } from "@/modules/detalhes/pages/DetalhesPage";
import { SobrePage } from "@/modules/sobre/pages/SobrePage";
import { ContatoPage } from "@/modules/contato/pages/ContatoPage";
import { useWhatsAppQuery } from "@/api/queries/useSiteQuery";

// WhatsApp Button Component
function WhatsAppButton() {
  const { data: whatsapp } = useWhatsAppQuery();

  const getWhatsAppLink = () => {
    if (!whatsapp?.numero) return "#";
    
    // Se a API já retornou um link, usa ele
    if (whatsapp.link) {
      return whatsapp.link;
    }
    
    // Senão, gera o link do WhatsApp
    const cleaned = whatsapp.numero.replace(/\D/g, "");
    const message = whatsapp.mensagem || "Olá! Gostaria de mais informações.";
    return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
  };

  if (!whatsapp?.numero) {
    return null;
  }

  return (
    <motion.a
      href={getWhatsAppLink()}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all hover:shadow-xl"
      style={{ backgroundColor: '#25D366' }}
      aria-label="Fale conosco no WhatsApp"
      title="Fale conosco no WhatsApp"
    >
      <MessageCircle className="h-7 w-7 text-white" />
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

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden max-w-full">
      <Header />
      <div className="relative flex-1 overflow-x-hidden max-w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full overflow-x-hidden max-w-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </div>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}

// Componente para página não encontrada
function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <h1 className="mb-4 text-4xl font-bold text-primary">404</h1>
      <p className="mb-8 text-lg text-muted-foreground">
        Página não encontrada
      </p>
      <a
        href="/"
        className="rounded-md bg-primary px-6 py-3 text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Voltar para a página inicial
      </a>
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

export const routeTree = rootRoute.addChildren([
  indexRoute,
  seminovosRoute,
  detalhesRoute,
  sobreRoute,
  contatoRoute,
]);

// Exporta NotFound para uso no RouterProvider
export { NotFound };

// O router será criado dinamicamente no RouterProvider
// Isso permite detectar o basepath corretamente após o DOM estar pronto
