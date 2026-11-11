import { QueryClientProviderWrapper } from "./providers/query-client";
import { ThemeProvider } from "./providers/theme-provider";
import { RouterProvider } from "./providers/router-provider";
import { SearchProvider } from "@/contexts/SearchContext";
import { BlackFridayCampaignProvider } from "@/features/black-friday/CampaignProvider";

export function App() {
  return (
    <ThemeProvider>
      <QueryClientProviderWrapper>
        <SearchProvider>
          <BlackFridayCampaignProvider>
            <RouterProvider />
          </BlackFridayCampaignProvider>
        </SearchProvider>
      </QueryClientProviderWrapper>
    </ThemeProvider>
  );
}
