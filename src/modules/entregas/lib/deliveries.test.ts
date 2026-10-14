import assert from "node:assert/strict";
import test from "node:test";
import {
  deliveries,
  DEFAULT_DELIVERY_LAYOUT,
  deliveryArchiveMetadata,
  deliveryCardCrop,
  deliveryGridCardCrop,
  deduplicateDeliveries,
  filterDeliveries,
  mergePublishedDeliveries,
  parsePublishedDeliveries,
  resolveDeliveryId,
  type Delivery,
} from "./deliveries";

const sample: Delivery[] = [
  {
    id: "one",
    name: "João da Silva",
    imageUrl: "https://example.com/one.jpg",
    date: "2024-03-10",
    year: "2024",
    month: "03",
  },
  {
    id: "two",
    name: "Márcia Souza",
    imageUrl: "https://example.com/two.jpg",
    date: "2023-03-10",
    year: "2023",
    month: "03",
  },
  {
    id: "three",
    name: "",
    imageUrl: "https://example.com/three.jpg",
    date: null,
    year: null,
    month: null,
  },
];

test("late delivery retries keep publication order and corrections keep one shareable record", () => {
  const early: Delivery = {
    ...sample[0],
    id: "published",
    date: "2026-09-21",
    publishedAt: "2026-09-21T12:00:00Z",
  };
  const latest: Delivery = {
    ...early,
    id: "latest",
    publishedAt: "2026-09-21T15:00:00Z",
  };
  const correction = {
    ...early,
    imageUrl: "https://example.com/corrected.webp",
  };
  const merged = mergePublishedDeliveries(
    [early, ...sample],
    [latest, correction],
  );
  assert.deepEqual(
    merged.slice(0, 2).map((item) => item.id),
    ["latest", "published"],
  );
  assert.equal(merged.filter((item) => item.id === early.id).length, 1);
  assert.equal(merged[1].imageUrl, correction.imageUrl);
  assert.equal(early.imageUrl, sample[0].imageUrl);
});

test("publication feed accepts public cards and rejects malformed or external image sources", () => {
  const record = {
    id: "delivery-1234567890abcdef12345678",
    imageUrl:
      "/entregas-media/live/delivery-1234567890abcdef12345678-1234.webp",
    publishedAt: "2026-09-21T02:00:00Z",
    date: "2026-09-20",
    name: "Internal name",
    token: "private",
  };
  const parsed = parsePublishedDeliveries([record]);
  assert.equal(parsed[0].date, "2026-09-20");
  assert.equal(parsed[0].month, "09");
  assert.equal(parsed[0].name, "");
  assert.equal(parsed[0].imageKind, "story_card");
  assert.equal("token" in parsed[0], false);
  assert.throws(() =>
    parsePublishedDeliveries([
      { ...record, imageUrl: "https://example.com/photo.webp" },
    ]),
  );
  assert.throws(() =>
    parsePublishedDeliveries([{ ...record, publishedAt: "not a date" }]),
  );
  assert.throws(() => parsePublishedDeliveries([null]));
});

test("native photos never reuse live or static artwork crops", () => {
  const record = {
    id: "delivery-1234567890abcdef12345678",
    imageUrl:
      "/entregas-media/live/delivery-1234567890abcdef12345678-1234.webp",
    publishedAt: "2026-09-21T18:09:19Z",
    date: "2026-09-21",
    imageKind: "photo",
    cardCrop: [0, 0.1, 0.8, 0.4],
  };
  const [photo] = parsePublishedDeliveries([record]);
  const staticCrops = { [photo.id]: [0.1, 0.1, 0.5, 0.5] };
  assert.equal(photo.imageKind, "photo");
  assert.equal(photo.cardCrop, null);
  assert.equal(deliveryCardCrop(photo, staticCrops), undefined);
  assert.equal(deliveryGridCardCrop(photo, staticCrops, "pessoas"), undefined);
  assert.equal(deliveryGridCardCrop(photo, staticCrops, "inteira"), undefined);
  // Defensive even if a trusted local snapshot accidentally retains a prior crop.
  assert.equal(
    deliveryCardCrop({ ...photo, cardCrop: [0, 0, 0.5, 0.5] }, staticCrops),
    undefined,
  );
});

test("closer thumbnails are the default while the full-photo layout remains available", () => {
  const archive = sample[0];
  const crops = { [archive.id]: [0, 0.1, 1, 0.5] };
  assert.equal(DEFAULT_DELIVERY_LAYOUT, "pessoas");
  assert.deepEqual(deliveryGridCardCrop(archive, crops), crops[archive.id]);
  assert.equal(deliveryGridCardCrop(archive, crops, "inteira"), undefined);
  assert.deepEqual(
    deliveryGridCardCrop(archive, crops, "pessoas"),
    crops[archive.id],
  );
  assert.equal(
    deliveryGridCardCrop({ ...archive, cardCrop: null }, crops, "pessoas"),
    undefined,
  );
});

test("native photo framing only affects the thumbnail, never the opened photo", () => {
  const record = {
    id: "delivery-1234567890abcdef12345678",
    imageUrl: "/entregas-media/live/delivery-1234567890abcdef12345678-1234.webp",
    publishedAt: "2026-09-21T18:09:19Z",
    date: "2026-09-21",
    imageKind: "photo",
    cardCrop: [0, 0, 1, 0.5],
    photoCrop: [0.1, 0.15, 0.8, 0.45],
  };
  const [photo] = parsePublishedDeliveries([record]);
  const staleStoryCrops = { [photo.id]: [0.2, 0.3, 0.5, 0.5] };
  assert.deepEqual(deliveryGridCardCrop(photo, staleStoryCrops), record.photoCrop);
  assert.equal(deliveryGridCardCrop(photo, staleStoryCrops, "inteira"), undefined);
  assert.equal(deliveryCardCrop(photo, staleStoryCrops), undefined);
  assert.equal(photo.cardCrop, null);
  // Replacing the image without fresh framing cannot reuse its old crop.
  const [replacement] = parsePublishedDeliveries([
    { ...record, imageUrl: record.imageUrl.replace("1234.webp", "5678.webp"), photoCrop: undefined },
  ]);
  const [merged] = mergePublishedDeliveries([photo], [replacement]);
  assert.equal(deliveryGridCardCrop(merged, staleStoryCrops), undefined);
  assert.equal(merged.id, photo.id);
  assert.equal(merged.date, photo.date);
});

test("uncertain or malformed native framing falls back to the complete photo", () => {
  for (const photoCrop of [undefined, null, [], [0, 0, 1], [0, 0, 1, 1, 0],
    ["0", 0, 1, 1], [0, 0, NaN, 1], [0, 0, Infinity, 1],
    [-0.1, 0, 1, 1], [0, 0, 0, 1], [0.3, 0, 0.8, 1]]) {
    const record = {
      id: "delivery-1234567890abcdef12345678",
      imageUrl: "/entregas-media/live/delivery-1234567890abcdef12345678-1234.webp",
      publishedAt: "2026-09-21T18:09:19Z",
      date: "2026-09-21",
      imageKind: "photo",
      photoCrop,
    };
    const [photo] = parsePublishedDeliveries([record]);
    assert.equal(photo.photoCrop, null);
    assert.equal(deliveryGridCardCrop(photo, { [photo.id]: [0, 0, 1, 1] }), undefined);
    assert.equal(deliveryCardCrop(photo, {}), undefined);
  }
  const [story] = parsePublishedDeliveries([{
    id: "delivery-1234567890abcdef12345678",
    imageUrl: "/entregas-media/live/delivery-1234567890abcdef12345678-1234.webp",
    publishedAt: "2026-09-21T18:09:19Z", date: "2026-09-21",
    photoCrop: [0, 0, 1, 0.5],
  }]);
  assert.equal(story.photoCrop, undefined);
  assert.equal(deliveryGridCardCrop(story, {}), undefined);
});

test("publication image kinds reject malformed metadata without guessing from aspect ratio", () => {
  const record = {
    id: "delivery-1234567890abcdef12345678",
    imageUrl:
      "/entregas-media/live/delivery-1234567890abcdef12345678-1234.webp",
    publishedAt: "2026-09-21T18:09:19Z",
    date: "2026-09-21",
  };
  for (const imageKind of ["Photo", "video", "", null, 1, [], {}]) {
    assert.throws(() => parsePublishedDeliveries([{ ...record, imageKind }]));
  }
  assert.equal(
    parsePublishedDeliveries([{ ...record, imageKind: "story_card" }])[0]
      .imageKind,
    "story_card",
  );
});

test("replacing a Story card with a photo preserves share identity, dates and merge order", () => {
  const record = {
    id: "delivery-1234567890abcdef12345678",
    imageUrl:
      "/entregas-media/live/delivery-1234567890abcdef12345678-1234.webp",
    publishedAt: "2026-09-21T18:09:19Z",
    date: "2026-09-21",
    cardCrop: [0, 0.1, 0.8, 0.4],
  };
  const [before] = parsePublishedDeliveries([record]);
  const [after] = parsePublishedDeliveries([
    {
      ...record,
      imageKind: "photo",
      imageUrl: record.imageUrl.replace("1234.webp", "5678.webp"),
    },
  ]);
  const merged = mergePublishedDeliveries([before], [after]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, before.id);
  assert.equal(merged[0].publishedAt, before.publishedAt);
  assert.equal(merged[0].date, before.date);
  assert.equal(merged[0].imageUrl, after.imageUrl);
  assert.equal(
    deliveryGridCardCrop(merged[0], { [before.id]: [0, 0, 1, 1] }, "pessoas"),
    undefined,
  );
});

test("combines archive month and year filters and tolerates absent dates", () => {
  assert.deepEqual(
    filterDeliveries(sample, { month: "3", year: "2024" }).map(
      (item) => item.id,
    ),
    ["one"],
  );
  assert.equal(filterDeliveries(sample, { month: "03" }).length, 2);
  assert.equal(
    filterDeliveries(sample, { year: "all", month: "all" }).length,
    3,
  );
  assert.equal(
    filterDeliveries(sample, { month: "04", year: "2023" }).length,
    0,
  );
});

test("automatic publications carry group framing without needing a static archive entry", () => {
  const record = {
    id: "delivery-1234567890abcdef12345678",
    imageUrl:
      "/entregas-media/live/delivery-1234567890abcdef12345678-1234.webp",
    publishedAt: "2026-09-21T18:09:19Z",
    date: "2026-09-21",
  };
  const [before] = parsePublishedDeliveries([record]);
  const crop = [0.1, 0.2, 0.7, 0.35];
  const [corrected] = parsePublishedDeliveries([{ ...record, cardCrop: crop }]);
  const merged = mergePublishedDeliveries([before], [corrected]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, before.id);
  assert.equal(merged[0].imageUrl, before.imageUrl);
  assert.deepEqual(deliveryCardCrop(merged[0], {}), crop);
  assert.deepEqual(
    deliveryCardCrop(merged[0], { [record.id]: [0, 0, 1, 1] }),
    crop,
  );
  assert.deepEqual(
    deliveryCardCrop(sample[0], { one: [0, 0.1, 1, 0.5] }),
    [0, 0.1, 1, 0.5],
  );
});

test("missing or invalid live framing preserves the photo with a full-image fallback", () => {
  const record = {
    id: "delivery-1234567890abcdef12345678",
    imageUrl:
      "/entregas-media/live/delivery-1234567890abcdef12345678-1234.webp",
    publishedAt: "2026-09-21T18:09:19Z",
    date: "2026-09-21",
  };
  for (const cardCrop of [
    undefined,
    null,
    [],
    [0, 0, 1],
    [0, 0, 1, 1, 0],
    ["0", 0, 1, 1],
    [0, 0, NaN, 1],
    [0, 0, Infinity, 1],
    [-0.1, 0, 1, 1],
    [0, 0, 0, 1],
    [0, 0, 1, -1],
    [0.3, 0, 0.8, 1],
    [0, 0.3, 1, 0.8],
  ]) {
    const [item] = parsePublishedDeliveries([{ ...record, cardCrop }]);
    assert.equal(item.imageUrl, record.imageUrl);
    assert.equal(deliveryCardCrop(item, {}), undefined);
  }
});

test("reviewed duplicates keep the preferred photo and preserve previously shared IDs", () => {
  const original: Delivery = {
    ...sample[0],
    id: "instagram-copy",
    source: "instagram",
    name: "",
  };
  const preferred: Delivery = {
    ...sample[0],
    id: "marketing-original",
    source: "marketing",
  };
  const imported = [original, preferred];
  const mapping = { "instagram-copy": "marketing-original" };
  const visible = deduplicateDeliveries(imported, mapping);
  assert.deepEqual(visible, [preferred]);
  assert.equal(
    resolveDeliveryId("instagram-copy", visible, mapping),
    preferred.id,
  );
  assert.equal(resolveDeliveryId(preferred.id, visible, mapping), preferred.id);
  assert.equal(imported.length, 2);
  assert.equal(original.name, "");
  assert.equal(preferred.name, sample[0].name);
});

test("a missing preferred photo never hides the available original or breaks its link", () => {
  const original: Delivery = {
    ...sample[0],
    id: "instagram-copy",
    source: "instagram",
  };
  const mapping = { "instagram-copy": "not-imported-yet" };
  assert.deepEqual(deduplicateDeliveries([original], mapping), [original]);
  assert.equal(
    resolveDeliveryId(original.id, [original], mapping),
    original.id,
  );
  assert.equal(resolveDeliveryId(null, [original], mapping), null);
  assert.deepEqual(
    deduplicateDeliveries([original], { [original.id]: original.id }),
    [original],
  );
});

test("snapshot contains a bounded deduplicated set of source-host images with honest dates", () => {
  const archiveDeliveries = deliveries.filter(
    (item) => item.source === "archive",
  );
  assert.equal(archiveDeliveries.length, deliveryArchiveMetadata.snapshotCount);
  assert.ok(archiveDeliveries.length <= 240);
  assert.equal(
    new Set(archiveDeliveries.map((item) => item.id)).size,
    archiveDeliveries.length,
  );
  assert.equal(
    new Set(archiveDeliveries.map((item) => item.imageUrl)).size,
    archiveDeliveries.length,
  );
  for (const delivery of archiveDeliveries) {
    assert.equal(
      new URL(delivery.imageUrl).hostname,
      "www.netcarmultimarcas.com.br",
    );
    if (delivery.date) {
      assert.equal(delivery.year, delivery.date.slice(0, 4));
      assert.equal(delivery.month, delivery.date.slice(5, 7));
    }
  }
  assert.equal(deliveryArchiveMetadata.dateMeaning, "archive-record-date");
  assert.equal(deliveryArchiveMetadata.sampleOnly, true);
});
