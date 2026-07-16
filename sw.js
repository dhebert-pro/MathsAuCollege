const CACHE_NAME = "maths-college-v23";
const APP_SHELL = [
  "./",
  "./index.html",
  "./professeur.html",
  "./presentation.html",
  "./styles.css?v=0.20.0",
  "./professeur.css?v=0.20.0",
  "./presentation.css?v=0.20.0",
  "./course-content.js?v=0.20.0",
  "./firebase-config.js?v=0.20.0",
  "./firebase-bundle.js?v=0.20.0",
  "./app.js?v=0.20.0",
  "./professeur.js?v=0.20.0",
  "./presentation.js?v=0.20.0",
  "./course-store.js?v=0.20.0",
  "./pdf-export.js?v=0.20.0",
  "./vendor/jspdf.umd.min.js?v=0.20.0",
  "./animations/report-distance-compas.html",
  "./animations/report-distance-compas.css?v=0.20.0",
  "./animations/report-distance-compas.js?v=0.20.0",
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
  const url = new URL(event.request.url);
  if (!["http:", "https:"].includes(url.protocol) || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      }),
  );
});
