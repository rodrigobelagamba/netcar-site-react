import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { renderToStaticMarkup } from "react-dom/server";
import { VehicleDescription } from "../../src/modules/detalhes/components/VehicleDescription";
import type { ParsedGptContent } from "../../src/lib/parseGptContent";

const content: ParsedGptContent = {
  apresentacao: (
    <>
      O <strong>KICKS SENSE</strong> mantém o texto do cadastro.
    </>
  ),
  accordions: [
    {
      title: "Diferenciais do modelo",
      content: {
        introducao: "Equipamentos informados:",
        itens: [{ label: "Motor", texto: "Conteúdo original sem reescrita." }],
      },
    },
    { title: "Conforto", content: "Última seção do anúncio original." },
  ],
};

test("description shows a three-line beginning before expanding", () => {
  const html = renderToStaticMarkup(<VehicleDescription content={content} />);
  assert.match(html, /Descrição do veículo/);
  assert.match(
    html,
    /<p class="line-clamp-3[^"]*">O <strong>KICKS SENSE<\/strong>/,
  );
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /Ler mais/);
  assert.match(html, /min-h-11/);
  assert.match(html, /focus-visible:outline/);
  assert.match(html, /<div hidden="" class="hidden">/);
});

test("expand and collapse preserve the complete announcement and accessible state", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<VehicleDescription content={content} />);
  });
  const button = () => renderer!.root.findByType("button");
  const controlled = () =>
    renderer!.root.findByProps({ id: button().props["aria-controls"] });

  assert.equal(button().props["aria-expanded"], false);
  assert.equal(
    controlled().findByType("div").props.id,
    button().props["aria-controls"],
  );
  act(() => button().props.onClick());
  assert.equal(button().props["aria-expanded"], true);
  assert.equal(button().children[0], "Ler menos");
  assert.equal(controlled().children[0].props.hidden, true);
  assert.equal(controlled().children[1].props.hidden, false);
  assert.deepEqual(
    renderer!.root.findAllByType("h4").map((h) => h.children[0]),
    ["Diferenciais do modelo", "Conforto"],
  );
  assert.equal(
    renderer!.root.findByType("li").children.at(-1),
    "Conteúdo original sem reescrita.",
  );

  act(() => button().props.onClick());
  assert.equal(button().props["aria-expanded"], false);
  assert.equal(controlled().children[0].props.hidden, false);
  assert.equal(controlled().children[1].props.hidden, true);
  act(() => renderer!.unmount());
});

test("description without presentation previews the first section text", () => {
  const html = renderToStaticMarkup(
    <VehicleDescription
      content={{
        accordions: [
          { title: "Detalhes", content: "Começo informado no cadastro." },
        ],
      }}
    />,
  );
  assert.match(html, /line-clamp-3[^"]*">Começo informado no cadastro\./);
});

test("description previews list introduction or original list items when needed", () => {
  const withIntro = renderToStaticMarkup(
    <VehicleDescription content={{ accordions: [content.accordions[0]] }} />,
  );
  assert.match(withIntro, /line-clamp-3[^"]*">Equipamentos informados:/);
  const withItems = renderToStaticMarkup(
    <VehicleDescription
      content={{
        accordions: [
          {
            title: "Detalhes",
            content: {
              itens: [{ label: "Motor", texto: "Texto do cadastro." }],
            },
          },
        ],
      }}
    />,
  );
  assert.match(
    withItems,
    /line-clamp-3[^"]*"><strong>Motor <\/strong>Texto do cadastro\./,
  );
});

test("empty parsed description does not render an empty section", () => {
  assert.equal(
    renderToStaticMarkup(<VehicleDescription content={{ accordions: [] }} />),
    "",
  );
});

test("navigating to a different vehicle starts with the compact preview", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <VehicleDescription key="19857" content={content} />,
    );
  });
  act(() => renderer!.root.findByType("button").props.onClick());
  assert.equal(
    renderer!.root.findByType("button").props["aria-expanded"],
    true,
  );
  act(() =>
    renderer!.update(<VehicleDescription key="19299" content={content} />),
  );
  assert.equal(
    renderer!.root.findByType("button").props["aria-expanded"],
    false,
  );
  act(() => renderer!.unmount());
});
