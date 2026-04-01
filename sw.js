const CACHE_NAME = "routesaver-v6";

const urlsToCache = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./public/pages/dashboard.html",
  "./public/pages/register.html",
  "./public/css/auth.css",
  "./public/css/dashboard.css",
  "./public/css/style.css",
  "./public/js/auth.js",
  "./public/js/dashboard.js",
  "./public/js/firebase-config.js",
  "./public/img/favicon-64.png",
  "./public/img/favicon-192.png",
  "./public/img/favicon-512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  // não interceptar arquivos externos
  if (requestUrl.origin !== location.origin) return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});