self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch {}
  event.waitUntil(self.registration.showNotification(payload.title || "Yuniko", {
    body: payload.body || "Vous avez une nouvelle notification.",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    tag: payload.tag || `yuniko-notification-${Date.now()}`,
    data: { url: payload.url || "/notifications" },
    vibrate: [100, 50, 100],
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/notifications";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => {
      try { return new URL(client.url).pathname === target; } catch { return false; }
    });
    return existing ? existing.focus() : self.clients.openWindow(target);
  }));
});
