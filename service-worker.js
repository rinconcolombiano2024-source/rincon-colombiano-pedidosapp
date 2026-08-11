const CACHE_NAME = "rc-ordera-v79-location-i18n";
const APP_FILES = [
  "./",
  "./index.html",
  "./cliente.html",
  "./colaborador.html",
  "./mesero.html",
  "./admin.html",
  "./styles.css",
  "./app.js",
  "./cliente.js",
  "./colaborador.js",
  "./mesero.js",
  "./admin.js",
  "./auto-translate.js",
  "./supabase-config.js",
  "./manifest.webmanifest",
  "./cliente-manifest.webmanifest",
  "./colaborador-manifest.webmanifest",
  "./admin-manifest.webmanifest",
  "./app-icon.svg",
  "./app-icon-192.png",
  "./app-icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(async () => {
        const cachedRequest = await caches.match(event.request, { ignoreSearch: true });
        if (cachedRequest) return cachedRequest;
        const pageName = requestUrl.pathname.split("/").pop() || "index.html";
        const pageFallbacks = new Set(["index.html", "cliente.html", "colaborador.html", "mesero.html", "admin.html"]);
        return caches.match(pageFallbacks.has(pageName) ? `./${pageName}` : "./index.html");
      })
  );
});
self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {
      title: "RC ORDERA",
      body: event.data ? event.data.text() : "Nuevo pedido disponible.",
    };
  }

  const title = data.title || "Nuevo domicilio - RC ORDERA";

  const options = {
    body:
      data.body ||
      "Hay un nuevo pedido disponible. Abre RC ORDERA para aceptarlo.",

    icon: "./app-icon-192.png",
    badge: "./app-icon-192.png",

    tag: data.tag || "rc-ordera-delivery",

    renotify: true,
    requireInteraction: true,

    vibrate: [500, 200, 500, 200, 800],

    data: {
      url: data.url || "./colaborador.html?view=offers",
      assignment_id: data.assignment_id || "",
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification.data?.url ||
    "./colaborador.html?view=offers";

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      return clients.openWindow(targetUrl);
    })
  );
});
