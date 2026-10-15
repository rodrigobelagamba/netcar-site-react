#!/usr/bin/env node
// Read-only inventory/HTML audit. Reports contain public IDs/prices, never the feed.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SITE = "https://www.netcarmultimarcas.com.br";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CRAWLER = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

function decoded(value) {
  return String(value).replace(/&(?:amp|quot|apos|nbsp|lt|gt|#\d+|#x[\da-f]+);/gi, (entity) => {
    const named = { "&amp;": "&", "&quot;": '"', "&apos;": "'", "&nbsp;": " ", "&lt;": "<", "&gt;": ">" };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
    const number = entity[2].toLowerCase() === "x" ? parseInt(entity.slice(3), 16) : parseInt(entity.slice(2), 10);
    return number <= 0x10ffff ? String.fromCodePoint(number) : entity;
  });
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? decoded(match[1] ?? match[2] ?? match[3]) : "";
}

function textOnly(html) {
  return decoded(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

export function parseBrl(value) {
  const match = textOnly(value).match(/^R\$\s*((?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{2})?)$/);
  return match ? Number(match[1].replace(/\./g, "").replace(",", ".")) : null;
}

export function vehicleIdFromHref(href) {
  try {
    const url = new URL(decoded(href), SITE);
    if (url.origin !== SITE || !url.pathname.startsWith("/veiculo/")) return null;
    return url.pathname.match(/^\/veiculo\/[^/]+-([1-9]\d*)\/?$/)?.[1] ?? "invalid";
  } catch { return null; }
}

function priceOf(vehicle) {
  const raw = vehicle.valor ?? vehicle.price;
  if ((typeof raw !== "number" && typeof raw !== "string") || (typeof raw === "string" && !/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(raw))) return NaN;
  return Number(raw);
}

export function inventoryMap(vehicles, { activeOnly = false } = {}) {
  if (!Array.isArray(vehicles) || vehicles.length === 0) throw new Error("inventory_empty");
  const seen = new Set();
  const active = new Map();
  for (const vehicle of vehicles) {
    const id = String(vehicle?.id ?? "");
    const price = priceOf(vehicle ?? {});
    if (!/^[1-9]\d*$/.test(id)) throw new Error("inventory_invalid_id");
    if (seen.has(id)) throw new Error(`inventory_duplicate_id:${id}`);
    if (!Number.isFinite(price) || price < 0 || price > Number.MAX_SAFE_INTEGER) throw new Error(`inventory_invalid_price:${id}`);
    seen.add(id);
    if (price > 0 && vehicle.available !== false) active.set(id, price);
    else if (activeOnly) throw new Error(`bootstrap_inactive_vehicle:${id}`);
  }
  if (active.size === 0) throw new Error("inventory_no_active_vehicles");
  return active;
}

export function validateSnapshot(snapshot, { publicMode = false, now = Date.now() } = {}) {
  if (snapshot?.source !== "api-complete") throw new Error("snapshot_source_not_api_complete");
  const ageMs = now - Date.parse(snapshot.createdAt || "");
  const sourceAgeMs = Number(snapshot.sourceAgeMs ?? 0);
  const maxAge = (publicMode ? 60 : 15) * 60 * 1000;
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > maxAge || !Number.isFinite(sourceAgeMs) || sourceAgeMs < 0 || sourceAgeMs + ageMs > maxAge) {
    throw new Error("snapshot_stale_or_invalid");
  }
  return { active: inventoryMap(snapshot.vehicles), ageMs, total: snapshot.vehicles.length };
}

export function canonicalFromHtml(html) {
  const tags = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]);
  const canonical = tags.filter((tag) => attribute(tag, "rel").toLowerCase().split(/\s+/).includes("canonical"));
  if (canonical.length !== 1) throw new Error("canonical_missing_or_duplicate");
  const url = new URL(attribute(canonical[0], "href"), SITE);
  if (url.origin !== SITE || url.search || url.hash) throw new Error("canonical_invalid");
  return url.href;
}

export function inspectOffers(html, active, { expectedCanonical } = {}) {
  const errors = [];
  let canonical;
  try { canonical = canonicalFromHtml(html); } catch (error) { errors.push({ code: error.message }); }
  if (expectedCanonical && canonical && canonical !== expectedCanonical) errors.push({ code: "canonical_mismatch" });
  // These are historical/detail pages, not lists of available offers.
  if (canonical && new URL(canonical).pathname.startsWith("/veiculo/")) return { canonical, skippedDetail: true, links: [], cards: [], schemaLinks: 0, errors };
  const visible = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  const links = [];
  const cards = [];
  function checkId(id, context) {
    if (id === "invalid") errors.push({ code: "vehicle_url_missing_exact_id", context });
    else if (!active.has(id)) errors.push({ code: "vehicle_not_active", id, context });
  }
  function checkPrice(id, price, context) {
    if (price === null) errors.push({ code: "offer_price_missing_or_invalid", id, context });
    else if (active.has(id) && Math.round(price * 100) !== Math.round(active.get(id) * 100)) errors.push({ code: "offer_price_mismatch", id, expected: active.get(id), actual: price, context });
  }
  for (const match of visible.matchAll(/(<a\b[^>]*>)([\s\S]*?)<\/a>/gi)) {
    const id = vehicleIdFromHref(attribute(match[1], "href"));
    if (!id) continue;
    links.push(id);
    checkId(id, "anchor");
    if (attribute(match[1], "class").split(/\s+/).includes("blog-car")) {
      const prices = [...match[2].matchAll(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi)].map((item) => parseBrl(item[1])).filter((price) => price !== null);
      const price = prices.length === 1 ? prices[0] : null;
      cards.push({ id, price });
      checkPrice(id, price, "card");
    }
  }
  for (const block of visible.matchAll(/<div\b[^>]*class=["'][^"']*\bblog-cars\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)) {
    const ids = [...block[1].matchAll(/<a\b[^>]*>/gi)].map((match) => vehicleIdFromHref(attribute(match[0], "href"))).filter(Boolean);
    for (const id of new Set(ids)) if (ids.filter((value) => value === id).length > 1) errors.push({ code: "duplicate_offer_in_group", id });
  }
  // Comparisons display their prices in a table, outside the linked cards.
  for (const section of visible.matchAll(/<section\b[^>]*data-comparison-stock=["']([^"']+)["'][^>]*>([\s\S]*?)<\/section>/gi)) {
    const ids = [...section[2].matchAll(/<article\b[^>]*data-comparison-vehicle=["'](\d+)["'][^>]*>/gi)].map((match) => match[1]);
    if (new Set(ids).size !== ids.length) errors.push({ code: "duplicate_comparison_vehicle" });
    ids.forEach((id) => checkId(id, "comparison"));
    const row = [...section[2].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].find((match) => /Pre[çc]o anunciado/i.test(textOnly(match[1])));
    if (section[1] === "complete" && (!row || ids.length !== 2)) errors.push({ code: "comparison_price_row_missing" });
    if (row) {
      const prices = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => parseBrl(match[1]));
      if (prices.length !== ids.length) errors.push({ code: "comparison_price_count_mismatch" });
      ids.forEach((id, index) => { checkPrice(id, prices[index] ?? null, "comparison"); cards.push({ id, price: prices[index] ?? null }); });
    }
  }
  let schemaLinks = 0;
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (!Array.isArray(node)) {
      const id = typeof node.url === "string" ? vehicleIdFromHref(node.url) : null;
      if (id) {
        schemaLinks += 1;
        checkId(id, "schema");
        const price = node.price ?? node.offers?.price;
        if (price != null) checkPrice(id, Number.isFinite(Number(price)) ? Number(price) : null, "schema");
      }
    }
    Object.values(node).forEach(visit);
  }
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(match[1])); } catch { errors.push({ code: "schema_invalid_json" }); }
  }
  return { canonical, links, cards, schemaLinks, errors };
}

export function compareInventory(actual, expected) {
  const errors = [];
  for (const [id, price] of expected) {
    if (!actual.has(id)) errors.push({ code: "bootstrap_missing_active_id", id });
    else if (Math.round(actual.get(id) * 100) !== Math.round(price * 100)) errors.push({ code: "bootstrap_price_mismatch", id, expected: price, actual: actual.get(id) });
  }
  for (const id of actual.keys()) if (!expected.has(id)) errors.push({ code: "bootstrap_unexpected_active_id", id });
  return errors;
}

function htmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? htmlFiles(join(directory, entry.name)) : entry.name.endsWith(".html") ? [join(directory, entry.name)] : []).sort();
}

export async function fetchPublic(url, fetcher = fetch) {
  if (new URL(url).origin !== SITE) throw new Error("fetch_origin_not_allowed");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetcher(url, { headers: { "user-agent": CRAWLER, "cache-control": "no-cache" }, redirect: "error", signal: AbortSignal.timeout(30000) });
      if (response.status !== 200) {
        if (![408, 429, 500, 502, 503, 504].includes(response.status)) throw Object.assign(new Error(`http_${response.status}`), { noRetry: true });
        throw new Error(`http_${response.status}`);
      }
      const body = await response.text();
      if (body.length > 5 * 1024 * 1024) throw Object.assign(new Error("response_too_large"), { noRetry: true });
      return body;
    } catch (error) {
      if (attempt === 2 || error.noRetry) throw error;
      await new Promise((done) => setTimeout(done, 500 * (attempt + 1)));
    }
  }
}

const offerSignature = (page) => JSON.stringify({ links: [...page.links].sort(), cards: [...page.cards].sort((a, b) => a.id.localeCompare(b.id) || a.price - b.price) });

export async function runAudit({ root = ROOT, publicMode = false, snapshotFile = join(root, ".devops/seo-build-stock.json") } = {}) {
  const snapshot = JSON.parse(readFileSync(snapshotFile, "utf8"));
  const { active, ageMs, total } = validateSnapshot(snapshot, { publicMode });
  const files = htmlFiles(join(root, "public/seo-static"));
  if (!files.length) throw new Error("generated_html_missing");
  const startedAt = new Date().toISOString();
  const errors = [];
  const bootstrap = JSON.parse(readFileSync(join(root, "public/seo/stock-bootstrap.json"), "utf8"));
  errors.push(...compareInventory(inventoryMap(bootstrap.vehicles, { activeOnly: true }), active).map((error) => ({ ...error, context: "local-bootstrap" })));
  const sourcePages = files.map((file) => ({ file: relative(root, file), html: readFileSync(file, "utf8") }));
  const canonicalSet = new Set();
  const pages = sourcePages.map(({ file, html }) => {
    const local = inspectOffers(html, active);
    if (local.canonical && canonicalSet.has(local.canonical)) local.errors.push({ code: "duplicate_canonical" });
    canonicalSet.add(local.canonical);
    return { file, local };
  });
  let publicInventory;
  let liveInventory;
  if (publicMode) {
    publicInventory = inventoryMap(JSON.parse(await fetchPublic(`${SITE}/seo/stock-bootstrap.json`)).vehicles, { activeOnly: true });
    errors.push(...compareInventory(publicInventory, active).map((error) => ({ ...error, context: "public-bootstrap-inventory-drift" })));
    let cursor = 0;
    async function worker() {
      while (cursor < pages.length) {
        const page = pages[cursor++];
        if (!page.local.canonical || page.local.skippedDetail) continue;
        try {
          page.remote = inspectOffers(await fetchPublic(page.local.canonical), active, { expectedCanonical: page.local.canonical });
          if (offerSignature(page.remote) !== offerSignature(page.local)) page.remote.errors.push({ code: "public_offers_differ_from_build" });
        } catch (error) { page.remote = { links: [], cards: [], schemaLinks: 0, errors: [{ code: /^http_\d+$/.test(error.message) ? error.message : "public_read_failed", type: error.name }] }; }
      }
    }
    await Promise.all([worker(), worker(), worker()]);
    const finalInventory = inventoryMap(JSON.parse(await fetchPublic(`${SITE}/seo/stock-bootstrap.json`)).vehicles, { activeOnly: true });
    errors.push(...compareInventory(finalInventory, publicInventory).map((error) => ({ ...error, context: "public-inventory-changed-during-audit" })));
    // Reuse the same complete feed reader after HTTP workers have finished.
    // A stock change during deployment/audit cannot become a false success.
    try {
      const { fetchCompleteSeoStock } = await import("./lib/seo-stock-source.js");
      const live = await fetchCompleteSeoStock({ rootDir: root });
      const liveActive = inventoryMap(live.vehicles);
      const drift = compareInventory(liveActive, active);
      errors.push(...drift.map((error) => ({ ...error, code: error.code.replace(/^bootstrap_/, "live_stock_"), context: "live-stock-drift" })));
      liveInventory = { checkedAt: new Date().toISOString(), total: live.vehicles.length, active: liveActive.size, matchesSnapshot: drift.length === 0 };
    } catch {
      errors.push({ code: "live_stock_complete_read_failed" });
      liveInventory = { checkedAt: new Date().toISOString(), complete: false };
    }
  }
  const reports = pages.map(({ file, local, remote }) => {
    const result = publicMode && !local.skippedDetail ? remote ?? local : local;
    const pageErrors = [...local.errors.map((error) => ({ ...error, source: "local" })), ...(remote?.errors ?? []).map((error) => ({ ...error, source: "public" }))];
    return { path: local.canonical ? new URL(local.canonical).pathname : file, skippedDetail: Boolean(local.skippedDetail), links: result.links.length, pricedOffers: result.cards.length, schemaLinks: result.schemaLinks, ids: [...new Set(result.links)].sort(), errors: pageErrors };
  });
  const counts = { pages: reports.length, detailPagesSkipped: reports.filter((page) => page.skippedDetail).length, linkedOffers: reports.reduce((sum, page) => sum + page.links, 0), pricedOffers: reports.reduce((sum, page) => sum + page.pricedOffers, 0), schemaLinks: reports.reduce((sum, page) => sum + (page.schemaLinks ?? 0), 0), uniqueOfferedIds: new Set(reports.flatMap((page) => page.ids)).size, inventoryTotal: total, inventoryActive: active.size, errors: errors.length + reports.reduce((sum, page) => sum + page.errors.length, 0) };
  return { startedAt, finishedAt: new Date().toISOString(), mode: publicMode ? "public" : "local", snapshotCreatedAt: snapshot.createdAt, snapshotAgeMs: ageMs, liveInventory, ok: counts.errors === 0, counts, errors, pages: reports };
}

async function main() {
  const args = process.argv.slice(2);
  const valueFlags = new Set(["--root", "--snapshot", "--output"]);
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--public") continue;
    if (!valueFlags.has(args[index]) || !args[index + 1] || args[index + 1].startsWith("--")) {
      console.error(JSON.stringify({ ok: false, error: "invalid_audit_argument" }));
      process.exitCode = 1;
      return;
    }
    index += 1;
  }
  const value = (flag) => { const index = args.indexOf(flag); return index < 0 ? undefined : args[index + 1]; };
  const root = resolve(value("--root") ?? ROOT);
  const publicMode = args.includes("--public");
  const output = resolve(value("--output") ?? join(root, `.devops/offer-validation-${publicMode ? "public" : "local"}.json`));
  let report;
  try { report = await runAudit({ root, publicMode, snapshotFile: value("--snapshot") }); }
  catch (error) { report = { finishedAt: new Date().toISOString(), ok: false, mode: publicMode ? "public" : "local", blocked: true, error: /^(inventory_|snapshot_|bootstrap_|generated_html_|canonical_|http_)/.test(error.message) ? error.message : error.code ?? error.name }; }
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ok: report.ok, mode: report.mode, counts: report.counts, blocked: report.blocked, error: report.error, report: relative(root, output) }));
  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
