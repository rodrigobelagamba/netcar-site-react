import type { StoryGroup } from "@/social/types";

export interface StoryViewerState {
  groupIndex: number;
  itemIndex: number;
}

export interface FlatStoryItem {
  groupIndex: number;
  itemIndex: number;
  group: StoryGroup;
  item: StoryGroup["items"][number];
}

export function flattenStoryItems(stories: StoryGroup[]): FlatStoryItem[] {
  const flat: FlatStoryItem[] = [];

  stories.forEach((group, groupIndex) => {
    group.items.forEach((item, itemIndex) => {
      flat.push({ groupIndex, itemIndex, group, item });
    });
  });

  return flat;
}

export function findFlatIndex(
  flat: FlatStoryItem[],
  groupIndex: number,
  itemIndex: number
): number {
  return flat.findIndex(
    (entry) => entry.groupIndex === groupIndex && entry.itemIndex === itemIndex
  );
}
