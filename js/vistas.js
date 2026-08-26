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
//   4  FUNCION. A mano, sube cuando entra algo NUEVO de verdad (una pantalla,
//      una capacidad), no cuando se arregla algo. Arrancó en 0; el 1 fue la
//      pantalla de Posiciones, el 2 las paletas de acento, el 3 la página
//      Configuración con las tonalidades de fondo (todo el 25/08/2026), y el
//      4 la interfaz entera pasada a inglés (26/08/2026).
// 107  PUBLICACION. NO se escribe aca: se LEE del nombre del cache (`CACHE` en
//      sw.js), que ya sube en cada publicacion porque es lo que evita que el
//      telefono siga sirviendo archivos viejos.
//
// Que la ultima se lea y no se escriba es a proposito: el ritual de publicar
// sigue siendo UN solo numero para tocar, y las partes no pueden quedar
// desincronizadas. Un numero escrito a mano en dos lugares es exactamente la
// clase de cosa que queda vieja sin que nadie se entere.
var VERSION_GENERACION = '1';
var VERSION_FUNCION = '4';
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
document.getElementById('mRefrescar').onclick = function () { sincronizarTodo(); };

// ---------- Navegación (barra inferior) ----------
var VIEWS = ['inicio', 'portafolio', 'cash', 'trade', 'noticias', 'account', 'posiciones', 'config', 'diseno', 'ia', 'seguridad', 'buscar', 'ibkr', 'bnb', 'cs'];
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
var navName = (name === 'account') ? accountReturnView : (name === 'posiciones' ? 'inicio' : name);
NAVTABS.forEach(function (b) {
b.classList.toggle('active', b.getAttribute('data-view') === navName);
});
if (name === 'portafolio') { renderPortafolio(); if (!anaCargado) cargarAnalisis(false); }
if (name === 'posiciones') renderPosiciones();
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
noticiasCargadas = true;
google.script.run.withSuccessHandler(function (d) { renderNoticias(d); })
.withFailureHandler(function (err) { noticiasCargadas = false; errorEnVista('noticiasBody', err, 'las noticias'); }).getNoticias();
}
if (name === 'trade' && !opsCargadas) cargarOperaciones(false);
window.scrollTo(0, 0);
}
NAVTABS.forEach(function (b) {
b.addEventListener('click', function () { setView(b.getAttribute('data-view')); });
});

// ---------- Detalle de cuenta ----------
var lastAcc = null, lastAccData = null;
function showAccount(acc, fromView) {
accountReturnView = fromView || 'portafolio';
setView('account');
document.getElementById('accTitle').textContent = nombrePlataforma(acc.nombre);
var accErr = document.getElementById('accError'); if (accErr) accErr.innerHTML = '';
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
google.script.run.withSuccessHandler(function (data) { renderAccount(acc, data); })
.withFailureHandler(function (err) {
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
var body = document.getElementById('accBody');
body.innerHTML = '';
// Podada a 4 columnas (pedido de Guzman, 18/08/2026): precio medio de
// compra, precio actual con el % del dia arriba, y valor con la ganancia
// total arriba — mismos helpers y mismo orden que la tabla del Inicio
// (test-posiciones vigila que las dos digan lo mismo). La cantidad y el
// resto viven en el detalle desplegable.
data.posiciones.forEach(function (h) {
h.cambioDia = cambioDiaDe(h.symbol);
var tr = document.createElement('tr');
tr.innerHTML = '<td><span class="sym">' + esc(h.symbol) + '</span><span class="desc">' + esc(h.descripcion || '') + '</span></td>' +
'<td>' + (Number(h.precioCompra) > 0 ? esc(fmtNum(h.precioCompra)) : '&mdash;') + '</td>' +
'<td>' + daychgHtml(h) + esc(fmtNum(h.precioActual)) + '</td>' +
'<td>' + gananciaHtml(h) + fmt(h.valor) + '</td>';
tr.className = 'asset-row';
tr.onclick = function () { toggleDetalle(tr, { symbol: h.symbol, precioCompra: h.precioCompra, precioActual: h.precioActual, qty: h.qty, cripto: acc.key === 'BNB' }); };
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
// Leyenda compacta al costado: nombre + % (el detalle en USD vive en Inicio)
var leg = document.getElementById('pieLegend');
leg.innerHTML = '';
items.forEach(function (c, i) {
var row = document.createElement('div');
row.className = 'pierow' + (c.acc ? ' clickable' : '');
row.innerHTML = '<span class="lname"><span class="dot" style="background:' + coloresPie()[i % PIE_COLORS.length] + '"></span>' + esc(c.label) + '</span>' +
'<span class="lpct">' + (total ? ((c.valor / total) * 100).toFixed(1) : '0') + '%' + (c.acc ? '<span class="chev">&rsaquo;</span>' : '') + '</span>';
if (c.acc) row.onclick = function () { showAccount(c.acc, 'portafolio'); };
leg.appendChild(row);
});
// La tabla con TODAS las posiciones salio de esta vista el 17/08/2026 (pedido
// de Guzman); su rol lo cumple el detalle de cada cuenta (V8).
// El mapa de calor mensual (V5) se calcula sobre fullSerie, ya en memoria.
renderAnual();
renderMapaCalor();
}

