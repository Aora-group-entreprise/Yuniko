/**
 * Authenticated API fetch helper.
 * Always uses relative /api paths so Replit's path-based routing
 * forwards requests to the API server regardless of environment.
 */
const TOKEN_KEY = "yuniko_token";

export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers ?? {}) as Record<string, string>),
  };
  return fetch(`/api${path}`, { ...options, headers });
}

export async function apiJson<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await apiFetch(path, options);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}
