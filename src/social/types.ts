export interface GoogleReviewsSummary {
  rating: number;
  totalCount: number;
  placeUrl: string;
  writeReviewUrl: string;
}

export interface GoogleReviewsPagination {
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
  widgetId?: string;
}

export interface GoogleReview {
  id: string;
  authorName: string;
  authorPhotoUrl?: string;
  rating: number;
  text: string;
  relativeTime: string;
  publishedAt?: string;
  photoUrl?: string;
  largePhotoUrl?: string;
  reviewUrl?: string;
  pinned?: boolean;
  hidden?: boolean;
  variant?: "text" | "photo" | "dark";
}

export interface GoogleReviewsResponse {
  success: boolean;
  stale?: boolean;
  syncedAt?: string;
  summary: GoogleReviewsSummary;
  reviews: GoogleReview[];
  pagination?: GoogleReviewsPagination;
}

export interface StoryProfile {
  username: string;
  displayName: string;
  avatarUrl: string;
  followUrl: string;
}

export interface StoryItem {
  id: string;
  type: "image" | "video";
  url: string;
  previewUrl?: string;
  durationMs?: number;
  caption?: string;
  link?: {
    href: string;
    label?: string;
  };
}

export interface StoryGroup {
  id: string;
  title: string;
  coverImage: string;
  relativeTime?: string;
  publishedAt?: string;
  expiresAt?: string;
  items: StoryItem[];
}

export interface StoriesResponse {
  success: boolean;
  stale?: boolean;
  syncedAt?: string;
  profile: StoryProfile;
  stories: StoryGroup[];
}
