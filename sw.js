// Service worker: cachea el "cascarón" de la app para carga instantánea.
// Los datos (POST a la API) nunca se cachean.
var CACHE = 'ga-pwa-v130';
var ASSETS = ['./', './index.html',   './js/gagraf.js', './js/analisis.js', './js/arranque.js', './js/brokers.js', './js/buscador.js', './js/config.js', './js/graficos.js', './js/ia.js', './js/nucleo.js', './js/paneles.js', './js/seguridad.js', './js/sincronizar.js', './js/trade.js', './js/vistas.js', './js/watchlist.js',
  './fonts/manrope.woff2', './fonts/montserrat-500.woff2',
  './apple-touch-icon.png', './icon-512.png', './favicon.png', './manifest.json'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS.map(function (u) { return new Request(u, { cache: 'reload' }); })); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// --- Web Push (27/08/2026): las alertas de precio de la watchlist ---
// El Worker manda el payload cifrado (aes128gcm) y aca solo se muestra. En
// iOS es OBLIGATORIO mostrar una notificacion por cada push recibido: un
// push "silencioso" hace que Safari revoque la suscripcion.
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) {}
  e.waitUntil(self.registration.showNotification(d.titulo || 'GA Portfolio', {
    body: d.cuerpo || '',
    icon: './icon-512.png',
    badge: './favicon.png',
    tag: d.tag || 'ga-alerta',
    data: { url: d.url || './' }
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (ws) {
    for (var i = 0; i < ws.length; i++) {
      if ('focus' in ws[i]) return ws[i].focus();
    }
    return self.clients.openWindow('./');
  }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return; // la API es POST: siempre a la red
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // TradingView: red
  // Shell propio: CACHE-FIRST (R4). El shell esta VERSIONADO — cada
  // publicacion sube CACHE y la instalacion baja todos los ASSETS de nuevo —
  // asi que revalidarlo en cada apertura era pagar ~20 pedidos que competian
  // con el pedido de datos para recibir "no cambio" casi siempre. Del cache
  // directo; a la red solo si falta (test-html vigila que ningun asset quede
  // fuera de la lista). La actualizacion llega por el ciclo normal del
  // service worker: el navegador re-lee sw.js, ve otro CACHE e instala.
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      return cached || fetch(e.request).then(function (resp) {
        if (resp && resp.ok) {
          var copy = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return resp;
      });
    })
  );
});
