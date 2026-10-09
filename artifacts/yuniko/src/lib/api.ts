/**
 * Authenticated API fetch helper.
 * Authentication is handled by a browser-managed HttpOnly session cookie.
 * Pages never read, store, or send authentication tokens.
 */
const API_BASE_URL = (() => {
  // Yuniko's frontend and API are deployed on the same Cloudflare Worker domain.
  return "https://yuniko-api.lafatriniainaallane.workers.dev";
})();

export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers ?? {}) as Record<string, string>),
  };
  const normalizedPath = path.startsWith("/") ? path : "/" + path;
  return fetch(API_BASE_URL + "/api" + normalizedPath, {
    ...options,
    headers,
    credentials: "include",
  });
}

export async function apiJson<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await apiFetch(path, options);
  const contentType = res.headers.get("content-type") ?? "";
  const raw = await res.text();
  let data: T | { error?: string } | null = null;
  if (raw) {
    try { data = JSON.parse(raw) as T | { error?: string }; }
    catch {
      const preview = raw.replace(/\s+/g, " ").slice(0, 120);
      throw new Error("API returned non-JSON (" + res.status + ", " + (contentType || "unknown content-type") + ") from " + API_BASE_URL + "/api" + (path.startsWith("/") ? path : "/" + path) + ": " + preview);
    }
  }
  if (!res.ok) throw new Error((data && typeof data === "object" && "error" in data && data.error) || "Request failed (" + res.status + ")");
  return data as T;
}
