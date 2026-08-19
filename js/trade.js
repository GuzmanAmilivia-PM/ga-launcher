// Trade, operaciones y noticias
// ---------- Trade ----------
var tradeTipo = 'compra';
function setTipo(t) {
tradeTipo = t;
document.getElementById('btnCompra').className = 'tipobtn' + (t === 'compra' ? ' active-compra' : '');
document.getElementById('btnVenta').className = 'tipobtn' + (t === 'venta' ? ' active-venta' : '');
actualizarMonto();
}
document.getElementById('btnCompra').onclick = function () { setTipo('compra'); };
document.getElementById('btnVenta').onclick = function () { setTipo('venta'); };

function buildTradeForm() {
var sel = document.getElementById('tCuenta');
sel.innerHTML = '';
ACCOUNTS.forEach(function (a) {
var o = document.createElement('option');
o.value = a.key; o.textContent = nombrePlataforma(a.nombre);
sel.appendChild(o);
});
}
function actualizarSymbols() {
if (!lastData) return;
var dl = document.getElementById('symbolsList');
dl.innerHTML = '';
(lastData.posiciones || []).forEach(function (p) {
var o = document.createElement('option');
o.value = p.symbol;
dl.appendChild(o);
});
}
function leerForm() {
return {
cuenta: document.getElementById('tCuenta').value,
tipo: tradeTipo,
symbol: document.getElementById('tSymbol').value.trim().toUpperCase(),
qty: parseFloat(document.getElementById('tQty').value),
precio: parseFloat(document.getElementById('tPrecio').value)
};
}
function actualizarMonto() {
var f = leerForm();
var el = document.getElementById('tMonto');
if (isFinite(f.qty) && f.qty > 0 && isFinite(f.precio) && f.precio > 0) {
el.textContent = 'USD ' + (Math.round(f.qty * f.precio * 100) / 100).toLocaleString('es-UY');
} else { el.textContent = '—'; }
}
['tQty', 'tPrecio'].forEach(function (id) {
document.getElementById(id).addEventListener('input', actualizarMonto);
});
document.getElementById('tSymbol').addEventListener('input', function () {
// Autocompletar precio con el precio actual conocido de la posición
if (!lastData) return;
var s = this.value.trim().toUpperCase();
var pos = (lastData.posiciones || []).filter(function (p) { return String(p.symbol).toUpperCase() === s; })[0];
var precioEl = document.getElementById('tPrecio');
if (pos && pos.precioActual && !precioEl.value) precioEl.value = pos.precioActual;
});

function validarForm(f) {
var errs = [];
if (!f.symbol || !/^[A-Z0-9.\-]{1,12}$/.test(f.symbol)) errs.push('Ticker inválido.');
if (!isFinite(f.qty) || f.qty <= 0) errs.push('Cantidad inválida.');
if (!isFinite(f.precio) || f.precio <= 0) errs.push('Precio inválido.');
return errs;
}
function mostrarResultado(html, esOk) {
document.getElementById('tResultado').innerHTML = '<div class="tmsg ' + (esOk ? 'ok' : 'err') + '">' + html + '</div>';
}
document.getElementById('tRevisar').onclick = function () {
var f = leerForm();
var errs = validarForm(f);
document.getElementById('tResultado').innerHTML = '';
if (errs.length) { mostrarResultado(esc(errs.join(' ')), false); return; }
var nombre = nombrePlataforma(ACCOUNTS.filter(function (a) { return a.key === f.cuenta; })[0].nombre);
var monto = Math.round(f.qty * f.precio * 100) / 100;
document.getElementById('tConfirmTxt').innerHTML =
'<b>' + (f.tipo === 'compra' ? 'COMPRA' : 'VENTA') + '</b>: ' + esc(f.qty) + ' &times; <b>' + esc(f.symbol) + '</b> a USD ' + esc(f.precio) +
' = <b>USD ' + esc(monto.toLocaleString('es-UY')) + '</b><br>en ' + esc(nombre) + '. Se actualiza la Google Sheet (cantidad, precio promedio y cash).';
document.getElementById('tConfirmWrap').style.display = '';
this.style.display = 'none';
};
function cerrarConfirm() {
document.getElementById('tConfirmWrap').style.display = 'none';
document.getElementById('tRevisar').style.display = '';
}
document.getElementById('tCancelar').onclick = cerrarConfirm;
document.getElementById('tConfirmar').onclick = function () {
var f = leerForm();
var btn = this;
btn.disabled = true; btn.textContent = 'Registrando...';
google.script.run.withSuccessHandler(function (res) {
btn.disabled = false; btn.textContent = 'Confirmar y registrar';
cerrarConfirm();
if (res && res.ok) {
var r = res.resumen;
var html = '&#10003; Registrado: ' + esc(r.tipo) + ' ' + esc(r.qty) + ' ' + esc(r.symbol) + ' a USD ' + esc(r.precio) + ' en ' + esc(r.cuenta) + '.';
(res.mensajes || []).forEach(function (m) { html += '<br>&#9888; ' + esc(m); });
mostrarResultado(html, true);
document.getElementById('tSymbol').value = '';
document.getElementById('tQty').value = '';
document.getElementById('tPrecio').value = '';
actualizarMonto();
document.getElementById('tManual').open = false;
loadData();
cargarOperaciones(true);
} else {
mostrarResultado(esc((res && res.mensajes || ['Error desconocido.']).join(' ')), false);
}
}).withFailureHandler(function (err) {
btn.disabled = false; btn.textContent = 'Confirmar y registrar';
cerrarConfirm();
mostrarResultado('Error: ' + esc(err.message), false);
}).registrarOperacion(f);
};
// ---------- Operaciones (compras y ventas) ----------
// La lista viaja entera desde el backend (brokers + lo cargado a mano) y los
// filtros se aplican ACA: cambiar de rango o de tipo es instantaneo, sin pagar
// el viaje de ~1,5 s que cuesta cada llamada a Apps Script.
var opsRango = 'ytd', opsTipo = 'todas', opsTicker = 'todos', lastOps = null;
// t = lo que dice la pantallita de opciones; c = lo que entra en el boton
// (en un telefono de 375 px el boton mide ~87: "Desde el inicio" se cortaba).
var OPS_RANGOS = [
{ v: 'ytd', t: 'Este año', c: 'Este año' },
{ v: '3m', t: 'Últimos 3 meses', c: '3 meses' },
{ v: 'todo', t: 'Desde el inicio', c: 'Todo' }
];
var OPS_TIPOS = [
{ v: 'todas', t: 'Todos' },
{ v: 'compra', t: 'Compras' },
{ v: 'venta', t: 'Ventas' }
];

function opsIso(d) {
return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
// Primer dia incluido segun el filtro de fecha ('' = desde el inicio).
function opsDesde() {
var hoy = new Date();
if (opsRango === 'ytd') return hoy.getFullYear() + '-01-01';
if (opsRango === '3m') return opsIso(new Date(hoy.getFullYear(), hoy.getMonth() - 3, hoy.getDate()));
return '';
}
function opsFechaTxt(iso) {
var p = String(iso || '').split('-');
return p.length === 3 ? (p[2] + '/' + p[1] + '/' + p[0]) : String(iso || '');
}
// Delegado en fmt (nucleo.js): misma etiqueta USD, mismo redondeo y ojito;
// solo cambia que aca un null cuenta como 0 (son sumas de montos).
function opsMonto(n) {
return fmt(Number(n) || 0);
}
// Los tickers que hay para elegir salen de lo que esta cargado, no de una
// lista fija: si nunca operaste algo, no tiene sentido ofrecerlo.
// Memoizado por referencia: la lista solo cambia cuando llega otra respuesta
// (renderOperaciones pisa lastOps), no en cada pintada de filtros.
var _opsTickersDe = null, _opsTickersCache = null;
function opsTickers() {
if (lastOps === _opsTickersDe && _opsTickersCache) return _opsTickersCache;
var vistos = {}, symbols = [];
((lastOps && lastOps.operaciones) || []).forEach(function (o) {
if (o.symbol && !vistos[o.symbol]) { vistos[o.symbol] = true; symbols.push(o.symbol); }
});
symbols.sort();
_opsTickersDe = lastOps;
_opsTickersCache = [{ v: 'todos', t: 'Todos' }].concat(symbols.map(function (s) { return { v: s, t: s }; }));
return _opsTickersCache;
}
function opsTexto(opciones, valor) {
var o = opciones.filter(function (x) { return x.v === valor; })[0];
return o ? (o.c || o.t) : valor;
}
// Cada boton muestra lo elegido; el detalle esta en la pantallita que abre.
function pintarFiltros() {
document.querySelector('#opsFiltroRango b').textContent = opsTexto(OPS_RANGOS, opsRango);
document.querySelector('#opsFiltroTipo b').textContent = opsTexto(OPS_TIPOS, opsTipo);
document.querySelector('#opsFiltroTicker b').textContent = opsTexto(opsTickers(), opsTicker);
}
function cerrarPicker() { document.getElementById('opsPicker').style.display = 'none'; }
function abrirPicker(titulo, opciones, actual, alElegir) {
document.getElementById('opsPickerTit').textContent = titulo;
var cont = document.getElementById('opsPickerOpts');
cont.innerHTML = '';
opciones.forEach(function (o) {
var b = document.createElement('button');
b.type = 'button';
b.className = 'opspick' + (o.v === actual ? ' sel' : '');
b.textContent = o.t;
b.onclick = function () {
cerrarPicker();
alElegir(o.v);
pintarFiltros();
if (lastOps) renderOperaciones(lastOps);
};
cont.appendChild(b);
});
document.getElementById('opsPicker').style.display = 'flex';
}
document.getElementById('opsPickerClose').onclick = cerrarPicker;
document.getElementById('opsPicker').onclick = function (e) { if (e.target === this) cerrarPicker(); };
document.getElementById('opsFiltroRango').onclick = function () {
abrirPicker('Período', OPS_RANGOS, opsRango, function (v) { opsRango = v; });
};
document.getElementById('opsFiltroTipo').onclick = function () {
abrirPicker('Tipo', OPS_TIPOS, opsTipo, function (v) { opsTipo = v; });
};
document.getElementById('opsFiltroTicker').onclick = function () {
abrirPicker('Ticker', opsTickers(), opsTicker, function (v) { opsTicker = v; });
};
// La actividad de los brokers se guarda 6 h en el backend: sin esto, un cambio
// recien hecho en el broker no se puede ver hasta que venza el cache.
document.getElementById('opsRefreshBtn').onclick = function () { cargarOperaciones(true); };

function cargarOperaciones(forzar) {
opsCargadas = true;
cargarConCache({
clave: 'ga_cache_ops',
avisoId: 'opsCacheAviso',
bodyId: 'opsBody',
cargando: 'Leyendo tus compras y ventas...',
forzar: !!forzar,
limpiar: function () {
document.getElementById('opsResumen').innerHTML = '';
document.getElementById('opsAvisos').innerHTML = '';
},
render: renderOperaciones,
alFallar: function () { opsCargadas = false; },
pedir: function (ok, fail) {
google.script.run.withSuccessHandler(ok).withFailureHandler(fail).getOperaciones({ forzar: !!forzar });
}
});
}

function renderOperaciones(r) {
lastOps = r;
var body = document.getElementById('opsBody');
var resumenEl = document.getElementById('opsResumen');
var avisosEl = document.getElementById('opsAvisos');
resumenEl.innerHTML = '';
avisosEl.innerHTML = '';
if (!r || !r.ok) {
opsCargadas = false; // la proxima visita reintenta (mismo criterio que dividendos)
body.innerHTML = '<p class="newsempty">' + esc(msgBackend(r)) + '</p>';
return;
}
var todas = r.operaciones || [];
// El ticker elegido puede no existir en los datos nuevos (otro refresco, otra
// ventana del broker): sin esto la pantalla quedaria vacia sin explicacion.
if (opsTicker !== 'todos' && !todas.some(function (o) { return o.symbol === opsTicker; })) opsTicker = 'todos';
pintarFiltros();
var desde = opsDesde();
var lista = todas.filter(function (o) {
if (desde && String(o.fecha) < desde) return false;
if (opsTipo !== 'todas' && o.tipo !== opsTipo) return false;
if (opsTicker !== 'todos' && o.symbol !== opsTicker) return false;
return true;
});

var compras = 0, ventas = 0;
lista.forEach(function (o) {
if (o.tipo === 'compra') compras += Number(o.monto) || 0; else ventas += Number(o.monto) || 0;
});
resumenEl.className = 'opsresumen';
resumenEl.innerHTML =
'<div><span>Trades</span><b>' + lista.length + '</b></div>' +
'<div><span>Compras</span><b class="up">' + esc(opsMonto(compras)) + '</b></div>' +
'<div><span>Ventas</span><b class="down">' + esc(opsMonto(ventas)) + '</b></div>';

if (!lista.length) {
body.innerHTML = todas.length
? '<div class="vacio"><span class="vic">&#128269;</span><b>Nada con estos filtros</b>Prob&aacute; con otro per&iacute;odo, otro tipo u otro ticker.</div>'
: '<div class="vacio"><span class="vic">&#128200;</span><b>Sin trades todav&iacute;a</b>Tus compras y ventas van a aparecer ac&aacute;.</div>';
} else {
body.innerHTML = '';
lista.forEach(function (o) {
var esCompra = o.tipo === 'compra';
var d = document.createElement('div');
d.className = 'txrow';
d.innerHTML = '<span><b class="' + (esCompra ? 'up' : 'down') + '">' + (esCompra ? 'COMPRA' : 'VENTA') + '</b> ' + esc(o.qty) + ' &times; <b>' + esc(o.symbol) + '</b>' +
'<span class="txmeta">' + esc(nombrePlataforma(o.cuenta)) + ' &middot; ' + esc(opsFechaTxt(o.fecha)) +
(o.origen === 'manual' ? '<span class="opstag">a mano</span>' : '') + '</span></span>' +
'<span>' + esc(opsMonto(o.monto)) + '<span class="txmeta">a ' + esc(o.precio) + '</span></span>';
body.appendChild(d);
});
}

var avisos = (r.avisos || []).slice();
if (r.recortadas) avisos.push('Se muestran los 500 trades mas recientes.');
if (avisos.length) {
avisosEl.innerHTML = avisos.map(function (a) {
return '<p class="newsempty">&#9888; ' + esc(a) + '</p>';
}).join('');
}
}

// ---------- Noticias ----------
function timeAgo(pubDate) {
if (!pubDate) return '';
var d = new Date(pubDate);
if (isNaN(d.getTime())) return '';
var diffH = Math.round((Date.now() - d.getTime()) / 3600000);
if (diffH < 1) return 'hace un momento';
if (diffH < 24) return 'hace ' + diffH + 'h';
return 'hace ' + Math.round(diffH / 24) + 'd';
}
function newsItemsHtml(noticias) {
var html = '';
(noticias || []).forEach(function (n) {
html += '<div class="newsitem"><a href="' + esc(safeUrl(n.link)) + '" target="_blank" rel="noopener">' + esc(n.titulo) + '</a>' +
'<div class="newsmeta"><span class="src">' + esc(n.fuente || '') + '</span>' + (n.fuente && n.fecha ? ' · ' : '') + timeAgo(n.fecha) + '</div></div>';
});
return html;
}
function renderNoticias(data) {
var body = document.getElementById('noticiasBody');
body.innerHTML = '';
if (!data || (Array.isArray(data) && !data.length)) {
body.innerHTML = '<div class="vacio"><span class="vic">&#128240;</span><b>Sin novedades por ahora</b>Cuando haya titulares sobre tus posiciones, van a aparecer ac&aacute;.</div>';
return;
}

// 1) Movimientos bruscos (±3% o más en 24h), siempre arriba.
var card = document.createElement('div');
card.className = 'card';
var html = '<span class="newssym">Movimientos bruscos (24h)</span>';
if (!data.bruscos || !data.bruscos.length) {
html += '<p class="newsempty">Ninguna posición se movió &plusmn;3% en las últimas 24hs.</p>';
} else {
data.bruscos.forEach(function (b) {
var up = Number(b.cambio) >= 0;
html += '<div class="newsmove"><span><b>' + esc(b.symbol) + '</b>' + (b.nombre ? ' — ' + esc(b.nombre) : '') + '</span>' +
'<span class="' + (up ? 'up' : 'down') + '">' + signoPct(Number(b.cambio), 2) + '</span></div>' +
newsItemsHtml(b.noticias);
});
}
card.innerHTML = html;
body.appendChild(card);

// 2) Mercado USA (S&P 500 / Nasdaq).
card = document.createElement('div');
card.className = 'card';
html = '<span class="newssym">Mercado USA — S&amp;P 500 &middot; Nasdaq</span>';
html += (data.mercado && data.mercado.length) ? newsItemsHtml(data.mercado) : '<p class="newsempty">Sin noticias de medios serios por ahora.</p>';
card.innerHTML = html;
body.appendChild(card);

// 3) Noticias por empresa (sin ETFs).
(data.empresas || []).forEach(function (item) {
var c = document.createElement('div');
c.className = 'card';
var h = '<span class="newssym">' + esc(item.symbol) + (item.nombre ? ' — ' + esc(item.nombre) : '') + '</span>';
h += (item.noticias && item.noticias.length) ? newsItemsHtml(item.noticias) : '<p class="newsempty">Sin noticias de medios serios por ahora.</p>';
c.innerHTML = h;
body.appendChild(c);
});
}

