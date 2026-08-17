// Service worker: cachea el "cascarón" de la app para carga instantánea.
// Los datos (POST a la API) nunca se cachean.
var CACHE = 'ga-pwa-v61';
var ASSETS = ['./', './index.html',   './js/gagraf.js', './js/analisis.js', './js/arranque.js', './js/brokers.js', './js/buscador.js', './js/config.js', './js/graficos.js', './js/ia.js', './js/nucleo.js', './js/paneles.js', './js/seguridad.js', './js/sincronizar.js', './js/trade.js', './js/vistas.js',
  './apple-touch-icon.png', './icon-512.png', './favicon.png', './manifest.json'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return; // la API es POST: siempre a la red
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // fuentes y TradingView: red
  // Shell propio: responde del caché y actualiza en segundo plano
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      var fresh = fetch(e.request).then(function (resp) {
        if (resp && resp.ok) {
          var copy = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return resp;
      }).catch(function () { return cached; });
      return cached || fresh;
    })
  );
});
