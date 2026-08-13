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
    referrer: "",
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
    (event) => event[0] === "init" && event[1] === "367657940934075",
  ),
  "Meta Pixel não foi inicializado",
);
assert(
  context.fbq.queue.some(
    (event) => event[0] === "track" && event[1] === "PageView",
  ),
  "PageView inicial do Meta não entrou na fila",
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
assert(insertedScripts.length === 0, "tags carregaram durante a primeira pintura");
timeoutCallback();
assert(
  typeof idleCallback === "function",
  "carregamento ocioso não foi agendado após a janela crítica",
);
idleCallback();

const sources = insertedScripts.map((script) => script.src);
assert(
  sources.some((src) => src.includes("gtm.js?id=GTM-M8MZRTL9")),
  "GTM não foi carregado",
);
assert(
  !sources.includes("https://www.googletagmanager.com/gtag/js?id=G-MGPNBDNQ9G"),
  "GA4 direto duplicou o GA4 já administrado pelo GTM",
);
assert(
  sources.includes("https://connect.facebook.net/en_US/fbevents.js"),
  "biblioteca do Meta Pixel não foi carregada",
);
assert(
  context.dataLayer.some(
    (event) => event?.event === "gtm.js" && event["gtm.start"],
  ),
  "evento inicial do GTM ausente",
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
assert(typeof gtmScript?.onerror === "function", "fallback do GA4 ausente no GTM");
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
  "Tags validadas em runtime: GTM e Meta carregam uma vez; GA4 direto fica como fallback sem duplicação.",
);
