/**
 * Yuniko API client.
 * All application HTTP requests must go through this module.
 */

const TOKEN_KEY = "yuniko_token";
const DEFAULT_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 90_000;
const DEFAULT_API_BASE_URL = "https://yuniko-api.lafatriniainaallane.workers.dev";
const API_BASE_URL = String(import.meta.env.VITE_API_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, "");
let authFailureHandled = false;

function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}/api${normalizedPath}`;
}

function handleUnauthorized(path: string): void {
  if (authFailureHandled || path === "/auth/login" || path === "/auth/signup") return;
  authFailureHandled = true;
  localStorage.removeItem(TOKEN_KEY);
  try { window.dispatchEvent(new CustomEvent("yuniko:auth-expired")); } catch {}
  if (window.location.pathname !== "/login") window.location.assign("/login");
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
  const providedHeaders = { ...((options.headers ?? {}) as Record<string, string>) };
  const providedAuthorization = providedHeaders.Authorization ?? providedHeaders.authorization;
  const hasUsableAuthorization = typeof providedAuthorization === "string" && /^Bearer\s+[^\s]+$/i.test(providedAuthorization) && !/^Bearer\s+(null|undefined)$/i.test(providedAuthorization);
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...providedHeaders };
  if (!hasUsableAuthorization && token) headers.Authorization = `Bearer ${token}`;
  else if (!hasUsableAuthorization && !token) delete headers.Authorization;

  const isRealtime = headers.Accept === "text/event-stream";
  const controller = new AbortController();
  const timeout = isRealtime ? undefined : window.setTimeout(() => controller.abort(), path.includes("/media/upload") ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);
  const callerSignal = options.signal;
  const onAbort = () => controller.abort();
  callerSignal?.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetch(apiUrl(path), { ...options, headers, signal: controller.signal });
    if (response.status === 401) handleUnauthorized(path);
    return response;
  } catch (err: unknown) {
    let message = "Network error";
    try { message = err && typeof err === "object" && "message" in err ? String((err as { message?: unknown }).message ?? err) : String(err ?? "Unknown network error"); } catch { message = "Network error"; }
    const lower = message.toLowerCase();
    if (lower.includes("aborted") || lower.includes("timeout") || lower.includes("request timed out")) throw new Error(`Request timed out or was aborted while calling ${path}`);
    throw new Error(`Network error while calling ${path}: ${message}`);
  } finally {
    if (timeout !== undefined) window.clearTimeout(timeout);
    callerSignal?.removeEventListener("abort", onAbort);
  }
}

async function uploadInlineImage(dataUrl: string): Promise<string> {
  const response = await apiFetch("/media/upload", { method: "POST", body: JSON.stringify({ dataUrl, kind: "image", filename: `yuniko-image-${Date.now()}.jpg` }) });
  const raw = await response.text();
  let data: any = null;
  if (raw) { try { data = JSON.parse(raw); } catch {} }
  if (!response.ok || !data?.url) throw new Error(data?.error ?? `Media upload failed (${response.status})`);
  return String(data.url);
}

async function prepareCreateBody(path: string, options: RequestInit): Promise<RequestInit> {
  if (options.method?.toUpperCase() !== "POST" || (path !== "/posts" && path !== "/stories") || typeof options.body !== "string") return options;
  let body: any;
  try { body = JSON.parse(options.body); } catch { return options; }
  if (typeof body?.mediaUrl !== "string" || !body.mediaUrl.startsWith("data:image/")) return options;
  const uploadedUrl = await uploadInlineImage(body.mediaUrl);
  return { ...options, body: JSON.stringify({ ...body, mediaUrl: uploadedUrl }) };
}

export async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    const prepared = await prepareCreateBody(path, options);
    const res = await apiFetch(path, prepared);
    const raw = await res.text();
    let data: any = null;
    if (raw) { try { data = JSON.parse(raw); } catch {} }
    if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
    if (data === null) throw new Error("Invalid server response");
    return data as T;
  } catch (err: any) {
    console.error(`apiJson error for ${path}:`, err);
    try {
      const mod = await import("@/hooks/use-toast");
      if (mod && typeof mod.toast === "function") mod.toast({ title: err?.message ? String(err.message).slice(0,100) : "Network error", description: err?.message ?? String(err), open: true });
    } catch {}
    throw err;
  }
}
