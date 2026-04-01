const CACHE_NAME = "routesaver-v5";

const urlsToCache = [
  "/routesaver-firebase/",
  "/routesaver-firebase/index.html",
  "/routesaver-firebase/public/manifest.webmanifest",
  "/routesaver-firebase/public/pages/dashboard.html",
  "/routesaver-firebase/public/pages/register.html",
  "/routesaver-firebase/public/css/auth.css",
  "/routesaver-firebase/public/css/dashboard.css",
  "/routesaver-firebase/public/css/style.css",
  "/routesaver-firebase/public/js/auth.js",
  "/routesaver-firebase/public/js/dashboard.js",
  "/routesaver-firebase/public/js/firebase-config.js",
  "/routesaver-firebase/public/img/favicon-64.png",
  "/routesaver-firebase/public/img/favicon-192.png",
  "/routesaver-firebase/public/img/favicon-512.png"
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