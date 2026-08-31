/**
 * Rastreio de origem para conversas de WhatsApp.
 *
 * Captura gclid/fbclid/UTM (30d, last non-direct). No clique WA gera uma
 * identidade forte para o join digital e uma referência curta legível na
 * mensagem, ex.:
 *
 *   ...quero mais informações sobre o Tiggo 7 Pro 2023 - (M7KQ4X9P).
 *
 * 1ª letra = fonte (M Meta, G Google Ads, O orgânico, S social, R referral,
 * D direto, U outro). A referência curta usa Base32 Crockford e preserva a
 * leitura humana; o parser aceita também os formatos legados. O
 * `click_id` é a chave canônica no GA4/dataLayer/log próprio.
 */

const STORAGE_KEY = "nc_traffic_ref";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
let inMemoryTrafficRef: StoredTrafficRef | null = null;

declare global {
  interface Window {
    __netcarPrivacyConsent?: string;
  }
}

export type PrivacyConsentState = "accepted" | "essential" | "unset";

export function getPrivacyConsentState(): PrivacyConsentState {
  if (typeof window === "undefined") return "unset";
  if (window.__netcarPrivacyConsent === "accepted") return "accepted";
  if (window.__netcarPrivacyConsent) return "essential";
  return "unset";
}

function canPersistAttribution(): boolean {
  return getPrivacyConsentState() === "accepted";
}

/** Remove a atribuicao opcional da memoria e do navegador. */
export function clearTrafficAttribution(): void {
  inMemoryTrafficRef = null;
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // armazenamento bloqueado: a copia em memoria ja foi descartada
  }
}

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
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  utmSource?: string;
  utmMedium?: string;
  utmContent?: string;
  utmTerm?: string;
  landingPage?: string;
  referrer?: string;
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

function isFresh(ref: StoredTrafficRef): boolean {
  return Boolean(ref.src) && Date.now() - ref.ts <= TTL_MS;
}

function readPersistentStorage(): StoredTrafficRef | null {
  if (!canPersistAttribution()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTrafficRef;
    if (!isFresh(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(ref: StoredTrafficRef): void {
  inMemoryTrafficRef = ref;
  if (!canPersistAttribution()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ref));
  } catch {
    // storage cheio/bloqueado: mantém a sessão, sem quebrar o site
  }
}

/**
 * Antes do consentimento, atribuição existe só em memória. Quando há opt-in,
 * a próxima leitura promove esse contexto para a persistência de 30 dias.
 */
function readStored(): StoredTrafficRef | null {
  if (inMemoryTrafficRef && isFresh(inMemoryTrafficRef)) {
    if (canPersistAttribution()) writeStored(inMemoryTrafficRef);
    return inMemoryTrafficRef;
  }
  inMemoryTrafficRef = null;

  const persisted = readPersistentStorage();
  if (persisted) inMemoryTrafficRef = persisted;
  return persisted;
}

function attributionContext(): Pick<
  StoredTrafficRef,
  "landingPage" | "referrer"
> {
  let referrer = "";
  try {
    const parsed = document.referrer ? new URL(document.referrer) : null;
    referrer = parsed ? `${parsed.origin}${parsed.pathname}`.slice(0, 300) : "";
  } catch {
    referrer = "";
  }
  return {
    landingPage: window.location.pathname.slice(0, 200),
    referrer: referrer || undefined,
  };
}

function detectFromUrl(): StoredTrafficRef | null {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get("utm_source")?.toLowerCase() ?? "";
  const utmMedium = params.get("utm_medium")?.toLowerCase() ?? "";
  const campaignRaw = params.get("utm_campaign") ?? "";
  const campaign = campaignRaw ? sanitizeToken(campaignRaw, 80) : undefined;
  const utm = {
    utmSource: utmSource ? sanitizeToken(utmSource, 40) : undefined,
    utmMedium: utmMedium ? sanitizeToken(utmMedium, 40) : undefined,
    utmContent: params.get("utm_content")?.slice(0, 120) || undefined,
    utmTerm: params.get("utm_term")?.slice(0, 120) || undefined,
    ...attributionContext(),
  };

  const gclid = params.get("gclid") ?? undefined;
  const gbraid = params.get("gbraid") ?? undefined;
  const wbraid = params.get("wbraid") ?? undefined;
  if (gclid || gbraid || wbraid) {
    return {
      src: "GADS",
      campaign,
      gclid,
      gbraid,
      wbraid,
      ...utm,
      ts: Date.now(),
    };
  }
  const fbclid = params.get("fbclid") ?? undefined;
  if (fbclid) {
    return { src: "META", campaign, fbclid, ...utm, ts: Date.now() };
  }
  if (utmSource) {
    if (/facebook|instagram|^fb$|^ig$|meta/.test(utmSource)) {
      return { src: "META", campaign, ...utm, ts: Date.now() };
    }
    if (/google/.test(utmSource)) {
      return {
        src: /cpc|paid|ads/.test(utmMedium) ? "GADS" : "GORG",
        campaign,
        ...utm,
        ts: Date.now(),
      };
    }
    return {
      src: sanitizeToken(utmSource, 10).toUpperCase() || "REF",
      campaign,
      ...utm,
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
  const context = attributionContext();
  if (/google\./.test(host)) return { src: "GORG", ...context, ts: Date.now() };
  if (/facebook\.|instagram\.|fb\.com|t\.co|tiktok\./.test(host)) {
    return { src: "SOCIAL", ...context, ts: Date.now() };
  }
  return { src: "REF", ...context, ts: Date.now() };
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

export interface TrafficSourceContext {
  src: TrafficSourceCode;
  campaign?: string;
  utmSource?: string;
  utmMedium?: string;
  utmContent?: string;
  utmTerm?: string;
  landingPage?: string;
  referrer?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
}

/** Origem atual (pra eventos GA4 e atribuição própria). */
export function getTrafficSource(): TrafficSourceContext {
  // A origem pode ser mantida transitoriamente em memoria ate a escolha, mas
  // nao e exposta a eventos, URLs ou logs sem consentimento de medicao.
  if (getPrivacyConsentState() !== "accepted") return { src: "DIR" };
  const stored = typeof window !== "undefined" ? readStored() : null;
  if (!stored) return { src: "DIR" };
  const context: TrafficSourceContext = {
    src: stored.src,
    campaign: stored.campaign,
    utmSource: stored.utmSource,
    utmMedium: stored.utmMedium,
    utmContent: stored.utmContent,
    utmTerm: stored.utmTerm,
    landingPage: stored.landingPage,
  };
  if (stored.referrer) context.referrer = stored.referrer;
  if (stored.gclid) context.gclid = stored.gclid;
  if (stored.gbraid) context.gbraid = stored.gbraid;
  if (stored.wbraid) context.wbraid = stored.wbraid;
  if (stored.fbclid) context.fbclid = stored.fbclid;
  return context;
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

export interface WhatsAppClickIdentity {
  /** Chave canônica, aleatória criptograficamente, para GA4 e o log próprio. */
  clickId: string;
  /** Referência curta preservada na mensagem para compatibilidade legada. */
  waRef: string;
}

function secureRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }

  // Fallback apenas para navegadores muito antigos; os ambientes atuais usam
  // Web Crypto. Nunca reutiliza uma identidade entre cliques.
  for (let index = 0; index < length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

function randomHex(length: number): string {
  return [...secureRandomBytes(length)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// Base32 legível: evita 0/1/I/O; L e U completam os 32 símbolos.
const CROCKFORD_BASE32 = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomCrockford(length: number): string {
  return [...secureRandomBytes(length)]
    .map((byte) => CROCKFORD_BASE32[byte & 31])
    .join("");
}

/**
 * Cria uma identidade nova por gesto. Quem inicia o gesto a passa tanto para
 * a telemetria quanto para a URL WA; não há janela temporal que una cliques
 * distintos por acidente.
 */
export function createWhatsAppClickIdentity(): WhatsAppClickIdentity {
  return {
    clickId: `nc_${randomHex(16)}`,
    waRef: `${sourceLetter(getTrafficSource().src)}${randomCrockford(7)}`,
  };
}

/** @deprecated Use createWhatsAppClickIdentity().waRef no mesmo gesto. */
export function getOrCreateClickCode(): string {
  return createWhatsAppClickIdentity().waRef;
}

const WA_LOG_ENDPOINT = "https://wa.netcarmultimarcas.com.br/";

/**
 * Log próprio do clique WA (fire-and-forget): grava wa_ref + gclid/utm
 * no servidor. É o que liga o código da mensagem à campanha Google/Meta
 * sem expor nada na mensagem. Falha aqui nunca quebra o clique.
 */
export function logWaClick(
  identity: WhatsAppClickIdentity | string,
  context: Record<string, unknown> = {},
): void {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  // O log proprio e medicao opcional. O WhatsApp continua funcionando quando
  // o visitante escolhe apenas os recursos essenciais.
  if (getPrivacyConsentState() !== "accepted") return;
  try {
    const ref = readStored();
    const click =
      typeof identity === "string"
        ? { clickId: "", waRef: identity }
        : identity;
    const body = JSON.stringify({
      // `code` é mantido para o consumidor legado do log.
      code: click.waRef,
      wa_ref: click.waRef,
      click_id: click.clickId,
      src: ref?.src ?? "DIR",
      campaign: ref?.campaign ?? "",
      gclid: ref?.gclid ?? "",
      gbraid: ref?.gbraid ?? "",
      wbraid: ref?.wbraid ?? "",
      fbclid: ref?.fbclid ?? "",
      utm_source: ref?.utmSource ?? "",
      utm_medium: ref?.utmMedium ?? "",
      utm_content: ref?.utmContent ?? "",
      utm_term: ref?.utmTerm ?? "",
      landing_page: ref?.landingPage ?? "",
      referrer: ref?.referrer ?? "",
      page: window.location.pathname.slice(0, 200),
      privacy_consent: getPrivacyConsentState(),
      ts: Math.floor(Date.now() / 1000),
      ...context,
    });
    // text/plain evita preflight CORS; servidor aceita JSON no body do mesmo jeito
    const deliveredWithBeacon = navigator.sendBeacon
      ? navigator.sendBeacon(
          WA_LOG_ENDPOINT,
          new Blob([body], { type: "text/plain" }),
        )
      : false;
    if (!deliveredWithBeacon) {
      void fetch(WA_LOG_ENDPOINT, {
        method: "POST",
        body,
        headers: { "Content-Type": "text/plain" },
        keepalive: true,
        mode: "cors",
      }).catch(() => {});
    }
  } catch {
    // log é best-effort
  }
}

const WA_URL_PATTERN = /wa\.me|api\.whatsapp\.com/i;
/** Referências válidas sempre começam por uma das fontes emitidas pela Netcar. */
const CODE_IN_TEXT_PATTERN =
  /\(\s*[MGODSRU](?:[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{7}|\d{1,5}|[A-Z2-9]{4})\s*\)/;
const CODE_AT_END_PATTERN =
  /\s*-\s*\(\s*[MGODSRU](?:[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{7}|\d{1,5}|[A-Z2-9]{4})\s*\)\.?\s*$/;

function stripWaRefFromUrl(url: string): string {
  if (!url || !WA_URL_PATTERN.test(url)) return url;
  try {
    const parsed = new URL(url);
    const currentText = parsed.searchParams.get("text") ?? "";
    if (!CODE_IN_TEXT_PATTERN.test(currentText)) return url;

    const withoutSuffix = currentText.replace(CODE_AT_END_PATTERN, "").trimEnd();
    const withoutCode = withoutSuffix
      .replace(CODE_IN_TEXT_PATTERN, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    const cleanText = withoutCode
      ? `${withoutCode.replace(/\.+$/, "")}.`
      : withoutCode;
    parsed.searchParams.set("text", cleanText);
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Anexa ` - (M7KQ4X9P).` ao fim da mensagem pré-preenchida. A identidade deve
 * ser a mesma usada no evento do gesto; sem ela, uma nova é criada somente
 * para esta chamada, sem reutilização temporal.
 */
export function appendWaRefToUrl(
  url: string,
  identity?: WhatsAppClickIdentity,
): string {
  if (!url || !WA_URL_PATTERN.test(url)) return url;
  if (getPrivacyConsentState() !== "accepted") return stripWaRefFromUrl(url);
  try {
    const resolvedIdentity = identity ?? createWhatsAppClickIdentity();
    const parsed = new URL(url);
    const currentText = parsed.searchParams.get("text") ?? "";
    const newText = CODE_IN_TEXT_PATTERN.test(currentText)
      ? currentText.replace(CODE_IN_TEXT_PATTERN, `(${resolvedIdentity.waRef})`)
      : (() => {
          const trimmed = currentText.trimEnd();
          const base = trimmed.replace(/\.+$/, "").trimEnd();
          return base
            ? `${base} - (${resolvedIdentity.waRef}).`
            : `Olá! Vim pelo site - (${resolvedIdentity.waRef}).`;
        })();

    parsed.searchParams.set("text", newText);
    return parsed.toString();
  } catch {
    return url;
  }
}
