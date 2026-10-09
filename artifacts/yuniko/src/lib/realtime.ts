import { invalidateApiCachePrefix } from "@/lib/api-cache";
import { invalidateSessionCache, invalidateSessionCachePrefix } from "@/lib/session-cache";
import { apiJson } from "@/lib/api";

type RealtimeEvent = Record<string, unknown> & { type?: string };

let socket: WebSocket | null = null;
let feedSocket: WebSocket | null = null;
let feedRetryTimer: number | null = null;
let activeUserId: number | null = null;
let retryTimer: number | null = null;
let presenceOfflineTimer: number | null = null;
let retryDelay = 1000;
let stopped = true;

function invalidateForEvent(event: RealtimeEvent): void {
  const type = String(event.type ?? "");
  const notification = event.notification as Record<string, unknown> | undefined;
  const notificationType = String(notification?.type ?? "");
  if (type === "notification:new") {
    invalidateSessionCache("/notifications");
    invalidateSessionCache("/posts/feed");
    invalidateSessionCache("/messages/conversations");
    invalidateApiCachePrefix("/notifications");
    invalidateApiCachePrefix("/posts/");
    invalidateApiCachePrefix("/messages/");
    if (["like", "comment", "follow", "story_reaction", "story_reply", "story_view"].includes(notificationType)) {
      invalidateSessionCache("/stories");
    }
  }
  if (type.startsWith("message:") || type.startsWith("chat:")) {
    invalidateSessionCache("/messages/conversations");
    invalidateSessionCachePrefix("/messages/conversations/");
    invalidateApiCachePrefix("/messages/conversations");
    const otherUserId = Number(event.userId ?? event.fromUserId);
    if (Number.isInteger(otherUserId) && otherUserId > 0) {
      invalidateSessionCache(`/messages/conversations/${otherUserId}`);
    }
  }
  if (type === "presence:update") {
    window.dispatchEvent(new CustomEvent("yuniko:presence", { detail: event }));
  }
  if (type.startsWith("story:")) { invalidateSessionCache("/stories"); invalidateApiCachePrefix("/stories"); }
  if (type.startsWith("post:") || type.startsWith("feed:")) { invalidateSessionCache("/posts/feed"); invalidateApiCachePrefix("/posts/"); }
}

function connectFeed(userId: number): void {
  if (stopped || activeUserId !== userId || typeof window === "undefined") return;
  if (feedSocket && (feedSocket.readyState === WebSocket.OPEN || feedSocket.readyState === WebSocket.CONNECTING)) return;
  const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
  const next = new WebSocket(`${scheme}//${window.location.host}/api/realtime/feed`);
  feedSocket = next;
  next.onmessage = (message) => {
    let event: RealtimeEvent;
    try { event = JSON.parse(String(message.data)) as RealtimeEvent; } catch { return; }
    invalidateForEvent(event);
    window.dispatchEvent(new CustomEvent("yuniko:realtime", { detail: event }));
  };
  next.onerror = () => { try { next.close(); } catch {} };
  next.onclose = () => {
    if (feedSocket === next) feedSocket = null;
    if (stopped || activeUserId !== userId) return;
    if (feedRetryTimer !== null) window.clearTimeout(feedRetryTimer);
    feedRetryTimer = window.setTimeout(() => {
      feedRetryTimer = null;
      connectFeed(userId);
    }, 5000);
  };
}

function connect(userId: number): void {
  if (stopped || activeUserId !== userId || typeof window === "undefined") return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
  const next = new WebSocket(`${scheme}//${window.location.host}/api/realtime/ws`);
  socket = next;
  next.onopen = () => {
    retryDelay = 1000;
    if (presenceOfflineTimer !== null) window.clearTimeout(presenceOfflineTimer);
    presenceOfflineTimer = null;
    void apiJson("/realtime/presence", { method: "POST", body: JSON.stringify({ online: true }) }).catch(() => {});
    window.dispatchEvent(new CustomEvent("yuniko:realtime-status", { detail: { connected: true } }));
  };
  next.onmessage = (message) => {
    let event: RealtimeEvent;
    try {
      event = JSON.parse(String(message.data)) as RealtimeEvent;
    } catch {
      return;
    }
    invalidateForEvent(event);
    window.dispatchEvent(new CustomEvent("yuniko:realtime", { detail: event }));
  };
  next.onerror = () => {
    try { next.close(); } catch {}
  };
  next.onclose = () => {
    if (socket === next) socket = null;
    window.dispatchEvent(new CustomEvent("yuniko:realtime-status", { detail: { connected: false } }));
    if (presenceOfflineTimer !== null) window.clearTimeout(presenceOfflineTimer);
    presenceOfflineTimer = window.setTimeout(() => {
      presenceOfflineTimer = null;
      if (activeUserId === userId && (!socket || socket.readyState !== WebSocket.OPEN)) {
        void apiJson("/realtime/presence", { method: "POST", body: JSON.stringify({ online: false }) }).catch(() => {});
      }
    }, 10000);
    if (stopped || activeUserId !== userId) return;
    if (retryTimer !== null) window.clearTimeout(retryTimer);
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      connect(userId);
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 30000);
  };
}

export function connectRealtime(userId: number): () => void {
  if (!Number.isInteger(userId) || userId <= 0 || typeof window === "undefined") return () => {};
  if (activeUserId !== userId) disconnectRealtime();
  activeUserId = userId;
  stopped = false;
  connect(userId);
  connectFeed(userId);
  const onOnline = () => {
    if (!socket || socket.readyState === WebSocket.CLOSED) connect(userId);
    if (!feedSocket || feedSocket.readyState === WebSocket.CLOSED) connectFeed(userId);
  };
  window.addEventListener("online", onOnline);
  return () => {
    window.removeEventListener("online", onOnline);
    if (activeUserId === userId) disconnectRealtime();
  };
}

export function disconnectRealtime(): void {
  stopped = true;
  if (activeUserId !== null) {
    void apiJson("/realtime/presence", { method: "POST", body: JSON.stringify({ online: false }) }).catch(() => {});
  }
  activeUserId = null;
  if (retryTimer !== null && typeof window !== "undefined") window.clearTimeout(retryTimer);
  if (feedRetryTimer !== null && typeof window !== "undefined") window.clearTimeout(feedRetryTimer);
  if (presenceOfflineTimer !== null && typeof window !== "undefined") window.clearTimeout(presenceOfflineTimer);
  retryTimer = null;
  feedRetryTimer = null;
  presenceOfflineTimer = null;
  if (socket) {
    socket.onclose = null;
    try { socket.close(1000, "session ended"); } catch {}
  }
  socket = null;
  if (feedSocket) {
    feedSocket.onclose = null;
    try { feedSocket.close(1000, "session ended"); } catch {}
  }
  feedSocket = null;
}
