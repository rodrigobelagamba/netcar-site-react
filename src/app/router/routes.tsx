import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useRouterState } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { Header } from "@/design-system/components/layout/Header";
import { Footer } from "@/design-system/components/layout/Footer";
import { HomePage } from "@/modules/home/pages/HomePage";
import { SeminovosPage } from "@/modules/seminovos/pages/SeminovosPage";
import { DetalhesPage } from "@/modules/detalhes/pages/DetalhesPage";
import { SobrePage } from "@/modules/sobre/pages/SobrePage";
import { ContatoPage } from "@/modules/contato/pages/ContatoPage";

// Theme Toggle Button Component (Temporary)
function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Verifica o tema atual
    const currentTheme =
      document.documentElement.getAttribute("data-theme") || "light";
    setTheme(currentTheme as "light" | "dark");
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(newTheme);
  };

  return (
    <button
      onClick={toggleTheme}
      className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-110 hover:shadow-xl"
      aria-label={`Alternar para modo ${theme === "light" ? "escuro" : "claro"}`}
      title={`Alternar para modo ${theme === "light" ? "escuro" : "claro"}`}
    >
      {theme === "light" ? (
        <Moon className="h-5 w-5" />
      ) : (
        <Sun className="h-5 w-5" />
      )}
    </button>
  );
}

function RootComponent() {
  const location = useRouterState({
    select: (state) => state.location,
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="relative flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </div>
      <Footer />
      <ThemeToggle />
    </div>
  );
}

const rootRoute = createRootRoute({
  component: RootComponent,
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
  path: "/detalhes/$slug",
  component: DetalhesPage,
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

const routeTree = rootRoute.addChildren([
  indexRoute,
  seminovosRoute,
  detalhesRoute,
  sobreRoute,
  contatoRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
