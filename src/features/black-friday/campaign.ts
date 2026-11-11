export const BLACK_FRIDAY_CAMPAIGN_ID = "black-friday-2026";
export const BLACK_FRIDAY_CONFIG_URL = "/campaigns/black-friday-2026.json";
export const BLACK_FRIDAY_START = "2026-11-11T00:00:00-03:00";
export const BLACK_FRIDAY_END = "2026-12-01T00:00:00-03:00";
export const BLACK_FRIDAY_END_LABEL = "30/11/2026";
export const BLACK_FRIDAY_REFRESH_MS = 60_000;

export interface BlackFridayCampaignConfig {
  id: typeof BLACK_FRIDAY_CAMPAIGN_ID;
  enabled: boolean;
  startsAt: typeof BLACK_FRIDAY_START;
  endsAt: typeof BLACK_FRIDAY_END;
}

/** Missing, malformed or rescheduled configuration must not activate an offer. */
export function parseBlackFridayConfig(value: unknown): BlackFridayCampaignConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const config = value as Record<string, unknown>;
  if (
    config.id !== BLACK_FRIDAY_CAMPAIGN_ID ||
    typeof config.enabled !== "boolean" ||
    config.startsAt !== BLACK_FRIDAY_START ||
    config.endsAt !== BLACK_FRIDAY_END
  ) return null;

  return {
    id: BLACK_FRIDAY_CAMPAIGN_ID,
    enabled: config.enabled,
    startsAt: BLACK_FRIDAY_START,
    endsAt: BLACK_FRIDAY_END,
  };
}

export function isBlackFridayActive(
  config: BlackFridayCampaignConfig | null,
  now = Date.now(),
): boolean {
  return Boolean(
    config?.enabled &&
    Number.isFinite(now) &&
    now >= Date.parse(BLACK_FRIDAY_START) &&
    now < Date.parse(BLACK_FRIDAY_END),
  );
}

/** Recheck at the next date boundary, even if the visitor leaves the tab open. */
export function getBlackFridayBoundaryDelay(now: number): number | null {
  if (!Number.isFinite(now)) return null;
  const next = [Date.parse(BLACK_FRIDAY_START), Date.parse(BLACK_FRIDAY_END)]
    .find((boundary) => boundary > now);
  return next === undefined ? null : Math.min(next - now, 2_147_483_647);
}

type CampaignFetcher = (
  url: string,
  options: RequestInit,
) => Promise<Pick<Response, "ok" | "json">>;

export async function fetchBlackFridayConfig(
  fetcher: CampaignFetcher = fetch,
  signal?: AbortSignal,
): Promise<BlackFridayCampaignConfig | null> {
  try {
    const response = await fetcher(BLACK_FRIDAY_CONFIG_URL, {
      cache: "no-store",
      credentials: "same-origin",
      signal,
    });
    if (!response.ok) return null;
    return parseBlackFridayConfig(await response.json());
  } catch {
    return null;
  }
}
