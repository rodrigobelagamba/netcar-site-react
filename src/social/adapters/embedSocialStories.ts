import { pickStoryImageUrl } from "@/lib/socialMedia";
import { EMBEDSOCIAL_STORIES_PATH } from "../constants/embedSocial";
import type { StoriesResponse, StoryGroup } from "../types";
import {
  extractStoriesArray,
  fetchEmbedSocialHtml,
  unescapeEmbedSocialUrl,
} from "./embedSocialParser";

interface EmbedSocialStoryItem {
  id?: number;
  storyId?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  largeMediaUrl?: string;
  smallMediaUrl?: string;
  mediaType?: string;
  sourceUsername?: string;
  sourceName?: string;
  sourceImage?: string;
  createdOnFormated?: string;
  name?: string;
}

function mapStoryItem(raw: EmbedSocialStoryItem): StoryGroup {
  const id = String(raw.storyId ?? raw.id);
  const cover = unescapeEmbedSocialUrl(
    pickStoryImageUrl(
      {
        largeMediaUrl: raw.largeMediaUrl,
        mediaUrl: raw.mediaUrl,
        thumbnailUrl: raw.thumbnailUrl,
        smallMediaUrl: raw.smallMediaUrl,
      },
      "cover"
    )
  );

  const fullUrl = unescapeEmbedSocialUrl(
    pickStoryImageUrl(
      {
        largeMediaUrl: raw.largeMediaUrl,
        mediaUrl: raw.mediaUrl,
        thumbnailUrl: raw.thumbnailUrl,
        smallMediaUrl: raw.smallMediaUrl,
      },
      "full"
    )
  );

  return {
    id,
    title: raw.sourceName || "Netcar",
    coverImage: cover ?? "",
    relativeTime: raw.createdOnFormated || "",
    items: [
      {
        id,
        type: raw.mediaType === "VIDEO" ? "video" : "image",
        url: fullUrl ?? cover ?? "",
        previewUrl: cover,
        durationMs: 5000,
      },
    ],
  };
}

export async function fetchEmbedSocialStories(): Promise<StoriesResponse | null> {
  try {
    const bridge = await fetch("/embedsocial-bridge.php?type=stories");
    if (bridge.ok) {
      const data = (await bridge.json()) as StoriesResponse;
      if (data.success) return data;
    }
  } catch {
    // bridge indisponível — tenta parse HTML
  }

  const html = await fetchEmbedSocialHtml(EMBEDSOCIAL_STORIES_PATH);
  if (!html) return null;

  const rawStories = extractStoriesArray(html) as EmbedSocialStoryItem[] | null;
  if (!rawStories?.length) return null;

  const first = rawStories[0];
  const username = first.sourceUsername || "netcar_rc";

  return {
    success: true,
    stale: false,
    syncedAt: new Date().toISOString(),
    profile: {
      username,
      displayName: first.sourceName || "Netcar",
      avatarUrl:
        unescapeEmbedSocialUrl(first.sourceImage) ||
        "/images/Logotipo7_1768863597989.png",
      followUrl: `https://www.instagram.com/${username}`,
    },
    stories: rawStories.map(mapStoryItem),
  };
}
