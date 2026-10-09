import { getApiCached, invalidateApiCachePrefix, isCacheableGet, setApiCached } from "@/lib/api-cache";

/**
 * Authenticated API fetch helper.
 * The frontend and API are served by the same Cloudflare Worker domain.
 * Use same-origin paths so requests always follow the domain serving Yuniko.
 * Authentication is handled by a browser-managed HttpOnly session cookie.
 * Pages never read, store, or send authentication tokens.
 */
function getApiPath(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : "/" + path;
  return "/api" + normalizedPath;
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(options.headers);
  const hasBody = options.body !== undefined && options.body !== null;
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  // GET requests and FormData uploads do not need a forced JSON content type.
  // Let the browser set multipart boundaries for FormData.
  if (hasBody && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const method = (options.method ?? "GET").toUpperCase();
  const canCache = method === "GET" && isCacheableGet(path);
  if (canCache) {
    const cached = await getApiCached<unknown>(path);
    if (cached !== undefined && !options.signal?.aborted) {
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8", "X-Yuniko-Cache": "HIT" },
      });
    }
  }
  const response = await fetch(getApiPath(path), {
    ...options,
    headers,
    credentials: "include",
  });
  if (canCache && response.ok && (response.headers.get("content-type") ?? "").includes("json")) {
    try { setApiCached(path, await response.clone().json()); } catch {}
  }
  if (method !== "GET" && response.ok) invalidateAfterMutation(path);
  return response;
}

function invalidateAfterMutation(path: string): void {
  const normalized = path.startsWith("/") ? path : "/" + path;
  if (/^\/posts(?:\/|$)/.test(normalized)) {
    invalidateApiCachePrefix("/posts/");
    invalidateApiCachePrefix("/notifications");
    invalidateApiCachePrefix("/users/");
  }
  if (/^\/stories(?:\/|$)/.test(normalized)) {
    invalidateApiCachePrefix("/stories");
    invalidateApiCachePrefix("/notifications");
  }
  if (/^\/messages(?:\/|$)/.test(normalized) || /^\/message-requests(?:\/|$)/.test(normalized)) {
    invalidateApiCachePrefix("/messages/");
    invalidateApiCachePrefix("/message-requests");
    invalidateApiCachePrefix("/notifications");
  }
  if (/^\/users\/\d+\/(?:follow|friend-requests)/.test(normalized) || /^\/friend-requests/.test(normalized)) {
    invalidateApiCachePrefix("/users/");
    invalidateApiCachePrefix("/friends/");
    invalidateApiCachePrefix("/friend-requests");
    invalidateApiCachePrefix("/notifications");
  }
  if (/^\/settings(?:\/|$)/.test(normalized)) invalidateApiCachePrefix("/settings");
  if (/^\/notifications(?:\/|$)/.test(normalized)) invalidateApiCachePrefix("/notifications");
  if (/^\/auth\/me$/.test(normalized)) {
    invalidateApiCachePrefix("/users/");
    invalidateApiCachePrefix("/posts/");
  }
}

export async function apiJson<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const cacheable = method === "GET" && isCacheableGet(path);
  if (cacheable && !options.signal?.aborted) {
    const cached = await getApiCached<T>(path);
    if (cached !== undefined && !options.signal?.aborted) return cached;
  }
  const res = await apiFetch(path, options);
  const contentType = res.headers.get("content-type") ?? "";
  const raw = await res.text();
  let data: T | { error?: string } | null = null;
  if (raw) {
    try { data = JSON.parse(raw) as T | { error?: string }; }
    catch {
      const preview = raw.replace(/\s+/g, " ").slice(0, 120);
      throw new Error("API returned non-JSON (" + res.status + ", " + (contentType || "unknown content-type") + ") from " + getApiPath(path) + ": " + preview);
    }
  }
  if (!res.ok) throw new Error((data && typeof data === "object" && "error" in data && data.error) || "Request failed (" + res.status + ")");
  if (cacheable && data !== null) setApiCached(path, data);
  if (method !== "GET") invalidateAfterMutation(path);
  return data as T;
}
