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

  return fetch(getApiPath(path), {
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
      throw new Error("API returned non-JSON (" + res.status + ", " + (contentType || "unknown content-type") + ") from " + getApiPath(path) + ": " + preview);
    }
  }
  if (!res.ok) throw new Error((data && typeof data === "object" && "error" in data && data.error) || "Request failed (" + res.status + ")");
  return data as T;
}
