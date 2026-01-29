import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  appType: "spa",
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: process.env.NODE_ENV === "development",
    minify: "esbuild",
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Verifica se é node_modules primeiro
          if (!id.includes("node_modules")) {
            return;
          }
          
          // Bibliotecas grandes específicas primeiro (mais específicas primeiro)
          
          // Google Maps (muito grande)
          if (id.includes("@react-google-maps") || id.includes("/google")) {
            return "vendor-maps";
          }
          
          // GSAP (biblioteca de animação grande)
          if (id.includes("/gsap/") || id.includes("\\gsap\\")) {
            return "vendor-gsap";
          }
          
          // Framer Motion (biblioteca de animação)
          if (id.includes("framer-motion")) {
            return "vendor-framer";
          }
          
          // React Slick e Slick Carousel
          if (id.includes("react-slick") || id.includes("slick-carousel")) {
            return "vendor-slick";
          }
          
          // Embla Carousel
          if (id.includes("embla-carousel")) {
            return "vendor-embla";
          }
          
          // Lucide React (muitos ícones)
          if (id.includes("lucide-react")) {
            return "vendor-icons";
          }
          
          // React Hook Form e Zod
          if (id.includes("react-hook-form") || id.includes("/zod/")) {
            return "vendor-forms";
          }
          
          // Lightbox
          if (id.includes("fslightbox")) {
            return "vendor-lightbox";
          }
          
          // TanStack Router
          if (id.includes("@tanstack/react-router")) {
            return "vendor-router";
          }
          
          // TanStack Query
          if (id.includes("@tanstack/react-query")) {
            return "vendor-query";
          }
          
          // React e React DOM (verificar depois das outras para evitar falsos positivos)
          if (id.includes("/react/") || id.includes("/react-dom/") || 
              id.includes("\\react\\") || id.includes("\\react-dom\\")) {
            return "vendor-react";
          }
          
          // Axios
          if (id.includes("/axios/") || id.includes("\\axios\\")) {
            return "vendor-axios";
          }
          
          // Zustand
          if (id.includes("/zustand/") || id.includes("\\zustand\\")) {
            return "vendor-zustand";
          }
          
          // Radix UI
          if (id.includes("@radix-ui")) {
            return "vendor-radix";
          }
          
          // Outras bibliotecas pequenas agrupadas (evitar dependências circulares)
          // Não retornar "vendor" genérico para evitar circularidade com vendor-react
          if (id.includes("node_modules")) {
            // Bibliotecas muito pequenas podem ficar no bundle principal
            return undefined;
          }
        },
      },
    },
  },
});
