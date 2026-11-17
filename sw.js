
const CACHE_STATIC_NAME = 'static-outbox-v2';

const STATIC_FILES = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db-helper.js',
  './manifest.json'
];

// INSTALACIÓN: guardar los archivos del App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_FILES);
      })
      .then(() => self.skipWaiting())
  );
});

// ACTIVACIÓN: eliminar cachés anteriores
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(
        nombres
          .filter((nombre) => nombre !== CACHE_STATIC_NAME)
          .map((nombre) => caches.delete(nombre))
      ))
      .then(() => self.clients.claim())
  );
});

// FETCH: estrategia Cache First para peticiones GET
self.addEventListener('fetch', (event) => {

  // No interceptar POST ni otros métodos
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((respuesta) => {
        // Si existe en caché, devolverla
        if (respuesta) {
          return respuesta;
        }

        // Si no existe, intentar obtenerla de Internet
        return fetch(event.request);
      })
  );
});
