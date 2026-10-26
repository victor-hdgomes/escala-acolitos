// The smallest service worker that makes this app installable.
//
// A browser will not offer to install a site that has no service worker with
// a fetch handler, and without that offer there is no native install dialog
// for the button in the app to open.
//
// It deliberately caches nothing. A schedule changes during the week and the
// whole point of the published link is that it is never out of date, so a
// stale page would be worse than a slow one.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Intentionally empty: every request goes to the network untouched.
});
