import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const MAX_CACHE_AGE_MS = 30 * 60 * 1000;
const MAX_VERSIONED_STOCK_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_BUILD_SNAPSHOT_AGE_MS = 15 * 60 * 1000;
const PUBLIC_DIFFERENTIAL_TAGS = new Set([
  "garantia_fabrica",
  "unico_dono",
]);

function publicDifferentials(vehicle) {
  if (!Array.isArray(vehicle?.diferenciais)) return [];

  return vehicle.diferenciais
    .filter((differential) =>
      PUBLIC_DIFFERENTIAL_TAGS.has(String(differential?.tag || "")),
    )
    .map((differential) => ({
      tag: String(differential.tag || ""),
      descricao: String(differential.descricao || ""),
    }));
}

function cachePath(rootDir) {
  return join(rootDir, ".devops", "seo-stock-cache.json");
}

function versionedStockPath(rootDir) {
  return join(rootDir, "public", "seo", "stock-bootstrap.json");
}

function buildSnapshotPath(rootDir) {
  return join(rootDir, ".devops", "seo-build-stock.json");
}

// Mantém somente os campos públicos usados nas vitrines SEO. Assim o cache não
// replica chassi, Renavam ou outros dados administrativos retornados pela API.
export function publicVehicle(vehicle) {
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
    // O snapshot alimenta o bootstrap do primeiro paint. Preserva somente os
    // diferenciais que a vitrine exibe; os demais dados comerciais da API não
    // precisam ser replicados no cache público do build.
    diferenciais: publicDifferentials(vehicle),
    placa: vehicle.placa,
    link: vehicle.link,
    destaque: vehicle.destaque,
    promocao: vehicle.promocao,
    pdf: vehicle.pdf,
    pdf_url: vehicle.pdf_url,
    imagens: {
      thumb: Array.isArray(vehicle?.imagens?.thumb)
        ? vehicle.imagens.thumb.slice(0, 1)
        : [],
    },
    imagens_site: vehicle?.imagens_site
      ? {
          capa: vehicle.imagens_site.capa,
          capa_thumb: vehicle.imagens_site.capa_thumb,
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

/**
 * Congela a fonte escolhida no início do build. Os geradores seguintes usam
 * este mesmo retrato, evitando misturar um fallback antigo com uma API que se
 * recuperou (ou mudou) alguns segundos depois.
 */
export function writeSeoBuildStockSnapshot(
  rootDir,
  vehicles,
  { source = "unknown", sourceAgeMs = 0 } = {},
) {
  const file = buildSnapshotPath(rootDir);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    `${JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        source,
        sourceAgeMs: Number.isFinite(sourceAgeMs) ? sourceAgeMs : 0,
        vehicles: vehicles.map(publicVehicle),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

export function readSeoBuildStockSnapshot(
  rootDir,
  { includeSold = false } = {},
) {
  try {
    const snapshot = JSON.parse(
      readFileSync(buildSnapshotPath(rootDir), "utf8"),
    );
    const createdAt = Date.parse(snapshot?.createdAt || "");
    const ageMs = Date.now() - createdAt;
    if (
      !Number.isFinite(createdAt) ||
      ageMs < 0 ||
      ageMs > MAX_BUILD_SNAPSHOT_AGE_MS ||
      !Array.isArray(snapshot?.vehicles) ||
      snapshot.vehicles.length === 0
    ) {
      return null;
    }

    return {
      ageMs,
      source: snapshot.source || "unknown",
      sourceAgeMs: Number(snapshot.sourceAgeMs || 0),
      vehicles: includeSold
        ? snapshot.vehicles
        : snapshot.vehicles.filter((vehicle) => Number(vehicle.valor) > 0),
    };
  } catch {
    return null;
  }
}

export function clearSeoBuildStockSnapshot(rootDir) {
  try {
    unlinkSync(buildSnapshotPath(rootDir));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
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
export function readVersionedSeoStock(rootDir, { includeSold = false } = {}) {
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
