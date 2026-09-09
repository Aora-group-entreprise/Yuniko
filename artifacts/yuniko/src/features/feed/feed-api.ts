import { apiFetch } from "@/lib/api";

export async function fetchWorldFeed(params: { cursor?: number | null; limit?: number; signal?: AbortSignal } = {}) {
  const query = new URLSearchParams({ limit: String(params.limit ?? 20) });
  if (params.cursor !== null && params.cursor !== undefined) query.set("cursor", String(params.cursor));
  const response = await apiFetch(`/posts/feed?${query.toString()}`, { signal: params.signal });
  if (!response.ok) throw new Error(`Feed request failed: ${response.status}`);
  return response.json() as Promise<{ posts?: any[]; nextCursor?: number | string | null; hasMore?: boolean }>;
}
