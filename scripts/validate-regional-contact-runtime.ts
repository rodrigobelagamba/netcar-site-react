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
import * as vehicleSearch from "../src/lib/vehicleSearch";
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

function createHarness(path: string, apiData: ApiData, routePath = pagePath) {
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
    "@/design-system/components/patterns/VehicleCard": {
      VehicleCard: "vehicle-card",
    },
    "@/lib/homeStock": { isAvailableHomeStockVehicle: () => true },
    "@/lib/showroomStock": {
      sortShowroomVehicles: (vehicles: unknown[]) => vehicles,
    },
    "@/lib/whatsappMessages": whatsappMessages,
    "@/lib/vehicleSearch": vehicleSearch,
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
      useLocation: () => ({ pathname: routePath }),
      useSearch: () => ({}),
      useRouterState: ({ select }: Props) =>
        select({ location: { pathname: routePath } }),
      useNavigate: () => () => {
        throw new Error("Navegação externa inesperada");
      },
    },
    "@/contexts/SearchContext": {
      useSearchContext: () => ({ searchTerm: "", setSearchTerm: () => {} }),
    },
    "@/lib/slug": { generateVehicleSlug: () => "veiculo-teste" },
    "@/hooks/useDefaultMetaTags": { useDefaultMetaTags: () => {} },
    "@/design-system/components/layout/LazyLocalizacao": {
      LazyLocalizacao: "location-preview",
    },
    "@/design-system/components/layout/IanBot": { IanBot: "ian-preview" },
    "@/components/QuickSellForm": { QuickSellForm: "quick-sell-form" },
    "@/lib/images": {
      optimizeStockImage: (url: string) => url,
      stockImageSrcSet: () => "",
    },
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
      window: { location: { pathname: routePath } },
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
      "Página consultada: Canoas",
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
    waText: "vi a página da Netcar para Canoas e estou procurando um seminovo.",
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
    waText: "vi a página da Netcar para Canoas e estou procurando um seminovo.",
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

// Compra regional mantém o visitante no estoque da cidade; consumidores sem
// âncora (hub e páginas de venda) continuam abrindo o catálogo com seus filtros.
const regionalCtas = ctas.render("RegionalActionCtas", {
  waText:
    "vi a página da Netcar para Sapucaia do Sul e estou procurando um seminovo.",
  primary: "stock",
  stockAnchor: "estoque-regional",
  stockLabel: "Ver carros e preços",
  sellCitySlug: "sapucaia-do-sul",
});
const stockAnchor = find(
  regionalCtas,
  (element) => element.props["data-regional-action"] === "view_stock",
);
assert.equal(stockAnchor.type, "a");
assert.equal(stockAnchor.props.href, "#estoque-regional");
assert.equal(stockAnchor.props.target, undefined);
assert.equal(stockAnchor.props.to, undefined);
assert.ok(text(stockAnchor).includes("Ver carros e preços"));
assert.equal(
  descendants(regionalCtas).filter(
    (element) => element.props["data-regional-action"],
  )[0],
  stockAnchor,
);
assert.equal(
  find(regionalCtas, (element) => element.props["data-regional-action"] === "sell_city")
    .props.params.citySlug,
  "sapucaia-do-sul",
);
const regionalWhatsApp = find(
  regionalCtas,
  (element) => element.props["data-regional-action"] === "whatsapp",
);
assert.match(
  assertWhatsApp(regionalWhatsApp.props.href, "5551997293118"),
  /vi a página da Netcar para Sapucaia do Sul/,
);
assert.equal(regionalWhatsApp.props["data-wa-intent"], "regional_help");

const filteredSearch = { ...emptySeminovosSearch, busca: "automático" };
for (const anchor of [undefined, "", "  "]) {
  const fallback = find(
    ctas.render("RegionalActionCtas", {
      waText: "quero ver o estoque.",
      stockAnchor: anchor,
      stockSearch: filteredSearch,
    }),
    (element) => element.props["data-regional-action"] === "view_stock",
  );
  assert.equal(fallback.type, "router-link");
  assert.equal(fallback.props.to, "/seminovos");
  assert.deepEqual(fallback.props.search, filteredSearch);
}

const previewHarness = createHarness(
  "src/modules/seo/components/RegionalStockPreview.tsx",
  undefined,
);
const preview = previewHarness.render("RegionalStockPreview", {
  id: "estoque-regional",
});
assert.equal(preview.type, "section");
assert.equal(preview.props.id, "estoque-regional");
assert.match(preview.props.className, /\bscroll-mt-28\b/);
assert.equal(
  find(preview, (element) => element.props["data-regional-action"] === "view_stock_more")
    .props.to,
  "/seminovos",
);
assert.equal(
  previewHarness.render("RegionalStockPreview").props.id,
  undefined,
  "Outros consumidores não devem ganhar IDs duplicados implicitamente",
);
const cityPageSource = readFileSync(
  new URL("../src/modules/seo/pages/CityLandingPage.tsx", import.meta.url),
  "utf8",
);
assert.match(cityPageSource, /<RegionalActionCtas[\s\S]*?stockAnchor="estoque-regional"/);
assert.match(cityPageSource, /<RegionalStockPreview\s+id="estoque-regional"/);
// O site sabe qual página foi consultada, não onde o visitante mora.
for (const sourcePath of [
  "../src/modules/seo/pages/CityLandingPage.tsx",
  "../src/modules/seo/pages/SellCityLandingPage.tsx",
  "../src/app/router/routes.tsx",
  "../scripts/generate-seo-assets.js",
]) {
  const source = readFileSync(new URL(sourcePath, import.meta.url), "utf8");
  assert.doesNotMatch(source, /moro em \$\{city(?:\.name|Name)\}/);
  assert.match(source, /vi a página da Netcar para \$\{city(?:\.name|Name)\}/);
}
assert.doesNotMatch(
  assertWhatsApp(regionalWhatsApp.props.href, "5551997293118"),
  /moro em|\([MGODSRU][A-Z0-9]+\)/i,
);
const generatedSeoSource = readFileSync(
  new URL("../scripts/generate-seo-assets.js", import.meta.url),
  "utf8",
);
assert.ok(
  generatedSeoSource.includes(
    '<a href="#estoque-regional" data-regional-action="view_stock">Ver carros e preços</a>',
  ),
  "O HTML rastreável deve preservar a mesma ação local do React",
);

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

// A escolha no formulário real também atualiza os três atalhos da página.
for (const route of ["/compra", "/compramos-seu-usado", "/vender-meu-carro"]) {
  const data = { numero: "51988887777" };
  const page = createHarness("src/modules/compra/pages/CompraPage.tsx", data, route);
  const form = createHarness("src/components/QuickSellForm.tsx", data, route);
  const renderPage = () => page.render("CompraPage");
  const renderForm = () =>
    form.render(
      "QuickSellForm",
      find(renderPage(), (element) => element.type === "quick-sell-form").props,
    );

  const checkLinks = (intent: Intent) => {
    const links = descendants(renderPage()).filter(
      (element) =>
        element.type === "a" && element.props["data-wa-source"] === "form",
    );
    assert.equal(links.length, 3, `${route}: atalhos de avaliação ausentes`);
    for (const link of links) {
      const message = assertWhatsApp(link.props.href, "5551988887777");
      if (intent === "trade_in") {
        assert.match(message, /avaliar meu carro para usar na troca/);
        assert.doesNotMatch(message, /vender meu carro/);
      } else {
        assert.match(message, /vender meu carro para a Netcar/);
        assert.doesNotMatch(message, /usar na troca/);
      }
    }
  };

  checkLinks("direct_purchase");
  for (const intent of ["trade_in", "direct_purchase"] as const) {
    find(
      renderForm(),
      (element) => element.type === "input" && element.props.value === intent,
    ).props.onChange();
    checkLinks(intent);
    assert.equal(
      text(renderForm()).includes("No máximo 6 anos de uso"),
      intent === "direct_purchase",
      `${route}: regras de compra direta não acompanharam a escolha`,
    );
  }
  assert.equal(form.opened.length, 0, "Mudar a intenção não deve abrir WhatsApp");
}

console.log(
  "Contato regional validado: 4 estados de API, compra/troca, intenção inicial, cabeçalho desktop/mobile, destinos dos CTAs, âncora de estoque com fallback e sincronia dos atalhos de /compra e aliases.",
);
