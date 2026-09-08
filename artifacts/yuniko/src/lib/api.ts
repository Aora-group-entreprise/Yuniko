/**
 * Improved API fetch helper: surface network errors with clearer messages
 * so the UI can display actionable text instead of generic "Failed to fetch".
 * Also logs errors to the console and shows a toast in the UI.
 */

const TOKEN_KEY = "yuniko_token";
const DEFAULT_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 90_000;
const DEFAULT_API_BASE_URL = "https://yuniko-api.lafatriniainaallane.workers.dev";
const API_BASE_URL = String(import.meta.env.VITE_API_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, "");
const FEED_CACHE_KEY = "yuniko_feed_cache_v2";
const FEED_CACHE_TTL = 5 * 60_000;
const FEED_REFRESH_COOLDOWN = 30_000;
const FEED_POST_USERS_KEY = "yuniko_feed_post_users_v2";
const FOLLOW_STATE_KEY = "yuniko_follow_state_v1";

function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}/api${normalizedPath}`;
}

function isFeedRequest(input: RequestInfo | URL): boolean {
  try {
    const url = typeof input === "string" ? new URL(input, window.location.origin) : new URL(input instanceof Request ? input.url : String(input));
    return url.pathname === "/api/posts/feed" && url.searchParams.get("cursor") === null;
  } catch {
    return false;
  }
}

function cloneJsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
}

function readFollowStates(): Record<string, boolean> {
  try {
    const raw = sessionStorage.getItem(FOLLOW_STATE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeFollowState(userId: number, following: boolean): void {
  try {
    const states = readFollowStates();
    states[String(userId)] = following;
    sessionStorage.setItem(FOLLOW_STATE_KEY, JSON.stringify(states));
  } catch {}
}

function applyFollowState(button: HTMLButtonElement, following: boolean): void {
  button.textContent = following ? "Following" : "Follow";
  button.setAttribute("aria-pressed", String(following));
  button.dataset.yunikoFollowing = String(following);
  button.style.background = following ? "rgba(255,255,255,.1)" : "linear-gradient(135deg, #FF006E, #8B00FF)";
}

let feedRefreshPromise: Promise<Response> | null = null;
let lastFeedRefreshAt = 0;

function installFeedInstantReturn(): void {
  if (typeof window === "undefined" || (window as any).__yunikoFeedCacheInstalled) return;
  (window as any).__yunikoFeedCacheInstalled = true;
  const nativeFetch = window.fetch.bind(window);

  const refreshFeed = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (feedRefreshPromise) return feedRefreshPromise;
    lastFeedRefreshAt = Date.now();
    feedRefreshPromise = nativeFetch(input, init).then(async response => {
      if (response.ok) {
        const data = await response.clone().json().catch(() => null);
        if (data) {
          try {
            sessionStorage.setItem(FEED_CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
            const posts = Array.isArray(data.posts) ? data.posts : [];
            const users: Record<string, number> = {};
            for (const p of posts) if (p?.id != null && p?.userId != null) users[String(p.id)] = Number(p.userId);
            sessionStorage.setItem(FEED_POST_USERS_KEY, JSON.stringify(users));
          } catch {}
        }
      }
      return response;
    }).finally(() => {
      feedRefreshPromise = null;
    });
    return feedRefreshPromise;
  };

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!isFeedRequest(input) || (init?.method && init.method.toUpperCase() !== "GET")) return nativeFetch(input, init);
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return nativeFetch(input, init);

    let cached: { at: number; data: any } | null = null;
    try {
      const raw = sessionStorage.getItem(FEED_CACHE_KEY);
      if (raw) cached = JSON.parse(raw);
    } catch {}

    const cacheIsFresh = Boolean(cached?.data && Date.now() - Number(cached?.at || 0) < FEED_CACHE_TTL);
    const canRefresh = Date.now() - lastFeedRefreshAt >= FEED_REFRESH_COOLDOWN;

    if (cacheIsFresh) {
      if (canRefresh) void refreshFeed(input, init).catch(() => {});
      return cloneJsonResponse(cached!.data);
    }

    return refreshFeed(input, init);
  };
}

function installFollowInstantAction(): void {
  if (typeof window === "undefined" || (window as any).__yunikoFollowInstalled) return;
  (window as any).__yunikoFollowInstalled = true;

  document.addEventListener("click", async event => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest("button") as HTMLButtonElement | null;
    if (!button) return;
    const card = button.closest('[data-testid^="post-card-"]') as HTMLElement | null;
    if (!card) return;
    const label = button.textContent?.trim().toLowerCase() ?? "";
    if (!/^(follow|suivre|suivi|following)$/.test(label)) return;
    if (button.dataset.yunikoFollowBusy === "true") return;

    let postId = card.getAttribute("data-testid")?.replace(/^post-card-/, "") ?? "";
    if (postId.startsWith("live_")) postId = postId.slice(5);
    let users: Record<string, number> = {};
    try { users = JSON.parse(sessionStorage.getItem(FEED_POST_USERS_KEY) || "{}"); } catch {}
    const userId = Number(users[postId]);
    if (!Number.isSafeInteger(userId) || userId <= 0) return;

    event.preventDefault();
    event.stopPropagation();
    button.dataset.yunikoFollowBusy = "true";
    const states = readFollowStates();
    const wasFollowing = states[String(userId)] ?? /^(suivi|following)$/.test(label);
    const next = !wasFollowing;

    writeFollowState(userId, next);
    applyFollowState(button, next);

    try {
      const res = await apiFetch(`/users/${userId}/follow`, { method: next ? "POST" : "DELETE" });
      if (!res.ok) throw new Error("Follow request failed");
      const data = await res.json().catch(() => ({}));
      const following = Boolean(data?.following ?? next);
      writeFollowState(userId, following);
      applyFollowState(button, following);
    } catch {
      writeFollowState(userId, wasFollowing);
      applyFollowState(button, wasFollowing);
    } finally {
      delete button.dataset.yunikoFollowBusy;
    }
  }, true);
}

installFeedInstantReturn();
installFollowInstantAction();

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
  const providedHeaders = { ...((options.headers ?? {}) as Record<string, string>) };
  const providedAuthorization = providedHeaders.Authorization ?? providedHeaders.authorization;
  const hasUsableAuthorization = typeof providedAuthorization === "string" && /^Bearer\s+[^\s]+$/i.test(providedAuthorization) && !/^Bearer\s+(null|undefined)$/i.test(providedAuthorization);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...providedHeaders,
  };
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
    return response;
  } catch (err: unknown) {
    let message = "Network error";
    try {
      if (err && typeof err === "object" && "message" in err) message = String((err as any).message ?? err);
      else message = String(err ?? "Unknown network error");
    } catch {
      message = "Network error";
    }
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
  } catch (err: any) {
    console.error(`apiJson error for ${path}:`, err);
    try {
      const mod = await import("@/hooks/use-toast");
      if (mod && typeof mod.toast === "function") {
        const title = err?.message && typeof err.message === "string" ? (err.message.length > 100 ? err.message.slice(0, 97) + "..." : err.message) : "Network error";
        mod.toast({ title, description: typeof err === "string" ? err : (err?.message ?? String(err)), open: true });
      }
    } catch {}
    throw err;
  }
}
