import { invalidateSessionCache } from "@/lib/session-cache";

type RealtimeEvent = Record<string, unknown> & { type?: string };

let socket: WebSocket | null = null;
let activeUserId: number | null = null;
let retryTimer: number | null = null;
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
    if (["like", "comment", "follow", "story_reaction", "story_reply", "story_view"].includes(notificationType)) {
      invalidateSessionCache("/stories");
    }
  }
  if (type.startsWith("message:") || type.startsWith("chat:")) {
    invalidateSessionCache("/messages/conversations");
    const otherUserId = Number(event.userId ?? event.fromUserId);
    if (Number.isInteger(otherUserId) && otherUserId > 0) {
      invalidateSessionCache(`/messages/conversations/${otherUserId}`);
    }
  }
  if (type.startsWith("story:")) invalidateSessionCache("/stories");
  if (type.startsWith("post:") || type.startsWith("feed:")) invalidateSessionCache("/posts/feed");
}

function connect(userId: number): void {
  if (stopped || activeUserId !== userId || typeof window === "undefined") return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
  const next = new WebSocket(`${scheme}//${window.location.host}/api/realtime/ws`);
  socket = next;
  next.onopen = () => {
    retryDelay = 1000;
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
  const onOnline = () => {
    if (!socket || socket.readyState === WebSocket.CLOSED) connect(userId);
  };
  window.addEventListener("online", onOnline);
  return () => {
    window.removeEventListener("online", onOnline);
    if (activeUserId === userId) disconnectRealtime();
  };
}

export function disconnectRealtime(): void {
  stopped = true;
  activeUserId = null;
  if (retryTimer !== null && typeof window !== "undefined") window.clearTimeout(retryTimer);
  retryTimer = null;
  if (socket) {
    socket.onclose = null;
    try { socket.close(1000, "session ended"); } catch {}
  }
  socket = null;
}
