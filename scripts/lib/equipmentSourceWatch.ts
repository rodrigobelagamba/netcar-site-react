import { createHash } from "node:crypto";
import type { ReviewInput, ReviewMatch } from "./equipmentReview";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_LEDGER_BYTES = 6 * 1024 * 1024;
const MAX_PARAGRAPHS = 1200;
const MAX_SOURCES = 100;
const MAX_HISTORY = 1200;
const HASH = /^[a-f0-9]{64}$/;
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const fail = (code: string): never => { throw new Error(`Equipment source watch: ${code}`); };
export interface WatchedParagraph { sha256: string; text: string }
export interface WatchedSource {
  key: string; url: string; title: string; edition: string; match: ReviewMatch;
  checkedAt: string; status: "ok" | "manual_pdf_review_required" | "failed";
  lastSuccessfulAt?: string; contentSha256?: string; paragraphs: WatchedParagraph[];
  failure?: string;
}
export interface SourceWatchHistory {
  key: string; checkedAt: string; status: WatchedSource["status"];
  contentSha256?: string; failure?: string; paragraphs: WatchedParagraph[];
}
export interface EquipmentSourceWatchLedger { schemaVersion: 1; sources: WatchedSource[]; history: SourceWatchHistory[] }
export interface EquipmentSourceUpdate {
  sourceKey: string; url: string; title: string; edition: string; match: ReviewMatch;
  kind: "baseline-excerpt" | "changed-source-excerpt" | "source-content-changed";
  classification: "information-insufficient";
  status: "source-change-needs-review";
  text: string; paragraphSha256?: string;
}
export function emptyEquipmentSourceWatch(): EquipmentSourceWatchLedger { return { schemaVersion: 1, sources: [], history: [] }; }
function validInstant(value: unknown): value is string { return typeof value === "string" && Number.isFinite(Date.parse(value)) && /^\d{4}-\d{2}-\d{2}T/.test(value); }
function validParagraphs(value: unknown): value is WatchedParagraph[] {
  return Array.isArray(value) && value.length <= MAX_PARAGRAPHS && value.every(p => p && typeof p === "object" && HASH.test(p.sha256) && typeof p.text === "string" && p.text.length <= 10000 && p.sha256 === sha(p.text));
}
function isOfficialUrl(url: URL, brand: string): boolean {
  if (url.protocol !== "https:" || url.port || url.username || url.password || [...url.searchParams.keys()].some(k => /token|secret|password|signature|credential|api.?key/i.test(k))) return false;
  const normalized = brand.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const official: Record<string, string[]> = { nissan: ["nissan.com.br", "www.nissan.com.br"], fiat: ["fiat.com.br", "www.fiat.com.br"], jeep: ["jeep.com.br", "www.jeep.com.br"], volkswagen: ["vw.com.br", "www.vw.com.br"], ford: ["ford.com.br", "www.ford.com.br"], honda: ["honda.com.br", "www.honda.com.br"], chevrolet: ["chevrolet.com.br", "www.chevrolet.com.br"], hyundai: ["hyundai.com.br", "www.hyundai.com.br"], chery: ["caoachery.com.br", "www.caoachery.com.br"], caoa_chery: ["caoachery.com.br", "www.caoachery.com.br"] };
  if (["media.stellantis.com", "www.media.stellantis.com"].includes(url.hostname)) return ["fiat", "jeep", "peugeot", "citroen", "ram"].includes(normalized) && url.pathname.startsWith(`/br-pt/${normalized}/`);
  if (normalized === "byd") return ["byd.com", "www.byd.com"].includes(url.hostname) && /^\/br(?:\/|$)/.test(url.pathname);
  return official[normalized]?.includes(url.hostname) ?? false;
}
export function validateEquipmentSourceWatch(value: unknown): EquipmentSourceWatchLedger {
  const ledger = value as EquipmentSourceWatchLedger;
  if (!ledger || typeof ledger !== "object" || Object.keys(ledger).some(k => !["schemaVersion", "sources", "history"].includes(k)) || ledger.schemaVersion !== 1 || !Array.isArray(ledger.sources) || ledger.sources.length > MAX_SOURCES || !Array.isArray(ledger.history) || ledger.history.length > MAX_HISTORY) fail("invalid_source_history");
  if (new Set(ledger.sources.map(s => s.key)).size !== ledger.sources.length) fail("duplicate_source_history");
  for (const source of ledger.sources) {
    let url: URL; try { url = new URL(source.url); } catch { return fail("invalid_source_history"); }
    if (!HASH.test(source.key) || !source.match || !isOfficialUrl(url, source.match.brand) || !validInstant(source.checkedAt) || (source.lastSuccessfulAt !== undefined && !validInstant(source.lastSuccessfulAt)) || !["ok", "manual_pdf_review_required", "failed"].includes(source.status) || (source.contentSha256 !== undefined && !HASH.test(source.contentSha256)) || !validParagraphs(source.paragraphs)) fail("invalid_source_history");
  }
  for (const event of ledger.history) if (!HASH.test(event.key) || !validInstant(event.checkedAt) || !["ok", "manual_pdf_review_required", "failed"].includes(event.status) || (event.contentSha256 !== undefined && !HASH.test(event.contentSha256)) || !validParagraphs(event.paragraphs)) fail("invalid_source_history");
  if (Buffer.byteLength(JSON.stringify(ledger)) > MAX_LEDGER_BYTES) fail("source_history_limit_preserve_and_review");
  return structuredClone(ledger);
}
function decodeHtml(text: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (original, value: string) => {
    if (named[value.toLowerCase()]) return named[value.toLowerCase()];
    if (value.startsWith("#")) { const n = value[1].toLowerCase() === "x" ? parseInt(value.slice(2), 16) : Number(value.slice(1)); if (n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff)) return String.fromCodePoint(n); }
    return original;
  });
}
/** Extract prose only, without interpreting source content as executable instructions. */
export function extractSourceParagraphs(html: string): WatchedParagraph[] {
  let text = html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<(script|style|noscript|svg|nav|header|footer|aside|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ");
  const article = /<(article|main)\b[^>]*>([\s\S]*?)<\/\1\s*>/i.exec(text);
  if (article) text = article[2];
  else { const body = /<body\b[^>]*>([\s\S]*?)<\/body\s*>/i.exec(text); if (body) text = body[1]; }
  text = text.replace(/<\/?(?:p|li|div|section|h[1-6]|tr|br|ul|ol)\b[^>]*>/gi, "\n").replace(/<[^>]*>/g, " ");
  const paragraphs = [...new Set(text.split("\n").map(p => decodeHtml(p).replace(/\s+/g, " ").trim()).filter(p => p.length >= 35))];
  if (!paragraphs.length || paragraphs.length > MAX_PARAGRAPHS || paragraphs.some(p => p.length > 10000)) fail("document_requires_manual_extraction");
  return paragraphs.map(text => ({ sha256: sha(text), text }));
}
async function fetchSource(source: WatchedSource, fetcher: typeof fetch): Promise<{ checksum: string; paragraphs: WatchedParagraph[]; pdf: boolean }> {
  const url = new URL(source.url);
  if (!isOfficialUrl(url, source.match.brand)) fail("source_not_allowlisted");
  const response = await fetcher(url.href, { redirect: "error", signal: AbortSignal.timeout(12000), headers: { Accept: "text/html,application/pdf", "Cache-Control": "no-cache" } });
  if (!response.ok || response.redirected || !response.body || (response.url && new URL(response.url).href !== url.href) || Number(response.headers.get("content-length")) > MAX_BYTES) fail("source_http_or_size_failure");
  const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (!contentType || !["text/html", "application/xhtml+xml", "application/pdf"].includes(contentType)) fail("unsupported_document_type");
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > MAX_BYTES) fail("source_size_limit"); chunks.push(value); } }
  finally { await reader.cancel(); }
  const bytes = Buffer.concat(chunks); const checksum = createHash("sha256").update(bytes).digest("hex");
  if (contentType === "application/pdf" || bytes.subarray(0, 5).toString() === "%PDF-") return { checksum, paragraphs: [], pdf: true };
  return { checksum, paragraphs: extractSourceParagraphs(bytes.toString("utf8")), pdf: false };
}
/** Watch only documents already researched for exact editions. This is not a general web search. */
export async function watchEquipmentSources(input: ReviewInput, previous: EquipmentSourceWatchLedger = emptyEquipmentSourceWatch(), fetcher: typeof fetch = fetch, checkedAt = new Date().toISOString()) {
  if (!validInstant(checkedAt)) fail("invalid_check_time");
  const ledger = validateEquipmentSourceWatch(previous); const updates: EquipmentSourceUpdate[] = []; const checks: Array<{ sourceKey: string; status: WatchedSource["status"]; url: string; failure?: string }> = [];
  const documents = new Map<string, WatchedSource>();
  const refused = new Set<string>();
  for (const candidate of input.candidates) {
    const evidence = candidate.evidence;
    const key = sha(JSON.stringify({ url: evidence.url, edition: evidence.date, match: evidence.match }));
    let allowed = false;
    try { allowed = isOfficialUrl(new URL(evidence.url), evidence.match.brand); } catch { allowed = false; }
    if (!allowed) {
      if (!refused.has(key)) checks.push({ sourceKey: key, status: "failed", url: "[source not allowlisted]", failure: "unsupported_or_unsafe_official_source_requires_review" });
      refused.add(key); continue;
    }
    documents.set(key, { key, url: evidence.url, title: evidence.title, edition: evidence.date, match: structuredClone(evidence.match), checkedAt, status: "failed", paragraphs: [] });
  }
  if (documents.size > 24 || new Set([...ledger.sources.map(s => s.key), ...documents.keys()]).size > MAX_SOURCES) fail("source_history_limit_preserve_and_review");
  // Sequential requests keep the existing job's network footprint bounded.
  for (const document of documents.values()) {
    const old = ledger.sources.find(s => s.key === document.key);
    let next: WatchedSource;
    try {
      const fetched = await fetchSource(document, fetcher);
      const changed = old?.contentSha256 !== fetched.checksum;
      const historical = ledger.history.filter(event => event.key === document.key);
      const previouslySeenContent = historical.some(event => event.contentSha256 === fetched.checksum && event.status !== "failed");
      const known = new Set([...(old?.paragraphs.map(p => p.sha256) ?? []), ...historical.flatMap(event => event.paragraphs.map(p => p.sha256))]);
      const newParagraphs = fetched.paragraphs.filter(p => !known.has(p.sha256));
      const currentParagraphs = new Set(fetched.paragraphs.map(p => p.sha256));
      const removedParagraph = old?.paragraphs.some(p => !currentParagraphs.has(p.sha256)) ?? false;
      next = { ...document, status: fetched.pdf ? "manual_pdf_review_required" : "ok", lastSuccessfulAt: checkedAt, contentSha256: fetched.checksum, paragraphs: fetched.paragraphs };
      if (changed && !previouslySeenContent) {
        for (const paragraph of newParagraphs) updates.push({ sourceKey: document.key, url: document.url, title: document.title, edition: document.edition, match: document.match, kind: old?.lastSuccessfulAt ? "changed-source-excerpt" : "baseline-excerpt", classification: "information-insufficient", status: "source-change-needs-review", text: paragraph.text, paragraphSha256: paragraph.sha256 });
        if (!newParagraphs.length && (fetched.pdf || removedParagraph)) updates.push({ sourceKey: document.key, url: document.url, title: document.title, edition: document.edition, match: document.match, kind: "source-content-changed", classification: "information-insufficient", status: "source-change-needs-review", text: fetched.pdf ? "PDF requer leitura humana; checksum registrado sem atribuir equipamentos." : "Documento mudou sem novo parágrafo extraível; conferir remoções ou alterações de edição." });
      }
    } catch {
      // Never retain remote bodies, cookies, query strings from errors or arbitrary exception messages.
      next = { ...(old ?? document), checkedAt, status: "failed", failure: "official_document_fetch_or_extraction_failed_previous_evidence_preserved" };
    }
    if (!old || next.status !== old.status || next.contentSha256 !== old.contentSha256 || next.failure !== old.failure) ledger.history.push({ key: next.key, checkedAt, status: next.status, ...(next.contentSha256 ? { contentSha256: next.contentSha256 } : {}), ...(next.failure ? { failure: next.failure } : {}), paragraphs: structuredClone(next.paragraphs) });
    if (old) ledger.sources[ledger.sources.indexOf(old)] = next; else ledger.sources.push(next);
    checks.push({ sourceKey: next.key, status: next.status, url: next.url, ...(next.failure ? { failure: next.failure } : {}) });
  }
  return { ledger: validateEquipmentSourceWatch(ledger), updates, checks, limitations: ["Monitoramento somente de documentos oficiais já cadastrados, sem busca geral da internet nem certificação de todo o estoque.", "Trechos de linha de base não afirmam novidade absoluta; mudanças exigem leitura humana da edição e da configuração exatas.", "Nenhum trecho cria candidato, confirma presença, autoriza inclusão ou modifica cadastro; PDFs permanecem para leitura manual."] };
}
