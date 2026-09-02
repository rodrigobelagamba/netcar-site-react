import { QueryClientProviderWrapper } from "./providers/query-client";
import { ThemeProvider } from "./providers/theme-provider";
import { RouterProvider } from "./providers/router-provider";
import { SearchProvider } from "@/contexts/SearchContext";
import { CampaignProvider } from "@/features/september-campaign/CampaignProvider";

export function App() {
  return (
    <ThemeProvider>
      <QueryClientProviderWrapper>
        <CampaignProvider>
          <SearchProvider>
            <RouterProvider />
          </SearchProvider>
        </CampaignProvider>
      </QueryClientProviderWrapper>
    </ThemeProvider>
  );
}
