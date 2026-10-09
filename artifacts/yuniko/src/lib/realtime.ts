import { getApiCached, invalidateApiCachePrefix, setApiCached } from "@/lib/api-cache";
import { getSessionCache, invalidateSessionCache, invalidateSessionCachePrefix, setSessionCache } from "@/lib/session-cache";
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

type CacheEnvelope = Record<string, unknown>;

function updateExistingSessionCache<T>(path: string, update: (value: T) => T): boolean {
  const current = getSessionCache<T>(path);
  if (current === undefined) return false;
  setSessionCache(path, update(current));
  return true;
}

async function updateExistingApiCache<T>(path: string, update: (value: T) => T): Promise<boolean> {
  const current = await getApiCached<T>(path);
  if (current === undefined) return false;
  setApiCached(path, update(current));
  return true;
}

function appendUnique<T>(items: T[], item: T, idOf: (value: T) => unknown): T[] {
  const id = idOf(item);
  if (items.some((existing) => idOf(existing) === id)) return items;
  return [item, ...items].slice(0, 100);
}

function applyNotificationToCache(event: RealtimeEvent): void {
  const notification = event.notification as Record<string, unknown> | undefined;
  if (!notification || notification.id == null) return;
  const item = {
    ...notification,
    text: String(notification.text ?? notification.message ?? ""),
    read: Boolean(notification.read),
    actorId: Number(notification.actorId),
    actorDisplayName: String(notification.actorDisplayName ?? "Yuniko user"),
    actorAvatarUrl: notification.actorAvatarUrl ?? null,
  };
  const update = <T extends CacheEnvelope>(value: T): T => {
    const notifications = Array.isArray(value.notifications) ? value.notifications as Array<Record<string, unknown>> : [];
    return { ...value, notifications: appendUnique(notifications, item, (entry) => entry.id) } as T;
  };
  updateExistingSessionCache("/notifications", update);
  void updateExistingApiCache("/notifications", update);
}

function applyMessageToCache(event: RealtimeEvent): boolean {
  const userId = Number(event.userId ?? event.fromUserId);
  const message = event.message as Record<string, unknown> | undefined;
  if (!Number.isInteger(userId) || userId <= 0 || !message || message.id == null) return false;
  const path = `/messages/conversations/${userId}`;
  const update = <T extends CacheEnvelope>(value: T): T => {
    const messages = Array.isArray(value.messages) ? value.messages as Array<Record<string, unknown>> : [];
    return { ...value, messages: appendUnique(messages, message, (entry) => entry.id) } as T;
  };
  updateExistingSessionCache(path, update);
  void updateExistingApiCache(path, update);

  const conversationUpdate = <T extends CacheEnvelope>(value: T): T => {
    if (!Array.isArray(value.conversations)) return value;
    const conversations = (value.conversations as Array<Record<string, unknown>>).map((conversation) => {
      if (Number(conversation.user && (conversation.user as Record<string, unknown>).id) !== userId) return conversation;
      return {
        ...conversation,
        lastMessage: String(message.text ?? (message.type === "image" ? "Photo" : message.type === "audio" ? "Voice message" : "")),
        lastMessageTime: String(message.timestamp ?? new Date().toISOString()),
        unread: Math.max(0, Number(conversation.unread ?? 0)) + 1,
      };
    });
    conversations.sort((a, b) => new Date(String(b.lastMessageTime ?? 0)).getTime() - new Date(String(a.lastMessageTime ?? 0)).getTime());
    return { ...value, conversations } as T;
  };
  updateExistingSessionCache("/messages/conversations", conversationUpdate);
  void updateExistingApiCache("/messages/conversations", conversationUpdate);
  return true;
}

function applyPostToCache(event: RealtimeEvent): boolean {
  const post = event.post as Record<string, unknown> | undefined;
  if (!post || post.id == null) return false;

  // Queue incoming posts separately so a realtime event never jumps the visible feed.
  // The user applies this queue locally by tapping Home; no feed refresh request is needed.
  const path = "/posts/feed/pending-realtime";
  const cached = getSessionCache<{ posts?: Array<Record<string, unknown>> }>(path);
  const queued = Array.isArray(cached?.posts) ? cached.posts : [];
  const posts = appendUnique(queued, post, (entry) => entry.id)
    .sort((a, b) => new Date(String(b.createdAt ?? 0)).getTime() - new Date(String(a.createdAt ?? 0)).getTime())
    .slice(0, 100);
  setSessionCache(path, { posts });
  return true;
}

function invalidateForEvent(event: RealtimeEvent): void {
  const type = String(event.type ?? "");
  if (type === "notification:new") {
    applyNotificationToCache(event);
  } else if (type === "message:new") {
    if (!applyMessageToCache(event)) {
      invalidateSessionCache("/messages/conversations");
      invalidateApiCachePrefix("/messages/conversations");
    }
  } else if (type.startsWith("message:")) {
    invalidateSessionCache("/messages/conversations");
    invalidateSessionCachePrefix("/messages/conversations/");
    invalidateApiCachePrefix("/messages/conversations");
  } else if (type.startsWith("chat:") && !["chat:typing", "chat:presence"].includes(type)) {
    invalidateSessionCache("/messages/conversations");
    invalidateSessionCachePrefix("/messages/conversations/");
    invalidateApiCachePrefix("/messages/conversations");
  }
  if (type === "presence:update") {
    window.dispatchEvent(new CustomEvent("yuniko:presence", { detail: event }));
  }
  if (type.startsWith("story:")) {
    invalidateSessionCache("/stories");
    invalidateApiCachePrefix("/stories");
  }
  if (type === "post:new" || type.startsWith("feed:")) {
    if (!applyPostToCache(event)) {
      invalidateSessionCache("/posts/feed");
      invalidateApiCachePrefix("/posts/");
    }
  } else if (type.startsWith("post:")) {
    invalidateSessionCache("/posts/feed");
    invalidateApiCachePrefix("/posts/");
  }
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
