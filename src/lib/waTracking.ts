/**
 * Rastreio de origem para conversas de WhatsApp.
 *
 * Problema: GA4 registra whatsapp_click, mas a conversa chega no WhatsApp sem
 * nenhuma marca de origem — no CRM o negócio entra como FACEBOOK/LEAD IA/sem
 * origem e a venda nunca volta pro canal que a gerou.
 *
 * Solução: capturar utm/gclid/fbclid na entrada do visitante, persistir por
 * 30 dias (last non-direct touch) e anexar uma referência curta e legível na
 * mensagem pré-preenchida do WhatsApp, ex.:
 *
 *   Ref: NC-META-c.estoque-julho-V19836
 *
 * A automação (iAN) extrai o padrão `NC-...` da primeira mensagem e grava
 * origem + campanha + veículo no CRM.
 */

import { extractVehicleIdFromSlug } from "@/lib/slug";

const STORAGE_KEY = "nc_traffic_ref";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

/** Códigos curtos de fonte de tráfego usados na ref. */
export type TrafficSourceCode =
  | "META" // fbclid ou utm facebook/instagram
  | "GADS" // gclid ou utm google+cpc
  | "GORG" // referrer google sem clid (orgânico)
  | "SOCIAL" // referrer social sem utm
  | "REF" // outro referrer
  | "DIR" // direto
  | string; // utm_source desconhecido, normalizado

interface StoredTrafficRef {
  src: TrafficSourceCode;
  campaign?: string;
  ts: number;
}

function sanitizeToken(value: string, maxLen = 24): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLen);
}

function readStored(): StoredTrafficRef | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTrafficRef;
    if (!parsed.src || Date.now() - parsed.ts > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(ref: StoredTrafficRef): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ref));
  } catch {
    // storage cheio/bloqueado: rastreio degrada pra DIR, sem quebrar o site
  }
}

function detectFromUrl(): StoredTrafficRef | null {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get("utm_source")?.toLowerCase() ?? "";
  const utmMedium = params.get("utm_medium")?.toLowerCase() ?? "";
  const campaignRaw = params.get("utm_campaign") ?? "";
  const campaign = campaignRaw ? sanitizeToken(campaignRaw) : undefined;

  if (params.get("gclid") || params.get("gbraid") || params.get("wbraid")) {
    return { src: "GADS", campaign, ts: Date.now() };
  }
  if (params.get("fbclid")) {
    return { src: "META", campaign, ts: Date.now() };
  }
  if (utmSource) {
    if (/facebook|instagram|^fb$|^ig$|meta/.test(utmSource)) {
      return { src: "META", campaign, ts: Date.now() };
    }
    if (/google/.test(utmSource)) {
      return {
        src: /cpc|paid|ads/.test(utmMedium) ? "GADS" : "GORG",
        campaign,
        ts: Date.now(),
      };
    }
    return {
      src: sanitizeToken(utmSource, 10).toUpperCase() || "REF",
      campaign,
      ts: Date.now(),
    };
  }
  return null;
}

function detectFromReferrer(): StoredTrafficRef | null {
  const referrer = document.referrer;
  if (!referrer) return null;
  let host = "";
  try {
    host = new URL(referrer).hostname;
  } catch {
    return null;
  }
  if (!host || host === window.location.hostname) return null;
  if (/google\./.test(host)) return { src: "GORG", ts: Date.now() };
  if (/facebook\.|instagram\.|fb\.com|t\.co|tiktok\./.test(host)) {
    return { src: "SOCIAL", ts: Date.now() };
  }
  return { src: "REF", ts: Date.now() };
}

/**
 * Captura a origem do visitante. Chamar uma vez no boot (initAnalytics).
 * Regra last non-direct touch: url com utm/clid sempre sobrescreve; referrer
 * externo só preenche se não houver origem paga guardada; acesso direto
 * preserva o que existir (quem viu Meta e voltou por Direct continua META).
 */
export function captureTrafficSource(): void {
  if (typeof window === "undefined") return;

  const fromUrl = detectFromUrl();
  if (fromUrl) {
    writeStored(fromUrl);
    return;
  }

  const stored = readStored();
  if (stored) return;

  const fromReferrer = detectFromReferrer();
  if (fromReferrer) writeStored(fromReferrer);
}

/** Origem atual (pra eventos GA4). */
export function getTrafficSource(): { src: TrafficSourceCode; campaign?: string } {
  const stored = typeof window !== "undefined" ? readStored() : null;
  return stored ? { src: stored.src, campaign: stored.campaign } : { src: "DIR" };
}

function inferVehicleIdFromPath(): string {
  if (typeof window === "undefined") return "";
  const pathname = window.location.pathname;
  if (!pathname.startsWith("/veiculo/")) return "";
  const id = extractVehicleIdFromSlug(pathname);
  return /^\d+$/.test(id) ? id : "";
}

/**
 * Monta a referência anexada à mensagem do WhatsApp.
 * Formato: NC-<SRC>[-c.<campanha>][-V<idVeiculo>]
 */
export function buildWaRef(vehicleId?: string | number): string {
  const { src, campaign } = getTrafficSource();
  const parts = [`NC-${src}`];
  if (campaign) parts.push(`c.${campaign}`);
  const id =
    vehicleId != null && String(vehicleId).trim() !== ""
      ? String(vehicleId)
      : inferVehicleIdFromPath();
  if (id) parts.push(`V${id}`);
  return parts.join("-");
}

const WA_URL_PATTERN = /wa\.me|api\.whatsapp\.com/i;

/**
 * Anexa a ref de rastreio ao parâmetro `text` de uma URL wa.me.
 * Idempotente: não duplica se a mensagem já contém "Ref: NC-".
 */
export function appendWaRefToUrl(
  url: string,
  vehicleId?: string | number,
): string {
  if (!url || !WA_URL_PATTERN.test(url)) return url;
  try {
    const parsed = new URL(url);
    const currentText = parsed.searchParams.get("text") ?? "";
    if (/Ref: NC-/.test(currentText)) return url;
    const ref = buildWaRef(vehicleId);
    const newText = currentText
      ? `${currentText}\n\nRef: ${ref}`
      : `Olá! Vim pelo site.\n\nRef: ${ref}`;
    parsed.searchParams.set("text", newText);
    return parsed.toString();
  } catch {
    return url;
  }
}
