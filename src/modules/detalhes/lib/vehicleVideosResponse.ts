import {
  normalizeInstagramVideoUrl,
  normalizeVehicleVideoCover,
  type VehicleInstagramVideo,
} from "./vehicleInstagramVideos";

export interface VehicleVideosResponse {
  syncedAt: string;
  stale: boolean;
  videos: VehicleInstagramVideo[];
}

const MAX_CACHE_AGE_MS = 48 * 60 * 60 * 1000;

/** React Query conserva o último sucesso após um erro; expiração vale também nesse caso. */
export function vehicleVideosForDisplay(
  response: VehicleVideosResponse | undefined,
  failed = false,
  now = Date.now(),
): readonly VehicleInstagramVideo[] | undefined {
  if (!response) return failed ? undefined : [];
  return now - Date.parse(response.syncedAt) > MAX_CACHE_AGE_MS ? [] : response.videos;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** Limita a resposta pública a vínculos válidos; nunca aceita mídia externa como capa. */
export function parseVehicleVideosResponse(value: unknown): VehicleVideosResponse {
  if (!isRecord(value) || value.success !== true ||
      typeof value.syncedAt !== "string" || !Number.isFinite(Date.parse(value.syncedAt)) ||
      !Array.isArray(value.videos) || value.videos.length > 1000) {
    throw new Error("Resposta de vídeos indisponível");
  }

  const videos: VehicleInstagramVideo[] = [];
  for (const item of value.videos) {
    if (!isRecord(item) || typeof item.vehicleId !== "string" ||
        !/^[1-9]\d*$(?![\s\S])/.test(item.vehicleId) || !Number.isSafeInteger(Number(item.vehicleId)) ||
        typeof item.permalink !== "string" || typeof item.verifiedAt !== "string" ||
        !Number.isFinite(Date.parse(item.verifiedAt)) ||
        typeof item.stockPrice !== "number" || !Number.isFinite(item.stockPrice) || item.stockPrice <= 0) continue;
    const permalink = normalizeInstagramVideoUrl(item.permalink);
    if (!permalink) continue;
    videos.push({
      vehicleId: item.vehicleId,
      permalink,
      verifiedAt: item.verifiedAt,
      stockPrice: item.stockPrice,
      displayModel: typeof item.displayModel === "string"
        ? item.displayModel.trim().slice(0, 100) || undefined : undefined,
      coverImage: typeof item.coverImage === "string"
        ? normalizeVehicleVideoCover(item.coverImage) : undefined,
    });
  }

  const ids = new Map<string, number>();
  const urls = new Map<string, number>();
  for (const video of videos) {
    ids.set(video.vehicleId, (ids.get(video.vehicleId) ?? 0) + 1);
    urls.set(video.permalink, (urls.get(video.permalink) ?? 0) + 1);
  }
  const expired = Date.now() - Date.parse(value.syncedAt) > MAX_CACHE_AGE_MS;
  return {
    syncedAt: value.syncedAt,
    stale: value.stale === true || expired,
    videos: expired ? [] : videos.filter((video) =>
      ids.get(video.vehicleId) === 1 && urls.get(video.permalink) === 1),
  };
}
