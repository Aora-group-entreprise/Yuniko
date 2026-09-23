/**
 * Authenticated API fetch helper.
 * Authentication is handled by a browser-managed HttpOnly session cookie.
 * Pages never read, store, or send authentication tokens.
 */
const API_BASE_URL = (import.meta.env.VITE_YUNIKO_API_URL || "https://yuniko-api.lafatriniainaallane.workers.dev").replace(/\/+$/, "");

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
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error ?? "Request failed (" + res.status + ")");
  }
  return data as T;
}
