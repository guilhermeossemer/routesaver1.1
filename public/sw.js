const CACHE_NAME = "routesaver-v2";

const urlsToCache = [
  "./",
  "./index.html",
  "./public/manifest.webmanifest",
  "./public/pages/dashboard.html",
  "./public/pages/register.html",
  "./public/css/dashboard.css",
  "./public/css/auth.css",
  "./public/css/style.css",
  "./public/js/dashboard.js",
  "./public/js/auth.js",
  "./public/js/firebase-config.js",
  "./public/img/favicon-192.png",
  "./public/img/favicon-512.png"
];

// install
self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// activate
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

// fetch
self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  // NÃO cachear externos (Firebase/CDN)
  if (requestUrl.origin !== location.origin) return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});