// Mode hors-ligne : cache local pour les leçons déjà visitées (texte, netlist,
// moteur de simulation EEcircuit qui tourne 100% en WASM navigateur), utile en
// atelier technique avec accès internet irrégulier. Le labo CircuitVerse (iframe
// externe) reste hors périmètre — il nécessite une connexion par nature.
//
// Stratégie volontairement restreinte à /cours/* pour éviter de mettre en cache
// des pages sensibles (admin, messagerie) : une page /cours/* peut afficher des
// données propres à l'utilisateur connecté (notes, soumissions), donc le cache
// est purgé à la déconnexion (voir le listener "message" ci-dessous) pour éviter
// qu'un compte suivant sur le même appareil ne voie une version hors-ligne
// obsolète appartenant au compte précédent.
const CACHE_VERSION = "v1";
const STATIC_CACHE = `atlaslab-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `atlaslab-runtime-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_RUNTIME_CACHE") {
    event.waitUntil(caches.delete(RUNTIME_CACHE));
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Fichiers de build Next (JS/CSS, noms de fichiers hashés donc immuables) :
  // cache-first, indispensable pour que le moteur WASM EEcircuit tourne offline.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) event.waitUntil(cache.put(request, response.clone()));
        return response;
      }),
    );
    return;
  }

  // Pages de cours/leçons : network-first (toujours la version la plus fraîche
  // quand il y a du réseau), repli sur la dernière version mise en cache sinon,
  // puis sur la page /offline si la leçon n'a encore jamais été visitée.
  if (request.mode === "navigate" && url.pathname.startsWith("/cours/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            // waitUntil, sinon le SW peut etre suspendu avant la fin de
            // l'ecriture cache une fois la reponse deja renvoyee au client —
            // la page ne serait alors jamais réellement mise en cache.
            event.waitUntil(caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone)));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(RUNTIME_CACHE);
          const cached = await cache.match(request);
          return cached || (await caches.match(OFFLINE_URL));
        }),
    );
  }
});
