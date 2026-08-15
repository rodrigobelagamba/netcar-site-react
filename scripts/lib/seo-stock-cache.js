import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const MAX_CACHE_AGE_MS = 30 * 60 * 1000;

function cachePath(rootDir) {
  return join(rootDir, ".devops", "seo-stock-cache.json");
}

// Mantém somente os campos públicos usados nas vitrines SEO. Assim o cache não
// replica chassi, Renavam ou outros dados administrativos retornados pela API.
function publicVehicle(vehicle) {
  return {
    id: vehicle.id,
    marca: vehicle.marca,
    modelo: vehicle.modelo,
    ano: vehicle.ano,
    valor: vehicle.valor,
    km: vehicle.km,
    cambio: vehicle.cambio,
    combustivel: vehicle.combustivel,
    categoria: vehicle.categoria,
    placa: vehicle.placa,
    link: vehicle.link,
    destaque: vehicle.destaque,
    imagens: {
      thumb: Array.isArray(vehicle?.imagens?.thumb)
        ? vehicle.imagens.thumb.slice(0, 1)
        : [],
    },
    imagens_site: vehicle?.imagens_site
      ? {
          capa: vehicle.imagens_site.capa,
          capa_opengraph: vehicle.imagens_site.capa_opengraph,
          tem_fotos: vehicle.imagens_site.tem_fotos,
        }
      : undefined,
  };
}

export function writeSeoStockCache(rootDir, vehicles) {
  const file = cachePath(rootDir);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        vehicles: vehicles.map(publicVehicle),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

export function readFreshSeoStockCache(rootDir) {
  try {
    const cached = JSON.parse(readFileSync(cachePath(rootDir), "utf8"));
    const generatedAt = Date.parse(cached?.generatedAt || "");
    const ageMs = Date.now() - generatedAt;
    if (
      !Number.isFinite(generatedAt) ||
      ageMs < 0 ||
      ageMs > MAX_CACHE_AGE_MS ||
      !Array.isArray(cached?.vehicles) ||
      cached.vehicles.length === 0
    ) {
      return null;
    }
    return {
      ageMs,
      vehicles: cached.vehicles.filter((vehicle) => Number(vehicle.valor) > 0),
    };
  } catch {
    return null;
  }
}
