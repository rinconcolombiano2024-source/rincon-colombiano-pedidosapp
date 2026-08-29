const CACHE_NAME = "rc-ordera-v91-0-3-performance-core";
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
  "./offline-i18n.js",
  "./auto-translate.js",
  "./supabase-config.js",
  "./manifest.webmanifest",
  "./cliente-manifest.webmanifest",
  "./colaborador-manifest.webmanifest",
  "./admin-manifest.webmanifest",
  "./manifest.pl.webmanifest",
  "./manifest.en.webmanifest",
  "./cliente-manifest.pl.webmanifest",
  "./cliente-manifest.en.webmanifest",
  "./colaborador-manifest.pl.webmanifest",
  "./colaborador-manifest.en.webmanifest",
  "./admin-manifest.pl.webmanifest",
  "./admin-manifest.en.webmanifest",
  "./mesero-manifest.webmanifest",
  "./mesero-manifest.pl.webmanifest",
  "./mesero-manifest.en.webmanifest",
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

  const isDocument = event.request.mode === "navigate" || event.request.destination === "document";
  const isCriticalCode = ["script", "style", "worker", "manifest"].includes(event.request.destination);
  if (!isDocument && !isCriticalCode) return;

 if (isCriticalCode) {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseClone = response.clone();

        event.waitUntil(
          caches.open(CACHE_NAME).then((cache) => {
            return cache.put(event.request, responseClone);
          })
        );

        return response;
      })
      .catch(() => caches.match(event.request))
  );

  return;
}
const updateCache = fetch(event.request).then(async (response) => {
  if (response && response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(event.request, response.clone());
  }
  return response;
});
  event.respondWith(
    updateCache.catch(async () => {
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

  const language = ["es", "pl", "en"].includes(String(data.language || "").toLowerCase())
    ? String(data.language).toLowerCase()
    : "es";
  const fallback = {
    es: {
      title: "Nuevo domicilio - RC ORDERA",
      body: "Hay un nuevo pedido disponible. Abre RC ORDERA para aceptarlo.",
    },
    pl: {
      title: "Nowa dostawa - RC ORDERA",
      body: "Dostępne jest nowe zamówienie. Otwórz RC ORDERA, aby je przyjąć.",
    },
    en: {
      title: "New delivery - RC ORDERA",
      body: "A new order is available. Open RC ORDERA to accept it.",
    },
  }[language];
  const title = data.title || fallback.title;

  const options = {
    body:
      data.body ||
      fallback.body,

    icon: "./app-icon-192.png",
    badge: "./app-icon-192.png",

    tag: data.tag || "rc-ordera-delivery",

    renotify: true,
    requireInteraction: true,

    vibrate: [500, 200, 500, 200, 800],

    data: {
      url: data.url || (data.assignment_id
        ? `./colaborador.html?view=offers&assignment=${encodeURIComponent(data.assignment_id)}&app=v91.0.2&lang=${language}`
        : `./colaborador.html?view=offers&app=v91.0.2&lang=${language}`),
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
    "./colaborador.html?view=offers&app=v91.0.2";

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

