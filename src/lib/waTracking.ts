/**
 * Rastreio de origem para conversas de WhatsApp.
 *
 * Captura gclid/fbclid/UTM (30d, last non-direct). No clique WA gera código
 * curto e discreto anexado ao fim da mensagem, ex.:
 *
 *   ...quero mais informações sobre o Tiggo 7 Pro 2023 - (M482).
 *
 * 1ª letra = fonte (M Meta, G Google Ads, O orgânico, S social, R referral,
 * D direto, U outro). 3 dígitos identificam o clique (join no GA4).
 * Campanha NÃO vai na mensagem: fica em traffic_campaign (UTM / ID Meta)
 * e no Google Ads via gclid. iAN extrai `(X999)`.
 */

const STORAGE_KEY = "nc_traffic_ref";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

/** Códigos curtos de fonte de tráfego. */
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

/** Letra da fonte usada como prefixo do código. */
function sourceLetter(src: TrafficSourceCode): string {
  switch (src) {
    case "META":
      return "M";
    case "GADS":
      return "G";
    case "GORG":
      return "O";
    case "SOCIAL":
      return "S";
    case "REF":
      return "R";
    case "DIR":
      return "D";
    default:
      return "U";
  }
}

const CLICK_CODE_TTL_MS = 3000;

let currentClickCode = "";
let currentClickCodeAt = 0;

/** 3 dígitos (100–999). */
function randomDigits3(): string {
  return String(100 + Math.floor(Math.random() * 900));
}

/**
 * Código do clique, ex. "M482" (1 letra da fonte + 3 dígitos).
 * Mesmo clique → mesmo código na mensagem WA e no evento GA4 (janela 3s).
 */
export function getOrCreateClickCode(): string {
  const now = Date.now();
  if (currentClickCode && now - currentClickCodeAt < CLICK_CODE_TTL_MS) {
    return currentClickCode;
  }
  currentClickCode = `${sourceLetter(getTrafficSource().src)}${randomDigits3()}`;
  currentClickCodeAt = now;
  return currentClickCode;
}

const WA_URL_PATTERN = /wa\.me|api\.whatsapp\.com/i;
/** Já tem código (M482) ou legado (M4 / M4827 / M4T7X). */
const CODE_IN_TEXT_PATTERN = /\(\s*[A-Z](?:\d{1,4}|[A-Z2-9]{4})\s*\)/;

/**
 * Anexa ` - (M482).` ao fim da mensagem pré-preenchida.
 * Idempotente. Cliente vê letra + 3 dígitos entre parênteses.
 */
export function appendWaRefToUrl(url: string): string {
  if (!url || !WA_URL_PATTERN.test(url)) return url;
  try {
    const parsed = new URL(url);
    const currentText = parsed.searchParams.get("text") ?? "";
    if (CODE_IN_TEXT_PATTERN.test(currentText)) return url;

    const code = getOrCreateClickCode();
    const trimmed = currentText.trimEnd();
    const base = trimmed.replace(/\.+$/, "").trimEnd();
    const newText = base
      ? `${base} - (${code}).`
      : `Olá! Vim pelo site - (${code}).`;

    parsed.searchParams.set("text", newText);
    return parsed.toString();
  } catch {
    return url;
  }
}
