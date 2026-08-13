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
    getElementsByTagName: () => [firstScript],
    createElement: () => ({ async: false, src: "" }),
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
  setTimeout() {},
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
  typeof idleCallback === "function",
  "carregamento adiado não foi agendado",
);

idleCallback();

const sources = insertedScripts.map((script) => script.src);
assert(
  sources.some((src) => src.includes("gtm.js?id=GTM-M8MZRTL9")),
  "GTM não foi carregado",
);
assert(
  sources.includes("https://www.googletagmanager.com/gtag/js?id=G-MGPNBDNQ9G"),
  "GA4 direto não foi carregado",
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

console.log(
  "Tags validadas em runtime: GTM, GA4 e Meta carregam uma vez e preservam as filas.",
);
