const SITE_URL = "https://www.netcarmultimarcas.com.br";
const API_URL = `${SITE_URL}/api/v1/veiculos.php?limit=500`;

function maskPlate(placa) {
  if (!placa) return "";
  const clean = placa.replace(/\s/g, "").toUpperCase().replace(/-/g, "");
  if (clean.length < 5) return clean.toLowerCase();
  const prefix = clean.substring(0, 3);
  const digits = clean.match(/\d/g);
  const suffix = digits && digits.length >= 2 ? digits.slice(-2).join("") : clean.slice(-2);
  return `${prefix.toLowerCase()}-xx${suffix}`;
}

export function generateVehicleSlug(vehicle) {
  const parts = [];

  if (vehicle.modelo) {
    let modelo = vehicle.modelo.trim();
    if (vehicle.marca && modelo.toLowerCase().startsWith(vehicle.marca.toLowerCase())) {
      modelo = modelo.substring(vehicle.marca.length).trim();
    }
    const modeloSlug = modelo
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (modeloSlug) parts.push(modeloSlug);
  }

  if (vehicle.ano) parts.push(String(vehicle.ano));
  if (vehicle.placa) {
    const placaSlug = maskPlate(vehicle.placa);
    if (placaSlug) parts.push(placaSlug);
  }
  parts.push(String(vehicle.id));

  return parts.join("-");
}

async function fetchOnce() {
  const response = await fetch(API_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`API retornou HTTP ${response.status}`);
  }

  const json = await response.json();
  if (!json.success || !Array.isArray(json.data)) {
    throw new Error("Resposta da API inválida");
  }

  return json.data
    .filter((vehicle) => Number(vehicle.valor) > 0)
    .map((vehicle) => `${SITE_URL}/veiculo/${generateVehicleSlug(vehicle)}`);
}

/**
 * URLs absolutas dos veículos disponíveis na API.
 * Tenta 3 vezes: uma falha isolada aqui já apagou os veículos do sitemap
 * de produção e o fallback perpetuou o sitemap vazio.
 */
export async function fetchVehicleSitemapUrls() {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await fetchOnce();
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
      }
    }
  }
  throw lastError;
}
