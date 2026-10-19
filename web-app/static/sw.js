// VERSION is filled in by build.py (content hash) – every content change ships a new cache.
const VERSION = "__BUILD__";
const CACHE = "zpevnik-" + VERSION;
const ASSETS = [
  "./", "style.css", "app.js", "chords.js", "songs.json", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png",
  "icons/apple-touch-icon.png", "icons/favicon-32.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(ASSETS.map(async (url) => {
        // fetch + put instead of addAll: put() overwrites, addAll() rejects on concurrent installs
        const res = await fetch(new Request(url, { cache: "reload" }));
        if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
        await cache.put(url, res);
      })))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("zpevnik-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first: the app opens instantly even offline. New data arrives with a new SW version.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      if (req.mode === "navigate") return caches.match("./").then((r) => r || fetch(req));
      return fetch(req);
    })
  );
});
