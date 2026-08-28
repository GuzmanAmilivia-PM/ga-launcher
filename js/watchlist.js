// Watchlist con alertas de precio (27/08/2026)
// ---------- Watchlist (pestana de la barra) ----------
// Acciones y ETFs que se siguen SIN tenerlos, agregados con el "+" del
// buscador. La campanita arma una alerta de precio: el Worker la revisa cada
// 20 minutos en horario de mercado y manda una notificacion push al telefono
// (aunque la app este cerrada). La alerta es UN disparo: al sonar queda en
// verde y hay que cargar un objetivo nuevo para volver a vigilar.
//
// Mismo patron de datos que los paneles lentos: se pinta el cache local al
// instante y el pedido real corre por atras (cacheLeer/cacheGuardar viven en
// paneles.js, que carga antes que este archivo).

// La clave PUBLICA del par VAPID del Worker (la privada es un secreto de
// alla). Es publica por definicion: el navegador se la da a Apple/Google al
// suscribirse. Si el par se regenerara, hay que pegar la nueva ACA y el
// telefono debe re-suscribirse (la app lo hace sola al guardar una alerta).
var VAPID_PUBLIC = 'BGjJZeqfHKPsNKP050JPlY6iKV-VHFp62Kygt151iviQXZvHbe7l_HfAFsLjD5iVbv-8iyYCg1H1VIEATAog6Zo';

var wlData = null;          // lo ultimo pintado (items del Worker)
var wlCargando = false;
var wlFormAbierto = null;   // symbol con el formulario de alerta desplegado
var wlFormEl = null;        // el formulario vivo (se crea por fila, no en el HTML)

function wlTiene(sym) {
  var s = String(sym || '').toUpperCase();
  var items = (wlData && wlData.items) || [];
  for (var i = 0; i < items.length; i++) {
    if (items[i].symbol === s) return true;
  }
  return false;
}

function cargarWatchlist(forzar) {
  // El estado de las notificaciones es 100% local (permiso + registro): se
  // pinta al entrar, exista o no red — si no, un fallo de carga lo dejaba
  // clavado en "Checking...".
  pintarEstadoPush();
  var c = cacheLeer('ga_cache_wl');
  if (c && c.data) renderWatchlist(c.data);
  if (wlCargando && !forzar) return;
  wlCargando = true;
  google.script.run.withSuccessHandler(function (d) {
    wlCargando = false;
    if (!d || d.ok === false) {
      errorTexto((d && d.mensajes || ['Could not load the watchlist.']).join(' '));
      return;
    }
    cacheGuardar('ga_cache_wl', d);
    renderWatchlist(d);
  }).withFailureHandler(function (err) {
    wlCargando = false;
    // Con cache pintado, un fallo de red no borra la lista.
    if (!(wlData && wlData.items)) errorEnVista('wlAviso', err, 'the watchlist');
  }).getWatchlist();
  function errorTexto(msj) {
    document.getElementById('wlAviso').innerHTML = '<div class="tmsg err">' + esc(msj) + '</div>';
  }
}
document.getElementById('wlRefreshBtn').onclick = function () { cargarWatchlist(true); };

// El boton de la alerta es un "+" y no una campana (pedido de Guzman,
// 27/08/2026 noche). Lo que dice si HAY alerta no es el icono sino su color
// —acento si esta armada, verde si ya sono— mas el objetivo escrito bajo el
// precio; el "+" queda como "sumale algo a este simbolo".
var WL_MAS_SVG = '<svg viewBox="0 0 24 24"><path d="M12 5.5v13M5.5 12h13"/></svg>';
var WL_X_SVG = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>';

function wlChip(pct) {
  if (pct === null || pct === undefined || !isFinite(Number(pct))) return '';
  var v = Number(pct);
  return '<span class="' + (v >= 0 ? 'up' : 'down') + '">' + esc(signoPct(v, 2)) + '</span>';
}

function renderWatchlist(data) {
  wlData = data;
  var body = document.getElementById('wlBody');
  document.getElementById('wlAviso').innerHTML = '';
  body.innerHTML = '';
  var items = data.items || [];
  if (!items.length) {
    body.innerHTML = '<div class="vacio"><span class="vic">&#9734;</span><b>Nothing here yet</b>Search a ticker with the magnifier and tap +.</div>';
    pintarEstadoPush();
    return;
  }
  items.forEach(function (it) {
    var fila = document.createElement('div');
    fila.className = 'wlrow';
    var objetivo = '';
    if (it.alerta) {
      objetivo = '<span class="wl-objetivo">' + (it.alerta.disparada ? '&#10003; hit ' : 'alert ') +
        (it.alerta.direccion === 'sube' ? '&#8805; ' : '&#8804; ') + esc(fmtNum(it.alerta.precio)) + '</span>';
    }
    // El mes de cierres se dibuja con sparkSvg (graficos.js, que carga antes
    // que este archivo): es EL MISMO dibujo de la tarjeta de Posiciones del
    // Inicio, para que las dos pantallas cuenten el mes igual. Sin serie
    // —lo que el proveedor no cubre— la celda queda vacia y no se inventa.
    var spark = (it.spark && it.spark.length > 1 && typeof sparkSvg === 'function')
      ? sparkSvg(it.spark, 64, 28) : '';
    fila.innerHTML = '<div class="wl-main"><span class="sym">' + esc(it.symbol) + '</span>' +
      '<span class="desc">' + esc(it.nombre || '') + '</span></div>' +
      '<div class="wl-spark">' + spark + '</div>' +
      '<div class="wl-precio"><b>' + (it.precio !== null && it.precio !== undefined ? esc(fmtNum(it.precio)) : '&mdash;') + '</b>' +
      wlChip(it.cambioPct) + objetivo + '</div>' +
      '<button class="wl-btn' + (it.alerta ? (it.alerta.disparada ? ' disparada' : ' armada') : '') + '" title="Price alert">' + WL_MAS_SVG + '</button>' +
      '<button class="wl-btn" title="Remove">' + WL_X_SVG + '</button>';
    var botones = fila.querySelectorAll('.wl-btn');
    botones[0].onclick = function () { wlToggleForm(it, fila); };
    botones[1].onclick = function () { wlQuitar(it.symbol, botones[1]); };
    body.appendChild(fila);
  });
  pintarEstadoPush();
}

function wlQuitar(symbol, btn) {
  btn.disabled = true;
  google.script.run.withSuccessHandler(function () {
    cargarWatchlist(true);
  }).withFailureHandler(function (err) {
    btn.disabled = false;
    errorEnVista('wlAviso', err, 'removing ' + symbol);
  }).quitarWatchlist({ symbol: symbol });
}

// El formulario de alerta, UNO por vez, desplegado bajo su fila. Vive en la
// variable wlFormEl (no se busca por id: se crea y se borra por referencia).
function wlToggleForm(it, fila) {
  if (wlFormEl && wlFormEl.parentNode) wlFormEl.parentNode.removeChild(wlFormEl);
  wlFormEl = null;
  if (wlFormAbierto === it.symbol) { wlFormAbierto = null; return; }
  wlFormAbierto = it.symbol;
  var f = document.createElement('div');
  f.className = 'wl-alertform tradeform';
  var actual = (it.precio !== null && it.precio !== undefined) ? fmtNum(it.precio) : null;
  f.innerHTML = '<label for="wlObjetivo">Alert price for ' + esc(it.symbol) +
    (actual ? ' (now ' + esc(actual) + ')' : '') + '</label>' +
    '<input id="wlObjetivo" type="number" inputmode="decimal" step="any" min="0" placeholder="' + (actual ? esc(actual) : '0.00') + '"' +
    (it.alerta ? ' value="' + esc(String(it.alerta.precio)) + '"' : '') + '>' +
    '<button class="bigbtn" id="wlAlertGuardar">Save alert</button>' +
    (it.alerta ? '<button class="ghostbtn" id="wlAlertBorrar">Remove alert</button>' : '') +
    '<div id="wlAlertMsg"></div>';
  fila.parentNode.insertBefore(f, fila.nextSibling);
  wlFormEl = f;
  document.getElementById('wlAlertGuardar').onclick = function () { wlGuardarAlerta(it, this); };
  var borrar = document.getElementById('wlAlertBorrar');
  if (borrar) borrar.onclick = function () { wlMandarAlerta(it.symbol, 0, null, this); };
}

function wlGuardarAlerta(it, btn) {
  var objetivo = parseFloat(document.getElementById('wlObjetivo').value);
  var msg = document.getElementById('wlAlertMsg');
  if (!isFinite(objetivo) || objetivo <= 0) {
    msg.innerHTML = '<div class="tmsg err">Invalid price.</div>';
    return;
  }
  // El permiso de notificaciones se pide ACA, dentro del toque (iOS solo lo
  // acepta en un gesto del usuario, igual que WebAuthn). La suscripcion en
  // si puede seguir despues, ya sin gesto.
  if (window.Notification && Notification.permission === 'default') {
    try { Notification.requestPermission().then(function () { pintarEstadoPush(); suscribirPush(); }); } catch (e) {}
  }
  wlMandarAlerta(it.symbol, objetivo, it.precio, btn);
}

function wlMandarAlerta(symbol, objetivo, referencia, btn) {
  var msg = document.getElementById('wlAlertMsg');
  btn.disabled = true;
  google.script.run.withSuccessHandler(function (res) {
    btn.disabled = false;
    if (!res || res.ok === false) {
      msg.innerHTML = '<div class="tmsg err">' + esc((res && res.mensajes || ['Could not save the alert.']).join(' ')) + '</div>';
      return;
    }
    wlFormAbierto = null;
    suscribirPush();
    cargarWatchlist(true);
  }).withFailureHandler(function (err) {
    btn.disabled = false;
    msg.innerHTML = '<div class="tmsg err">' + esc(msgErr(err, 'The alert')) + '</div>';
  }).alertaWatchlist({ symbol: symbol, precio: objetivo, referencia: referencia });
}

// ---------- Notificaciones push ----------
// La suscripcion se registra en el Worker (tabla push_suscripciones); el
// barrido del cron le empuja las alertas. Re-suscribirse pisa, no duplica,
// asi que llamarlo en cada guardado de alerta es inocuo y repara solo una
// suscripcion vencida.
function wlB64aBytes(s) {
  var b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  var bin = atob(b64);
  var out = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function pushSoportado() {
  return 'serviceWorker' in navigator && 'PushManager' in window && window.Notification;
}

function suscribirPush() {
  if (!pushSoportado() || Notification.permission !== 'granted') return;
  navigator.serviceWorker.ready.then(function (reg) {
    return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: wlB64aBytes(VAPID_PUBLIC) });
  }).then(function (sub) {
    google.script.run.withSuccessHandler(function (res) {
      if (res && res.ok) {
        try { localStorage.setItem('ga_push_ok', '1'); } catch (e) {}
        pintarEstadoPush();
      }
    }).withFailureHandler(function () { /* el proximo guardado reintenta */ })
      .registrarPush({ sub: sub.toJSON() });
  }).catch(function (e) {
    // En iOS suscribir puede fallar si la PWA no esta instalada en la
    // pantalla de inicio; el estado de abajo lo explica.
    pintarEstadoPush();
  });
}

function pintarEstadoPush() {
  var el = document.getElementById('wlPushEstado');
  var btn = document.getElementById('wlPushProbar');
  if (!el) return;
  var registrado = false;
  try { registrado = localStorage.getItem('ga_push_ok') === '1'; } catch (e) {}
  btn.style.display = 'none';
  if (!pushSoportado()) {
    el.innerHTML = 'This browser cannot receive push notifications. On iPhone, the app must be added to the Home Screen.';
  } else if (Notification.permission === 'denied') {
    el.innerHTML = 'Notifications are blocked. Enable them for this app in iOS Settings &rarr; Notifications.';
  } else if (Notification.permission === 'granted' && registrado) {
    el.innerHTML = 'Alerts will notify this phone, even with the app closed.';
    btn.style.display = '';
  } else {
    el.innerHTML = 'Save a price alert to enable notifications on this phone.';
  }
}

document.getElementById('wlPushProbar').onclick = function () {
  var btn = this;
  var msg = document.getElementById('wlPushMsg');
  btn.disabled = true;
  google.script.run.withSuccessHandler(function (res) {
    btn.disabled = false;
    msg.innerHTML = (res && res.ok)
      ? '<div class="tmsg ok">&#10003; Sent to ' + res.dispositivos + ' device(s). It can take a few seconds.</div>'
      : '<div class="tmsg err">' + esc((res && res.mensajes || ['It did not go out.']).join(' ')) + '</div>';
  }).withFailureHandler(function (err) {
    btn.disabled = false;
    msg.innerHTML = '<div class="tmsg err">' + esc(msgErr(err, 'The test')) + '</div>';
  }).probarPush();
};
