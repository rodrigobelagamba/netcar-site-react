import { useEffect } from "react";

export function useTheme() {
  useEffect(() => {
    const theme = import.meta.env.VITE_DEFAULT_THEME || "light";
    const html = document.documentElement;
    html.classList.remove("light", "dark");
    html.classList.add(theme);
    html.setAttribute("data-theme", theme);
  }, []);
}
