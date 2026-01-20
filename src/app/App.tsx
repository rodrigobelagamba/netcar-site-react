import { useState, useEffect } from "react";
import { QueryClientProviderWrapper } from "./providers/query-client";
import { ThemeProvider } from "./providers/theme-provider";
import { RouterProvider } from "./providers/router-provider";
import { SearchProvider } from "@/contexts/SearchContext";
import { Preloader } from "@/design-system/components/layout/Preloader";

export function App() {
  const [showPreloader, setShowPreloader] = useState(() => {
    // Só mostra preloader se for a primeira visita na sessão E entrou pela URL principal
    const hasVisited = sessionStorage.getItem("netcar_visited");
    const isMainUrl = window.location.pathname === "/" || window.location.pathname === "";
    return !hasVisited && isMainUrl;
  });

  useEffect(() => {
    // Marca como visitado assim que o app carrega
    sessionStorage.setItem("netcar_visited", "true");
  }, []);

  const handlePreloaderComplete = () => {
    setShowPreloader(false);
  };

  return (
    <ThemeProvider>
      <QueryClientProviderWrapper>
        <SearchProvider>
          {showPreloader && <Preloader onComplete={handlePreloaderComplete} />}
          <RouterProvider />
        </SearchProvider>
      </QueryClientProviderWrapper>
    </ThemeProvider>
  );
}
