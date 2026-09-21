import snapshot from "../data/deliveries-preview.json";
import recentSnapshot from "../data/deliveries-recent.json";
import instagramSnapshot from "../data/deliveries-instagram.json";
import duplicateMappings from "../data/delivery-duplicates.json";

/** Normalized [left, top, width, height] in the complete original image. */
export type DeliveryCardCrop = readonly [number, number, number, number];

export interface Delivery {
  id: string;
  /** Empty when the source does not provide a real customer name. */
  name: string;
  imageUrl: string;
  /** Pre-generated responsive files for locally imported photos. */
  previewImageUrl?: string;
  previewSrcSet?: string;
  /** Card focal point; the viewer always shows the whole photo. */
  imagePosition?: string;
  /** Automatically calculated group framing; the original image stays intact. */
  cardCrop?: DeliveryCardCrop;
  /** Archive record or source publication date, not a verified delivery/purchase date. */
  date: string | null;
  year: string | null;
  month: string | null;
  caption?: string;
  source?: "archive" | "marketing" | "instagram";
  /** Original Instagram publication metadata; never inferred from the photo. */
  publishedAt?: string | null;
  sourceUrl?: string;
  sourceLabel?: string;
}

export interface DeliveryFilters {
  year?: string;
  month?: string;
}

type DeliveryDuplicateMap = Readonly<Record<string, string>>;
export const deliveryDuplicates: DeliveryDuplicateMap = duplicateMappings;

/** Keep imported originals intact; hide only reviewed Instagram duplicates. */
export function deduplicateDeliveries(
  items: readonly Delivery[],
  duplicates: DeliveryDuplicateMap = deliveryDuplicates,
): Delivery[] {
  const availableIds = new Set(items.map((item) => item.id));
  return items.filter((item) => {
    const preferredId = duplicates[item.id];
    return !(
      item.source === "instagram" &&
      preferredId &&
      preferredId !== item.id &&
      availableIds.has(preferredId)
    );
  });
}

/** Previously shared Instagram IDs continue opening the retained photo. */
export function resolveDeliveryId(
  id: string | null,
  items: readonly Delivery[] = deliveries,
  duplicates: DeliveryDuplicateMap = deliveryDuplicates,
): string | null {
  if (!id) return id;
  const preferredId = duplicates[id];
  return preferredId && items.some((item) => item.id === preferredId)
    ? preferredId
    : id;
}

export const recentDeliveries: Delivery[] = recentSnapshot.deliveries.map(
  (delivery: Omit<Delivery, "source">) => ({
    ...delivery,
    source: "marketing",
  }),
);

export const instagramDeliveries: Delivery[] = instagramSnapshot.deliveries.map(
  (delivery: Omit<Delivery, "source">) => ({
    ...delivery,
    source: "instagram",
  }),
);

export const deliveries: Delivery[] = deduplicateDeliveries([
  ...instagramDeliveries,
  ...recentDeliveries,
  ...snapshot.deliveries.map((delivery) => ({
    ...delivery,
    source: "archive" as const,
  })),
]).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
export const deliveryArchiveMetadata = snapshot.metadata;

function parseCardCrop(value: unknown): DeliveryCardCrop | undefined {
  if (
    !Array.isArray(value) ||
    value.length !== 4 ||
    !value.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate))
  )
    return undefined;
  const [left, top, width, height] = value;
  if (
    left < 0 || top < 0 || width <= 0 || height <= 0 ||
    left + width > 1.000001 || top + height > 1.000001
  )
    return undefined;
  return [left, top, width, height];
}

export function deliveryCardCrop(
  item: Delivery,
  archiveCrops: Readonly<Record<string, readonly number[]>>,
): readonly number[] | undefined {
  return item.cardCrop ?? archiveCrops[item.id];
}

export function parsePublishedDeliveries(value: unknown): Delivery[] {
  if (!Array.isArray(value)) throw new Error("Invalid publication feed");
  return value.map((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.id !== "string" ||
      !/^delivery-[a-f0-9]{24}$/.test(item.id) ||
      typeof item.imageUrl !== "string" ||
      !/^\/entregas-media\/live\/[a-z0-9-]+\.webp$/.test(item.imageUrl) ||
      typeof item.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(item.date) ||
      typeof item.publishedAt !== "string" ||
      !Number.isFinite(Date.parse(item.publishedAt))
    )
      throw new Error("Invalid publication record");
    const result: Delivery = {
      id: item.id,
      name: "",
      imageUrl: item.imageUrl,
      date: item.date,
      year: item.date.slice(0, 4),
      month: item.date.slice(5, 7),
      source: "marketing",
      publishedAt: item.publishedAt,
    };
    if (
      typeof item.previewImageUrl === "string" &&
      /^\/entregas-media\/live\/[a-z0-9-]+\.webp$/.test(item.previewImageUrl)
    )
      result.previewImageUrl = item.previewImageUrl;
    if (
      typeof item.previewSrcSet === "string" &&
      item.previewSrcSet
        .split(",")
        .every((entry: string) =>
          /^\/entregas-media\/live\/[a-z0-9-]+\.webp \d+w$/.test(entry.trim()),
        )
    )
      result.previewSrcSet = item.previewSrcSet;
    if (
      typeof item.imagePosition === "string" &&
      /^center \d{1,3}%$/.test(item.imagePosition)
    )
      result.imagePosition = item.imagePosition;
    const cardCrop = parseCardCrop(item.cardCrop);
    if (cardCrop) result.cardCrop = cardCrop;
    return result;
  });
}

/** Runtime publications replace the same record without changing existing share links. */
export function mergePublishedDeliveries(
  archive: readonly Delivery[],
  published: readonly Delivery[],
): Delivery[] {
  const records = new Map(archive.map((item) => [item.id, item]));
  for (const item of published) records.set(item.id, item);
  return deduplicateDeliveries([...records.values()]).sort(
    (a, b) =>
      (b.date || "").localeCompare(a.date || "") ||
      (b.publishedAt || "").localeCompare(a.publishedAt || ""),
  );
}

export function filterDeliveries(
  items: readonly Delivery[],
  filters: DeliveryFilters = {},
): Delivery[] {
  const year = filters.year && filters.year !== "all" ? filters.year : "";
  const month =
    filters.month && filters.month !== "all"
      ? filters.month.padStart(2, "0")
      : "";
  return items.filter((delivery) => {
    if (year && delivery.year !== year) return false;
    if (month && delivery.month !== month) return false;
    return true;
  });
}
