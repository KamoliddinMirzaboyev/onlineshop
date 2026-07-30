// Barakali Bozor Kuryer — Web Push service worker (plain, no build step).
// Registered manually from src/push.ts.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : "" };
  }

  const payload = {
    title: data.title || "Barakali Bozor Kuryer",
    body: data.body || "",
    url: data.url || "/",
    tag: data.tag,
  };

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // If a courier already has the app open & focused, skip the OS banner
        // and let the page show an in-app toast instead (less intrusive,
        // and avoids a duplicate when they're already looking at the screen).
        // Faqat haqiqatan focus bo'lgan oynada banner o'rniga in-app toast.
        // Ekran o'chiq / app background → OS bildirishnoma.
        const focused = clients.some((c) => c.focused);
        if (focused) {
          clients.forEach((c) => c.postMessage({ type: "push", payload }));
          return;
        }
        return self.registration.showNotification(payload.title, {
          body: payload.body,
          icon: "/pwa-192.png",
          badge: "/pwa-192.png",
          tag: payload.tag || "courier-order",
          renotify: true,
          requireInteraction: true,
          silent: false,
          vibrate: [200, 100, 200, 100, 200],
          data: { url: payload.url },
        });
      })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  const target = new URL(url, self.location.origin);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (new URL(client.url).pathname === target.pathname && "focus" in client) {
          return client.focus();
        }
      }
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(target.href);
          return client.focus();
        }
      }
      return self.clients.openWindow(target.href);
    })
  );
});
