import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface WorldFeedAuthor {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  verified?: boolean;
  isFollowing?: boolean;
}

export interface WorldFeedPost {
  post: any;
  author: WorldFeedAuthor;
  raw: any;
}

export interface WorldFeedPage {
  items: WorldFeedPost[];
  nextCursor: number | null;
  hasMore: boolean;
}

function normalizeCursor(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isSafeInteger(n) ? n : null;
  }
  return null;
}

function relativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function convert(raw: any): WorldFeedPost {
  let mediaItems: string[] | undefined;
  if (raw.mediaItems) {
    try {
      const parsed = typeof raw.mediaItems === "string" ? JSON.parse(raw.mediaItems) : raw.mediaItems;
      if (Array.isArray(parsed)) mediaItems = parsed;
    } catch {
      mediaItems = undefined;
    }
  }
  return {
    raw,
    post: {
      id: `live_${raw.id}`,
      userId: `live_${raw.userId}`,
      imageUrl: raw.mediaUrl ?? "",
      mediaType: raw.mediaType ?? "text",
      mediaItems,
      caption: raw.caption ?? "",
      hashtags: raw.hashtags ? String(raw.hashtags).split(/[\\s,]+/).filter(Boolean) : [],
      likes: raw.likes ?? 0,
      comments: raw.comments ?? 0,
      shares: raw.shares ?? 0,
      saves: raw.saves ?? 0,
      timestamp: relativeTime(raw.createdAt),
      isLiked: Boolean(raw.liked),
      isSaved: Boolean(raw.saved),
      location: raw.location ?? undefined,
      views: raw.views ?? 0,
      isSponsored: Boolean(raw.isSponsored),
    },
    author: {
      displayName: raw.authorDisplayName ?? "Yuniko user",
      username: raw.authorUsername ?? "user",
      avatarUrl: raw.authorAvatarUrl ?? null,
      verified: Boolean(raw.authorVerified),
      isFollowing: Boolean(raw.following ?? raw.isFollowing),
    },
  };
}

async function fetchWorldFeedPage(cursor: number | null, signal?: AbortSignal): Promise<WorldFeedPage> {
  const params = new URLSearchParams({ limit: "20" });
  if (cursor !== null) params.set("cursor", String(cursor));
  const res = await apiFetch(`/posts/feed?${params.toString()}`, { signal });
  if (!res.ok) throw new Error(`Feed request failed: ${res.status}`);
  const data = await res.json() as { posts?: any[]; nextCursor?: unknown; hasMore?: boolean };
  return {
    items: (data.posts ?? []).map(convert),
    nextCursor: normalizeCursor(data.nextCursor),
    hasMore: Boolean(data.hasMore),
  };
}

export const worldFeedKeys = {
  all: ["world-feed"] as const,
};

export function useWorldFeed(enabled = true) {
  return useInfiniteQuery({
    queryKey: worldFeedKeys.all,
    enabled,
    initialPageParam: null as number | null,
    queryFn: ({ pageParam, signal }) => fetchWorldFeedPage(pageParam, signal),
    getNextPageParam: (lastPage) => lastPage.hasMore && lastPage.nextCursor !== null ? lastPage.nextCursor : undefined,
    staleTime: 30_000,
    gcTime: 15 * 60_000,
    retry: 1,
    refetchOnWindowFocus: true,
  });
}

export function useWorldFeedClient() {
  return useQueryClient();
}

export function flattenWorldFeed(data: { pages?: WorldFeedPage[] } | undefined): WorldFeedPost[] {
  return data?.pages?.flatMap(page => page.items) ?? [];
}
