import { useEffect, ReactNode } from "react";

const defaultTheme =
  import.meta.env.VITE_DEFAULT_THEME || "light";

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const theme = defaultTheme;
    const html = document.documentElement;
    html.classList.remove("light", "dark");
    html.classList.add(theme);
    html.setAttribute("data-theme", theme);
  }, []);

  return <>{children}</>;
}
