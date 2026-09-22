/**
 * Authenticated API fetch helper.
 * The API can live on a separate Workers origin in production; use the
 * environment override when provided and keep the Yuniko API as the default.
 */
const TOKEN_KEY = "yuniko_token";
const API_BASE_URL = (import.meta.env.VITE_YUNIKO_API_URL || "https://yuniko-api.lafatriniainaallane.workers.dev").replace(/\/+$/, "");

export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: "Bearer " + token } : {}),
    ...((options.headers ?? {}) as Record<string, string>),
  };
  const normalizedPath = path.startsWith("/") ? path : "/" + path;
  return fetch(API_BASE_URL + "/api" + normalizedPath, { ...options, headers });
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
