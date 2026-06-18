import { axiosInstance } from "../axios-instance";
import { config } from "../config";
import type { StoriesResponse, StoryGroup } from "../types/social";

function normalizeMediaUrl(url?: string): string | undefined {
  if (!url) return undefined;

  let normalized = url.replace(/^\.\\?\/+/, "").replace(/\\/g, "/").trim();

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }

  const baseDomain = config.apiBaseUrl.replace("/api/v1", "");

  if (normalized.startsWith("/")) {
    return `${baseDomain}${normalized}`;
  }

  return `${baseDomain}/${normalized}`;
}

function normalizeStoryGroup(story: StoryGroup): StoryGroup {
  return {
    ...story,
    coverImage: normalizeMediaUrl(story.coverImage) ?? story.coverImage,
    items: story.items.map((item) => ({
      ...item,
      url: normalizeMediaUrl(item.url) ?? item.url,
      previewUrl: normalizeMediaUrl(item.previewUrl) ?? item.previewUrl,
    })),
  };
}

async function fetchSeedFallback(): Promise<StoriesResponse | null> {
  try {
    const response = await fetch("/data/stories.seed.json");
    if (!response.ok) return null;
    const data = (await response.json()) as StoriesResponse;
    return {
      ...data,
      stale: true,
      profile: {
        ...data.profile,
        avatarUrl:
          normalizeMediaUrl(data.profile.avatarUrl) ?? data.profile.avatarUrl,
      },
      stories: (data.stories ?? []).map(normalizeStoryGroup),
    };
  } catch {
    return null;
  }
}

export async function fetchStories(): Promise<StoriesResponse | null> {
  try {
    const response = await axiosInstance.get<StoriesResponse>(
      `${config.apiBaseUrl}/stories.php?action=list`,
      { validateStatus: (status) => status < 500 }
    );

    if (response.status === 200 && response.data.success) {
      return {
        ...response.data,
        profile: {
          ...response.data.profile,
          avatarUrl:
            normalizeMediaUrl(response.data.profile.avatarUrl) ??
            response.data.profile.avatarUrl,
        },
        stories: (response.data.stories ?? []).map(normalizeStoryGroup),
      };
    }
  } catch (error) {
    console.warn("stories.php indisponível:", error);
  }

  return fetchSeedFallback();
}
