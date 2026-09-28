import { createHash, randomUUID } from "node:crypto";
import { hostname } from "node:os";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  equipmentCatalog,
  equipmentByTag,
  equipmentEvidenceRegistry,
  unitEquipmentConfirmations,
  isApprovedUnitEquipmentConfirmation,
  normalizeEquipmentTag,
  resolveVehicleEquipment,
  type EquipmentVehicle,
  type UnitEquipmentConfirmation,
} from "../src/lib/vehicleEquipment";
import { mapVehicleOptional } from "../src/catalog/lib/mapVehicleOptional";

// This is an auditor, not an importer or publisher. Never store the API response:
// it also contains administrative identifiers unrelated to equipment review.
export const EQUIPMENT_STOCK_URL =
  "https://www.netcarmultimarcas.com.br/api/v1/veiculos.php?limit=500";
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_VEHICLES = 500;
const RULESET_VERSION = 1;
class StockInputError extends Error {}

export interface EquipmentAuditFinding {
  code: string;
  severity: "high" | "medium" | "info";
  message: string;
}

export interface EquipmentAuditVehicle {
  id: string;
  brand: string;
  model: string;
  modelYear: number | null;
  engine: string;
  transmission: string;
  reviewKey: string;
  change: "new" | "changed" | "unchanged";
  findings: EquipmentAuditFinding[];
  inventoryDescriptions: string[];
  displayedDescriptions: string[];
  confirmationIds: string[];
  researchQuery: string;
}

export interface EquipmentAuditReport {
  schemaVersion: 1;
  generatedAt: string;
  inputSource: string;
  catalogFingerprint: string;
  counts: {
    vehicles: number;
    new: number;
    changed: number;
    unchanged: number;
    withAlerts: number;
  };
  vehicles: EquipmentAuditVehicle[];
}

const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const text = (value: unknown) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
function shortText(value: unknown): string {
  if (value == null) return "";
  if (typeof value !== "string" || value.length > 400)
    throw new StockInputError("Campo de equipamento inválido na fonte.");
  return text(value);
}

/** Reject partial/error data instead of making a failed feed look like an empty
 * stock. All rows, including sold units, are validated before filtering. */
export function parseStockResponse(payload: unknown): EquipmentVehicle[] {
  const source = payload as Record<string, unknown> | null;
  if (!source || source.success !== true || !Array.isArray(source.data))
    throw new StockInputError(
      "API de estoque não retornou uma coleção válida.",
    );
  const total = Number(source.total_results);
  if (
    !Number.isInteger(total) ||
    total < 1 ||
    total > MAX_VEHICLES ||
    total !== source.data.length ||
    Number(source.offset || 0) !== 0
  )
    throw new StockInputError(
      "Estoque incompleto ou fora do limite da auditoria; relatório anterior preservado.",
    );
  const ids = new Set<string>();
  const vehicles: EquipmentVehicle[] = [];
  for (const raw of source.data) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new StockInputError("Veículo inválido na fonte.");
    const vehicle = raw as Record<string, unknown>;
    const id = String(vehicle.id ?? "");
    if (!/^\d+$/.test(id) || ids.has(id))
      throw new StockInputError("Estoque com código ausente ou duplicado.");
    ids.add(id);
    if (!Array.isArray(vehicle.opcionais) || vehicle.opcionais.length > 300)
      throw new StockInputError(
        "Lista de equipamentos ausente ou inválida na fonte.",
      );
    const opcionais = vehicle.opcionais.map((optional: unknown) => {
      if (typeof optional === "string") {
        const tag = shortText(optional);
        if (!tag) throw new StockInputError("Equipamento vazio na fonte.");
        return mapVehicleOptional(tag);
      }
      if (!optional || typeof optional !== "object" || Array.isArray(optional))
        throw new StockInputError("Equipamento inválido na fonte.");
      const item = optional as Record<string, unknown>;
      const mapped = mapVehicleOptional({
        tag: shortText(item.tag),
        descricao: shortText(item.descricao),
        nome: shortText(item.nome),
      });
      if (!mapped.tag && !mapped.descricao)
        throw new StockInputError("Equipamento vazio na fonte.");
      return mapped;
    });
    const price = Number(vehicle.valor);
    if (vehicle.valor == null || !Number.isFinite(price) || price < 0)
      throw new StockInputError("Situação comercial inválida na fonte.");
    const candidate: EquipmentVehicle = {
      id,
      marca: shortText(vehicle.marca),
      modelo: shortText(vehicle.modelo),
      motor: shortText(vehicle.motor),
      cambio: shortText(vehicle.cambio),
      year:
        typeof vehicle.ano === "number" || typeof vehicle.ano === "string"
          ? vehicle.ano
          : "",
      lugares:
        typeof vehicle.lugares === "number" ||
        typeof vehicle.lugares === "string"
          ? vehicle.lugares
          : "",
      opcionais,
    };
    if (price > 0) vehicles.push(candidate);
  }
  if (!vehicles.length)
    throw new StockInputError(
      "Nenhum veículo ativo na consulta; relatório anterior preservado.",
    );
  return vehicles;
}

function confirmationMatches(
  record: UnitEquipmentConfirmation,
  vehicle: EquipmentVehicle,
) {
  const match = record.match;
  return (
    String(vehicle.id) === match.vehicleId &&
    Number(vehicle.year) === match.modelYear &&
    [
      [vehicle.marca, match.brand],
      [vehicle.modelo, match.model],
      [vehicle.motor, match.engine],
      [vehicle.cambio, match.transmission],
    ].every(
      ([actual, expected]) =>
        normalizeEquipmentTag(actual || "") ===
        normalizeEquipmentTag(expected || ""),
    )
  );
}

/** Pure report builder. Review keys intentionally ignore stock order, optional
 * order, price, photos and timestamps; changed equipment/rules require review. */
export function buildEquipmentAudit(
  vehicles: EquipmentVehicle[],
  previous: EquipmentAuditReport | null = null,
  now = new Date().toISOString(),
): EquipmentAuditReport {
  if (!vehicles.length || vehicles.length > MAX_VEHICLES)
    throw new Error("Quantidade de veículos inválida.");
  const catalogFingerprint = hash({
    version: RULESET_VERSION,
    catalog: equipmentCatalog,
    evidence: equipmentEvidenceRegistry,
    confirmations: unitEquipmentConfirmations,
    resolver: readFileSync(
      join(rootDir, "src/lib/vehicleEquipment.ts"),
      "utf8",
    ),
  });
  const former = new Map(
    (previous?.vehicles || []).map((vehicle) => [vehicle.id, vehicle]),
  );
  const reviewed = unitEquipmentConfirmations.filter(
    isApprovedUnitEquipmentConfirmation,
  );
  const ids = new Set<string>();
  const rows = vehicles.map((vehicle): EquipmentAuditVehicle => {
    const id = String(vehicle.id ?? "");
    if (!/^\d+$/.test(id) || ids.has(id))
      throw new Error("Código ausente ou duplicado na auditoria.");
    ids.add(id);
    const year = Number(vehicle.year);
    const identity = {
      id,
      brand: text(vehicle.marca),
      model: text(vehicle.modelo),
      modelYear:
        Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : null,
      engine: text(vehicle.motor),
      transmission: text(vehicle.cambio),
    };
    const mapped = (vehicle.opcionais || []).map(mapVehicleOptional);
    const options = mapped
      .map((item) => [text(item.tag), text(item.descricao)])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const reviewKey = hash({
      catalogFingerprint,
      identity,
      seats: vehicle.lugares ?? "",
      options,
    });
    const old = former.get(id);
    const change = !old
      ? "new"
      : old.reviewKey === reviewKey
        ? "unchanged"
        : "changed";
    const result = resolveVehicleEquipment({ ...vehicle, opcionais: mapped });
    const findings: EquipmentAuditFinding[] = [];
    const add = (
      code: string,
      severity: EquipmentAuditFinding["severity"],
      message: string,
    ) => findings.push({ code, severity, message });

    if (
      !identity.brand ||
      !identity.model ||
      !identity.modelYear ||
      !identity.engine ||
      !identity.transmission
    )
      add(
        "incomplete-identity",
        "high",
        "Identidade incompleta. Não aplicar complementos por modelo/ano sem confirmar versão, motor e câmbio.",
      );
    const confirmations = reviewed.filter((record) =>
      confirmationMatches(record, vehicle),
    );
    if (
      reviewed.some((record) => record.match.vehicleId === id) &&
      !confirmations.length
    )
      add(
        "confirmation-identity-mismatch",
        "high",
        "A identidade deste código mudou: a confirmação anterior não foi aplicada. Conferir se é a mesma unidade.",
      );

    const unknown = [
      ...new Set(
        result.items
          .filter((item) => item.id.startsWith("other-"))
          .map((item) => item.description),
      ),
    ];
    if (unknown.length)
      add(
        "unknown-equipment",
        "medium",
        `Equipamentos sem classificação revisada: ${unknown.join("; ")}.`,
      );
    const newTags = [
      ...new Set(
        mapped
          .filter(
            (item) =>
              item.tag && !equipmentByTag.has(normalizeEquipmentTag(item.tag)),
          )
          .map((item) => item.tag),
      ),
    ];
    if (newTags.length)
      add(
        "unknown-source-tag",
        "medium",
        `Tags novas ou aliases fora da taxonomia auditada: ${newTags.join("; ")}. Conferir o significado, sem deduzir pelo nome.`,
      );
    const conflicts = result.suppressed.filter(
      (item) => item.reason === "unit-confirmed-absence",
    );
    const missingConfirmed = result.items.filter(
      (item) =>
        item.source === "unit-confirmation" && item.sourceTags.length === 0,
    );
    if (conflicts.length || missingConfirmed.length) {
      const notes = [
        conflicts.length
          ? `Retirar do cadastro: ${conflicts.map((item) => item.description).join("; ")}.`
          : "",
        missingConfirmed.length
          ? `Confirmado na unidade, mas ausente do cadastro: ${missingConfirmed.map((item) => item.description).join("; ")}.`
          : "",
      ]
        .filter(Boolean)
        .join(" ");
      add(
        "unit-source-conflict",
        "high",
        `${notes} A lista calculada aplica a confirmação específica; o XML/API de origem ainda precisa de correção.`,
      );
    }
    const negative = result.suppressed.filter((item) =>
      [
        "conflicting-presence",
        "conflicting-airbag-count",
        "manufacturer-blocked-by-absence",
      ].includes(item.reason),
    );
    if (negative.length)
      add(
        "conflicting-equipment",
        "high",
        "O cadastro contém presenças/ausências ou quantidades incompatíveis. Conferir a unidade e corrigir a origem.",
      );
    if (
      result.suppressed.some(
        (item) => item.reason === "manufacturer-correction",
      )
    )
      add(
        "manufacturer-source-correction",
        "medium",
        "Há correção apoiada em documentação oficial que ainda diverge do cadastro. Conferir a evidência e corrigir a origem.",
      );
    add(
      "research-needed",
      "info",
      "Conferir o cadastro desta unidade e pesquisar fontes oficiais da versão brasileira e ano-modelo antes de complementar. Esta rotina não certifica equipamentos nem pesquisa a internet automaticamente.",
    );
    return {
      ...identity,
      reviewKey,
      change,
      findings,
      inventoryDescriptions: [
        ...new Set(
          mapped.map((item) => item.descricao || item.tag).filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, "pt-BR")),
      displayedDescriptions: result.items.map((item) => item.description),
      confirmationIds: confirmations.map((record) => record.id),
      researchQuery: [
        identity.brand,
        identity.model,
        identity.modelYear,
        identity.engine,
        identity.transmission,
        "Brasil catálogo oficial equipamentos de série",
      ]
        .filter(Boolean)
        .join(" "),
    };
  });
  rows.sort((a, b) => {
    const severity = (row: EquipmentAuditVehicle) =>
      row.findings.some((f) => f.severity === "high")
        ? 2
        : row.findings.some((f) => f.severity === "medium")
          ? 1
          : 0;
    return (
      severity(b) - severity(a) ||
      `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, "pt-BR") ||
      a.id.localeCompare(b.id)
    );
  });
  return {
    schemaVersion: 1,
    generatedAt: now,
    inputSource: EQUIPMENT_STOCK_URL,
    catalogFingerprint,
    counts: {
      vehicles: rows.length,
      new: rows.filter((row) => row.change === "new").length,
      changed: rows.filter((row) => row.change === "changed").length,
      unchanged: rows.filter((row) => row.change === "unchanged").length,
      withAlerts: rows.filter((row) =>
        row.findings.some((finding) => finding.severity !== "info"),
      ).length,
    },
    vehicles: rows,
  };
}

export async function fetchEquipmentStock(
  fetcher: typeof fetch = fetch,
): Promise<EquipmentVehicle[]> {
  // The fixed public endpoint cannot be changed to an internal URL by a web form.
  // No credentials or arbitrary URL from the inventory are followed.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetcher(EQUIPMENT_STOCK_URL, {
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      });
      if (!response.ok) throw new StockInputError(`HTTP ${response.status}.`);
      if (!response.body) throw new StockInputError("Resposta sem corpo.");
      if (Number(response.headers.get("content-length")) > MAX_BYTES)
        throw new StockInputError("Resposta excedeu limite.");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_BYTES)
            throw new StockInputError("Resposta excedeu limite.");
          chunks.push(value);
        }
      } finally {
        await reader.cancel();
      }
      let payload: unknown;
      try {
        payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        throw new StockInputError("Resposta não é JSON válido.");
      }
      return parseStockResponse(payload);
    } catch (error) {
      // Do not print response bodies, administrative data or arbitrary remote
      // error strings. Failure never replaces the most recent valid report.
      if (attempt === 2)
        throw new Error(
          `Não foi possível obter estoque completo e válido após 3 tentativas. Motivo: ${safeStockFailure(error)} Relatório anterior preservado.`,
        );
      await new Promise((done) => setTimeout(done, 500 * (attempt + 1)));
    }
  }
  throw new Error("Falha ao consultar estoque.");
}

function safeStockFailure(error: unknown): string {
  if (error instanceof StockInputError) return error.message;
  if (
    error instanceof Error &&
    ["TimeoutError", "AbortError"].includes(error.name)
  )
    return "Tempo limite da consulta excedido.";
  const safeCodes = new Set([
    "ENOTFOUND",
    "EAI_AGAIN",
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "ENETUNREACH",
    "EHOSTUNREACH",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_HEADERS_TIMEOUT",
    "UND_ERR_BODY_TIMEOUT",
    "UND_ERR_SOCKET",
    "CERT_HAS_EXPIRED",
    "CERT_NOT_YET_VALID",
    "DEPTH_ZERO_SELF_SIGNED_CERT",
    "SELF_SIGNED_CERT_IN_CHAIN",
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
    "ERR_TLS_CERT_ALTNAME_INVALID",
  ]);
  const pending: unknown[] = [error];
  for (let index = 0; index < pending.length && index < 10; index++) {
    const current = pending[index];
    if (!current || typeof current !== "object") continue;
    const record = current as {
      code?: unknown;
      cause?: unknown;
      errors?: unknown;
      message?: unknown;
    };
    if (typeof record.code === "string" && safeCodes.has(record.code))
      return `Falha de rede (${record.code}).`;
    if (record.message === "unexpected redirect")
      return "Redirecionamento da API recusado.";
    if (record.cause) pending.push(record.cause);
    if (Array.isArray(record.errors))
      pending.push(...record.errors.slice(0, 5));
  }
  return "Falha de rede ou resposta indisponível.";
}

const LOCK_MAX_AGE_MS = 10 * 60 * 1000;
const OWNER_NAME =
  /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.json$/;
const errorCode = (error: unknown) => (error as NodeJS.ErrnoException).code;

function recoverLock(path: string): boolean {
  try {
    const stat = lstatSync(path);
    if (!stat.isDirectory())
      throw new Error(
        "Trava antiga ou desconhecida em audit.lock; preserve-a e confira antes de executar novamente.",
      );
    const entries = readdirSync(path);
    // A crash between mkdir and metadata creation leaves an empty directory.
    // rmdir is atomic and can never remove another owner's nonempty directory.
    if (!entries.length) {
      if (Date.now() - stat.mtimeMs <= LOCK_MAX_AGE_MS) return false;
      rmdirSync(path);
      return true;
    }
    const ownerName = entries.find((name) => OWNER_NAME.test(name));
    if (!ownerName) return false;
    const token = ownerName.match(OWNER_NAME)![1];
    const temporaryName = `${token}.report.tmp`;
    if (entries.some((name) => name !== ownerName && name !== temporaryName))
      return false;
    const ownerPath = join(path, ownerName);
    if (!lstatSync(ownerPath).isFile()) return false;
    const owner = JSON.parse(readFileSync(ownerPath, "utf8"));
    if (
      owner.token !== token ||
      !Number.isInteger(owner.pid) ||
      owner.pid < 1 ||
      typeof owner.hostname !== "string" ||
      !Number.isFinite(Date.parse(owner.startedAt))
    )
      return false;
    // Fetches take at most 3 x 20 seconds. The age limit also handles a restarted
    // container retaining its hostname and reusing the old producer's PID.
    let stale = Date.now() - Date.parse(owner.startedAt) > LOCK_MAX_AGE_MS;
    if (!stale && owner.hostname === hostname()) {
      try {
        process.kill(owner.pid, 0);
      } catch (error) {
        stale = errorCode(error) === "ESRCH";
      }
    }
    if (!stale) return false;
    // Only the contender that deletes THIS observed owner may remove its guard
    // and the directory. ENOENT must not authorize deleting a new owner's lock.
    try {
      unlinkSync(ownerPath);
    } catch (error) {
      if (errorCode(error) === "ENOENT") return false;
      throw error;
    }
    try {
      unlinkSync(join(path, temporaryName));
    } catch (error) {
      if (errorCode(error) !== "ENOENT") throw error;
    }
    rmdirSync(path);
    return true;
  } catch (error) {
    if (errorCode(error) === "ENOENT") return true;
    if (errorCode(error) === "ENOTEMPTY" || error instanceof SyntaxError)
      return false;
    throw error;
  }
}

function acquireLock(directory: string) {
  const path = join(directory, "audit.lock");
  const token = randomUUID();
  const ownerName = `${token}.json`;
  const ownerPath = join(path, ownerName);
  const temporaryName = `${token}.report.tmp`;
  const temporaryPath = join(path, temporaryName);
  const candidatePath = join(directory, `.audit-lock.${token}`);
  const candidateOwner = join(candidatePath, ownerName);
  const release = () => {
    try {
      // The token filename itself is exclusive. Never unlink an arbitrary lock
      // after a suspended producer has lost ownership to another process.
      unlinkSync(ownerPath);
      rmdirSync(path);
    } catch {
      /* preserve a replacement owner's files or an unknown lock */
    }
  };
  const assertOwnership = () => {
    try {
      const entries = readdirSync(path);
      if (
        entries.includes(ownerName) &&
        entries.every((name) => name === ownerName || name === temporaryName) &&
        JSON.parse(readFileSync(ownerPath, "utf8")).token === token
      )
        return;
    } catch {
      /* report a sanitized ownership failure */
    }
    throw new Error(
      "A auditoria perdeu a trava de execução; relatório anterior preservado.",
    );
  };
  // Publish an already nonempty directory atomically. mkdir(path) followed by
  // writing metadata exposed an empty window to competing orphan recoverers.
  // A rename cannot replace a new owner's nonempty directory.
  mkdirSync(candidatePath, { mode: 0o700 });
  try {
    writeFileSync(
      candidateOwner,
      JSON.stringify({
        pid: process.pid,
        hostname: hostname(),
        token,
        startedAt: new Date().toISOString(),
      }),
      { mode: 0o600, flag: "wx" },
    );
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (existsSync(path) && !recoverLock(path))
          throw new Error(
            "Já existe uma auditoria em execução ou uma trava que precisa de conferência.",
          );
        renameSync(candidatePath, path);
      } catch (error) {
        if (!["EEXIST", "ENOTEMPTY"].includes(errorCode(error) || ""))
          throw error;
        if (attempt === 0 && recoverLock(path)) continue;
        throw new Error(
          "Já existe uma auditoria em execução ou uma trava que precisa de conferência.",
        );
      }
      try {
        assertOwnership();
        return { release, assertOwnership, temporaryPath };
      } catch (error) {
        release();
        throw error;
      }
    }
    throw new Error("Não foi possível obter a trava da auditoria.");
  } finally {
    // These paths contain our random token; never remove another contender.
    try {
      unlinkSync(candidateOwner);
    } catch {
      /* already renamed or absent */
    }
    try {
      rmdirSync(candidatePath);
    } catch {
      /* already renamed or absent */
    }
  }
}

export async function runEquipmentAudit({
  stateDir = join(rootDir, ".devops/equipment"),
  loadStock = fetchEquipmentStock,
}: {
  stateDir?: string;
  loadStock?: () => Promise<EquipmentVehicle[]>;
} = {}): Promise<EquipmentAuditReport> {
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  chmodSync(stateDir, 0o700);
  const lock = acquireLock(stateDir);
  let temporary: string | null = null;
  try {
    const reportPath = join(stateDir, "report.json");
    let previous: EquipmentAuditReport | null = null;
    if (existsSync(reportPath)) {
      previous = JSON.parse(readFileSync(reportPath, "utf8"));
      if (previous?.schemaVersion !== 1 || !Array.isArray(previous.vehicles))
        throw new Error(
          "Relatório anterior inválido; preservado para conferência.",
        );
    }
    const report = buildEquipmentAudit(await loadStock(), previous);
    lock.assertOwnership();
    // Keep the pending report inside the owned directory. A reclaimer either
    // cannot remove the nonempty directory or removes this exact old temporary
    // file, making a suspended producer's later rename fail instead of commit.
    temporary = lock.temporaryPath;
    writeFileSync(temporary, `${JSON.stringify(report, null, 2)}\n`, {
      mode: 0o600,
      flag: "wx",
    });
    lock.assertOwnership();
    renameSync(temporary, reportPath);
    temporary = null;
    return report;
  } finally {
    try {
      if (temporary && existsSync(temporary)) unlinkSync(temporary);
    } finally {
      lock.release();
    }
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const args = process.argv.slice(2);
    if (
      args.length &&
      (args.length !== 2 || args[0] !== "--state-dir" || !args[1])
    )
      throw new Error(
        "Uso: audit-vehicle-equipment.ts [--state-dir diretório]",
      );
    const report = await runEquipmentAudit(
      args.length ? { stateDir: resolve(args[1]) } : {},
    );
    console.log(
      `Equipamentos: ${report.counts.vehicles} veículos; ${report.counts.new} novos, ${report.counts.changed} alterados, ${report.counts.withAlerts} com alertas. Relatório privado atualizado. Nenhum cadastro ou deploy alterado.`,
    );
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Falha na auditoria de equipamentos.",
    );
    process.exitCode = 1;
  }
}
