#!/usr/bin/env node

/** Executa o bootstrap das tags sem rede para impedir regressões nas filas. */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const bootstrap = inlineScripts.find((match) =>
  match[1].includes("loadDeferredAnalytics"),
)?.[1];

if (!bootstrap) {
  console.error("Bootstrap das tags não encontrado no index.html.");
  process.exit(1);
}

const insertedScripts = [];
const listeners = new Map();
const storage = new Map();
let idleCallback;
let timeoutCallback;
let timeoutDelay;

const firstScript = {
  parentNode: {
    insertBefore(node) {
      insertedScripts.push(node);
    },
  },
};

const context = {
  console,
  URL,
  Date,
  location: { pathname: "/", search: "" },
  dataLayer: [],
  document: {
    referrer: "https://chatgpt.com/",
    readyState: "loading",
    getElementsByTagName: () => [firstScript],
    createElement: () => ({ async: false, src: "", onerror: undefined }),
    querySelector: () => null,
    head: {
      appendChild(node) {
        insertedScripts.push(node);
      },
    },
  },
  sessionStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
  },
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  },
  addEventListener(name, callback) {
    listeners.set(name, callback);
  },
  removeEventListener(name) {
    listeners.delete(name);
  },
  requestIdleCallback(callback) {
    idleCallback = callback;
  },
  setTimeout(callback, delay) {
    timeoutCallback = callback;
    timeoutDelay = delay;
    return 1;
  },
  clearTimeout() {},
};
context.window = context;

runInNewContext(bootstrap, context, { filename: "index.html#tracking" });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(typeof context.fbq === "function", "fila fbq não foi criada");
assert(
  context.fbq.queue.some(
    (event) => event[0] === "consent" && event[1] === "revoke",
  ),
  "Meta Pixel não iniciou com consentimento revogado",
);
assert(
  !context.fbq.queue.some(
    (event) => event[0] === "init" || event[0] === "track",
  ),
  "Meta inicializou ou mediu PageView antes do consentimento",
);
assert(
  !context.dataLayer.some((event) => event?.event === "ai_referral") &&
    !storage.has("ai_ref_tracked"),
  "referencia de IA foi medida ou persistida antes do consentimento",
);
assert(
  typeof listeners.get("load") === "function",
  "carregamento adiado não aguardou o load",
);

listeners.get("load")();
assert(
  typeof timeoutCallback === "function" && timeoutDelay >= 7000,
  "tags não respeitam a janela crítica após o load",
);
assert(
  insertedScripts.length === 0,
  "tags carregaram durante a primeira pintura",
);
timeoutCallback();
assert(
  typeof idleCallback === "function",
  "carregamento ocioso não foi agendado após a janela crítica",
);
idleCallback();

let sources = insertedScripts.map((script) => script.src);
assert(
  sources.some((src) => src.includes("gtm.js?id=GTM-M8MZRTL9")),
  "GTM não foi carregado",
);
assert(
  !sources.includes("https://www.googletagmanager.com/gtag/js?id=G-MGPNBDNQ9G"),
  "GA4 direto duplicou o GA4 já administrado pelo GTM",
);
assert(
  !sources.includes("https://connect.facebook.net/en_US/fbevents.js"),
  "biblioteca do Meta Pixel carregou antes do consentimento",
);
assert(
  context.dataLayer.some(
    (event) => event?.event === "gtm.js" && event["gtm.start"],
  ),
  "evento inicial do GTM ausente",
);

assert(
  typeof context.netcarSetPrivacyConsent === "function",
  "controle de consentimento não foi exposto para a interface",
);
context.netcarSetPrivacyConsent("accepted");
sources = insertedScripts.map((script) => script.src);
assert(
  storage.get("nc_privacy_consent_v1") === "accepted",
  "aceite de privacidade não foi persistido",
);
assert(
  context.dataLayer.some(
    (event) => event?.event === "ai_referral" && event.ai_source === "ChatGPT",
  ) && storage.get("ai_ref_tracked") === "1",
  "referencia de IA não foi medida depois do consentimento",
);
assert(
  context.fbq.queue.some(
    (event) => event[0] === "consent" && event[1] === "grant",
  ),
  "consentimento do Meta não foi concedido após aceite",
);
assert(
  context.fbq.queue.filter(
    (event) => event[0] === "init" && event[1] === "367657940934075",
  ).length === 1,
  "Meta Pixel não inicializou exatamente uma vez após aceite",
);
assert(
  context.fbq.queue.filter(
    (event) => event[0] === "track" && event[1] === "PageView",
  ).length === 1,
  "PageView do Meta não entrou exatamente uma vez após aceite",
);
assert(
  sources.includes("https://connect.facebook.net/en_US/fbevents.js"),
  "biblioteca do Meta Pixel não carregou após consentimento",
);

const scriptCount = insertedScripts.length;
context.loadDeferredAnalytics();
assert(
  insertedScripts.length === scriptCount,
  "bootstrap duplicou as bibliotecas de monitoramento",
);

const gtmScript = insertedScripts.find((script) =>
  script.src.includes("gtm.js?id=GTM-M8MZRTL9"),
);
assert(
  typeof gtmScript?.onerror === "function",
  "fallback do GA4 ausente no GTM",
);
gtmScript.onerror();
assert(
  insertedScripts.some(
    (script) =>
      script.src === "https://www.googletagmanager.com/gtag/js?id=G-MGPNBDNQ9G",
  ),
  "GA4 direto não carregou quando o GTM falhou",
);
const fallbackScriptCount = insertedScripts.length;
gtmScript.onerror();
assert(
  insertedScripts.length === fallbackScriptCount,
  "fallback do GA4 carregou mais de uma vez",
);

console.log(
  "Tags validadas em runtime: consentimento bloqueia Meta até o aceite, GTM carrega uma vez e GA4 direto fica como fallback.",
);
