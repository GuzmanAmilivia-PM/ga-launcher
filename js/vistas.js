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
function pintarVersion() {
var v = document.getElementById('mbVersion');
if (!v) return;
if (!window.caches || !caches.keys) { v.textContent = '&mdash;'; return; }
caches.keys().then(function (claves) {
var c = claves.filter(function (k) { return k.indexOf('ga-pwa-') === 0; })[0];
v.textContent = c ? c.replace('ga-pwa-', '') : '—';
}).catch(function () {});
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
var currentView = 'inicio';
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
document.querySelectorAll('.navtab').forEach(function (b) {
b.classList.toggle('active', b.getAttribute('data-view') === navName);
});
if (name === 'portafolio') { renderPortafolio(); if (!anaCargado) cargarAnalisis(false); }
if (name === 'config') { cargarPlataformas(); cargarEstadoIA(); cargarBackups(); pintarSaludApp(); }
if (name === 'ibkr') cargarEstadoIBKR();
if (name === 'bnb') prepararBNB();
if (name === 'cs') cargarEstadoCS();
if (name === 'ia') prepararIA();
if (name === 'seguridad') prepararSeguridad();
if (name === 'noticias' && !noticiasCargadas) {
google.script.run.withSuccessHandler(function (d) { noticiasCargadas = true; renderNoticias(d); })
.withFailureHandler(function (err) { errorEnVista('noticiasBody', err, 'las noticias'); }).getNoticias();
}
if (name === 'trade' && !opsCargadas) cargarOperaciones(false);
window.scrollTo(0, 0);
}
document.querySelectorAll('.navtab').forEach(function (b) {
b.addEventListener('click', function () { setView(b.getAttribute('data-view')); });
});

// ---------- Detalle de cuenta ----------
var lastAcc = null, lastAccData = null;
function showAccount(acc, fromView) {
accountReturnView = fromView || 'portafolio';
setView('account');
document.getElementById('accTitle').textContent = nombrePlataforma(acc.nombre);
document.getElementById('accTotal').textContent = 'Cargando...';
document.getElementById('accLiq').textContent = '';
document.getElementById('accBody').innerHTML = '';
var accErr = document.getElementById('accError'); if (accErr) accErr.innerHTML = '';
google.script.run.withSuccessHandler(function (data) { renderAccount(acc, data); })
.withFailureHandler(function (err) {
document.getElementById('accTotal').textContent = '--';
errorEnVista('accError', err, 'el detalle de la cuenta');
}).getAccountData(acc.key);
}
document.getElementById('accBack').onclick = function () { setView(accountReturnView); };
function renderAccount(acc, data) {
lastAcc = acc; lastAccData = data;
document.getElementById('accTotal').textContent = fmt(data.total);
document.getElementById('accLiq').textContent = 'Cash en la cuenta: ' + fmt(data.liquidez);
var body = document.getElementById('accBody');
body.innerHTML = '';
data.posiciones.forEach(function (p) {
var tr = document.createElement('tr');
tr.innerHTML = '<td><span class="sym">' + esc(p.symbol) + '</span><span class="desc">' + esc(p.descripcion || '') + '</span></td>' +
'<td>' + esc(fmtNum(p.qty)) + '</td>' +
'<td>' + esc(fmtNum(p.precioActual)) + '</td>' +
'<td>' + fmt(p.valor) + '</td>' +
'<td class="' + chipClass(p.gainAmt) + '">' + fmt(p.gainAmt) + '</td>' +
'<td class="' + chipClass(p.gainPct) + '">' + esc(fmtPctRaw(p.gainPct)) + '</td>' +
'<td>' + esc(fmtPctRaw(p.pctAccount)) + '</td>';
tr.className = 'asset-row';
tr.onclick = function () { toggleDetalle(tr, { symbol: p.symbol, precioCompra: p.precioCompra, precioActual: p.precioActual, qty: p.qty, cripto: acc.key === 'BNB' }); };
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
if (total - sumaPos > 1) grupos.cash += (total - sumaPos);
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
// Desglose completo
var el = document.getElementById('allPosList');
el.innerHTML = '';
var lista = lastData.posiciones || [];
if (!lista.length) { el.innerHTML = '<tr><td colspan="5" class="newsempty">Sin posiciones.</td></tr>'; return; }
lista.forEach(function (h) {
var tr = document.createElement('tr');
tr.innerHTML = '<td><span class="sym">' + esc(h.symbol) + '</span><span class="desc">' + esc(h.nombre || '') + '</span></td>' +
'<td>' + esc(fmtNum(h.qty)) + '</td>' +
'<td>' + daychgHtml(h) + esc(fmtNum(h.precioActual)) + '</td>' +
'<td>' + gananciaHtml(h) + fmt(h.valor) + '</td>' +
'<td class="holdpct col-pct">' + (h.pct * 100).toFixed(1) + '%</td>';
tr.className = 'asset-row';
tr.onclick = function () { toggleDetalle(tr, h); };
el.appendChild(tr);
});
}

