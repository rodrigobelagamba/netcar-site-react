#!/usr/bin/env tsx

/**
 * Executa os componentes reais e seus handlers, com hooks React em memória.
 * API, navegação, animação e analytics são isolados; nenhum browser, mensagem
 * ou request externo é aberto. URLs e mensagens usam os helpers de produção.
 * Este teste cobre contratos de interação, não layout ou validação nativa HTML.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";
import * as whatsappMessages from "../src/lib/whatsappMessages";
import { cn } from "../src/lib/cn";
import { emptySeminovosSearch } from "../src/lib/seminovos-search";

type Props = Record<string, any>;
type Element = React.ReactElement<Props>;
type ApiData = { numero: string } | undefined;
type Intent = "direct_purchase" | "trade_in";
const pagePath = "/vender-carro-canoas";

class InputTarget {
  name: string;
  value: string;
  constructor(props: Props) {
    this.name = props.name;
    this.value = props.value;
  }
}

function createHarness(path: string, apiData: ApiData) {
  const slots: any[] = [];
  let cursor = 0;
  const events: Array<{ stage: string; city: string; intent: Intent }> = [];
  const opened: Array<{ url: string; params: Props }> = [];
  const hooks = {
    ...React,
    useState(initial: unknown) {
      const index = cursor++;
      if (!(index in slots)) {
        slots[index] = typeof initial === "function" ? initial() : initial;
      }
      return [
        slots[index],
        (next: any) => {
          slots[index] = typeof next === "function" ? next(slots[index]) : next;
        },
      ];
    },
    useRef(initial: unknown) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useMemo: (calculate: () => unknown) => calculate(),
    useEffect: () => {},
  };
  const dependencies: Record<string, unknown> = {
    react: hooks,
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": new Proxy({}, { get: () => "svg" }),
    "@/design-system/components/utils/StaticMotion": {
      motion: { form: "form" },
    },
    "@/catalog/queries/useSiteQuery": {
      useWhatsAppQuery: () => ({ data: apiData }),
    },
    "@/catalog/queries/useVehiclesQuery": {
      useVehiclesQuery: () => ({ data: [] }),
    },
    "@/lib/whatsappMessages": whatsappMessages,
    "@/lib/analytics": {
      trackSellEvaluation: (stage: string, city: string, intent: Intent) =>
        events.push({ stage, city, intent }),
      openWhatsApp: (url: string, params: Props) =>
        opened.push({ url, params }),
    },
    "@/lib/cn": { cn },
    "@/lib/seminovos-search": { emptySeminovosSearch },
    "@tanstack/react-router": {
      Link: "router-link",
      useLocation: () => ({ pathname: pagePath }),
      useNavigate: () => () => {
        throw new Error("Navegação externa inesperada");
      },
    },
    "@/contexts/SearchContext": {
      useSearchContext: () => ({ searchTerm: "", setSearchTerm: () => {} }),
    },
    "@/features/september-campaign/CampaignProvider": {
      useSeptemberCampaignActive: () => false,
    },
    "@/lib/slug": { generateVehicleSlug: () => "veiculo-teste" },
    "@/assets/images/logo-netcar.png": "logo-test.png",
  };
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    fileName: path,
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const module = { exports: {} as Record<string, (props: Props) => Element> };
  runInNewContext(
    outputText,
    {
      module,
      exports: module.exports,
      require: (name: string) => {
        assert.ok(name in dependencies, `Dependência sem isolamento: ${name}`);
        return dependencies[name];
      },
      HTMLInputElement: InputTarget,
      window: { location: { pathname: pagePath } },
    },
    { filename: path },
  );

  return {
    events,
    opened,
    setApi(data: ApiData) {
      apiData = data;
    },
    render(name: string, props: Props = {}) {
      cursor = 0;
      return module.exports[name](props);
    },
  };
}

function descendants(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!React.isValidElement<Props>(node)) return [];
  const children =
    typeof node.type === "function"
      ? (node.type as (props: Props) => React.ReactNode)(node.props)
      : node.props.children;
  return [node, ...descendants(children)];
}

function find(
  node: React.ReactNode,
  predicate: (element: Element) => boolean,
): Element {
  const result = descendants(node).find(predicate);
  assert.ok(result, "Elemento esperado não foi renderizado");
  return result;
}

function text(node: React.ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join(" ");
  if (!React.isValidElement<Props>(node))
    return typeof node === "string" ? node : "";
  return text(
    typeof node.type === "function"
      ? (node.type as (props: Props) => React.ReactNode)(node.props)
      : node.props.children,
  );
}

function assertWhatsApp(url: string, number: string): string {
  const parsed = new URL(url);
  assert.equal(parsed.origin, "https://wa.me");
  assert.equal(parsed.pathname, `/${number}`);
  const message = parsed.searchParams.get("text") ?? "";
  assert.ok(message.startsWith(whatsappMessages.SITE_WHATSAPP_PREFIX));
  return message;
}

const cases: Array<{ label: string; data: ApiData; number: string }> = [
  { label: "API ausente", data: undefined, number: "5551997293118" },
  { label: "API vazia", data: { numero: "" }, number: "5551997293118" },
  {
    label: "API whitespace",
    data: { numero: " \t\n " },
    number: "5551997293118",
  },
  {
    label: "API válida",
    data: { numero: " (51) 98888-7777 " },
    number: "5551988887777",
  },
];

for (const fixture of cases) {
  for (const intent of ["direct_purchase", "trade_in"] as const) {
    const harness = createHarness(
      "src/components/QuickSellForm.tsx",
      fixture.data,
    );
    const render = () =>
      harness.render("QuickSellForm", { cityName: "Canoas" });
    let form = render();
    const radio = find(
      form,
      (element) => element.type === "input" && element.props.value === intent,
    );
    // No browser, focus capture precede o onChange do rádio.
    form.props.onFocusCapture({ target: new InputTarget(radio.props) });
    if (intent === "trade_in") radio.props.onChange();
    assert.deepEqual(
      harness.events,
      [{ stage: "start", city: "Canoas", intent }],
      `${fixture.label}: primeiro foco registrou a intenção errada`,
    );
    form = render();
    assert.equal(
      text(form).includes("No máximo 6 anos de uso"),
      intent === "direct_purchase",
    );
    if (intent === "trade_in")
      assert.ok(
        text(form).includes("histórico da compra direta não se aplicam"),
      );

    for (const [name, value] of [
      ["vehicle-model", "Onix LT"],
      ["vehicle-year", "2021"],
      ["vehicle-mileage", "45.000"],
    ]) {
      const input = find(form, (element) => element.props.name === name);
      form.props.onFocusCapture({ target: new InputTarget(input.props) });
      input.props.onChange({ target: { value } });
      form = render();
    }
    assert.equal(
      harness.events.length,
      1,
      "start duplicado ao preencher o formulário",
    );
    let prevented = false;
    form.props.onSubmit({
      preventDefault: () => {
        prevented = true;
      },
    });
    assert.ok(prevented);
    assert.deepEqual(harness.events[1], {
      stage: "completed",
      city: "Canoas",
      intent,
    });
    assert.equal(harness.opened.length, 1);
    const message = assertWhatsApp(harness.opened[0].url, fixture.number);
    for (const detail of [
      "Modelo: Onix LT",
      "Ano: 2021",
      "KM: 45.000",
      "Cidade: Canoas",
    ]) {
      assert.ok(message.includes(detail), `Mensagem perdeu ${detail}`);
    }
    assert.ok(
      message.includes(
        intent === "trade_in"
          ? "Negociação: Usar na troca"
          : "Negociação: Venda direta à Netcar",
      ),
    );
    assert.equal(harness.opened[0].params.source, "form");
    assert.equal(harness.opened[0].params.intent, "sell_evaluation");
    assert.equal(harness.opened[0].params.pagePath, pagePath);
  }

  const ctas = createHarness(
    "src/modules/seo/components/RegionalActionCtas.tsx",
    fixture.data,
  );
  const defaultCtas = ctas.render("RegionalActionCtas", {
    waText: "moro em Canoas.",
  });
  const wa = find(
    defaultCtas,
    (element) => element.props["data-regional-action"] === "whatsapp",
  );
  assertWhatsApp(wa.props.href, fixture.number);
  assert.equal(wa.props["data-wa-source"], "landing");
  assert.equal(wa.props["data-wa-intent"], "regional_help");
  assert.equal(wa.props.target, "_blank");
  assert.equal(
    find(
      defaultCtas,
      (element) => element.props["data-regional-action"] === "sell_evaluation",
    ).props.to,
    "/compra",
  );
  const stock = find(
    defaultCtas,
    (element) => element.props["data-regional-action"] === "view_stock",
  );
  assert.equal(stock.props.to, "/seminovos");
  assert.deepEqual(stock.props.search, emptySeminovosSearch);

  const header = createHarness(
    "src/design-system/components/layout/Header.tsx",
    fixture.data,
  );
  let tree = header.render("Header");
  const desktop = find(
    tree,
    (element) => element.props["data-wa-intent"] === "header_contact",
  );
  assertWhatsApp(desktop.props.href, fixture.number);
  assert.equal(desktop.props["data-wa-source"], "header");
  assert.match(desktop.props["aria-label"], /^\(51\) 9\d{4}-\d{4}$/);
  find(
    tree,
    (element) => element.props["aria-label"] === "Abrir menu",
  ).props.onClick();
  tree = header.render("Header");
  const mobile = find(
    tree,
    (element) => element.props["data-wa-intent"] === "mobile_menu_contact",
  );
  assertWhatsApp(mobile.props.href, fixture.number);
  assert.equal(mobile.props["data-wa-source"], "header");
  mobile.props.onClick();
  assert.ok(
    !descendants(header.render("Header")).some(
      (element) => element.props["data-wa-intent"] === "mobile_menu_contact",
    ),
    "Contato não fechou o menu móvel",
  );
}

const ctas = createHarness(
  "src/modules/seo/components/RegionalActionCtas.tsx",
  undefined,
);
for (const [props, target, action] of [
  [
    { sellTo: "/compramos-seu-usado" },
    "/compramos-seu-usado",
    "sell_evaluation",
  ],
  [{ sellCitySlug: "canoas" }, "/vender-carro-{$citySlug}", "sell_city"],
  [
    { sellAnchor: "pre-avaliacao", sellCitySlug: "canoas", sellTo: "/compra" },
    "#pre-avaliacao",
    "sell_evaluation",
  ],
] as const) {
  const tree = ctas.render("RegionalActionCtas", {
    waText: "moro em Canoas.",
    primary: "sell",
    ...props,
  });
  const links = descendants(tree).filter(
    (element) => element.props["data-regional-action"],
  );
  const first = links[0];
  assert.equal(first.props["data-regional-action"], action);
  assert.equal(first.props.href ?? first.props.to, target);
  if (action === "sell_city")
    assert.equal(first.props.params.citySlug, "canoas");
}

// Plataformas que emitem change sem foco ainda devem registrar troca corretamente.
const noFocus = createHarness("src/components/QuickSellForm.tsx", undefined);
const tradeRadio = find(
  noFocus.render("QuickSellForm", { cityName: "Canoas" }),
  (element) => element.type === "input" && element.props.value === "trade_in",
);
tradeRadio.props.onChange();
assert.deepEqual(noFocus.events, [
  { stage: "start", city: "Canoas", intent: "trade_in" },
]);

// Recuperação da API mantém a intenção e atualiza o destinatário sem remontar.
noFocus.setApi({ numero: "51988887777" });
noFocus
  .render("QuickSellForm", { cityName: "Canoas" })
  .props.onSubmit({ preventDefault() {} });
assertWhatsApp(noFocus.opened[0].url, "5551988887777");
assert.equal(noFocus.events[1].intent, "trade_in");

console.log(
  "Contato regional validado: 4 estados de API, compra/troca, intenção inicial, cabeçalho desktop/mobile e destinos dos CTAs.",
);
