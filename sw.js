// Mode hors connexion : l'app reste utilisable à la salle même sans réseau.
// Changer VERSION à chaque mise à jour pour que les téléphones récupèrent les nouveaux fichiers.
const VERSION = 'v1.5.0';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './app.css',
  './app.js', './db.js', './seed.js', './score.js', './freedb.js', './ideas.js', './nutrition.js', './foods.js',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open('shell-' + VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== 'shell-' + VERSION && k !== 'fonts' && k !== 'exo-img').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Polices Google : gardées en cache après le premier chargement.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open('fonts').then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      try { const res = await fetch(e.request); if (res.ok || res.type === 'opaque') c.put(e.request, res.clone()); return res; } catch (err) { return hit || Response.error(); }
    }));
    return;
  }
  // Images de la bibliothèque libre : gardées en cache après le premier affichage (utilisables à la salle sans réseau).
  if (url.hostname === 'raw.githubusercontent.com' && /\.(jpe?g|png|gif)$/i.test(url.pathname)) {
    e.respondWith(caches.open('exo-img').then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      try { const res = await fetch(e.request); if (res.ok || res.type === 'opaque') c.put(e.request, res.clone()); return res; } catch (err) { return Response.error(); }
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // Fichiers de l'app : réseau d'abord (pour les mises à jour), cache si hors connexion.
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open('shell-' + VERSION).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html'))));
});
