import { QueryClientProviderWrapper } from "./providers/query-client";
import { ThemeProvider } from "./providers/theme-provider";
import { RouterProvider } from "./providers/router-provider";
import { SearchProvider } from "@/contexts/SearchContext";

export function App() {
  return (
    <ThemeProvider>
      <QueryClientProviderWrapper>
        <SearchProvider>
          <RouterProvider />
        </SearchProvider>
      </QueryClientProviderWrapper>
    </ThemeProvider>
  );
}
