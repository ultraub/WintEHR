// Self-destructing service worker at CRA's default SW path.
//
// Browsers that installed the pre-Vite service worker keep checking THIS URL
// for updates. Serving a worker that immediately unregisters itself (instead
// of the 404 this path returned after the cutover) converges every stranded
// client: old caches deleted, registration removed, open tabs reloaded onto
// the live bundle. The current app registers /sw.js; this file exists only
// to rescue history.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((client) => client.navigate(client.url));
  })());
});
