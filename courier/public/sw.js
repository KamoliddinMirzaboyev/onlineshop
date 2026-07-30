// BB Kuryer — Web Push service worker
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
    title: data.title || "BB Kuryer",
    body: data.body || "",
    url: data.url || "/orders",
    tag: data.tag || "courier-order",
  };

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Faqat haqiqatan focus — ekran o'chiqda OS banner chiqsin
      const focused = clients.some((c) => c.focused);
      if (focused) {
        clients.forEach((c) => c.postMessage({ type: "push", payload }));
        // Focus bo'lsa ham qisqa banner (ba'zi brauzerlarda toast eshitilmaydi)
      }

      return self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: payload.tag,
        renotify: true,
        requireInteraction: true,
        silent: false,
        vibrate: [200, 100, 200, 100, 200],
        data: { url: payload.url },
        actions: [
          { action: "open", title: "Ochish" },
        ],
      });
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/orders";
  const target = new URL(url, self.location.origin);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          if ("navigate" in client) client.navigate(target.href);
          return client.focus();
        }
      }
      return self.clients.openWindow(target.href);
    })
  );
});
