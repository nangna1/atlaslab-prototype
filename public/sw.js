// Service worker minimal : sa seule raison d'etre est de rendre l'app
// installable (critere PWA), sans mise en cache — l'app est dynamique et
// authentifiee, un cache agressif casserait plus qu'il n'aiderait.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
