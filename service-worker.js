const CACHE_NAME = "rc-ordera-v76-region-print-history";
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
