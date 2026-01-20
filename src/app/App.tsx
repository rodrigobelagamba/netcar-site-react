import { useState } from "react";
import { QueryClientProviderWrapper } from "./providers/query-client";
import { ThemeProvider } from "./providers/theme-provider";
import { RouterProvider } from "./providers/router-provider";
import { SearchProvider } from "@/contexts/SearchContext";
import { Preloader } from "@/design-system/components/layout/Preloader";

export function App() {
  const [showPreloader, setShowPreloader] = useState(true);

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
