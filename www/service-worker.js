const CACHE_NAME = "rc-ordera-v91-0-4-offline-r2";
const APP_FILES = [
  "./",
  "./index.html",
  "./restaurante.html",
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
  "./vendor/supabase-2.57.4.js",
  "./manifest.webmanifest",
  "./restaurante-manifest.webmanifest",
  "./restaurante-manifest.pl.webmanifest",
  "./restaurante-manifest.en.webmanifest",
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
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("rc-ordera-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

async function cachedRuntimeResource(request) {
  const cache = await caches.open(CACHE_NAME);
  const exact = await cache.match(request);
  if (exact) return exact;
  // Precache stores unversioned files; HTML requests scripts with ?v=.
  // Ignore the query only for known static runtime assets, never for API data.
  const pathname = new URL(request.url).pathname;
  const known = APP_FILES.some((file) => new URL(file, self.location.href).pathname === pathname);
  return known ? cache.match(request, { ignoreSearch: true }) : undefined;
}

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
        if (!response || !response.ok) {
          throw new Error(`HTTP ${response ? response.status : "unknown"}`);
        }

        const responseClone = response.clone();

        event.waitUntil(
          caches.open(CACHE_NAME).then((cache) => {
            return cache.put(event.request, responseClone).catch(() => {});
          })
        );

        return response;
      })
      .catch(async () => {
        const cachedResponse = await cachedRuntimeResource(event.request);

        if (cachedResponse) {
          return cachedResponse;
        }

        return new Response("Recurso no disponible sin conexión.", {
          status: 503,
          statusText: "Service Unavailable",
        });
      })
  );

  return;
}
const updateCache = fetch(event.request).then(async (response) => {
  if (!response || !response.ok) throw new Error("Document fetch failed");
  if (response && response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(event.request, response.clone()).catch(() => {});
  }
  return response;
});
  event.respondWith(
    updateCache.catch(async () => {
      const cachedRequest = await cachedRuntimeResource(event.request);
      if (cachedRequest) return cachedRequest;
      const pageName = requestUrl.pathname.split("/").pop() || "index.html";
      const pageFallbacks = new Set(["index.html", "restaurante.html", "cliente.html", "colaborador.html", "mesero.html", "admin.html"]);
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(pageFallbacks.has(pageName) ? `./${pageName}` : "./index.html"))
        || new Response("Página no disponible sin conexión.", { status: 503 });
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
        ? `./colaborador.html?view=offers&assignment=${encodeURIComponent(data.assignment_id)}&app=v91.0.4&lang=${language}`
        : `./colaborador.html?view=offers&app=v91.0.4&lang=${language}`),
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
    "./colaborador.html?view=offers&app=v91.0.4";

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

