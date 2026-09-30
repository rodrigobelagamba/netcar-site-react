import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "lucide-react";
import ts from "typescript";
import { emptySeminovosSearch } from "../../src/lib/seminovos-search";
import {
  buildWhatsAppUrl,
  homeWhatsAppMessages,
} from "../../src/lib/whatsappMessages";

type BarModule =
  typeof import("../../src/modules/home/components/HomeMobileWhatsAppBar");
type BarProps = React.ComponentProps<BarModule["HomeMobileWhatsAppBar"]>;
type WhatsAppData = { numero?: string } | undefined;
type StockLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  to: string;
  search: typeof emptySeminovosSearch;
};

const number = "(51) 99729-3118";
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL(
      "../../src/modules/home/components/HomeMobileWhatsAppBar.tsx",
      import.meta.url,
    ),
    "utf8",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  },
);

// Exercise the actual component, React useId, icons and contact helpers.
// Isolate only the API result, navigation and DOM portal boundaries.
function loadBar(whatsapp: WhatsAppData) {
  const stockLinks: Pick<StockLinkProps, "to" | "search">[] = [];
  let portalRenders = 0;
  const dependencies: Record<string, unknown> = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": icons,
    "@tanstack/react-router": {
      Link: ({ to, search, children, ...rest }: StockLinkProps) => {
        stockLinks.push({ to, search });
        return (
          <a href={to} {...rest}>
            {children}
          </a>
        );
      },
    },
    "@/catalog/queries/useSiteQuery": {
      useWhatsAppQuery: () => ({ data: whatsapp }),
    },
    "@/lib/whatsappMessages": { buildWhatsAppUrl, homeWhatsAppMessages },
    "@/lib/seminovos-search": { emptySeminovosSearch },
    "@/components/FloatingPortal": {
      FloatingPortal: ({ children }: { children: React.ReactNode }) => {
        portalRenders += 1;
        return <>{children}</>;
      },
    },
  };
  const exports: Record<string, unknown> = {};
  runInNewContext(outputText, {
    exports,
    require: (name: string) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return {
    ...(exports as BarModule),
    stockLinks,
    portalRenders: () => portalRenders,
  };
}

function renderBar(
  props: BarProps = {},
  whatsapp: WhatsAppData = { numero: number },
) {
  const loaded = loadBar(whatsapp);
  const html = renderToStaticMarkup(
    <loaded.HomeMobileWhatsAppBar {...props} />,
  );
  return { ...loaded, html };
}

function anchors(html: string) {
  return [...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].map(
    (match) => match[0],
  );
}

function attribute(tag: string, name: string) {
  const value = tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
  assert.notEqual(value, undefined, `Missing ${name}`);
  return value!;
}

function classes(tag: string) {
  return new Set(attribute(tag, "class").split(/\s+/));
}

test("hidden or unavailable contact never creates a floating portal", () => {
  const hidden = renderBar({ visible: false });
  assert.equal(hidden.html, "");
  assert.equal(hidden.portalRenders(), 0);
  for (const whatsapp of [undefined, {}, { numero: "" }]) {
    const loaded = loadBar(whatsapp);
    assert.equal(renderToStaticMarkup(<loaded.HomeMobileWhatsAppBar />), "");
    assert.equal(loaded.portalRenders(), 0);
    assert.equal(loaded.stockLinks.length, 0);
  }
});

test("default contact keeps the sales message, safe external link and attribution", () => {
  const { html, portalRenders } = renderBar();
  const links = anchors(html);
  assert.equal(portalRenders(), 1);
  assert.equal(links.length, 2);
  assert.equal(
    attribute(links[0], "href"),
    buildWhatsAppUrl(number, homeWhatsAppMessages().vehicleInterest),
  );
  assert.equal(attribute(links[0], "target"), "_blank");
  assert.equal(attribute(links[0], "rel"), "noopener noreferrer");
  assert.equal(attribute(links[0], "data-wa-source"), "sticky_cold");
  assert.equal(attribute(links[0], "data-wa-intent"), "vehicle_interest");
  assert.match(links[0], />Quero ajuda<\/span>/);
  assert.match(links[1], />Ver estoque<\/span>/);
});

test("custom contact URL, labels and caller attribution are preserved", () => {
  const href = "https://wa.me/5551997293118?text=Quero%20trocar";
  const { html } = renderBar({
    coldHref: href,
    coldCtaLabel: "Conversar agora",
    stockCtaLabel: "Todos os carros",
    coldHint: "Ajuda da equipe pelo WhatsApp",
    sourceCold: "home_sticky_cold",
  });
  const links = anchors(html);
  assert.equal(attribute(links[0], "href"), href);
  assert.equal(attribute(links[0], "data-wa-source"), "home_sticky_cold");
  assert.equal(attribute(links[0], "data-wa-intent"), "vehicle_interest");
  assert.match(links[0], />Conversar agora<\/span>/);
  assert.match(links[1], />Todos os carros<\/span>/);
  assert.match(html, /class="sr-only">Ajuda da equipe pelo WhatsApp<\/p>/);
});

test("stock action resets every catalog filter without opening an external tab", () => {
  const { html, stockLinks } = renderBar();
  assert.equal(stockLinks.length, 1);
  assert.equal(stockLinks[0].to, "/seminovos");
  assert.equal(stockLinks[0].search, emptySeminovosSearch);
  assert(
    Object.values(stockLinks[0].search).every((value) => value === undefined),
  );
  const stockLink = anchors(html)[1];
  assert.equal(attribute(stockLink, "href"), "/seminovos");
  assert.doesNotMatch(stockLink, /target=|data-wa-source=|data-wa-intent=/);
});

test("optional mobile hiding preserves the tablet and desktop bar", () => {
  const visible = classes(renderBar().html);
  const mobileHidden = classes(renderBar({ hideOnMobile: true }).html);
  assert(visible.has("flex"));
  assert(!visible.has("hidden"));
  assert(mobileHidden.has("hidden"));
  assert(mobileHidden.has("sm:flex"));
});

test("compact bar keeps one action row, 44px touch targets and keyboard focus", () => {
  const { html } = renderBar();
  const wrapper = classes(html);
  assert(wrapper.has("fixed"));
  assert(wrapper.has("pointer-events-none"));
  assert(wrapper.has("bottom-[calc(env(safe-area-inset-bottom,0px)+0.5rem)]"));
  const nav = html.match(/<nav\b[^>]*>/)?.[0];
  assert(nav);
  const navClasses = classes(nav);
  for (const name of [
    "pointer-events-auto",
    "grid",
    "grid-cols-2",
    "max-w-[22rem]",
    "p-1",
  ]) {
    assert(navClasses.has(name), `Missing compact layout class: ${name}`);
  }
  assert.doesNotMatch(
    attribute(nav, "class"),
    /(?:sm|md|lg):(?:p-|py-|grid-cols-)/,
  );
  for (const link of anchors(html)) {
    const linkClasses = classes(link);
    assert(linkClasses.has("min-h-11"));
    assert(linkClasses.has("min-w-0"));
    assert(linkClasses.has("focus-visible:outline"));
    assert(linkClasses.has("focus-visible:outline-2"));
    assert(linkClasses.has("focus-visible:outline-offset-2"));
    assert.match(link, /<span class="truncate">/);
  }
  assert.doesNotMatch(html, /Envie sua mensagem a qualquer hora/);
});

test("navigation keeps its accessible description without visible helper rows", () => {
  const { html } = renderBar();
  const nav = html.match(/<nav\b[^>]*>/)?.[0];
  assert(nav);
  assert.equal(attribute(nav, "aria-label"), "Ações rápidas");
  const paragraphs = [...html.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/g)];
  assert.equal(paragraphs.length, 1);
  const hint = paragraphs[0][0];
  assert.equal(attribute(hint, "id"), attribute(nav, "aria-describedby"));
  assert.equal(attribute(hint, "class"), "sr-only");
  assert.match(hint, />Estoque completo ou ajuda no WhatsApp<\/p>/);
  const svgTags = [...html.matchAll(/<svg\b[^>]*>/g)];
  assert.equal(svgTags.length, 2);
  for (const [svg] of svgTags) {
    assert.equal(attribute(svg, "aria-hidden"), "true");
  }
});

test("description IDs remain unique across separate instances", () => {
  const { HomeMobileWhatsAppBar } = loadBar({ numero: number });
  const html = renderToStaticMarkup(
    <>
      <HomeMobileWhatsAppBar />
      <HomeMobileWhatsAppBar />
    </>,
  );
  const references = [...html.matchAll(/aria-describedby="([^"]+)"/g)].map(
    (match) => match[1],
  );
  const ids = [...html.matchAll(/<p id="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(references.length, 2);
  assert.equal(new Set(references).size, 2);
  assert.deepEqual(references, ids);
});
