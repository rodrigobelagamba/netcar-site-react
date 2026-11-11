import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import TestRenderer, { act } from "react-test-renderer";
import ts from "typescript";
import * as whatsappMessages from "../../src/lib/whatsappMessages";
import { emptySeminovosSearch } from "../../src/lib/seminovos-search";

const Icon = () => <svg aria-hidden="true" />;
const Link = ({ to, children, search: _search, ...props }: any) => <a href={to} {...props}>{children}</a>;

function loadComponents(active: boolean) {
  const state = { active };
  const hooks = {
    useBlackFridayCampaign: () => state,
    useWhatsAppQuery: () => ({ data: { numero: "5551997293118" } }),
  };
  const deps: Record<string, unknown> = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": new Proxy({}, { get: () => Icon }),
    "@tanstack/react-router": { Link },
    "@/catalog/queries/useSiteQuery": hooks,
    "@/lib/whatsappMessages": whatsappMessages,
    "@/lib/seminovos-search": { emptySeminovosSearch },
    "./CampaignProvider": hooks,
    "./black-friday.css": {},
  };
  function evaluate(source: string, extra: Record<string, unknown> = {}) {
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const module = { exports: {} as Record<string, any> };
    runInNewContext(compiled, {
      module,
      exports: module.exports,
      require: (id: string) => {
        if (!(id in deps)) throw new Error(`Unexpected dependency: ${id}`);
        return deps[id];
      },
      ...extra,
    });
    return module.exports;
  }
  const surfaces = evaluate(readFileSync(new URL(
    "../../src/features/black-friday/CampaignSurfaces.tsx", import.meta.url,
  ), "utf8"));

  // Exercise the actual private contact components without loading the entire
  // detail page's network, maps and gallery dependencies.
  const pageText = readFileSync(new URL("../../src/modules/detalhes/pages/DetalhesPage.tsx", import.meta.url), "utf8");
  const page = ts.createSourceFile("DetalhesPage.tsx", pageText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = ["ContactButton", "DetalheFloatingWhatsApp"];
  const functions = page.statements.filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text || ""));
  assert.equal(functions.length, 2);
  const contacts = evaluate(`${functions.map((node) => node.getText(page)).join("\n")}\nexport { ${names.join(", ")} };`, {
    ...hooks,
    ...whatsappMessages,
    Link,
    ArrowRight: Icon,
    MessageCircleMore: Icon,
    TradeInTextLink: ({ href }: any) => <a href={href}>Avaliar troca</a>,
    FloatingPortal: ({ children }: any) => children,
    VehicleWhatsAppCard: (props: any) => <a href={props.href} data-card-label={props.ctaLabel} data-card-source={props.source} />,
    trackCompareInteraction: () => {},
  });
  return { state, ...surfaces, ...contacts } as Record<string, any>;
}

test("disabled campaign removes all seasonal surfaces and video from the DOM", () => {
  const components = loadComponents(false);
  for (const name of ["BlackFridayHomeHero", "BlackFridayStockIntro", "BlackFridayVehicleOffer", "BlackFridayFooterBanner"]) {
    assert.equal(renderToStaticMarkup(React.createElement(components[name], {
      onViewStock: () => {}, vehicleLabel: "Tracker Premier", vehicleId: "20138",
    })), "", name);
  }
});

test("home, stock and vehicle present all four confirmed benefits and the common conditions", () => {
  const components = loadComponents(true);
  for (const name of ["BlackFridayHomeHero", "BlackFridayStockIntro", "BlackFridayVehicleOffer"]) {
    const html = renderToStaticMarkup(React.createElement(components[name], {
      onViewStock: () => {}, vehicleLabel: "Tracker Premier", vehicleId: "20138",
    }));
    for (const text of ["Transferência", "por nossa conta", "Entrada em até 10x", "sem juros no cartão", "Tanque cheio", "1ª parcela em janeiro", "de 2027 no financiamento", "valem juntos para todo o estoque até 30/11/2026", "sem limite adicional de valor", "Financiamento sujeito à análise de crédito"]) {
      assert.ok(html.includes(text), `${name}: ${text}`);
    }
  }
});

test("home offers the supplied video, captions and working stock navigation callback", () => {
  const { BlackFridayHomeHero } = loadComponents(true);
  let calls = 0;
  const renderer = TestRenderer.create(<BlackFridayHomeHero onViewStock={() => calls++} />);
  const video = renderer.root.findByType("video");
  assert.equal(video.props.controls, true);
  assert.equal(video.props.playsInline, true);
  assert.equal(video.props.preload, "none");
  assert.equal(video.findByType("source").props.src, "/images/campaigns/black-friday-2026/black-friday-netcar-2026.mp4");
  assert.equal(video.findByType("track").props.srcLang, "pt-BR");
  act(() => renderer.root.findByType("button").props.onClick());
  assert.equal(calls, 1);
  renderer.unmount();
});

test("vehicle offer contact keeps the unit identity and campaign inquiry", () => {
  const { BlackFridayVehicleOffer } = loadComponents(true);
  const renderer = TestRenderer.create(<BlackFridayVehicleOffer vehicleLabel="Tracker Premier" vehicleId="20138" waRef={{ placa: "JCD0J59" }} />);
  const anchor = renderer.root.findByType("a");
  const url = new URL(anchor.props.href);
  assert.equal(url.hostname, "wa.me");
  assert.match(url.searchParams.get("text") || "", /quatro benefícios da Black Friday no Tracker Premier/);
  assert.match(url.searchParams.get("text") || "", /Placa: JCD0J59/);
  assert.equal(anchor.props["data-wa-vehicle-id"], "20138");
  renderer.unmount();
});

test("rollback restores the normal vehicle contact text and message in the same mount", () => {
  const { ContactButton, state } = loadComponents(true);
  const props = { modeloCompleto: "Tracker Premier", vehicleLabel: "Tracker Premier", vehicleId: "20138", waRef: { placa: "JCD0J59" } };
  const renderer = TestRenderer.create(<ContactButton {...props} />);
  let anchor = renderer.root.findByProps({ "data-wa-source": "hero" });
  assert.match(new URL(anchor.props.href).searchParams.get("text") || "", /Black Friday/);
  state.active = false;
  act(() => renderer.update(<ContactButton {...props} />));
  anchor = renderer.root.findByProps({ "data-wa-source": "hero" });
  assert.ok(anchor.children.includes("Falar deste carro"));
  assert.equal(new URL(anchor.props.href).searchParams.get("text"), whatsappMessages.vehicleWhatsAppMessages("Tracker Premier", "Tracker Premier", props.waRef).info);
  assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /Black Friday/);
  renderer.unmount();
});

test("sold vehicles never receive a purchase campaign CTA or inquiry", () => {
  const { ContactButton, DetalheFloatingWhatsApp } = loadComponents(true);
  for (const Component of [ContactButton, DetalheFloatingWhatsApp]) {
    const html = renderToStaticMarkup(<Component modeloCompleto="Tracker Premier" vehicleLabel="Tracker Premier" vehicleId="20138" isSold price="R$ 100.000" visible />);
    assert.doesNotMatch(html, /Black Friday/);
    assert.match(html, /Ver opções parecidas/);
    assert.match(decodeURIComponent(html), /já foi vendido/);
  }
});

test("sticky contact restores the default label and normal message after rollback", () => {
  const { DetalheFloatingWhatsApp, state } = loadComponents(true);
  const props = { modeloCompleto: "Tracker Premier", vehicleLabel: "Tracker Premier", vehicleId: "20138", price: "R$ 100.000", visible: true };
  const renderer = TestRenderer.create(<DetalheFloatingWhatsApp {...props} />);
  assert.equal(renderer.root.findByType("a").props["data-card-label"], "Condições Black Friday");
  state.active = false;
  act(() => renderer.update(<DetalheFloatingWhatsApp {...props} />));
  const anchor = renderer.root.findByType("a");
  assert.equal(anchor.props["data-card-label"], undefined);
  assert.equal(new URL(anchor.props.href).searchParams.get("text"), whatsappMessages.vehicleWhatsAppMessages("Tracker Premier", "Tracker Premier").info);
  renderer.unmount();
});
