const CACHE_NAME = "rc-ordera-v91-0-4-v6-verified-20261016-settings-session-r27";
const APP_FILES = [
  "./",
  "./index.html",
  "./portal.html",
  "./centro-integraciones.html",
  "./centro-integraciones-status.js",
  "./restaurant-fiscal-ui.js",
  "./local-qr.js",
  "./install-app.js",
  "./install-app.css",
  "./portal-manifest.webmanifest",
  "./portal-manifest.pl.webmanifest",
  "./portal-manifest.en.webmanifest",
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
  "./vendor/qrcode-generator-2.0.4.js",
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

// Cache one canonical entry per known asset: never cache unbounded query variants.
const STATIC_CACHE_PATHS = new Set(APP_FILES.map((file) => new URL(file, self.location.href).pathname));
function staticCacheKey(request) {
  const url = new URL(request.url);
  return url.origin === self.location.origin && STATIC_CACHE_PATHS.has(url.pathname)
    ? url.origin + url.pathname : null;
}

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
  const key = staticCacheKey(request);
  return key ? (await caches.open(CACHE_NAME)).match(key) : undefined;
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

        const key = staticCacheKey(event.request);
        if (key) {
          const responseClone = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.put(key, responseClone).catch(() => {}))
          );
        }
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
    const key = staticCacheKey(event.request);
    if (key) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(key, response.clone()).catch(() => {});
    }
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

  // Null/array JSON payloads must not crash push delivery.
  if (!data || typeof data !== "object" || Array.isArray(data)) data = {};
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

function safeNotificationUrl(value) {
  const fallback = new URL("./colaborador.html?view=offers&app=v91.0.4", self.location.href);
  const allowed = new URL("./colaborador.html", self.location.href);
  if (typeof value !== "string" || value.length > 2048) return fallback.href;
  try {
    const target = new URL(value, self.location.href);
    return target.origin === self.location.origin && target.pathname === allowed.pathname &&
      !target.username && !target.password ? target.href : fallback.href;
  } catch { return fallback.href; }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = safeNotificationUrl(event.notification.data?.url);
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Never replace an active restaurant POS, checkout or administration tab.
      const existingCourier = windowClients.find((client) => {
        try {
          const current = new URL(client.url);
          return current.origin === self.location.origin &&
            current.pathname === new URL("./colaborador.html", self.location.href).pathname &&
            typeof client.navigate === "function";
        } catch { return false; }
      });
      if (!existingCourier) return clients.openWindow(targetUrl);
      return existingCourier.navigate(targetUrl)
        .then((navigated) => (navigated || existingCourier).focus())
        .catch(() => clients.openWindow(targetUrl));
    })
  );
});
