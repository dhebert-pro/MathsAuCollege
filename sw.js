const CACHE_NAME = "maths-college-v4";
const APP_SHELL = [
  "./",
  "./index.html",
  "./professeur.html",
  "./styles.css?v=0.2.0",
  "./professeur.css?v=0.2.0",
  "./app.js?v=0.2.0",
  "./professeur.js?v=0.2.0",
  "./course-store.js?v=0.2.0",
  "./pdf-export.js?v=0.2.0",
  "./vendor/jspdf.umd.min.js?v=0.2.0",
  "./manifest.webmanifest",
  "./assets/logo.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html"))),
  );
});
