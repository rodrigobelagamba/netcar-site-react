import { QueryClientProviderWrapper } from "./providers/query-client";
import { ThemeProvider } from "./providers/theme-provider";
import { RouterProvider } from "./providers/router-provider";

export function App() {
  return (
    <ThemeProvider>
      <QueryClientProviderWrapper>
        <RouterProvider />
      </QueryClientProviderWrapper>
    </ThemeProvider>
  );
}
