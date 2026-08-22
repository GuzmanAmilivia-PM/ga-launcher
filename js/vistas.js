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
var _versionPintada = false;
// La version del shell, leida del nombre del cache que el SW sirve. La misma
// consulta estaba copiada en pintarSaludApp (config.js); ambos usan esta.
// cb recibe 'v67' o null (sin soporte de caches, o sin cache ga-pwa-).
function versionShell(cb) {
if (!window.caches || !caches.keys) { cb(null); return; }
caches.keys().then(function (claves) {
var c = claves.filter(function (k) { return k.indexOf('ga-pwa-') === 0; })[0];
cb(c ? c.replace('ga-pwa-', '') : null);
}).catch(function () { cb(null); });
}
function pintarVersion() {
var v = document.getElementById('mbVersion');
if (!v) return;
// La version no cambia dentro de una sesion (una actualizacion del SW pide
// recargar): consultar caches.keys() en cada poll era gasto puro.
if (_versionPintada) return;
versionShell(function (ver) {
v.textContent = ver || '—';
if (ver) _versionPintada = true;
});
}
function pintarBadges(estado) {
pintarVersion();
var e = document.getElementById('mbEstado');
if (!e) return;
if (estado === 'ok') {
e.className = 'mbadge green';
e.innerHTML = '&#10003; Sincronizado';
} else if (estado === 'cache') {
e.className = 'mbadge gold';
e.innerHTML = 'Datos guardados';
} else {
e.className = 'mbadge gold';
e.innerHTML = '&#9888; Sin conexi&oacute;n';
}
}
function toggleMenu(open) {
document.getElementById('menuPanel').classList.toggle('open', open);
}
document.getElementById('logoBtn').onclick = function () { toggleMenu(true); };
document.getElementById('menuBack').onclick = function () { toggleMenu(false); };
document.getElementById('mIA').onclick = function () { toggleMenu(false); setView('ia'); };
document.getElementById('mConfig').onclick = function () { toggleMenu(false); setView('config'); };
document.getElementById('mSeguridad').onclick = function () { toggleMenu(false); setView('seguridad'); };
document.getElementById('mTrans').onclick = function () { toggleMenu(false); setView('trade'); };
document.getElementById('mRefrescar').onclick = function () { sincronizarTodo(); };

// ---------- Navegación (barra inferior) ----------
var VIEWS = ['inicio', 'portafolio', 'cash', 'trade', 'noticias', 'account', 'config', 'ia', 'seguridad', 'buscar', 'ibkr', 'bnb', 'cs'];
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
var navName = (name === 'account') ? accountReturnView : name;
NAVTABS.forEach(function (b) {
b.classList.toggle('active', b.getAttribute('data-view') === navName);
});
if (name === 'portafolio') { renderPortafolio(); if (!anaCargado) cargarAnalisis(false); }
// Configuracion dispara 3 llamadas al backend (~1,5 s cada una): dentro de la
// sesion se refrescan como mucho cada 5 min. Guardar algo sigue llamando
// cargarPlataformas()/cargarEstadoIA() directo, asi lo editado se ve al toque.
// pintarSaludApp es 100% local y se repinta siempre (muestra edades de cache).
if (name === 'config') {
pintarSaludApp();
if (Date.now() - configUltimaCarga > CONFIG_REFRESCO_MS) {
configUltimaCarga = Date.now();
cargarPlataformas(); cargarEstadoIA(); cargarBackups();
}
}
if (name === 'ibkr') cargarEstadoIBKR();
if (name === 'bnb') prepararBNB();
if (name === 'cs') cargarEstadoCS();
if (name === 'ia') prepararIA();
if (name === 'seguridad') prepararSeguridad();
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
document.getElementById('accTotal').textContent = 'Cargando...';
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
document.getElementById('accLiq').textContent = 'Cash en la cuenta: ' + fmt(data.liquidez);
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
var TIPO_LABELS = { accion: 'Acciones', etf: 'ETFs', cripto: 'Cripto', cash: 'Cash' };
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
datasets: [{ data: items.map(function (c) { return c.valor; }), backgroundColor: PIE_COLORS.slice(0, items.length), borderColor: temaChart().pieBorder, borderWidth: 3 }]
},
options: { cutout: '62%', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
});
// Leyenda compacta al costado: nombre + % (el detalle en USD vive en Inicio)
var leg = document.getElementById('pieLegend');
leg.innerHTML = '';
items.forEach(function (c, i) {
var row = document.createElement('div');
row.className = 'pierow' + (c.acc ? ' clickable' : '');
row.innerHTML = '<span class="lname"><span class="dot" style="background:' + PIE_COLORS[i % PIE_COLORS.length] + '"></span>' + esc(c.label) + '</span>' +
'<span class="lpct">' + (total ? ((c.valor / total) * 100).toFixed(1) : '0') + '%' + (c.acc ? '<span class="chev">&rsaquo;</span>' : '') + '</span>';
if (c.acc) row.onclick = function () { showAccount(c.acc, 'portafolio'); };
leg.appendChild(row);
});
// La tabla con TODAS las posiciones salio de esta vista el 17/08/2026 (pedido
// de Guzman); su rol lo cumple el detalle de cada cuenta (V8).
// El mapa de calor mensual (V5) se calcula sobre fullSerie, ya en memoria.
renderMapaCalor();
}

