import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import TestRenderer, { act } from "react-test-renderer";
import * as icons from "lucide-react";
import { parse as parseCss } from "postcss";
import ts from "typescript";
import type { Vehicle } from "../../src/catalog/endpoints/vehicles";
import {
  comparisonVehicleLabel,
  comparisonWhatsAppMessage,
} from "../../src/lib/comparisonContact";
import { resolvedVehicleCategory } from "../../src/lib/vehicleCategory";
import {
  extractVehicleIdFromSlug,
  generateVehicleSlug,
} from "../../src/lib/slug";
import { buildWhatsAppUrl } from "../../src/lib/whatsappMessages";
import { ComparisonVehicleImage } from "../../src/modules/seo/components/ComparisonVehicleImage";

type TableModule =
  typeof import("../../src/modules/seo/components/VehicleComparisonTable");
type TableProps = React.ComponentProps<TableModule["VehicleComparisonTable"]>;
type TrackedEvent = {
  action: string;
  vehicleIds: string[];
  vehicleNames: string[];
};

const first: Vehicle = {
  id: "19801",
  name: "Honda HR-V EX",
  marca: "Honda",
  modelo: "HR-V EX",
  slug: "hr-v-ex-2022-19801",
  year: 2022,
  price: 129_900,
  km: 12_345,
  preco_com_troca: 139_900,
  images: ["/images/first.jpg"],
  cambio: "Automático",
  motor: "1.8",
  combustivel: "Flex",
  potencia: "140 cv",
  portas: 4,
  cor: "Branco",
  categoria: "SUV",
  placa: "ABC1D23",
};
const second: Vehicle = {
  ...first,
  id: "19802",
  slug: "hr-v-ex-2022-19802",
  price: 119_900,
  images: ["/images/second.jpg"],
  cor: "Preto",
  placa: "DEF4G56",
};

const { outputText } = ts.transpileModule(
  readFileSync(
    new URL(
      "../../src/modules/seo/components/VehicleComparisonTable.tsx",
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

// Exercise the real component and React state with only navigation and tracking
// isolated. Images, contact messages, categories and slugs use production helpers.
function loadTable() {
  const events: TrackedEvent[] = [];
  const dependencies: Record<string, unknown> = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": icons,
    "@tanstack/react-router": {
      Link: ({
        to,
        params,
        children,
        ...rest
      }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
        to: string;
        params?: { slug: string };
      }) => (
        <a href={to.replace("$slug", params?.slug || "")} {...rest}>
          {children}
        </a>
      ),
    },
    "@/lib/analytics": {
      trackCompareInteraction: (event: TrackedEvent) => events.push(event),
    },
    "@/lib/comparisonContact": {
      comparisonVehicleLabel,
      comparisonWhatsAppMessage,
    },
    "@/lib/vehicleCategory": { resolvedVehicleCategory },
    "@/lib/slug": { generateVehicleSlug },
    "@/lib/whatsappMessages": { buildWhatsAppUrl },
    "./ComparisonVehicleImage": { ComparisonVehicleImage },
  };
  const exports: Record<string, unknown> = {};
  runInNewContext(outputText, {
    exports,
    require: (name: string) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return { ...(exports as TableModule), events };
}

const defaultProps: TableProps = {
  vehicles: [first, second],
  onAdd: () => {},
  onRemove: () => {},
  whatsAppNumber: " (51) 98888-7777 ",
};

function renderTable(props: Partial<TableProps> = {}) {
  const { VehicleComparisonTable } = loadTable();
  return renderToStaticMarkup(
    <VehicleComparisonTable {...defaultProps} {...props} />,
  );
}

function mountTable(props: Partial<TableProps> = {}) {
  const { VehicleComparisonTable, events } = loadTable();
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <VehicleComparisonTable {...defaultProps} {...props} />,
    );
  });
  return { renderer: renderer!, events };
}

function attribute(tag: string, name: string) {
  return tag
    .match(new RegExp(`\\b${name}="([^"]*)"`, "i"))?.[1]
    .replaceAll("&amp;", "&");
}

function anchors(html: string) {
  return [...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].map(
    (match) => match[0],
  );
}

function rowLabels(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root
    .findAllByType("th")
    .filter((header) => header.props.scope === "row")
    .map((header) => header.children[0]);
}

test("value comparisons ignore case, accents and outer whitespace", () => {
  const { comparisonValuesDiffer } = loadTable();
  assert.equal(comparisonValuesDiffer([]), false);
  assert.equal(comparisonValuesDiffer(["Automático"]), false);
  assert.equal(comparisonValuesDiffer([" Automático ", "AUTOMATICO"]), false);
  assert.equal(comparisonValuesDiffer(["Branco", "Preto"]), true);
  assert.equal(comparisonValuesDiffer(["—", "Flex"]), true);
});

test("prices strip API markup and technical rows preserve announced data", () => {
  const { comparisonPrice, comparisonRows } = loadTable();
  assert.equal(
    comparisonPrice({
      ...first,
      valor_formatado: "<span>R$</span> 129.900,00",
    }),
    "R$ 129.900,00",
  );
  assert.equal(comparisonPrice(first), "R$ 129.900");
  assert.equal(comparisonPrice({ ...first, price: 0 }), "—");
  assert.deepEqual(
    Array.from(comparisonRows, (row) => row.label),
    [
      "Ano",
      "Câmbio",
      "Motor",
      "Combustível",
      "Potência",
      "Portas",
      "Cor",
      "Categoria",
    ],
  );
  assert.deepEqual(
    Array.from(comparisonRows, (row) => row.get(first)),
    ["2022", "Automático", "1.8", "Flex", "140 cv", "4", "Branco", "SUV"],
  );
  for (const row of comparisonRows) assert.equal(row.get({} as Vehicle), "—");
  assert.equal(
    comparisonRows
      .find((row) => row.label === "Categoria")!
      .get({
        ...first,
        marca: "Nissan",
        modelo: "Kicks",
        categoria: "HATCH",
      }),
    "SUV",
  );
});

test("SSR renders one photo per unit with table headers and no mileage or trade row", () => {
  const html = renderTable();
  const images = [...html.matchAll(/<img\b[^>]*>/g)].map((match) => match[0]);
  assert.equal(images.length, 2);
  for (const [index, image] of images.entries()) {
    const src = new URL(attribute(image, "src")!);
    assert.equal(
      src.searchParams.get("src"),
      ["/images/first.jpg", "/images/second.jpg"][index],
    );
    assert.equal(
      attribute(image, "alt"),
      "Honda HR-V EX 2022 — foto do veículo",
    );
  }
  assert.equal([...html.matchAll(/<th\b[^>]*scope="col"/g)].length, 3);
  assert.equal([...html.matchAll(/<th\b[^>]*scope="row"/g)].length, 9);
  assert.match(html, /<caption\b/);
  assert.match(html, /tabindex="0" role="region"/);
  assert.match(html, /Cód\. 19801/);
  assert.match(html, /Cód\. 19802/);
  assert.doesNotMatch(
    html,
    /quilometragem|\bkm\b|preço com troca|12345|12\.345|139\.900/i,
  );
  assert.equal([...html.matchAll(/Menor preço desta seleção/g)].length, 1);
});

test("identical models retain distinct detail links, unit contacts and comparison intent", () => {
  const links = anchors(renderTable());
  const details = links.filter(
    (link) => attribute(link, "class") === "comparison-detail-link",
  );
  const inquiries = links.filter(
    (link) => attribute(link, "data-wa-intent") === "vehicle_inquiry",
  );
  assert.equal(details.length, 2);
  assert.equal(inquiries.length, 2);
  for (const [index, vehicle] of [first, second].entries()) {
    assert.equal(
      extractVehicleIdFromSlug(attribute(details[index], "href")!),
      vehicle.id,
    );
    const link = inquiries[index];
    assert.equal(attribute(link, "data-wa-source"), "comparison");
    assert.equal(attribute(link, "data-wa-vehicle-id"), vehicle.id);
    assert.equal(
      attribute(link, "data-wa-vehicle-name"),
      comparisonVehicleLabel(vehicle),
    );
    assert.equal(attribute(link, "target"), "_blank");
    assert.equal(attribute(link, "rel"), "noopener noreferrer");
    const url = new URL(attribute(link, "href")!);
    assert.equal(url.pathname, "/5551988887777");
    const message = url.searchParams.get("text")!;
    assert.match(message, new RegExp(`Código: ${vehicle.id}`));
    assert.ok(message.includes(`/veiculo/${generateVehicleSlug(vehicle)}`));
    assert.ok(!message.includes(vehicle.placa!));
    assert.ok(!message.includes([second, first][index].id));
  }
  const help = links.find(
    (link) => attribute(link, "data-wa-intent") === "comparison_help",
  )!;
  assert.equal(attribute(help, "data-wa-source"), "comparison");
  const message = new URL(attribute(help, "href")!).searchParams.get("text")!;
  for (const vehicle of [first, second])
    assert.ok(message.includes(`Código: ${vehicle.id}`));
});

test("difference checkbox filters technical rows without hiding photos, prices or actions", (t) => {
  const { renderer } = mountTable();
  t.after(() => act(() => renderer.unmount()));
  const checkbox = () => renderer.root.findByType("input");
  assert.equal(checkbox().props.checked, false);
  assert.equal(rowLabels(renderer).length, 9);
  act(() => checkbox().props.onChange({ target: { checked: true } }));
  assert.equal(checkbox().props.checked, true);
  assert.deepEqual(rowLabels(renderer), ["Cor", "Saiba mais"]);
  assert.equal(renderer.root.findAllByType("img").length, 2);
  assert.equal(
    renderer.root.findAllByProps({ className: "comparison-vehicle__price" })
      .length,
    2,
  );
  assert.equal(
    renderer.root.findAllByProps({ "data-wa-intent": "vehicle_inquiry" })
      .length,
    2,
  );
  act(() => checkbox().props.onChange({ target: { checked: false } }));
  assert.equal(rowLabels(renderer).length, 9);
});

test("equal technical data explains the empty differences view and retains each unit", (t) => {
  const { renderer } = mountTable({
    vehicles: [first, { ...second, cor: first.cor }],
  });
  t.after(() => act(() => renderer.unmount()));
  act(() =>
    renderer.root
      .findByType("input")
      .props.onChange({ target: { checked: true } }),
  );
  assert.deepEqual(rowLabels(renderer), ["Saiba mais"]);
  const message = renderer.root.findByProps({
    className: "comparison-identical",
  });
  assert.equal(message.props.colSpan, 3);
  assert.match(message.children.join(""), /dados desta ficha são iguais/);
  assert.equal(renderer.root.findAllByType("img").length, 2);
});

test("remove and contact actions preserve the clicked unit identifier", (t) => {
  const removed: string[] = [];
  const { renderer, events } = mountTable({
    onRemove: (id) => removed.push(id),
  });
  t.after(() => act(() => renderer.unmount()));
  const removeButtons = renderer.root
    .findAllByType("button")
    .filter((button) => button.props["aria-label"]?.startsWith("Remover "));
  act(() => removeButtons[1].props.onClick());
  assert.deepEqual(removed, [second.id]);
  const details = renderer.root
    .findAllByType("a")
    .filter((link) => link.props.className === "comparison-detail-link");
  const inquiries = renderer.root.findAllByProps({
    "data-wa-intent": "vehicle_inquiry",
  });
  act(() => details[1].props.onClick());
  act(() => inquiries[0].props.onClick());
  act(() =>
    renderer.root
      .findByProps({ "data-wa-intent": "comparison_help" })
      .props.onClick(),
  );
  assert.deepEqual(
    events.map((event) => [event.action, event.vehicleIds.join(",")]),
    [
      ["view_details", second.id],
      ["whatsapp", first.id],
      ["whatsapp", `${first.id},${second.id}`],
    ],
  );
});

test("one selected unit offers the next selection and unavailable WhatsApp falls back to contact", (t) => {
  let added = 0;
  const { renderer } = mountTable({ vehicles: [first], onAdd: () => added++ });
  t.after(() => act(() => renderer.unmount()));
  assert.equal(renderer.root.findAllByType("input").length, 0);
  assert.equal(renderer.root.findAllByType("img").length, 1);
  assert.equal(
    renderer.root.findByType("table").props.style["--comparison-columns"],
    2,
  );
  const add = renderer.root
    .findByProps({ className: "comparison-empty" })
    .findByType("button");
  act(() => add.props.onClick());
  assert.equal(added, 1);
  const html = renderTable({ whatsAppNumber: undefined });
  assert.doesNotMatch(html, /wa\.me|data-wa-intent/);
  assert.match(html, /href="\/contato"/);
});

test("four vehicles keep individual columns with local scrolling and a sticky label column", () => {
  const vehicles = [
    first,
    second,
    { ...first, id: "19803" },
    { ...second, id: "19804" },
  ];
  const html = renderTable({ vehicles });
  assert.match(html, /--comparison-columns:4/);
  assert.equal([...html.matchAll(/<img\b/g)].length, 4);
  assert.equal([...html.matchAll(/<th\b[^>]*scope="col"/g)].length, 5);
  const css = readFileSync(
    new URL("../../src/modules/seo/pages/comparador.css", import.meta.url),
    "utf8",
  );
  assert.match(css, /\.comparison-scroll\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(
    css,
    /\.comparison-label-cell\s*\{[^}]*position:\s*sticky;[^}]*left:\s*0/,
  );
  const minimumWidths = [
    ...css.matchAll(
      /min-width:\s*calc\(\s*(\d+)px\s*\+\s*var\(--comparison-columns\)\s*\*\s*(\d+)px\s*\)/g,
    ),
  ];
  assert.ok(
    minimumWidths.length >= 2,
    "desktop and mobile need per-vehicle minimum widths",
  );
  for (const [, labelWidth, vehicleWidth] of minimumWidths) {
    assert.ok(Number(labelWidth) >= 64);
    assert.ok(Number(vehicleWidth) >= 160);
    assert.ok(Number(labelWidth) + 4 * Number(vehicleWidth) > 640);
  }
  assert.match(css, /@media\s*\(max-width:\s*639px\)/);
});

test("responsive column state and each photo stay attached to the matching unit", (t) => {
  const available = [
    first,
    second,
    { ...first, id: "19803" },
    { ...second, id: "19804" },
  ];
  for (const count of [1, 2, 3, 4]) {
    const selected = available.slice(0, count);
    const { renderer } = mountTable({ vehicles: selected });
    t.after(() => act(() => renderer.unmount()));
    const table = renderer.root.findByType("table");
    assert.equal(table.props["data-columns"], Math.max(2, count));
    assert.equal(
      table.props.style["--comparison-columns"],
      table.props["data-columns"],
    );
    assert.equal(table.findAllByType("col").length, Math.max(2, count) + 1);

    const headers = renderer.root.findAllByProps({
      className: "comparison-vehicle",
    });
    assert.equal(headers.length, count);
    for (const [index, header] of headers.entries()) {
      const unit = selected[index];
      const body = header.findByProps({
        className: "comparison-vehicle__body",
      });
      const image = body.findByType("img");
      assert.match(image.props.className, /\bobject-contain\b/);
      assert.equal(
        new URL(image.props.src).searchParams.get("src"),
        unit.images[0],
      );
      const info = body.findByProps({
        className: "comparison-vehicle__info",
      });
      assert.match(
        info
          .findByProps({ className: "comparison-vehicle__year" })
          .children.join(""),
        new RegExp(`Cód\\. ${unit.id}`),
      );
      const details = info.findByType("a");
      assert.equal(extractVehicleIdFromSlug(details.props.href), unit.id);
      assert.equal(header.findAllByType("button").length, 1);
    }

    const actions = renderer.root.findAllByProps({
      className: "comparison-vehicle__actions",
    });
    assert.equal(actions.length, count);
    for (const [index, group] of actions.entries()) {
      assert.equal(group.findAllByType("a").length, 2);
      assert.equal(
        group.findByProps({ "data-wa-intent": "vehicle_inquiry" }).props[
          "data-wa-vehicle-id"
        ],
        selected[index].id,
      );
    }
  }
});

test("horizontal photo and identity layout is scoped to wide two-column tables", () => {
  const css = parseCss(
    readFileSync(
      new URL("../../src/modules/seo/pages/comparador.css", import.meta.url),
      "utf8",
    ),
  );
  let horizontalLayouts = 0;
  let responsiveActionGroups = 0;
  css.walkRules((rule) => {
    if (
      rule.selector.includes(".comparison-vehicle__body") &&
      rule.nodes.some(
        (node) =>
          node.type === "decl" &&
          node.prop === "display" &&
          node.value === "grid",
      )
    ) {
      horizontalLayouts += 1;
      assert.match(rule.selector, /\.comparison-table\[data-columns="2"\]/);
      assert.equal(rule.parent?.type, "atrule");
      const media = rule.parent as import("postcss").AtRule;
      assert.equal(media.name, "media");
      const breakpoint = media.params.match(/min-width:\s*(\d+)px/);
      assert.ok(
        breakpoint,
        "horizontal headers must have a wide-screen breakpoint",
      );
      assert.ok(Number(breakpoint[1]) >= 1024);
      const properties = new Map(
        rule.nodes
          .filter(
            (node): node is import("postcss").Declaration =>
              node.type === "decl",
          )
          .map((declaration) => [declaration.prop, declaration.value]),
      );
      assert.equal(properties.get("display"), "grid");
      assert.equal(
        [...properties.get("grid-template-columns")!.matchAll(/minmax\(/g)]
          .length,
        2,
      );
    }
    if (
      rule.selector === ".comparison-vehicle__actions" &&
      rule.parent?.type === "atrule"
    ) {
      const media = rule.parent as import("postcss").AtRule;
      if (/max-width/.test(media.params)) {
        responsiveActionGroups += 1;
        assert.ok(
          rule.nodes.some(
            (node) =>
              node.type === "decl" &&
              node.prop === "flex-direction" &&
              node.value === "column",
          ),
          "narrow columns must stack their two contact actions",
        );
      }
    }
  });
  assert.ok(horizontalLayouts > 0);
  assert.ok(responsiveActionGroups > 0);
});

test("lowest-price badge appears only when the selection has different prices", () => {
  assert.doesNotMatch(
    renderTable({ vehicles: [first] }),
    /Menor preço desta seleção/,
  );
  assert.doesNotMatch(
    renderTable({ vehicles: [first, { ...second, price: first.price }] }),
    /Menor preço desta seleção/,
  );
  const html = renderTable();
  assert.equal([...html.matchAll(/Menor preço desta seleção/g)].length, 1);
  // Empty, hidden slots align the prices without showing a badge on other units.
  assert.match(html, /<p class="comparison-vehicle__price-note"><\/p>/);
  assert.doesNotMatch(html, /Preço anunciado/);
});
