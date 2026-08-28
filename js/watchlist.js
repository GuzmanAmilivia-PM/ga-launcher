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
// UN solo panel desplegado por vez, sea el detalle del activo o el formulario
// de la alerta: los dos salen de la misma fila y verlos juntos era ruido.
var wlPanelEl = null;       // el panel vivo (se crea por fila, no vive en el HTML)
var wlPanelSym = null;      // de que simbolo es
var wlPanelTipo = null;     // 'detalle' | 'alerta'

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

// Los iconos de las dos acciones, que viven DEBAJO de la fila y aparecen al
// deslizarla (pedido de Guzman, 27/08/2026 noche: la fila se ve limpia, como
// una de Posiciones; las acciones salen con el dedo, como en Mail).
var WL_MAS_SVG = '<svg viewBox="0 0 24 24"><path d="M12 5.5v13M5.5 12h13"/></svg>';
var WL_X_SVG = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>';

// Debajo del precio va el % del dia... o, cuando ese precio NO es el de ahora,
// una marca que lo dice (27/08/2026). Guzman reporto que "a veces no aparece
// el valor": el proveedor de precios frena por IP compartida y dejaba la fila
// con un guion. Ahora se muestra el ultimo precio conocido, pero presentarlo
// como si fuera el actual seria mentir — de ahi la etiqueta.
function wlChip(it) {
  var pct = it.cambioPct;
  if (it.enVivo === false && it.precio !== null && it.precio !== undefined) {
    // `precioDe` es la fecha del cierre ('2026-08-27') o 'ultimo'. Se muestra
    // corto: "at close" cuando es un cierre con fecha, "last" cuando es el
    // ultimo precio que llegamos a ver.
    var esFecha = /^\d{4}-\d{2}-\d{2}$/.test(String(it.precioDe || ''));
    return '<span class="wl-viejo">' + (esFecha ? 'at close' : 'last known') + '</span>';
  }
  if (pct === null || pct === undefined || !isFinite(Number(pct))) return '';
  var v = Number(pct);
  return '<span class="' + (v >= 0 ? 'up' : 'down') + '">' + esc(signoPct(v, 2)) + '</span>';
}

function renderWatchlist(data) {
  wlData = data;
  var body = document.getElementById('wlBody');
  document.getElementById('wlAviso').innerHTML = '';
  // Las filas se rehacen: la que estuviera deslizada ya no existe, y dejar la
  // referencia viva haria que la proxima apertura intente cerrar un huerfano.
  wlFilaAbierta = null;
  wlPanelEl = null; wlPanelSym = null; wlPanelTipo = null;
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
    // La identidad sale de celdaInstrumentoHtml (graficos.js): el MISMO logo,
    // simbolo y descripcion de la tarjeta del Inicio y de Posiciones. Se reusa
    // la pieza en vez de copiarla, para que las tres no puedan divergir.
    var identidad = (typeof celdaInstrumentoHtml === 'function')
      ? celdaInstrumentoHtml(it)
      : '<span class="holdcell"><span class="holdid"><span class="sym">' + esc(it.symbol) +
        '</span><span class="desc">' + esc(it.nombre || '') + '</span></span></span>';
    fila.innerHTML = '<div class="wl-desliza">' + identidad +
      '<div class="wl-spark">' + spark + '</div>' +
      '<div class="wl-precio"><b>' + (it.precio !== null && it.precio !== undefined ? esc(fmtNum(it.precio)) : '&mdash;') + '</b>' +
      wlChip(it) + objetivo + '</div></div>' +
      '<div class="wl-acciones">' +
      '<button class="wl-accion alerta" aria-label="Price alert for ' + esc(it.symbol) + '">' + WL_MAS_SVG + 'Alert</button>' +
      '<button class="wl-accion quitar" aria-label="Remove ' + esc(it.symbol) + ' from the watchlist">' + WL_X_SVG + 'Remove</button>' +
      '</div>';
    if (typeof engancharLogos === 'function') engancharLogos(fila);
    var accAlerta = fila.querySelector('.wl-accion.alerta');
    var accQuitar = fila.querySelector('.wl-accion.quitar');
    accAlerta.onclick = function () { wlCerrarFilas(); wlToggleForm(it, fila); };
    accQuitar.onclick = function () { wlQuitar(it.symbol, accQuitar); };
    // Un toque en la fila abre el detalle del activo, como al tocar una
    // posicion. El gesto de deslizar tiene prioridad: si la fila esta
    // corrida, el toque la cierra y no abre nada (wlEngancharDeslizar).
    wlEngancharDeslizar(fila, function () { wlToggleDetalle(it, fila); });
    body.appendChild(fila);
  });
  pintarEstadoPush();
}

// ---------- Deslizar una fila para ver sus acciones ----------
// El gesto de Mail (referencia de Guzman): la fila se ve limpia y las dos
// acciones estan debajo, a la derecha. Tres decisiones:
//
// 1. ABRE EN CUALQUIER DIRECCION. Guzman lo pidio como "deslizo a la derecha";
//    el patron de iOS revela las acciones deslizando a la IZQUIERDA. En vez de
//    adivinar cual quiso, con la fila cerrada cualquier arrastre horizontal la
//    abre — el panel siempre sale del mismo lado, asi que no hay ambiguedad de
//    que va a pasar. Ya abierta, arrastrar hacia la derecha la cierra.
// 2. LA DIRECCION SE DECIDE UNA VEZ, en los primeros pixeles: si el dedo va
//    mas vertical que horizontal, el gesto es de la pagina y no se toca. Sin
//    ese candado, bajar la lista con el pulgar abriria filas sin querer.
// 3. SOLO UNA ABIERTA. Abrir una cierra la otra, y un toque en el contenido
//    de una fila abierta la cierra en vez de disparar nada.
var wlFilaAbierta = null;

function wlCerrarFilas(salvo) {
  if (wlFilaAbierta && wlFilaAbierta !== salvo && wlFilaAbierta._cerrar) wlFilaAbierta._cerrar();
}

function wlEngancharDeslizar(fila, alTocar) {
  var contenido = fila.querySelector('.wl-desliza');
  var acciones = fila.querySelector('.wl-acciones');
  if (!contenido || !acciones) return;
  var abierto = false, ancho = 0, x0 = 0, y0 = 0, dx = 0, arrastrando = false, decidido = false;

  function poner(px) { contenido.style.transform = 'translateX(' + px + 'px)'; }
  function abrir() {
    wlCerrarFilas(fila);
    abierto = true; wlFilaAbierta = fila;
    poner(-anchoAcciones());
  }
  function cerrar() {
    abierto = false;
    if (wlFilaAbierta === fila) wlFilaAbierta = null;
    poner(0);
  }
  function anchoAcciones() {
    // Se mide en el momento: depende del ancho real del panel, que a su vez
    // depende del tamano de letra del sistema.
    ancho = acciones.offsetWidth || 148;
    return ancho;
  }
  fila._cerrar = cerrar;

  fila.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    x0 = e.clientX; y0 = e.clientY; dx = 0;
    arrastrando = false; decidido = false;
    anchoAcciones();
  });

  fila.addEventListener('pointermove', function (e) {
    if (decidido && !arrastrando) return;
    dx = e.clientX - x0;
    var dy = e.clientY - y0;
    if (!decidido) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      decidido = true;
      arrastrando = Math.abs(dx) > Math.abs(dy);
      if (!arrastrando) return;                 // el gesto es de la pagina
      fila.classList.add('arrastrando');
      try { fila.setPointerCapture(e.pointerId); } catch (err) {}
    }
    // Cerrada: cualquier direccion la va abriendo. Abierta: solo se cierra
    // arrastrando hacia la derecha.
    var px = abierto ? Math.min(0, -ancho + Math.max(0, dx)) : -Math.min(Math.abs(dx), ancho);
    poner(px);
  });

  function soltar() {
    if (!arrastrando) {
      // Un toque limpio sobre una fila abierta la cierra (y no dispara nada).
      if (abierto && decidido === false) cerrar();
      return;
    }
    fila.classList.remove('arrastrando');
    arrastrando = false;
    var mitad = ancho / 2;
    if (abierto) { if (dx > mitad) cerrar(); else abrir(); }
    else if (Math.abs(dx) > mitad) abrir();
    else cerrar();
  }
  fila.addEventListener('pointerup', soltar);
  fila.addEventListener('pointercancel', function () {
    fila.classList.remove('arrastrando');
    arrastrando = false;
    if (abierto) abrir(); else cerrar();
  });
  // Un toque en el contenido: si la fila esta corrida, la cierra (y nada mas
  // — el toque que "guarda" el gesto no puede disparar tambien una pantalla).
  // Si esta en su lugar, abre el detalle del activo.
  contenido.addEventListener('click', function () {
    if (arrastrando || decidido) return;      // veniamos de un gesto, no de un toque
    if (abierto) { cerrar(); return; }
    if (alTocar) alTocar();
  });
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

// Cierra el panel que hubiera (detalle o alerta) y dice cual era. Los paneles
// se crean y se borran POR REFERENCIA, no buscandolos por id: la lista se
// repinta entera cada vez que llegan datos nuevos.
function wlCerrarPanel() {
  var era = wlPanelTipo && (wlPanelTipo + ':' + wlPanelSym);
  if (wlPanelEl && wlPanelEl.parentNode) wlPanelEl.parentNode.removeChild(wlPanelEl);
  wlPanelEl = null; wlPanelSym = null; wlPanelTipo = null;
  return era;
}

// El detalle del activo, al tocar la fila (27/08/2026). Es lo MISMO que se ve
// al tocar una posicion —los indicadores que le corresponden a su tipo de
// activo y el grafico— reusando las dos piezas de graficos.js:
// cargarFundamentales y crearTvWidget. Lo que NO se muestra son los numeros de
// una posicion (precio medio, costo, resultado): en la watchlist no tenes el
// activo, y esas tres celdas vacias serian una promesa incumplida.
function wlToggleDetalle(it, fila) {
  if (wlCerrarPanel() === 'detalle:' + it.symbol) return;   // segundo toque: cierra
  var d = document.createElement('div');
  d.className = 'wl-detalle';
  d.innerHTML = '<div class="detfund"></div><div class="tvwrap"></div>';
  fila.parentNode.insertBefore(d, fila.nextSibling);
  wlPanelEl = d; wlPanelSym = it.symbol; wlPanelTipo = 'detalle';
  var sym = String(it.symbol || '').toUpperCase();
  if (typeof crearTvWidget === 'function') crearTvWidget(d.querySelector('.tvwrap'), sym);
  if (typeof cargarFundamentales === 'function') cargarFundamentales(sym, d.querySelector('.detfund'));
}

// El formulario de alerta, en el mismo lugar y con la misma regla: uno por vez.
function wlToggleForm(it, fila) {
  if (wlCerrarPanel() === 'alerta:' + it.symbol) return;
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
  wlPanelEl = f; wlPanelSym = it.symbol; wlPanelTipo = 'alerta';
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
    wlCerrarPanel();
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
