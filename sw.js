// Cachea el "shell" (html/css/js) para que la app abra sin internet -- es un
// puesto de tacos, no una oficina. Los datos NUNCA pasan por aquí: los
// tickets viven en IndexedDB en el propio dispositivo (js/almacen.js); la
// nube llega hasta la Fase 2.

// build.py reescribe esta línea en CADA build con un hash del contenido de
// index.html/css/js/manifest -- nunca hay que subir este número a mano.
// Sin esto, un service worker viejo se queda serviendo la versión anterior
// indefinidamente porque el navegador lo ve "igual" y no se molesta en
// revisar si cambió.
const CACHE = 'taqueria-be921bb0dc';

const ARCHIVOS = [
  './index.html',
  './css/estilos.css',
  './js/app.js',
  './manifest.json',
  './icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((cacheado) => {
      const red = fetch(e.request)
        .then((resp) => {
          if (resp.ok) caches.open(CACHE).then((c) => c.put(e.request, resp.clone()));
          return resp;
        })
        .catch(() => cacheado);
      return cacheado || red;
    })
  );
});
