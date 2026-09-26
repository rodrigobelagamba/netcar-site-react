import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VehicleWhatsAppCard } from "../../src/design-system/components/patterns/VehicleWhatsAppCard";

const vehicle = {
  id: "19857",
  label: "NISSAN KICKS SENSE TURBO 2026 AUTOMÁTICO BRANCO",
  priceLabel: "R$ 147.900,00",
  image: "/images/kicks.webp",
};
const href = "https://wa.me/5551997293118?text=Quero%20este%20carro";
const tradeHref = "https://wa.me/5551997293118?text=Quero%20avaliar%20a%20troca";

function renderCard(
  props: Partial<React.ComponentProps<typeof VehicleWhatsAppCard>> = {},
) {
  return renderToStaticMarkup(
    <VehicleWhatsAppCard
      vehicle={vehicle}
      href={href}
      source="detalhe_sticky"
      {...props}
    />,
  );
}

function anchors(html: string) {
  return [...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].map(
    (match) => match[0],
  );
}

function attribute(tag: string, name: string) {
  const value = tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
  assert.notEqual(value, undefined, `missing ${name}`);
  return value!;
}

function classes(tag: string) {
  return new Set(attribute(tag, "class").split(/\s+/));
}

test("single inquiry preserves the vehicle link and attribution", () => {
  const html = renderCard();
  const links = anchors(html);
  assert.equal(links.length, 1);
  assert.equal(attribute(links[0], "href"), href);
  assert.equal(attribute(links[0], "target"), "_blank");
  assert.equal(attribute(links[0], "rel"), "noopener noreferrer");
  assert.equal(attribute(links[0], "data-wa-source"), "detalhe_sticky");
  assert.equal(attribute(links[0], "data-wa-intent"), "vehicle_inquiry");
  assert.equal(attribute(links[0], "data-wa-vehicle-id"), vehicle.id);
  assert.equal(attribute(links[0], "data-wa-vehicle-name"), vehicle.label);
  assert.match(links[0], /<span>Falar deste carro<\/span>/);
  assert.match(html, /grid-cols-1/);
  assert.doesNotMatch(html, /data-wa-intent="trade_in"/);
});

test("trade action preserves its independent URL, source and intent", () => {
  const links = anchors(
    renderCard({ tradeHref, tradeSource: "detalhe_sticky_trade" }),
  );
  assert.equal(links.length, 2);
  for (const link of links) {
    assert.equal(attribute(link, "target"), "_blank");
    assert.equal(attribute(link, "rel"), "noopener noreferrer");
    assert.equal(attribute(link, "data-wa-vehicle-id"), vehicle.id);
    assert.equal(attribute(link, "data-wa-vehicle-name"), vehicle.label);
  }
  assert.equal(attribute(links[0], "href"), href);
  assert.equal(attribute(links[0], "data-wa-source"), "detalhe_sticky");
  assert.equal(attribute(links[0], "data-wa-intent"), "vehicle_inquiry");
  assert.equal(attribute(links[1], "href"), tradeHref);
  assert.equal(attribute(links[1], "data-wa-source"), "detalhe_sticky_trade");
  assert.equal(attribute(links[1], "data-wa-intent"), "trade_in");
});

test("optional trade source derives from the caller source", () => {
  const links = anchors(renderCard({ tradeHref, source: "preview_vehicle" }));
  assert.equal(attribute(links[1], "data-wa-source"), "preview_vehicle_trade");
});

test("custom labels and full vehicle context remain accessible", () => {
  const html = renderCard({
    tradeHref,
    eyebrow: "Este carro",
    ctaLabel: "Conversar sobre este carro",
    tradeCtaLabel: "Avaliar troca",
    className: "test-contact-card",
  });
  assert(classes(html).has("test-contact-card"));
  assert.match(html, /<p class="sr-only">Este carro<\/p>/);
  assert.match(html, /<span>Conversar sobre este carro<\/span>/);
  assert.match(html, /<span>Avaliar troca<\/span>/);
  assert.equal(attribute(html, "title"), vehicle.label);
  assert(html.includes(`>${vehicle.label}</p>`));
  assert(html.includes(vehicle.priceLabel));
  const trade = anchors(html)[1];
  assert.equal(
    attribute(trade, "aria-label"),
    `Avaliar troca: meu carro por ${vehicle.label}`,
  );
  const image = html.match(/<img\b[^>]*>/)?.[0];
  assert(image);
  assert.equal(attribute(image, "alt"), "");
});

test("compact layout keeps a desktop row and 44px touch targets", () => {
  const html = renderCard({ tradeHref });
  const rootClasses = classes(html);
  assert(rootClasses.has("grid"));
  assert(rootClasses.has("md:grid-cols-[minmax(0,1fr)_auto]"));
  assert(rootClasses.has("md:items-center"));
  assert.match(html, /grid-cols-2/);
  assert.match(html, /md:flex md:items-center/);
  for (const link of anchors(html)) {
    const linkClasses = classes(link);
    assert(linkClasses.has("min-h-11"));
    assert(linkClasses.has("md:w-auto"));
    assert(linkClasses.has("md:whitespace-nowrap"));
    assert(linkClasses.has("focus-visible:outline"));
    assert(!linkClasses.has("md:min-h-12"));
  }
});
