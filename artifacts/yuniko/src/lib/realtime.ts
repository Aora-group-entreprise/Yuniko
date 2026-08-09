export type RealtimeEvent<T = unknown> = { type: string; data: T };

export function openRealtime(path: string, onEvent: (event: RealtimeEvent) => void): () => void {
  const token = localStorage.getItem("yuniko_token");
  const url = new URL(`/api${path}`, window.location.origin);
  if (token) url.searchParams.set("token", token);
  const source = new EventSource(url.toString());
  const handler = (event: MessageEvent) => {
    try {
      const parsed = JSON.parse(event.data);
      onEvent({ type: event.type || "message", data: parsed });
    } catch { /* ignore malformed events */ }
  };
  source.onmessage = handler;
  source.addEventListener("message", handler);
  return () => source.close();
}

export function subscribeToChat(conversationId: number, onMessage: (data: unknown) => void) {
  return openRealtime(`/conversations/${conversationId}/events`, event => onMessage(event.data));
}

export function subscribeToNotifications(onNotification: (data: unknown) => void) {
  return openRealtime("/notifications/events", event => onNotification(event.data));
}

export function subscribeToFeed(onPost: (data: unknown) => void) {
  return openRealtime("/posts/feed/events", event => onPost(event.data));
}
