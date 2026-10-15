import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";

const PRICE_FIELDS = ["preco", "price", "valor"];
const URL_FIELDS = ["url", "href", "link"];
const ALLOWED_HOSTS = new Set(["www.netcarmultimarcas.com.br", "netcarmultimarcas.com.br"]);
const currency = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function own(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function exactId(value) {
  const id = String(value ?? "");
  if (!/^[1-9]\d*$/.test(id)) fail("invalid_vehicle_id");
  return id;
}

/** Never match by model, plate, a substring of an ID, or an external URL. */
export function offerVehicleId(value, { required = false } = {}) {
  if (typeof value !== "string") {
    if (required) fail("missing_offer_url");
    return null;
  }
  let url;
  try {
    url = new URL(value, "https://www.netcarmultimarcas.com.br");
  } catch {
    if (required || value.includes("/veiculo")) fail("invalid_offer_url");
    return null;
  }
  if (!/^\/veiculo(?:\/|$)/.test(url.pathname)) {
    if (required) fail("invalid_offer_url");
    return null;
  }
  if (!ALLOWED_HOSTS.has(url.hostname) || !["http:", "https:"].includes(url.protocol)) {
    fail("external_vehicle_offer_url");
  }
  const match = url.pathname.match(/^\/veiculo\/(?:[a-z0-9]+(?:-[a-z0-9]+)*-)?([1-9]\d*)\/?$/i);
  if (!match) fail("invalid_offer_vehicle_id");
  return exactId(match[1]);
}

/** The complete source is mandatory even when only one offer needs changing. */
function stockById(snapshot) {
  if (snapshot?.source !== "api-complete" || !Array.isArray(snapshot?.vehicles) || !snapshot.vehicles.length) {
    fail("complete_stock_required");
  }
  const vehicles = new Map();
  let active = 0;
  for (const vehicle of snapshot.vehicles) {
    const id = exactId(vehicle?.id);
    if (vehicles.has(id)) fail("duplicate_stock_id");
    if (vehicle.valor === null || vehicle.valor === "" || typeof vehicle.valor === "boolean") {
      fail("invalid_stock_price");
    }
    const price = Number(vehicle.valor);
    if (!Number.isFinite(price) || price < 0) fail("invalid_stock_price");
    vehicles.set(id, price);
    if (price > 0) active += 1;
  }
  if (!active) fail("empty_available_stock");
  return vehicles;
}

/** Preserve editorial text, dates, URLs, images and historical offer records. */
export function reconcileOfferDocuments(documents, snapshot) {
  const vehicles = stockById(snapshot);
  const summary = {
    offers: 0,
    uniqueVehicleIds: 0,
    pricesChanged: 0,
    unavailableChanged: 0,
    reactivated: 0,
    soldOffers: 0,
    missingOffers: 0,
  };
  const ids = new Set();
  const output = structuredClone(documents);

  function visit(value, isCard = false) {
    if (Array.isArray(value)) {
      for (const item of value) visit(item, isCard);
      return;
    }
    if (!value || typeof value !== "object") {
      if (isCard) fail("invalid_offer_card");
      return;
    }

    const hasPrice = PRICE_FIELDS.some((field) => own(value, field));
    let id = null;
    for (const field of URL_FIELDS) {
      if (!own(value, field)) continue;
      const found = offerVehicleId(value[field]);
      if (found && id && found !== id) fail("conflicting_offer_vehicle_ids");
      if (found) id = found;
    }
    if (isCard && (!id || !hasPrice)) fail("invalid_offer_card");

    if (id && (hasPrice || isCard)) {
      summary.offers += 1;
      ids.add(id);
      const price = vehicles.get(id);
      if (price === undefined || price === 0) {
        if (price === undefined) summary.missingOffers += 1;
        else summary.soldOffers += 1;
        if (value.available !== false) {
          value.available = false;
          summary.unavailableChanged += 1;
        }
      } else {
        let changedPrice = false;
        for (const field of PRICE_FIELDS) {
          if (!own(value, field)) continue;
          const next = field === "preco" ? `R$ ${currency.format(price)}` : price;
          if (value[field] !== next) {
            value[field] = next;
            changedPrice = true;
          }
        }
        if (changedPrice) summary.pricesChanged += 1;
        if (value.available === false) {
          delete value.available;
          summary.reactivated += 1;
        }
      }
    }
    for (const [key, item] of Object.entries(value)) {
      visit(item, value.type === "cars" && key === "cars");
    }
  }

  for (const document of Object.values(output)) visit(document);
  summary.uniqueVehicleIds = ids.size;
  return { documents: output, summary };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stateDirectory(rootDir) {
  return join(rootDir, ".devops", "offer-reconciliation");
}

function atomicWrite(path, contents, mode = 0o644) {
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temp, contents, { mode, flag: "wx" });
    renameSync(temp, path);
  } finally {
    rmSync(temp, { force: true });
  }
}

/** A failed or interrupted process never steals another process's lock. */
export function withOfferReconciliationLock(rootDir, action) {
  const state = stateDirectory(rootDir);
  mkdirSync(state, { recursive: true, mode: 0o700 });
  const lock = join(state, "lock");
  try {
    mkdirSync(lock, { mode: 0o700 });
  } catch (error) {
    if (error.code === "EEXIST") fail("offer_reconciliation_locked");
    throw error;
  }
  return Promise.resolve()
    .then(action)
    .finally(() => rmSync(lock, { recursive: true, force: true }));
}

function seoJsonFiles(rootDir) {
  const files = [];
  function scan(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) scan(path);
      else if (entry.isFile() && entry.name.endsWith(".json")) files.push(path);
      else if (entry.isSymbolicLink()) fail("seo_source_symlink_not_allowed");
    }
  }
  scan(join(rootDir, "src", "data", "seo"));
  return files;
}

export function planOfferReconciliation(rootDir, snapshot) {
  const originals = new Map();
  const documents = {};
  for (const path of seoJsonFiles(rootDir)) {
    const name = relative(rootDir, path).split("\\").join("/");
    const content = readFileSync(path, "utf8");
    originals.set(name, content);
    try {
      documents[name] = JSON.parse(content);
    } catch {
      fail("invalid_seo_source_json");
    }
  }
  const result = reconcileOfferDocuments(documents, snapshot);
  const changes = [];
  for (const [path, document] of Object.entries(result.documents)) {
    if (JSON.stringify(document) === JSON.stringify(documents[path])) continue;
    const before = originals.get(path);
    const after = `${JSON.stringify(document, null, 2)}\n`;
    changes.push({ path, before, after, beforeSha256: sha256(before), afterSha256: sha256(after) });
  }
  return { changes, summary: result.summary };
}

function safeSourcePath(rootDir, path) {
  if (typeof path !== "string" || !/^src\/data\/seo\/.+\.json$/.test(path)) fail("invalid_backup_source_path");
  const base = resolve(rootDir, "src/data/seo");
  const resolved = resolve(rootDir, path);
  if (!resolved.startsWith(`${base}/`) || path.split("/").includes("..")) fail("invalid_backup_source_path");
  return resolved;
}

/** Writes only changed sources; all originals are backed up before the first write. */
export function applyOfferReconciliation(rootDir, plan) {
  if (!plan.changes.length) return { changed: false, changedFiles: [] };
  for (const change of plan.changes) {
    const path = safeSourcePath(rootDir, change.path);
    if (sha256(readFileSync(path)) !== change.beforeSha256) fail("offer_source_changed_since_plan");
  }
  const backupId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}`;
  const backup = join(stateDirectory(rootDir), "backups", backupId);
  mkdirSync(backup, { recursive: true, mode: 0o700 });
  const manifest = {
    version: 1,
    status: "prepared",
    files: plan.changes.map((change, index) => ({
      path: change.path,
      beforeSha256: change.beforeSha256,
      afterSha256: change.afterSha256,
      originalFile: `${index}.json`,
    })),
  };
  for (const [index, change] of plan.changes.entries()) {
    writeFileSync(join(backup, `${index}.json`), change.before, { mode: 0o600, flag: "wx" });
  }
  const manifestPath = join(backup, "manifest.json");
  atomicWrite(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 0o600);
  const applied = [];
  try {
    for (const change of plan.changes) {
      const path = safeSourcePath(rootDir, change.path);
      if (sha256(readFileSync(path)) !== change.beforeSha256) fail("offer_source_changed_since_plan");
      atomicWrite(path, change.after, statSync(path).mode & 0o777);
      applied.push(change);
    }
    manifest.status = "applied";
    atomicWrite(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 0o600);
  } catch (error) {
    for (const change of applied.reverse()) {
      const path = safeSourcePath(rootDir, change.path);
      if (sha256(readFileSync(path)) === change.afterSha256) atomicWrite(path, change.before, statSync(path).mode & 0o777);
    }
    throw error;
  }
  return { changed: true, changedFiles: plan.changes.map((change) => change.path), backupId };
}

/** Refuse rollback after later edits, including edits from another task. */
export function rollbackOfferReconciliation(rootDir, backupId) {
  if (typeof backupId !== "string" || !/^[a-zA-Z0-9-]+$/.test(backupId)) fail("invalid_backup_id");
  const backup = join(stateDirectory(rootDir), "backups", backupId);
  const manifestPath = join(backup, "manifest.json");
  if (!existsSync(manifestPath)) fail("offer_backup_not_found");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.version !== 1 || !["prepared", "applied", "rolled-back"].includes(manifest.status) || !Array.isArray(manifest.files)) fail("invalid_offer_backup");
  if (manifest.status === "rolled-back") return { changed: false, changedFiles: [], backupId };
  const changes = manifest.files.map((entry) => {
    if (!/^\d+\.json$/.test(entry.originalFile)) fail("invalid_offer_backup");
    const path = safeSourcePath(rootDir, entry.path);
    const before = readFileSync(join(backup, entry.originalFile), "utf8");
    const current = readFileSync(path, "utf8");
    if (sha256(before) !== entry.beforeSha256) fail("offer_backup_checksum_mismatch");
    const currentHash = sha256(current);
    if (currentHash !== entry.afterSha256 && !(manifest.status === "prepared" && currentHash === entry.beforeSha256)) fail("offer_rollback_conflict");
    return { path, relativePath: entry.path, before, current, changed: before !== current };
  });
  const restored = [];
  try {
    for (const change of changes.filter((entry) => entry.changed)) {
      if (readFileSync(change.path, "utf8") !== change.current) fail("offer_rollback_conflict");
      atomicWrite(change.path, change.before, statSync(change.path).mode & 0o777);
      restored.push(change);
    }
    manifest.status = "rolled-back";
    atomicWrite(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 0o600);
  } catch (error) {
    for (const change of restored.reverse()) {
      if (readFileSync(change.path, "utf8") === change.before) atomicWrite(change.path, change.current, statSync(change.path).mode & 0o777);
    }
    throw error;
  }
  return { changed: restored.length > 0, changedFiles: restored.map((change) => change.relativePath), backupId };
}
