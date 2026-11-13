import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReviewsSummaryHeader } from "../../src/design-system/components/patterns/social/ReviewsSummaryHeader";
import { ReviewDetailModal } from "../../src/design-system/components/patterns/social/ReviewDetailModal";
import type { GoogleReviewsSummary } from "../../src/social/types";
import { GOOGLE_PRIMARY_PROFILE, GOOGLE_REVIEW_STORES } from "../../src/social/googlePlaces";

const legacySummary: GoogleReviewsSummary = {
  rating: 4.9,
  totalCount: 897,
  placeUrl: "https://maps.google.com/maps?cid=10839197980729051544",
  writeReviewUrl: "https://g.page/NetcarRC/review?rc",
};

test("new review CTA uses the confirmed principal profile instead of legacy or unit selection", () => {
  const html = renderToStaticMarkup(<ReviewsSummaryHeader summary={legacySummary} />);
  assert.ok(html.includes(GOOGLE_PRIMARY_PROFILE.writeReviewUrl));
  assert.ok(html.includes("Av. Presidente Vargas, 740"));
  assert.ok(html.includes("Avaliar a Netcar no Google"));
  assert.equal(html.includes(legacySummary.writeReviewUrl), false);
  assert.equal(html.includes(GOOGLE_REVIEW_STORES[1].writeReviewUrl), false);
  assert.equal(html.includes("<details"), false);
  assert.equal(html.toLowerCase().includes("matriz"), false);
  assert.equal(html.includes("das duas unidades"), false);
});

test("combined counts stay attributed to both units while the new commercial CTA goes to the principal", () => {
  const summary: GoogleReviewsSummary = {
    ...legacySummary,
    scope: "all_locations",
    locationCount: 2,
    units: [
      { name: "Netcar Multimarcas", address: "Av. Presidente Vargas, 740", placeUrl: GOOGLE_PRIMARY_PROFILE.url, writeReviewUrl: null },
      { name: "Filial", address: "Av. Presidente Vargas, 1106", placeUrl: GOOGLE_REVIEW_STORES[1].url, writeReviewUrl: GOOGLE_REVIEW_STORES[1].writeReviewUrl },
    ],
  };
  const html = renderToStaticMarkup(<ReviewsSummaryHeader summary={summary} />);
  assert.ok(html.includes("897 avaliações das duas unidades"));
  assert.ok(html.includes(GOOGLE_PRIMARY_PROFILE.writeReviewUrl));
  assert.equal(html.includes(GOOGLE_REVIEW_STORES[1].writeReviewUrl), false);
});

test("an existing review keeps its own branch source and original location title", () => {
  const html = renderToStaticMarkup(<ReviewDetailModal
    review={{ id: "review-fixture", authorName: "Cliente", rating: 5, text: "Atendimento na unidade da experiência.", relativeTime: "", reviewUrl: GOOGLE_REVIEW_STORES[1].url, locationTitle: "Netcar Multimarcas - Loja 2" }}
    isOpen
    onClose={() => {}}
  />);
  assert.ok(html.includes(GOOGLE_REVIEW_STORES[1].url));
  assert.ok(html.includes("Netcar Multimarcas - Loja 2"));
  assert.equal(html.includes(GOOGLE_PRIMARY_PROFILE.url), false);
});
