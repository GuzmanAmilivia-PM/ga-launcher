// Service worker: cachea el "cascarón" de la app para carga instantánea.
// Los datos (POST a la API) nunca se cachean.
var CACHE = 'ga-pwa-v249';
// './' y NO también './index.html' (24/09/2026): son la misma página, y con
// las dos cada versión nueva la bajaba dos veces (50 KB de más). Quien pida
// index.html por su nombre recibe './' (ver el fetch, abajo).
var ASSETS = ['./', './css/estilos.css',   './js/gagraf.js', './js/analisis.js', './js/arranque.js', './js/brokers.js', './js/buscador.js', './js/calor.js', './js/config.js', './js/graficos.js', './js/ia.js', './js/nucleo.js', './js/paneles.js', './js/rendimiento.js', './js/seguridad.js', './js/sincronizar.js', './js/tablero.js', './js/trade.js', './js/bancos.js', './js/vistas.js', './js/watchlist.js', './js/exposicion.js', './js/libro.js',
  './manifest.json'];
// Lo ESTABLE (5/09/2026): fuentes e iconos, ~110 KB que no cambian desde agosto
// y se volvian a bajar con CADA version (entre 2 y 9 por dia). Viven en un cache
// aparte que NO se renueva con CACHE: en install solo se baja lo que falte. Si
// alguno cambia de verdad, se sube ESTABLES ('ga-estables-v2') y se baja todo de
// nuevo. El nombre NO empieza con 'ga-pwa-' a proposito: versionShell (vistas.js)
// saca el numero de version de los caches que si empiezan asi.
var ESTABLES = 'ga-estables-v1';
// Los dos logos (24/09/2026) viajaban en base64 DENTRO de estilos.css —53 KB
// de los 140 del CSS—, así que se volvían a bajar con cada versión. Ahora son
// archivos y viven acá. Si cambia el logo, scripts/logo.js --aplicar sube
// ESTABLES solo.
var ASSETS_ESTABLES = ['./fonts/manrope.woff2',
  './fonts/montserrat-700.woff2', './logo-menu.png', './logo-marca.png',
  './apple-touch-icon.png', './icon-512.png', './favicon.png'];

// El shell se REVALIDA, no se rebaja entero (19/10/2026, pasada de
// rendimiento). Con cache:'reload' cada version bajaba los 24 archivos de
// nuevo —224 KB comprimidos, medidos contra GitHub Pages— aunque cambiara uno
// solo, y se publica entre 2 y 9 veces por dia. Con 'no-cache' el navegador
// pregunta con el ETag y GitHub Pages contesta 304 (sin cuerpo) lo que no
// cambio: la version que toca un archivo baja ese archivo. Igual de fresco:
// los dos modos consultan al servidor; ninguno usa una copia sin preguntar.
self.addEventListener('install', function (e) {
  e.waitUntil(Promise.all([
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS.map(function (u) { return new Request(u, { cache: 'no-cache' }); })); }),
    caches.open(ESTABLES).then(function (c) {
      return Promise.all(ASSETS_ESTABLES.map(function (u) {
        return c.match(u).then(function (hay) { return hay ? null : c.add(u); });
      }));
    })
  ]).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE && k !== ESTABLES; }).map(function (k) { return caches.delete(k); }));
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

// La del corte de BTG (30/09/2026) trae url './#btg': con la app abierta se
// le avisa por mensaje (bancos.js abre BTG); cerrada, abre con el hash.
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (ws) {
    for (var i = 0; i < ws.length; i++) {
      if ('focus' in ws[i]) {
        if (/#btg$/.test(url)) ws[i].postMessage({ abrir: 'btg' });
        return ws[i].focus();
      }
    }
    return self.clients.openWindow(url);
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
  var pedido = /\/index\.html$/.test(url.pathname) ? new Request('./') : e.request;
  e.respondWith(
    caches.match(pedido).then(function (cached) {
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
