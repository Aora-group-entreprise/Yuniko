/**
 * Authenticated API fetch helper.
 * Yuniko's JWT remains the only session mechanism.
 */
const TOKEN_KEY = "yuniko_token";
const DEFAULT_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 90_000;

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers ?? {}) as Record<string, string>),
  };
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), path.includes("/media/upload") ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);
  const callerSignal = options.signal;
  const onAbort = () => controller.abort();
  callerSignal?.addEventListener("abort", onAbort, { once: true });
  try {
    return await fetch(`/api${path}`, { ...options, headers, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
    callerSignal?.removeEventListener("abort", onAbort);
  }
}

export async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, options);
  const raw = await res.text();
  let data: any = null;
  if (raw) {
    try { data = JSON.parse(raw); } catch { data = null; }
  }
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  if (data === null) throw new Error("Invalid server response");
  return data as T;
}
