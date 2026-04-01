const CACHE_NAME = "routesaver-v4";

const urlsToCache = [
    "./",
    "./manifest.webmanifest",
    "./pages/dashboard.html",
    "./pages/register.html",
    "./css/auth.css",
    "./css/dashboard.css",
    "./css/style.css",
    "./js/auth.js",
    "./js/dashboard.js",
    "./js/firebase-config.js",
    "./img/favicon-64.png",
    "./img/favicon-192.png",
    "./img/favicon-512.png"
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