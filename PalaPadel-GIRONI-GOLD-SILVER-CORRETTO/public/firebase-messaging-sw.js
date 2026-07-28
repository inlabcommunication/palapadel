self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("palapadel-shell-v1").then((cache) =>
      cache.addAll(["/", "/news", "/albo", "/campionati", "/manifest.webmanifest", "/logo.png", "/icon-192.png"])
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !["palapadel-shell-v1", "palapadel-pages-v1"].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (
    url.pathname.startsWith("/gestione") ||
    url.pathname.startsWith("/giornate") ||
    url.pathname.startsWith("/analytics") ||
    url.pathname.startsWith("/utenti-impostazioni")
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open("palapadel-pages-v1").then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") return caches.match("/");
        throw new Error("Risorsa non disponibile offline");
      })
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = notification.title || data.title || "PalaPadel";
  const body = notification.body || data.body || "Nuovo aggiornamento disponibile.";
  const url = data.url || payload.fcmOptions?.link || "/notifiche";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url },
      icon: "/icon-192.png",
      badge: "/icon-192.png",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/notifiche";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.postMessage({ type: "notification_opened", url });
            client.navigate(url);
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});
