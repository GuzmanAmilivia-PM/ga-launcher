// Menu, badges, navegacion, detalle de cuenta, portafolio
// ---------- Panel de menú (se abre con el logo) ----------
// Los dos badges estaban escritos a mano en el HTML: decian "v60" y
// "Sincronizado" siempre, aun cuando la ultima carga habia fallado. Ahora
// dicen la verdad, que es lo unico que sirve cuando algo anda mal.
// La version NO se escribe aca: se lee del nombre del cache que el service
// worker esta sirviendo de verdad. Tenerla escrita a mano en index.html Y en
// sw.js era una fuente doble de verdad, y la que manda es la del sw (si subis
// solo la del index, el sw sigue sirviendo el index viejo y no se publica
// nada). Asi el badge no puede mentir: muestra el shell que estas corriendo.
// La version del shell, leida del nombre del cache que el SW sirve. La misma
// consulta estaba copiada en pintarSaludApp (config.js); ambos usan esta.
// cb recibe 'v67' o null (sin soporte de caches, o sin cache ga-pwa-).
// La version es GENERACION.FUNCION.PUBLICACION (pedido de Guzman,
// 24/08/2026: la nomenclatura de tres numeros que usan las apps). Cada uno dice
// una cosa distinta y se mueve por un motivo distinto:
//
//   1  GENERACION. A mano, cambia solo en un hito. El 1 marca la primera
//      version del MVP: la app hace sola el trabajo de punta a punta
//      —sincroniza los brokers, guarda el patrimonio de cada dia, compara
//      contra el S&P 500 y manda el informe de los lunes—. El 2 seria salir de
//      la planilla de Google.
//   6  FUNCION. A mano, sube cuando entra algo NUEVO de verdad (una pantalla,
//      una capacidad), no cuando se arregla algo. Arrancó en 0; el 1 fue la
//      pantalla de Posiciones, el 2 las paletas de acento, el 3 la página
//      Configuración con las tonalidades de fondo (todo el 25/08/2026), el
//      4 la interfaz entera pasada a inglés, el 5 el análisis por perfil de
//      inversor con su pantalla Analysis, y el 6 los indicadores del detalle
//      de cada posición (los tres el 26/08/2026).
// 107  PUBLICACION. NO se escribe aca: se LEE del nombre del cache (`CACHE` en
//      sw.js), que ya sube en cada publicacion porque es lo que evita que el
//      telefono siga sirviendo archivos viejos.
//
// Que la ultima se lea y no se escriba es a proposito: el ritual de publicar
// sigue siendo UN solo numero para tocar, y las partes no pueden quedar
// desincronizadas. Un numero escrito a mano en dos lugares es exactamente la
// clase de cosa que queda vieja sin que nadie se entere.
// El 2, decidido por Guzmán el 1/09/2026: la app salió de la planilla de
// Google (corte a D1 del 29/08/2026). El comentario de la era-1 decía "el 2
// sería salir de la planilla" — salió, y este número lo cuenta.
var VERSION_GENERACION = '2';
// El 15: el desglose del fondo de Itaú en su pantalla (13/09/2026): cuánto
// aportaste, cuánto vale, y la ganancia partida entre lo que rindió el fondo
// en pesos y lo que hizo el tipo de cambio. Antes esa fila mostraba un guion
// porque el costo está en pesos y el valor en dólares.
// El 14: actualizar Itaú desde su propia pantalla (13/09/2026). Es capacidad
// nueva, no un arreglo: el botón deja un pedido que atiende la PC de Guzmán
// —la clave del banco vive cifrada allá y un banco no habilita CORS—, y el
// fondo de Itaú Assets dejó de escribirse a mano.
// El 13: las dos lecturas de cartera que faltaban (31/08/2026) — la
// asignacion con look-through dentro de los ETFs en el tablero de
// escritorio, y el ingreso por dividendos de los proximos doce meses al pie
// del panel de Dividends. La asignacion salio con el 12 sin subir este
// numero, que estuvo mal: es funcion nueva, no un arreglo.
// El 12: el desglose del periodo — cuanto aportaste y cuanto rindio, y el
// benchmark comparando el rendimiento LIMPIO (31/08/2026).
// El 11: la linea del S&P sobre el grafico de Evolucion, con el delta en
// puntos porcentuales y el aviso cuando hubo aportes (31/08/2026).
// El 10: el modo escritorio — barra lateral, carrusel desplegado y tira de
// indicadores, solo a partir de 1100px (31/08/2026).
// El 9: el podcast diario de noticias en espanol, en la pantalla News
// (30/08/2026) — guion con Claude + voz con Google Cloud Text-to-Speech.
// El 8 fue editar a mano los precios del fondo de Itau desde su pagina
// (29/08/2026, V16); el 7, la Watchlist con alertas y push; el 6, los
// indicadores del detalle.
var VERSION_FUNCION = '15';
// El armado vive aparte y es PURO —entra el nombre del cache, sale el texto—
// justamente para que se pueda probar ejecutandolo. Cuando esto vivia adentro
// de versionShell, lo unico que lo custodiaba eran expresiones regulares sobre
// el codigo fuente, y con eso se podia romper el formato (mostrar `1.107`, o
// dejar el numero clavado) sin que ninguna prueba se pusiera en rojo.
// Auditoria del 24/08/2026.
function versionTexto(nombreCache) {
var base = VERSION_GENERACION + '.' + VERSION_FUNCION;
var pub = String(nombreCache || '').replace('ga-pwa-v', '').replace('ga-pwa-', '');
return pub ? (base + '.' + pub) : base;
}
// De todos los caches `ga-pwa-*` vivos se elige el de numero MAS ALTO, no el
// primero que devuelve caches.keys(): ese orden es de CREACION, asi que entre
// que el service worker nuevo instala su cache y borra el viejo, el primero es
// el VIEJO. Si ese borrado quedara a medias, la app mostraria para siempre un
// numero anterior al que de verdad esta corriendo, justo cuando mirar la
// version es lo que sirve para entender que pasa. Auditoria del 25/08/2026.
// El numero se lee igual que en versionTexto, a proposito: si algun dia cambia
// el prefijo del cache, las dos se rompen juntas y de forma visible, en vez de
// que una siga eligiendo bien y la otra pinte cualquier cosa.
function numeroDeCache(k) {
var n = parseInt(String(k || '').replace('ga-pwa-v', '').replace('ga-pwa-', ''), 10);
return isNaN(n) ? -1 : n;
}
function versionShell(cb) {
if (!window.caches || !caches.keys) { cb(versionTexto(null)); return; }
caches.keys().then(function (claves) {
var mios = claves.filter(function (k) { return k.indexOf('ga-pwa-') === 0; })
.sort(function (a, b) { return numeroDeCache(b) - numeroDeCache(a); });
cb(versionTexto(mios[0]));
}).catch(function () { cb(versionTexto(null)); });
}
function pintarVersion() {
var v = document.getElementById('mbVersion');
if (!v) return;
// NO se cachea el resultado. Antes se pintaba UNA sola vez por sesion con la
// premisa de que "una actualizacion del SW pide recargar"; esa premisa es
// FALSA: sw.js usa skipWaiting() + clients.claim(), asi que el cache puede
// cambiar de nombre con la pagina abierta. Cacheando pasaban dos cosas: si el
// badge se pintaba antes de que el cache existiera quedaba clavado en `1.0`
// —que no parece un error, parece una version— por el resto de la sesion, y el
// menu podia decir una version distinta de la de Diagnostico, que nunca cacheo.
// Volver a consultar es leer un Map en memoria, no pedir red. Auditoria del
// 25/08/2026.
versionShell(function (ver) {
v.textContent = ver || '—';
});
}
function pintarBadges(estado) {
pintarVersion();
var e = document.getElementById('mbEstado');
if (!e) return;
if (estado === 'ok') {
e.className = 'mbadge green';
e.innerHTML = '&#10003; Synced';
} else if (estado === 'cache') {
e.className = 'mbadge gold';
e.innerHTML = 'Cached data';
} else {
e.className = 'mbadge gold';
e.innerHTML = '&#9888; No connection';
}
}
function toggleMenu(open) {
document.getElementById('menuPanel').classList.toggle('open', open);
}
document.getElementById('logoBtn').onclick = function () { toggleMenu(true); };
document.getElementById('menuBack').onclick = function () { toggleMenu(false); };
document.getElementById('mIA').onclick = function () { toggleMenu(false); setView('ia'); };
// Ojo con los nombres desde el 25/08/2026: el tile "Keys" abre view-config
// (APIs y claves, la ex Configuración) y el tile "Configuración" abre
// view-diseno (tema, acento y tonalidad).
document.getElementById('mConfig').onclick = function () { toggleMenu(false); setView('config'); };
document.getElementById('mDiseno').onclick = function () { toggleMenu(false); setView('diseno'); };
document.getElementById('mSeguridad').onclick = function () { toggleMenu(false); setView('seguridad'); };
document.getElementById('mTrans').onclick = function () { toggleMenu(false); setView('trade'); };
// Banking vive en el menu desde el 27/08/2026: su lugar en la barra de abajo
// lo ocupa la Watchlist (segunda desde el 9/09/2026; el central es Portfolio). La vista es la misma de siempre (view-cash).
document.getElementById('mCash').onclick = function () { toggleMenu(false); setView('cash'); };
document.getElementById('mRefrescar').onclick = function () { sincronizarTodo(); };

// ---------- Navegación (barra inferior) ----------
var VIEWS = ['inicio', 'portafolio', 'cash', 'watchlist', 'trade', 'noticias', 'account', 'posiciones', 'analisis', 'config', 'diseno', 'ia', 'seguridad', 'buscar', 'ibkr', 'bnb', 'cs'];
// La barra no cambia nunca: se consulta el DOM una sola vez, no en cada setView.
var NAVTABS = document.querySelectorAll('.navtab');
var currentView = 'inicio';
var CONFIG_REFRESCO_MS = 5 * 60 * 1000;
var configUltimaCarga = 0;
function setView(name) {
currentView = name;
VIEWS.forEach(function (v) {
var el = document.getElementById('view-' + v);
if (!el) return;
if (v === name) {
el.style.display = '';
// Reiniciar la animacion: sacar la clase, forzar reflow, ponerla.
el.classList.remove('view-entra');
void el.offsetWidth;
el.classList.add('view-entra');
} else {
el.style.display = 'none';
}
});
// Posiciones se abre desde el título del Inicio, así que en la barra sigue
// encendida la pestaña Inicio — mismo criterio que account con su vista origen.
// Analysis se abre desde la tarjeta de Portfolio: misma regla, queda Portfolio.
var navName = (name === 'account') ? accountReturnView
: (name === 'posiciones' ? 'inicio' : (name === 'analisis' ? 'portafolio' : name));
NAVTABS.forEach(function (b) {
b.classList.toggle('active', b.getAttribute('data-view') === navName);
});
if (name === 'portafolio') { renderPortafolio(); if (!anaCargado) cargarAnalisis(false); }
if (name === 'posiciones') renderPosiciones();
if (name === 'analisis') cargarAnalisisDetalle(false);
// Refresca qué está marcado (tema/acento/tonalidad) por si algo cambió.
if (name === 'diseno') pintarDiseno();
// Configuracion dispara 3 llamadas al backend (~1,5 s cada una): dentro de la
// sesion se refrescan como mucho cada 5 min. Guardar algo sigue llamando
// cargarPlataformas()/cargarEstadoIA() directo, asi lo editado se ve al toque.
// pintarSaludApp es 100% local y se repinta siempre (muestra edades de cache).
if (name === 'config') {
pintarSaludApp();
if (Date.now() - configUltimaCarga > CONFIG_REFRESCO_MS) {
configUltimaCarga = Date.now();
cargarPlataformas(); cargarEstadoIA(); cargarEstadoFinnhub(); cargarBackups();
}
}
if (name === 'watchlist') cargarWatchlist(false);
if (name === 'ibkr') cargarEstadoIBKR();
if (name === 'bnb') prepararBNB();
if (name === 'cs') cargarEstadoCS();
if (name === 'ia') prepararIA();
if (name === 'seguridad') prepararSeguridad();
if (name === 'noticias') cargarResultados();
if (name === 'noticias' && !noticiasCargadas) {
// La bandera se marca ANTES de pedir, no en el handler de exito: si no, cada
// toque en la pestana mientras el pedido esta en vuelo disparaba OTRA llamada
// de hasta dos minutos. Si falla se revierte, para poder reintentar. Es el
// mismo patron que ya usaba cargarOperaciones.
pedirNoticias();
}
if (name === 'trade' && !opsCargadas) cargarOperaciones(false);
window.scrollTo(0, 0);
}
NAVTABS.forEach(function (b) {
b.addEventListener('click', function () { setView(b.getAttribute('data-view')); });
});

// ---------- Detalle de cuenta ----------
var lastAcc = null, lastAccData = null;
// La cuenta cuyo pedido esta EN VUELO: una respuesta tardia de otra cuenta
// (editar Itau, volver, abrir IBKR antes de que conteste) pintaba las
// posiciones de una bajo el titulo de la otra (auditoria 31/08/2026).
var accPedida = null;
// UNA sola peticion de noticias alimenta las DOS pantallas (02/09/2026): la
// pestana News y la tarjeta del mundo que quedo al pie del Inicio. Pedirlas
// dos veces seria pagar dos veces por el mismo dato — y este pedido es de los
// caros: lee los feeds de seis medios.
//
// La bandera se marca ANTES de pedir, no en el handler de exito: si no, cada
// toque en la pestana mientras el pedido esta en vuelo disparaba OTRA llamada.
// Si falla se revierte, para poder reintentar.
function pedirNoticias() {
  if (noticiasCargadas) return;
  noticiasCargadas = true;
  google.script.run.withSuccessHandler(function (d) {
    renderNoticias(d);
    // trade.js se carga DESPUES que este archivo, asi que la funcion existe
    // recien en tiempo de ejecucion. Se consulta en vez de suponerla.
    if (typeof renderMacroInicio === 'function') renderMacroInicio(d);
  }).withFailureHandler(function (err) {
    noticiasCargadas = false;
    errorEnVista('noticiasBody', err, 'las noticias');
  }).getNoticias();
}
function showAccount(acc, fromView) {
accountReturnView = fromView || 'portafolio';
setView('account');
document.getElementById('accTitle').textContent = nombrePlataforma(acc.nombre);
var accErr = document.getElementById('accError'); if (accErr) accErr.innerHTML = '';
// El bloque de Itau solo en Itau, y al abrirlo se mira como quedo la ultima
// vez: si hay una actualizacion en curso (la pediste y cerraste la app), se
// retoma el seguimiento en vez de arrancar mudo.
var itauBox = document.getElementById('accItau');
if (itauBox) {
  itauParar();
  itauBox.hidden = !itauEsCuenta(acc);
  var fondoBox = document.getElementById('accFondo');
  if (fondoBox && itauBox.hidden) fondoBox.hidden = true;
  if (!itauBox.hidden) {
    var im = document.getElementById('accItauMsg'); if (im) im.innerHTML = '';
    itauSeguir();
  }
}
// Si es la misma cuenta de la ultima visita, se pinta lo ultimo visto al
// instante y el pedido corre por atras (mismo criterio que cargarConCache).
// Antes: "Cargando..." 1,5 s aunque hubieras salido hace 10 segundos.
var enCache = !!(lastAcc && lastAcc.key === acc.key && lastAccData);
if (enCache) {
renderAccount(acc, lastAccData);
} else {
document.getElementById('accTotal').textContent = 'Loading...';
document.getElementById('accLiq').textContent = '';
document.getElementById('accBody').innerHTML = '';
}
accPedida = acc.key;
google.script.run.withSuccessHandler(function (data) {
if (accPedida !== acc.key) return;   // respuesta tardia de una cuenta que ya no esta abierta
renderAccount(acc, data);
})
.withFailureHandler(function (err) {
if (accPedida !== acc.key) return;
// Con datos ya pintados, un fallo de red no borra la pantalla.
if (enCache) return;
document.getElementById('accTotal').textContent = '--';
errorEnVista('accError', err, 'el detalle de la cuenta');
}).getAccountData(acc.key);
}
document.getElementById('accBack').onclick = function () { setView(accountReturnView); };
// La variacion intradia por simbolo ya viaja en el payload del Inicio
// (lastData.posiciones): se reusa aca en vez de pedirla de nuevo (regla R1).
// Sin datos del Inicio devuelve null y el porcentaje simplemente no se muestra.
function cambioDiaDe(symbol) {
var s = String(symbol || '').toUpperCase();
var lista = (lastData && lastData.posiciones) || [];
for (var i = 0; i < lista.length; i++) {
if (String(lista[i].symbol).toUpperCase() === s) return lista[i].cambioDia;
}
return null;
}
function renderAccount(acc, data) {
lastAcc = acc; lastAccData = data;
document.getElementById('accTotal').textContent = fmt(data.total);
document.getElementById('accLiq').textContent = 'Cash in account: ' + fmt(data.liquidez);
// El desglose del fondo, solo en Itau. OJO CON LA FORMA: dentro de esta
// funcion NO puede haber una llave de cierre al principio de una linea, porque
// test-cuenta-detalle extrae renderAccount con una expresion regular que corta
// en la primera, y se quedaba con media funcion. Por eso va en UNA sola linea,
// sin llaves, y quien decide que dibujar es renderFondoItau.
if (typeof renderFondoItau === 'function') renderFondoItau(acc, data);
var body = document.getElementById('accBody');
body.innerHTML = '';
// El mismo diseno que el Inicio y la lista de posiciones (pedido de Guzman,
// 8/09/2026: la de Binance "se veia desactualizada sin las graficas ni la
// compra promedio"): logo con las iniciales de respaldo, el mini-grafico del
// mes (los mismos cierres que el Inicio, sparkDe), el % del dia arriba del
// precio y el precio medio de compra debajo en chico, y el valor con la
// ganancia total arriba. Mismos helpers que filaHoldingHtml y
// renderPosiciones; la cantidad y el resto viven en el detalle desplegable.
// Las TRES columnas del Inicio (8/09/2026, segunda vuelta: con cuatro, el
// nombre se montaba sobre el mini-grafico en el telefono): instrumento,
// mes, precio. El valor en dolares y la ganancia acumulada van en el renglon
// de abajo del simbolo. Las filas que son cash (USDT en Binance) no van: ya
// estan en "Cash in account".
data.posiciones.forEach(function (h) {
if (esFilaCash(h)) return;
h.cambioDia = cambioDiaDe(h.symbol);
if (!h.nombre) h.nombre = h.descripcion || '';
if (acc.key === 'BNB' && h.cripto === undefined) h.cripto = true;
var compra = Number(h.precioCompra) > 0 ? '<span class="pcmini">avg ' + esc(fmtNum(h.precioCompra)) + '</span>' : '';
var tr = document.createElement('tr');
tr.innerHTML = '<td>' + celdaInstrumentoHtml(h, esc(fmt(h.valor)) + gananciaHtml(h)) + '</td>' +
'<td class="col-spark">' + sparkDe(h) + '</td>' +
'<td class="col-precio">' + daychgHtml(h) + esc(fmtNum(h.precioActual)) + compra + '</td>';
tr.className = 'asset-row';
engancharLogos(tr);
tr.onclick = function () { toggleDetalle(tr, { symbol: h.symbol, precioCompra: h.precioCompra, precioActual: h.precioActual, qty: h.qty, cripto: acc.key === 'BNB', cuenta: acc.key, gfTicker: h.gfTicker }); };
body.appendChild(tr);
});
}

// ---------- Posiciones (la lista completa, desde el Inicio) ----------
// Pedido de Guzmán (25/08/2026): el título de la tarjeta del Inicio dice
// "Posiciones" y al tocarlo se abre esta pantalla con TODAS las posiciones,
// mismas columnas que el detalle de cuenta (P. compra / Precio / Valor).
// Sin cash: la fila de un banco no es una posición, y USDT ES cash ("que usdt
// es cash") — el Worker ya los marca `tipo: 'cash'`, acá solo se filtra.
// La cripto SÍ entra: desde hoy esta es la pantalla que lista la cartera
// entera (antes, la única lista una-por-una era el detalle de cada cuenta).
// Los datos son los del payload del Inicio (lastData.posiciones), que ya trae
// precio medio, precio actual, valor y cambio del día: no se pide nada nuevo.
//
// El aspecto es el de la tarjeta del Inicio — la lista de mercado de
// TradingView que Guzmán puso de referencia dos veces (18/08 y 25/08/2026:
// "me gustaría que se vea así de bien... ves todo más rápido") —: logo,
// símbolo grande con la descripción cortada en una línea, y números que no
// se parten. Por eso las filas usan celdaInstrumentoHtml + engancharLogos
// (graficos.js), las MISMAS piezas de esa tarjeta.
// El valor va sin el "USD " adelante (la lista de TradingView tampoco lo
// pone): con el prefijo, "USD 23.204" se partía en dos renglones en el ancho
// del teléfono — captura de Guzmán del 25/08/2026. Sale de fmt() para
// conservar el ojito de ocultar montos ('****').
// Refresca la cuenta abierta con datos frescos del backend. La usa el
// detalle desplegable despues de editar un precio manual (V16): sin esto, la
// fila seguiria mostrando el valor viejo hasta salir y volver a entrar.
function recargarCuentaAbierta() {
if (!lastAcc) return;
// La cuenta se resuelve al momento del PEDIDO, no de la respuesta: si
// mientras tanto se abrio otra cuenta, esta respuesta se descarta.
var pedida = lastAcc;
accPedida = pedida.key;
google.script.run.withSuccessHandler(function (data) {
if (accPedida !== pedida.key) return;
renderAccount(pedida, data);
})
.withFailureHandler(function () {})
.getAccountData(pedida.key);
}

function valorPelado(v) {
  var s = fmt(v);
  return s.indexOf('USD ') === 0 ? s.slice(4) : s;
}
function renderPosiciones() {
  var body = document.getElementById('posBody');
  if (!body) return;
  var lista = ((lastData && lastData.posiciones) || []).filter(function (p) { return tipoDe(p) !== 'cash'; });
  body.innerHTML = '';
  if (!lista.length) { body.innerHTML = '<tr><td colspan="4" class="newsempty">No positions.</td></tr>'; return; }
  // Mismo orden que la tarjeta del Inicio: secciones ETFs → Acciones → Cripto,
  // y adentro de cada una por valor descendente (así ya viene del Worker).
  lista = ordenarPorTipo(lista);
  var tipoPrev = null;
  lista.forEach(function (h) {
    var t = tipoDe(h);
    if (t !== tipoPrev) {
      var sec = document.createElement('tr');
      sec.className = 'holdsec';
      sec.innerHTML = '<td colspan="4">' + esc((typeof TIPO_LABELS !== 'undefined' && TIPO_LABELS[t]) || t) + '</td>';
      body.appendChild(sec);
      tipoPrev = t;
    }
    var tr = document.createElement('tr');
    tr.innerHTML = '<td>' + celdaInstrumentoHtml(h) + '</td>' +
      '<td class="col-pc">' + (Number(h.precioCompra) > 0 ? esc(fmtNum(h.precioCompra)) : '&mdash;') + '</td>' +
      '<td class="col-precio">' + daychgHtml(h) + esc(fmtNum(h.precioActual)) + '</td>' +
      '<td class="col-valor">' + gananciaHtml(h) + valorPelado(h.valor) + '</td>';
    tr.className = 'asset-row';
    engancharLogos(tr);
    tr.onclick = function () { toggleDetalle(tr, h); };
    body.appendChild(tr);
  });
}
document.getElementById('posBack').onclick = function () { setView('inicio'); };
// El título es un h2 con role="button" (la política de contenido no permite
// onclick inline): click y teclado, como cualquier control de verdad.
(function () {
  var t = document.getElementById('posTitulo');
  if (!t) return;
  function abrir() { setView('posiciones'); }
  t.addEventListener('click', abrir);
  t.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } });
})();

// El titulo de la tarjeta del mundo lleva a News, donde vive el bloque
// completo (02/09/2026). Mismo patron que Positions, teclado incluido: la
// politica de contenido no permite onclick inline.
(function () {
  var t = document.getElementById('macroTitulo');
  if (!t) return;
  function abrir() { setView('noticias'); }
  t.addEventListener('click', abrir);
  t.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } });
})();
// El titulo de la tarjeta de asignacion del tablero lleva al analisis
// completo (31/08/2026): la tarjeta es un resumen, el detalle vive en
// Analysis. Mismo patron que Positions, teclado incluido.
(function () {
  var t = document.getElementById('asigTitulo');
  if (!t) return;
  function abrir() { setView('analisis'); }
  t.addEventListener('click', abrir);
  t.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } });
})();

// ---------- Portafolio (torta + desglose) ----------
var pieChartInstance = null;
function accountByName(nombre) {
var n = String(nombre || '').trim().toLowerCase();
for (var i = 0; i < ACCOUNTS.length; i++) {
if (ACCOUNTS[i].nombre.toLowerCase() === n) return ACCOUNTS[i];
}
return null;
}
var pieModo = 'cuenta';
var TIPO_LABELS = { accion: 'Stocks', etf: 'ETFs', cripto: 'Crypto', cash: 'Cash' };
// Items de la torta según el modo: por cuenta (con click al detalle) o por
// tipo de activo (agrupando las posiciones; el resto no posicionado va a Cash).
function itemsPie() {
var total = lastData.total || 0;
if (pieModo === 'cuenta') {
return (lastData.cuentas || []).map(function (c) {
return { label: nombrePlataforma(c.nombre), valor: c.valor, acc: accountByName(c.nombre) };
});
}
var grupos = { accion: 0, etf: 0, cripto: 0, cash: 0 };
var sumaPos = 0;
(lastData.posiciones || []).forEach(function (p) {
var t = TIPO_LABELS[p.tipo] ? p.tipo : (p.cripto ? 'cripto' : 'accion');
grupos[t] += (Number(p.valor) || 0);
sumaPos += (Number(p.valor) || 0);
});
// La segunda rama faltaba y el backend SI la tiene (_repartoPorTipo en
// Analisis.js): cuando las posiciones suman casi el total —o sea, no queda
// resto sin asignar— pero hay liquidez, esta torta no mostraba la porcion Cash
// mientras la tarjeta de Analisis, en la MISMA pantalla, decia "tenes X% en
// cash". Dos numeros contradiciendose. Auditoria del 22/08/2026.
var cash = Number(lastData.liquidez) || 0;
if (total - sumaPos > 1) grupos.cash += (total - sumaPos);
else if (grupos.cash === 0 && cash > 0) grupos.cash = cash;
return ['accion', 'etf', 'cripto', 'cash'].filter(function (t) { return grupos[t] > 0.5; })
.map(function (t) { return { label: TIPO_LABELS[t], valor: Math.round(grupos[t] * 100) / 100, acc: null }; });
}
function renderPortafolio() {
if (!lastData) return;
var total = lastData.total || 0;
var items = itemsPie();
// Torta
if (pieChartInstance) pieChartInstance.destroy();
pieChartInstance = new Chart(document.getElementById('pieChart'), {
type: 'doughnut',
data: {
labels: items.map(function (c) { return c.label; }),
// coloresPie() y no PIE_COLORS: el primer color sigue a la paleta de Diseño.
datasets: [{ data: items.map(function (c) { return c.valor; }), backgroundColor: coloresPie().slice(0, items.length), borderColor: temaChart().pieBorder, borderWidth: 3 }]
},
options: { cutout: '62%', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
});
// Leyenda al costado: nombre, % y monto. El monto entro el 02/09/2026, al
// sacar la tarjeta "Account detail" del Inicio: era el UNICO lugar donde se
// veia cuanto vale cada cuenta, y esta leyenda ya era el otro camino para
// abrirlas. Sin esto, el dato se perdia. El orden es % primero y el monto
// despues de un separador tenue (pedido de Guzman, 7/09/2026): el % es lo que
// la torta cuenta; el monto es el detalle.
var leg = document.getElementById('pieLegend');
leg.innerHTML = '';
items.forEach(function (c, i) {
var row = document.createElement('div');
row.className = 'pierow' + (c.acc ? ' clickable' : '');
row.innerHTML = '<span class="lname"><span class="dot" style="background:' + coloresPie()[i % PIE_COLORS.length] + '"></span>' + esc(c.label) + '</span>' +
'<span class="lpct">' + (total ? '<b>' + ((c.valor / total) * 100).toFixed(1) + '%</b><span class="lsep"></span>' : '') + esc(fmt(c.valor)) + (c.acc ? '<span class="chev">&rsaquo;</span>' : '') + '</span>';
if (c.acc) row.onclick = function () { showAccount(c.acc, 'portafolio'); };
leg.appendChild(row);
});
// La tabla con TODAS las posiciones salio de esta vista el 17/08/2026 (pedido
// de Guzman); su rol lo cumple el detalle de cada cuenta (V8).
// El mapa de calor mensual (V5) se calcula sobre fullSerie, ya en memoria.
renderAnual();
renderMapaCalor();
}


// ---------------------------------------------------------------------------
// Actualizar Itaú desde la app (13/09/2026)
// ---------------------------------------------------------------------------
// El botón NO entra al banco. No puede: la contraseña de Itaú vive cifrada en
// la PC de Guzmán —a propósito, el backend es público— y un banco no habilita
// que una página ajena le hable, así que el truco de Binance (que sincroniza
// el propio teléfono) acá no sirve.
//
// Entonces deja un PEDIDO en el servidor y la PC lo atiende cuando lo ve. Por
// eso esto muestra estado en vez de un spinner mudo: tarda, y con la PC
// apagada no va a pasar nunca. Decir "prendé la PC" es más útil que girar.
var ITAU_ESPERA_MS = 3000;
var itauTimer = null;
// Solo si el pedido lo hizo Guzman EN ESTA pantalla se recarga la cartera al
// terminar. Sin esto, abrir la cuenta de Itau despues de una actualizacion
// vieja disparaba una recarga entera por un resultado de hace dias.
var itauActivo = false;

function itauEsCuenta(acc) {
  return /^itau/i.test(String((acc && acc.nombre) || '')) ||
         /^itau/i.test(String((acc && acc.key) || ''));
}

// El texto de cada estado. `abandonado` y `sin_respuesta` son los dos que
// explican algo que el usuario puede arreglar; los demás son informativos.
function itauTexto(e) {
  var m = (e && e.mensaje) || '';
  switch (e && e.estado) {
    case 'pendiente': return 'Requested. Waiting for your PC...';
    case 'actualizando': return 'Reading Ita&uacute;...';
    case 'listo': return '&#10003; ' + esc(m || 'Updated.');
    case 'error': return '&#9888; ' + esc(m || 'It could not be updated.');
    case 'sin_respuesta': return '&#9888; Your PC did not answer. Is it on?';
    case 'abandonado': return '&#9888; It started and never finished. Check the PC.';
    default: return '';
  }
}

function itauParar() {
  if (itauTimer) { clearTimeout(itauTimer); itauTimer = null; }
  itauActivo = false;
}

function itauMostrar(e) {
  var msg = document.getElementById('accItauMsg');
  if (msg) msg.innerHTML = itauTexto(e);
  var btn = document.getElementById('accItauBtn');
  var enCurso = e && (e.estado === 'pendiente' || e.estado === 'actualizando');
  if (btn) btn.disabled = !!enCurso;
  return enCurso;
}

// Pregunta cómo viene hasta que termine. Se rinde sola: un pedido que nadie
// toma llega a `sin_respuesta` y ahí corta, en vez de preguntar para siempre.
function itauSeguir() {
  itauParar();
  google.script.run.withSuccessHandler(function (e) {
    if (!document.getElementById('accItau') || document.getElementById('accItau').hidden) return;
    var sigue = itauMostrar(e);
    if (sigue) {
      itauTimer = setTimeout(itauSeguir, ITAU_ESPERA_MS);
    } else if (itauActivo && e && e.estado === 'listo') {
      // Terminó bien: que la pantalla muestre el número nuevo, que es el
      // punto de haber apretado.
      if (typeof sincronizarTodo === 'function') sincronizarTodo();
    }
  }).withFailureHandler(function () {
    var msg = document.getElementById('accItauMsg');
    if (msg) msg.textContent = 'Could not check the status.';
  }).itauEstado();
}

(function () {
  var btn = document.getElementById('accItauBtn');
  if (!btn) return;
  btn.onclick = function () {
    btn.disabled = true;
    var msg = document.getElementById('accItauMsg');
    if (msg) msg.textContent = 'Requesting...';
    itauActivo = true;
    google.script.run.withSuccessHandler(function (e) {
      itauMostrar(e);
      itauSeguir();
    }).withFailureHandler(function (err) {
      btn.disabled = false;
      if (msg) msg.textContent = msgErr ? msgErr(err, 'The request') : 'It could not be requested.';
    }).itauPedir();
  };
})();

// ---------------------------------------------------------------------------
// El desglose del fondo de Itaú (13/09/2026)
// ---------------------------------------------------------------------------
// El fondo cotiza en PESOS y la cartera se mide en dólares, así que la
// ganancia que ves mezcla dos cosas que se mueven por motivos distintos: lo
// que rinde el fondo (letras del Banco Central) y lo que hace el tipo de
// cambio. Guzmán aportó 6.000 y tiene 32 más; el fondo rindió 1,23% en pesos
// y el peso se llevó 0,68 de esos puntos. Sin el desglose ese 0,54% parece
// que el fondo no rinde, y no es eso.
//
// Antes esta fila mostraba un guion en la ganancia, y no por esconderla: la
// app tiene el costo en pesos y el valor en dólares, y no puede restarlos.
function renderFondoItau(acc, data) {
  var box = document.getElementById('accFondo');
  if (!box) return;
  if (!itauEsCuenta(acc)) { box.hidden = true; return; }
  var r = data && data.resumenItau;
  if (!r) {
    // Sin lo aportado cargado no se inventa nada: se ofrece cargarlo.
    box.hidden = false;
    box.innerHTML = '<p class="detlbl">Tell the app how many dollars you put into the fund ' +
      'and it will show what the fund earned and what the peso did.</p>' +
      '<div class="detedit"><button type="button" class="ghostbtn" id="accFondoSet">Set contributed</button></div>';
    wireFondoSet();
    return;
  }
  box.hidden = false;
  var signo = function (n) { return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'; };
  var clase = function (n) { return n >= 0 ? 'up' : 'down'; };
  box.innerHTML =
    '<div class="detgrid">' +
      '<span><span class="detlbl">Contributed</span><b>' + fmt(r.aportadoUSD) + '</b></span>' +
      '<span><span class="detlbl">Value today</span><b>' + fmt(r.valorUSD) + '</b></span>' +
      '<span><span class="detlbl">Gain</span><b class="' + clase(r.gananciaUSD) + '">' +
        (r.gananciaUSD >= 0 ? '+' : '') + fmt(r.gananciaUSD) + ' &middot; ' + signo(r.rendimientoPct) + '</b></span>' +
    '</div>' +
    // Las dos mitades. Se multiplican para dar el total, no se suman, pero a
    // esta escala la diferencia es invisible y "se reparte asi" se entiende.
    '<div class="detgrid" style="margin-top:8px">' +
      '<span><span class="detlbl">The fund (in UYU)</span><b class="' + clase(r.fondoPct) + '">' + signo(r.fondoPct) + '</b></span>' +
      '<span><span class="detlbl">Peso vs dollar</span><b class="' + clase(r.monedaPct) + '">' + signo(r.monedaPct) + '</b></span>' +
    '</div>' +
    '<p class="detlbl" style="margin-top:8px">' +
      (r.monedaPct < 0
        ? 'The fund earned ' + signo(r.fondoPct) + ' in pesos; the peso took back ' + Math.abs(r.monedaPct).toFixed(2) + '% of that in dollars.'
        : 'The fund earned ' + signo(r.fondoPct) + ' in pesos, and the peso added to it.') +
    '</p>' +
    '<div class="detedit"><button type="button" class="ghostbtn" id="accFondoSet">Change contributed</button></div>';
  wireFondoSet();
}

// Cargar o corregir los dólares aportados. Es el UNICO dato que la app no
// puede deducir: la base guarda el costo en pesos y nadie guardó el dólar del
// día de la compra.
function wireFondoSet() {
  var b = document.getElementById('accFondoSet');
  if (!b) return;
  b.onclick = function () {
    var actual = (lastAccData && lastAccData.resumenItau) ? lastAccData.resumenItau.aportadoUSD : '';
    var v = window.prompt('How many dollars did you put into Ita\u00fa Assets, in total?', actual);
    if (v === null) return;
    var n = Number(String(v).replace(',', '.'));
    if (!isFinite(n) || n <= 0) { alert('That is not an amount.'); return; }
    b.disabled = true;
    google.script.run.withSuccessHandler(function () {
      b.disabled = false;
      if (lastAcc) showAccount(lastAcc, accountReturnView);
    }).withFailureHandler(function (err) {
      b.disabled = false;
      alert(msgErr ? msgErr(err, 'Saving the amount') : 'It could not be saved.');
    }).itauAportado({ aportado: n });
  };
}
