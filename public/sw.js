// Service worker for the installed app (registered by AppShell.tsx).
// It caches nothing but the offline page: medical records are always loaded fresh and stay behind login,
// so nothing private is left in the browser's cache. Push handlers are ready for reminders.

const OFFLINE_CACHE = "offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== OFFLINE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Page loads that fail because there is no connection show the offline page instead of the browser's error.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Sổ bệnh án", {
      body: data.body || "",
      icon: "/app-icons/192.png",
      badge: "/app-icons/192.png",
      tag: data.tag,
      data: { url: data.url || "/" },
    }),
  );
});

// Tapping a notification focuses the app if it's open, otherwise opens it, on the notification's page.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.location.origin));
      if (open) return open.focus().then((w) => w.navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
