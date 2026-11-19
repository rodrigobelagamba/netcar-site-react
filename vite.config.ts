import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

function leadCallbackDryRunPlugin(): Plugin {
  const dedup = new Map<string, number>();
  const rate = new Map<string, number[]>();

  const cleanText = (value: unknown, max: number) =>
    String(value ?? "")
      .replace(/\p{Cc}+/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);

  const normalizeBrPhone = (raw: unknown): string | null => {
    let digits = String(raw ?? "").replace(/\D/g, "");
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
      digits = digits.slice(2);
    }
    if (digits.length !== 10 && digits.length !== 11) return null;
    const ddd = Number(digits.slice(0, 2));
    if (!Number.isInteger(ddd) || ddd < 11 || ddd > 99) return null;
    if (digits.length === 11 && digits[2] !== "9") return null;
    if (/^(\d)\1+$/.test(digits)) return null;
    return `55${digits}`;
  };

  return {
    name: "netcar-lead-callback-dry-run",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/lead-callback.php", (req, res) => {
        const send = (status: number, body: Record<string, unknown>) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json; charset=UTF-8");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify(body));
        };

        if (req.method !== "POST") {
          res.setHeader("Allow", "POST");
          send(405, { ok: false, error: "Método não permitido." });
          return;
        }

        const chunks: Buffer[] = [];
        let total = 0;
        req.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total <= 16 * 1024) chunks.push(chunk);
        });
        req.on("end", () => {
          if (total > 16 * 1024) {
            send(413, { ok: false, error: "Requisição muito grande." });
            return;
          }
          let input: Record<string, unknown>;
          try {
            input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          } catch {
            send(400, { ok: false, error: "Dados inválidos." });
            return;
          }

          if (cleanText(input.website, 120) !== "") {
            send(200, { ok: true, accepted: true, crm_confirmed: false });
            return;
          }

          const phone = normalizeBrPhone(input.phone);
          if (!phone) {
            send(422, { ok: false, error: "Informe um WhatsApp válido com DDD." });
            return;
          }

          const now = Date.now();
          const ip = req.socket.remoteAddress || "local";
          const recent = (rate.get(ip) || []).filter((ts) => now - ts < 10 * 60_000);
          if (recent.length >= 10) {
            send(429, {
              ok: false,
              error: "Muitas tentativas em poucos minutos. Chame direto no WhatsApp.",
            });
            return;
          }
          recent.push(now);
          rate.set(ip, recent);

          const vehicleId = String(input.vehicleId ?? "").replace(/\D/g, "").slice(0, 12);
          const dupKey = `${phone}|${vehicleId}`;
          const prevTs = dedup.get(dupKey);
          if (prevTs && now - prevTs < 15 * 60_000) {
            send(200, { ok: true, dry_run: true, duplicate: true, crm_confirmed: false });
            return;
          }
          dedup.set(dupKey, now);

          const vehicleName = cleanText(input.vehicleName, 160) || "Seminovo Netcar";
          const interest = vehicleId ? `${vehicleName} (ID ${vehicleId})` : vehicleName;
          const summaryParts = ["Pedido de retorno no site (Me chamar)."];
          const intentSummary = cleanText(input.intentSummary, 220);
          if (intentSummary) summaryParts.push(`Intenção: ${intentSummary}.`);
          const pageUrl = cleanText(input.pageUrl, 260);
          if (pageUrl) summaryParts.push(`Página: ${pageUrl}.`);

          const traffic =
            input.traffic && typeof input.traffic === "object"
              ? (input.traffic as Record<string, unknown>)
              : {};
          const trafficBits: string[] = [];
          for (const [k, label] of [
            ["src", "Fonte"],
            ["campaign", "Campanha"],
            ["utmSource", "utm_source"],
            ["utmMedium", "utm_medium"],
            ["utmContent", "utm_content"],
            ["utmTerm", "utm_term"],
            ["gclid", "gclid"],
            ["gbraid", "gbraid"],
            ["wbraid", "wbraid"],
            ["fbclid", "fbclid"],
          ] as const) {
            const val = cleanText(traffic[k], 120);
            if (val) trafficBits.push(`${label}=${val}`);
          }
          const waRef = cleanText(input.waRef, 16);
          if (waRef) trafficBits.push(`wa_ref=${waRef}`);
          const clickId = cleanText(input.clickId, 40);
          if (clickId) trafficBits.push(`click_id=${clickId}`);
          if (trafficBits.length > 0) {
            summaryParts.push(`Atribuição: ${trafficBits.join(" | ")}.`);
          }

          const payload = {
            event: "lead_created",
            timestamp: new Date().toISOString(),
            data: {
              phone,
              name: "Lead Site",
              interest,
              origem: "SITE",
              canal: "Site",
              id_carro: vehicleId,
              summary: cleanText(summaryParts.join(" "), 1000),
            },
          };

          send(200, {
            ok: true,
            dry_run: true,
            crm_confirmed: false,
            payload,
          });
        });
      });
    },
  };
}

export default defineConfig({
  appType: "spa",
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react(), leadCallbackDryRunPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    proxy: {
      // The detail page selects these responsive images again on viewport changes.
      "/vehicle-photo.php": {
        target: "https://www.netcarmultimarcas.com.br",
        changeOrigin: true,
      },
      "/entregas/v1/feed.php": {
        target: "https://www.netcarmultimarcas.com.br",
        changeOrigin: true,
      },
      "/social/v1": {
        target: "https://www.netcarmultimarcas.com.br",
        changeOrigin: true,
      },
      "/arquivos/autocheck": {
        target: "https://www.netcarmultimarcas.com.br",
        changeOrigin: true,
      },
      "/api/embedsocial-proxy": {
        target: "https://embedsocial.com",
        changeOrigin: true,
        rewrite: (requestPath) =>
          requestPath.replace(/^\/api\/embedsocial-proxy\/?/, "/api/"),
      },
    },
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    manifest: true,
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
          
          // Google Maps / Leaflet
          if (
            id.includes("@react-google-maps") ||
            id.includes("/google") ||
            id.includes("/leaflet/")
          ) {
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
          
          // Lucide não deve virar um chunk global: cada rota usa poucos ícones.
          // O chunk único obrigava a home a baixar ícones de páginas ainda não abertas.
          
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
