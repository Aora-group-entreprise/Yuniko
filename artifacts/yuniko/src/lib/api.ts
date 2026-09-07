/**
 * Improved API fetch helper: surface network errors with clearer messages
 * so the UI can display actionable text instead of generic "Failed to fetch".
 * Also logs errors to the console to aid debugging.
 */

const TOKEN_KEY = "yuniko_token";
const DEFAULT_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 90_000;
const DEFAULT_API_BASE_URL = "https://yuniko-api.lafatriniainaallane.workers.dev";
const API_BASE_URL = String(import.meta.env.VITE_API_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, "");

function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}/api${normalizedPath}`;
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers ?? {}) as Record<string, string>),
  };
  const isRealtime = headers.Accept === "text/event-stream";
  const controller = new AbortController();
  const timeout = isRealtime ? undefined : window.setTimeout(() => controller.abort(), path.includes("/media/upload") ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);
  const callerSignal = options.signal;
  const onAbort = () => controller.abort();
  callerSignal?.addEventListener("abort", onAbort, { once: true });

  try {
    // Attempt the network request and surface clearer errors for the UI/logs.
    const response = await fetch(apiUrl(path), { ...options, headers, signal: controller.signal });
    return response;
  } catch (err: unknown) {
    // Normalize error message
    let message = "Network error";
    try {
      if (err && typeof err === "object" && "message" in err) {
        // @ts-ignore
        message = String(err.message ?? err);
      } else {
        message = String(err ?? "Unknown network error");
      }
    } catch {
      message = "Network error";
    }

    // Provide more helpful error text for timeouts/aborts
    if (message.toLowerCase().includes("aborted") || message.toLowerCase().includes("timeout") || message.toLowerCase().includes("request timed out")) {
      const errMsg = `Request timed out or was aborted while calling ${path}`;
      console.error(errMsg, err);
      throw new Error(errMsg);
    }

    const errMsg = `Network error while calling ${path}: ${message}`;
    console.error(errMsg, err);
    throw new Error(errMsg);
  } finally {
    if (timeout !== undefined) window.clearTimeout(timeout);
    callerSignal?.removeEventListener("abort", onAbort);
  }
}

export async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    const res = await apiFetch(path, options);
    const raw = await res.text();
    let data: any = null;
    if (raw) {
      try { data = JSON.parse(raw); } catch { data = null; }
    }
    if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
    if (data === null) throw new Error("Invalid server response");
    return data as T;
  } catch (err) {
    // Re-throw after logging so callers can display messages; messages are already user-friendly
    console.error(`apiJson error for ${path}:`, err);
    throw err;
  }
}
