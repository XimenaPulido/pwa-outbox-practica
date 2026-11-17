const CACHE_STATIC_NAME = 'static-outbox-v2';
const STATIC_FILES = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db-helper.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC_NAME)
      .then((cache) => cache.addAll(STATIC_FILES))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(
        nombres
          .filter((nombre) => nombre !== CACHE_STATIC_NAME)
          .map((nombre) => caches.delete(nombre))
      ))
  );
});

// Solo GET desde caché; los POST no se interceptan
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then((respuesta) => respuesta || fetch(event.request))
  );
});
