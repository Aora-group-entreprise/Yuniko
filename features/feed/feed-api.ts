import { apiFetch } from "@/lib/api";

export async function fetchWorldFeed(params: { cursor?: number | null; limit?: number; signal?: AbortSignal } = {}) {
  const query = new URLSearchParams({ limit: String(params.limit ?? 20) });
  if (params.cursor !== null && params.cursor !== undefined) query.set("cursor", String(params.cursor));

  // The first page must always be fresh: Cloudflare/browser caches can otherwise
  // return the previous feed immediately after a new post is published.
  if (params.cursor === null || params.cursor === undefined) {
    query.set("_feed_refresh", String(Date.now()));
  }

  const response = await apiFetch(`/posts/feed?${query.toString()}`, {
    signal: params.signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Feed request failed: ${response.status}`);
  return response.json() as Promise<{ posts?: any[]; nextCursor?: number | string | null; hasMore?: boolean }>;
}
