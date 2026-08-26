const CACHE_NAME = "exercise-tracker-v68";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./i18n.js",
  "./theme.js",
  "./units.js",
  "./script.js",
  "./timer.js",
  "./sports.js",
  "./backup.js",
  "./profile.js",
  "./back-nav.js",
  "./firebase-init.js",
  "./account.js",
  "./friends.js",
  "./leaderboard.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./jba-logo.png",
  "./logo-mark.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Network-first: always try to fetch the latest version when online,
// only fall back to the cached copy when the network is unavailable.
// Cross-origin requests (Firebase Auth/Firestore, Google) are left untouched
// so this cache doesn't interfere with auth/session traffic.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Focus (or open) the app when the user taps a completion notification.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./");
    })
  );
});
