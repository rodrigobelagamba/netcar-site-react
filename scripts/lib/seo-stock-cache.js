import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const MAX_CACHE_AGE_MS = 30 * 60 * 1000;
const MAX_VERSIONED_STOCK_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function cachePath(rootDir) {
  return join(rootDir, ".devops", "seo-stock-cache.json");
}

function versionedStockPath(rootDir) {
  return join(rootDir, "public", "seo", "stock-bootstrap.json");
}

// Mantém somente os campos públicos usados nas vitrines SEO. Assim o cache não
// replica chassi, Renavam ou outros dados administrativos retornados pela API.
function publicVehicle(vehicle) {
  return {
    id: vehicle.id,
    marca: vehicle.marca,
    modelo: vehicle.modelo,
    ano: vehicle.ano,
    ano_fabricacao: vehicle.ano_fabricacao,
    valor: vehicle.valor,
    valor_formatado: vehicle.valor_formatado,
    preco_com_troca: vehicle.preco_com_troca,
    preco_com_troca_formatado: vehicle.preco_com_troca_formatado,
    km: vehicle.km,
    cor: vehicle.cor,
    motor: vehicle.motor,
    cambio: vehicle.cambio,
    combustivel: vehicle.combustivel,
    potencia: vehicle.potencia,
    portas: vehicle.portas,
    lugares: vehicle.lugares,
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

export function readFreshSeoStockCache(rootDir, { includeSold = false } = {}) {
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
      source: "runtime-cache",
      vehicles: includeSold
        ? cached.vehicles
        : cached.vehicles.filter((vehicle) => Number(vehicle.valor) > 0),
    };
  } catch {
    return null;
  }
}

function versionedVehicleToApiShape(vehicle) {
  return {
    ...vehicle,
    ano: vehicle.ano ?? vehicle.year,
    ano_fabricacao: vehicle.ano_fabricacao ?? vehicle.anoFabricacao,
    valor: vehicle.valor ?? vehicle.price ?? 0,
    link: vehicle.link ?? vehicle.slug,
    imagens: vehicle.imagens ?? {
      thumb: Array.isArray(vehicle.images) ? vehicle.images.slice(0, 1) : [],
      full: [],
    },
  };
}

/**
 * Último estoque completo versionado pelo build anterior. Ele só entra quando
 * a API e o cache efêmero falham, e expira para não perpetuar um catálogo
 * antigo silenciosamente.
 */
export function readVersionedSeoStock(
  rootDir,
  { includeSold = false } = {},
) {
  try {
    const stock = JSON.parse(readFileSync(versionedStockPath(rootDir), "utf8"));
    const generatedAt = Date.parse(stock?.generatedAt || "");
    const ageMs = Date.now() - generatedAt;
    const sourceVehicles =
      includeSold && Array.isArray(stock?.showroomVehicles)
        ? stock.showroomVehicles
        : stock?.vehicles;

    if (
      !Number.isFinite(generatedAt) ||
      ageMs < 0 ||
      ageMs > MAX_VERSIONED_STOCK_AGE_MS ||
      !Array.isArray(sourceVehicles) ||
      sourceVehicles.length === 0
    ) {
      return null;
    }

    const vehicles = sourceVehicles
      .filter((vehicle) => vehicle?.id && vehicle?.marca && vehicle?.modelo)
      .map(versionedVehicleToApiShape);
    if (vehicles.length === 0) return null;

    return {
      ageMs,
      source: "versioned-bootstrap",
      vehicles: includeSold
        ? vehicles
        : vehicles.filter((vehicle) => Number(vehicle.valor) > 0),
    };
  } catch {
    return null;
  }
}
