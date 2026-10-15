import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getDefaultAutoSelectFamilyAttemptTimeout,
  setDefaultAutoSelectFamilyAttemptTimeout,
} from "node:net";
import { publicVehicle } from "./seo-stock-cache.js";

const DEFAULT_API_URL =
  "https://www.netcarmultimarcas.com.br/api/v1/veiculos.php?limit=500";
const PAGE_SIZE = 500;
const MAX_PAGES = 100;
const MAX_REDUCTION = 0.2;
const HTTP_FAILURE = Symbol("seoStockHttpFailure");
const TRANSIENT_TRANSPORT_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENOTFOUND",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "EPIPE",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
]);
const TLS_CODES = new Set([
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "ERR_TLS_CERT_ALTNAME_INVALID",
]);

/** Same bounded dual-stack policy as the existing i-CHECK CLI. Importing this
 * module must not change its host process's network configuration. */
export function configureSeoStockNetwork() {
  setDefaultAutoSelectFamilyAttemptTimeout(
    Math.max(2_000, getDefaultAutoSelectFamilyAttemptTimeout()),
  );
}

function readFailure(error) {
  const codes = [];
  const queue = [error];
  const visited = new Set();
  let invalidJson = false;
  let timedOut = false;
  let unclassified = false;
  for (let index = 0; index < queue.length && index < 16; index += 1) {
    const current = queue[index];
    if (!current || typeof current !== "object" || visited.has(current)) {
      unclassified = true;
      continue;
    }
    visited.add(current);
    if (current.name === "SyntaxError") invalidJson = true;
    const timeout = ["TimeoutError", "AbortError"].includes(current.name);
    if (timeout) timedOut = true;
    if (typeof current.code === "string") codes.push(current.code);
    const hasCause = current.cause !== undefined;
    const children = Array.isArray(current.errors) ? current.errors : [];
    if (hasCause) queue.push(current.cause);
    if (children.length > 8) unclassified = true;
    if (children.length) queue.push(...children.slice(0, 8));
    if (
      !hasCause &&
      children.length === 0 &&
      typeof current.code !== "string" &&
      !timeout &&
      current.name !== "SyntaxError"
    ) {
      unclassified = true;
    }
  }
  if (queue.length > 16) unclassified = true;
  const tlsCode = codes.find((code) => TLS_CODES.has(code));
  if (tlsCode) return { code: tlsCode, retryable: false };
  if (invalidJson) return { code: "invalid_json", retryable: false };
  // Never accept a partially inspected error graph as allowlisted transport.
  if (unclassified) return { code: "unknown_read_error", retryable: false };
  if (
    codes.length &&
    codes.every((code) => TRANSIENT_TRANSPORT_CODES.has(code))
  ) {
    return { code: codes[0], retryable: true };
  }
  if (timedOut && codes.length === 0)
    return { code: "request_timeout", retryable: true };
  return { code: "unknown_read_error", retryable: false };
}

function stockError(message) {
  return new Error(`Estoque SEO: ${message}; publicação interrompida`);
}

function exactId(value) {
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    (typeof value === "number" && !Number.isSafeInteger(value)) ||
    !/^[1-9]\d*$/.test(String(value))
  ) {
    throw stockError("ID ausente ou inválido");
  }
  return String(value);
}

function validPrice(value) {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value)) ||
    !Number.isFinite(Number(value)) ||
    Number(value) < 0 ||
    Number(value) > Number.MAX_SAFE_INTEGER
  ) {
    throw stockError("preço ausente ou inválido");
  }
  return Number(value);
}

function validateRows(vehicles) {
  if (!Array.isArray(vehicles)) throw stockError("lista de veículos inválida");
  const ids = new Set();
  let activeCount = 0;
  for (const vehicle of vehicles) {
    if (!vehicle || typeof vehicle !== "object" || Array.isArray(vehicle)) {
      throw stockError("registro de veículo inválido");
    }
    const id = exactId(vehicle.id);
    if (ids.has(id)) throw stockError("IDs duplicados na leitura");
    ids.add(id);
    if (validPrice(vehicle.valor) > 0) activeCount += 1;
  }
  return { totalCount: vehicles.length, activeCount };
}

function previousCounts(rootDir) {
  if (!rootDir) throw stockError("diretório do projeto ausente");
  let previous;
  try {
    previous = JSON.parse(
      readFileSync(
        join(rootDir, "public", "seo", "stock-bootstrap.json"),
        "utf8",
      ),
    );
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw stockError("manifesto anterior ilegível");
  }
  if (!Array.isArray(previous?.vehicles) || !previous.vehicles.length) {
    throw stockError("manifesto anterior inválido");
  }
  const active = validateRows(
    previous.vehicles.map((vehicle) => ({
      id: vehicle?.id,
      valor: vehicle?.price ?? vehicle?.valor,
    })),
  );
  const complete = Array.isArray(previous.showroomVehicles)
    ? validateRows(
        previous.showroomVehicles.map((vehicle) => ({
          id: vehicle?.id,
          valor: vehicle?.price ?? vehicle?.valor,
        })),
      )
    : active;
  return { activeCount: active.activeCount, totalCount: complete.totalCount };
}

/** Validate the accepted API snapshot again before a build reuses it. */
export function validateSeoStockVehicles(vehicles, { rootDir } = {}) {
  const counts = validateRows(vehicles);
  if (!counts.totalCount || !counts.activeCount) {
    throw stockError("estoque vazio ou sem ofertas ativas");
  }
  const previous = previousCounts(rootDir);
  if (
    previous &&
    (counts.totalCount < previous.totalCount * (1 - MAX_REDUCTION) ||
      counts.activeCount < previous.activeCount * (1 - MAX_REDUCTION))
  ) {
    throw stockError("redução superior a 20% frente ao manifesto anterior");
  }
  return counts;
}

function fingerprint(vehicles) {
  // Only public identity/price are needed to prove stable availability. Never
  // retain or print supplier records, administrative fields, or full responses.
  const identityPrices = vehicles
    .map((vehicle) => [exactId(vehicle.id), validPrice(vehicle.valor)])
    .sort(([left], [right]) => left.localeCompare(right));
  return createHash("sha256")
    .update(JSON.stringify(identityPrices))
    .digest("hex");
}

async function fetchPage(url, fetchImpl, retryDelay, page) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: { Accept: "application/json", "Cache-Control": "no-cache" },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      // HTTP errors are not transport failures. Only a successfully parsed
      // endpoint-specific empty 404 may later prove the end of pagination.
      if (!response.ok && response.status !== 404) {
        await response.body?.cancel().catch(() => {});
        throw Object.assign(stockError(`página ${page} inválida ou vazia`), {
          [HTTP_FAILURE]: true,
        });
      }
      const payload = await response.json();
      return { response, payload };
    } catch (error) {
      if (error?.[HTTP_FAILURE]) throw error;
      const diagnostic = readFailure(error);
      if (!diagnostic.retryable || attempt === 3) {
        throw Object.assign(
          stockError(
            `falha de leitura na página ${page} (${diagnostic.code}; tentativas ${attempt})`,
          ),
          { code: `seo_stock_${diagnostic.code}`, page, attempts: attempt },
        );
      }
      await retryDelay(1_000 * 2 ** (attempt - 1));
    }
  }
}

async function readPass(apiUrl, fetchImpl, retryDelay) {
  const vehicles = [];
  const seenIds = new Set();
  let offset = 0;
  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex += 1) {
    const url = new URL(apiUrl);
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("offset", String(offset));
    const { response, payload } = await fetchPage(
      url,
      fetchImpl,
      retryDelay,
      pageIndex + 1,
    );
    if (
      !Array.isArray(payload?.data) ||
      !Number.isSafeInteger(payload.total_results) ||
      payload.total_results !== payload.data.length
    ) {
      throw stockError(`resposta incompleta na página ${pageIndex + 1}`);
    }
    // The existing endpoint returns this exact 404 for an offset after the
    // final record. A generic 404, network failure, or empty first page is NOT
    // proof that a previously advertised unit has disappeared.
    const emptyTerminal =
      payload.data.length === 0 &&
      ((response.ok && payload.success === true) ||
        (response.status === 404 &&
          payload.success === false &&
          payload.message === "Nenhum carro encontrado"));
    if (emptyTerminal && vehicles.length > 0) {
      return { vehicles, pages: pageIndex + 1 };
    }
    if (!response.ok || payload.success !== true || payload.data.length === 0) {
      throw stockError(`página ${pageIndex + 1} inválida ou vazia`);
    }
    if (payload.data.length > PAGE_SIZE) {
      throw stockError(
        `limite de paginação inválido na página ${pageIndex + 1}`,
      );
    }
    validateRows(payload.data);
    for (const vehicle of payload.data) {
      const id = exactId(vehicle.id);
      if (seenIds.has(id)) throw stockError("IDs duplicados entre páginas");
      seenIds.add(id);
      vehicles.push(publicVehicle(vehicle));
    }
    // total_results counts this page, not the full inventory. Even a short
    // page can reflect a server cap: only an explicit empty next page ends it.
    offset += payload.data.length;
  }
  throw stockError("limite de páginas excedido sem término comprovado");
}

/** Read the existing inventory feed completely, fail closed, write nothing. */
export async function fetchCompleteSeoStock({
  rootDir,
  apiUrl = process.env.NETCAR_SEO_STOCK_API_URL || DEFAULT_API_URL,
  fetchImpl = globalThis.fetch,
  retryDelay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  let parsedUrl;
  try {
    parsedUrl = new URL(apiUrl);
  } catch {
    throw stockError("URL do feed inválida");
  }
  // A filtered feed cannot prove that missing IDs are sold. Keep only the
  // existing all-stock endpoint's pagination contract, including test URLs.
  if (
    [...parsedUrl.searchParams.keys()].some(
      (key) => !["limit", "offset"].includes(key),
    )
  ) {
    throw stockError("feed com filtros não comprova estoque completo");
  }
  const first = await readPass(parsedUrl, fetchImpl, retryDelay);
  const counts = validateSeoStockVehicles(first.vehicles, { rootDir });
  const confirmed = await readPass(parsedUrl, fetchImpl, retryDelay);
  if (fingerprint(first.vehicles) !== fingerprint(confirmed.vehicles)) {
    throw stockError("estoque mudou durante a leitura; tente novamente");
  }
  return {
    vehicles: first.vehicles,
    source: "api-complete",
    sourceAgeMs: 0,
    pages: first.pages + confirmed.pages,
    ...counts,
  };
}
