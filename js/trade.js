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
el.textContent = 'USD ' + (Math.round(f.qty * f.precio * 100) / 100).toLocaleString('en-US');
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
if (!f.symbol || !/^[A-Z0-9.\-]{1,12}$/.test(f.symbol)) errs.push('Invalid ticker.');
if (!isFinite(f.qty) || f.qty <= 0) errs.push('Invalid quantity.');
if (!isFinite(f.precio) || f.precio <= 0) errs.push('Invalid price.');
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
'<b>' + (f.tipo === 'compra' ? 'BUY' : 'SELL') + '</b>: ' + esc(f.qty) + ' &times; <b>' + esc(f.symbol) + '</b> at USD ' + esc(f.precio) +
' = <b>USD ' + esc(monto.toLocaleString('en-US')) + '</b><br>in ' + esc(nombre) + '. This updates the Google Sheet (quantity, average price and cash).';
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
btn.disabled = true; btn.textContent = 'Recording...';
google.script.run.withSuccessHandler(function (res) {
btn.disabled = false; btn.textContent = 'Confirm and log';
cerrarConfirm();
if (res && res.ok) {
var r = res.resumen;
var html = '&#10003; Logged: ' + (r.tipo === 'compra' ? 'buy' : 'sell') + ' ' + esc(r.qty) + ' ' + esc(r.symbol) + ' at USD ' + esc(r.precio) + ' in ' + esc(r.cuenta) + '.';
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
mostrarResultado(esc((res && res.mensajes || ['Unknown error.']).join(' ')), false);
}
}).withFailureHandler(function (err) {
btn.disabled = false; btn.textContent = 'Confirm and log';
cerrarConfirm();
mostrarResultado('Error: ' + esc(err.message), false);
}).registrarOperacion(f);
};
// ---------- Operaciones (compras y ventas) ----------
// La lista viaja entera desde el backend (brokers + lo cargado a mano) y los
// filtros se aplican ACA: cambiar de rango o de tipo es instantaneo, sin pagar
// el viaje que cuesta cada llamada al backend.
var opsRango = 'ytd', opsTipo = 'todas', opsTicker = 'todos', lastOps = null;
// t = lo que dice la pantallita de opciones; c = lo que entra en el boton
// (en un telefono de 375 px el boton mide ~87: "Desde el inicio" se cortaba).
var OPS_RANGOS = [
{ v: 'ytd', t: 'This year', c: 'This year' },
{ v: '3m', t: 'Last 3 months', c: '3 months' },
{ v: 'todo', t: 'Since inception', c: 'All' }
];
var OPS_TIPOS = [
{ v: 'todas', t: 'All' },
{ v: 'compra', t: 'Buys' },
{ v: 'venta', t: 'Sells' }
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
_opsTickersCache = [{ v: 'todos', t: 'All' }].concat(symbols.map(function (s) { return { v: s, t: s }; }));
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
abrirPicker('Period', OPS_RANGOS, opsRango, function (v) { opsRango = v; });
};
document.getElementById('opsFiltroTipo').onclick = function () {
abrirPicker('Type', OPS_TIPOS, opsTipo, function (v) { opsTipo = v; });
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
cargando: 'Reading your buys and sells...',
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
'<div><span>Buys</span><b class="up">' + esc(opsMonto(compras)) + '</b></div>' +
'<div><span>Sells</span><b class="down">' + esc(opsMonto(ventas)) + '</b></div>';

if (!lista.length) {
body.innerHTML = todas.length
? '<div class="vacio"><span class="vic">&#128269;</span><b>Nothing with these filters</b>Try another period, type, or ticker.</div>'
: '<div class="vacio"><span class="vic">&#128200;</span><b>No trades yet</b>Your buys and sells will show up here.</div>';
} else {
body.innerHTML = '';
lista.forEach(function (o) {
var esCompra = o.tipo === 'compra';
var d = document.createElement('div');
d.className = 'txrow';
d.innerHTML = '<span><b class="' + (esCompra ? 'up' : 'down') + '">' + (esCompra ? 'BUY' : 'SELL') + '</b> ' + esc(o.qty) + ' &times; <b>' + esc(o.symbol) + '</b>' +
'<span class="txmeta">' + esc(nombrePlataforma(o.cuenta)) + ' &middot; ' + esc(opsFechaTxt(o.fecha)) +
(o.origen === 'manual' ? '<span class="opstag">manual</span>' : '') + '</span></span>' +
'<span>' + esc(opsMonto(o.monto)) + '<span class="txmeta">at ' + esc(o.precio) + '</span></span>';
body.appendChild(d);
});
}

var avisos = (r.avisos || []).slice();
if (r.recortadas) avisos.push('Showing the 500 most recent trades.');
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
if (diffH < 1) return 'just now';
if (diffH < 24) return diffH + 'h ago';
return Math.round(diffH / 24) + 'd ago';
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
body.innerHTML = '<div class="vacio"><span class="vic">&#128240;</span><b>No news for now</b>When there are headlines about your positions, they will show up here.</div>';
return;
}

// 1) Movimientos bruscos (±3% o más en 24h), siempre arriba.
var card = document.createElement('div');
card.className = 'card';
var html = '<span class="newssym">Sharp moves (24h)</span>';
if (!data.bruscos || !data.bruscos.length) {
html += '<p class="newsempty">No position moved &plusmn;3% in the last 24h.</p>';
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
html = '<span class="newssym">US Market — S&amp;P 500 &middot; Nasdaq</span>';
html += (data.mercado && data.mercado.length) ? newsItemsHtml(data.mercado) : '<p class="newsempty">No news from serious media outlets for now.</p>';
card.innerHTML = html;
body.appendChild(card);

// 3) Noticias por empresa (sin ETFs).
(data.empresas || []).forEach(function (item) {
var c = document.createElement('div');
c.className = 'card';
var h = '<span class="newssym">' + esc(item.symbol) + (item.nombre ? ' — ' + esc(item.nombre) : '') + '</span>';
h += (item.noticias && item.noticias.length) ? newsItemsHtml(item.noticias) : '<p class="newsempty">No news from serious media outlets for now.</p>';
c.innerHTML = h;
body.appendChild(c);
});
}

// ---------- Podcast diario de noticias (30/08/2026) ----------
// Mismo patron UX que analizarIA (ia.js): boton -> estado de carga ->
// exito/error, con reintento. El guion lo escribe Claude (misma clave de
// IA Insights) y la voz la genera Google Cloud Text-to-Speech (misma cuenta
// de servicio que ya habla con la Sheets API) — las dos APIs viven en el
// backend, aca solo se pinta el resultado.
var podcastCargando = false;
function wirePodcastBtn(id, forzar) {
var btn = document.getElementById(id);
if (btn) btn.onclick = function () { generarPodcast(forzar); };
}
wirePodcastBtn('podcastBtn', false);
function podcastErrorHtml(msg) {
return '<p class="newsempty">' + esc(msg) + '</p><button type="button" class="ghostbtn" id="podcastBtn">Generate podcast</button>';
}
function podcastHtml(r) {
// r.audioBase64 solo trae el alfabeto base64 (A-Za-z0-9+/=): no hace falta
// esc(), y escaparlo igual no cambiaria nada.
return '<audio controls preload="none" style="width:100%" src="data:' + esc(r.mime || 'audio/mpeg') + ';base64,' + r.audioBase64 + '"></audio>' +
'<p class="ia-p" style="margin-top:10px">' + esc(r.guion || '') + '</p>' +
'<button type="button" class="ghostbtn" id="podcastRegen">Regenerate</button>';
}
function generarPodcast(forzar) {
if (podcastCargando) return;
podcastCargando = true;
var out = document.getElementById('podcastBody');
out.innerHTML = '<p class="loadingtxt">Writing the script and generating the voice... this can take up to a minute.</p>';
google.script.run.withSuccessHandler(function (r) {
podcastCargando = false;
if (!r || !r.ok) {
var msg = (r && r.sinClave)
? 'Configure your Anthropic key in Configuration → AI Insights to generate the podcast.'
: msgBackend(r) || 'Error';
out.innerHTML = podcastErrorHtml(msg);
wirePodcastBtn('podcastBtn', false);
return;
}
out.innerHTML = podcastHtml(r);
wirePodcastBtn('podcastRegen', true);
}).withFailureHandler(function (err) {
podcastCargando = false;
out.innerHTML = podcastErrorHtml(msgErr(err, 'The podcast'));
wirePodcastBtn('podcastBtn', false);
}).getPodcast({ forzar: !!forzar });
}


// ---------- Resultados de las empresas (V11) ----------
// El calendario lo arma el backend una vez por dia (cron + Finnhub) y aca
// solo se pinta: que empresa reporta y cuando (ESTIMACION hasta que la
// empresa confirme), y que reporto contra que se esperaba. Los limites se
// dicen (regla U2): cubre acciones de EE.UU.; ETFs y cripto no reportan.
var resultadosCargados = false;
function fechaResultado(ymd) {
var d = new Date(String(ymd) + 'T12:00:00');
if (isNaN(d.getTime())) return String(ymd);
var dias = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
return dias[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1);
}
function usd(n) { return 'US$ ' + String(n); }
function renderResultados(data) {
var el = document.getElementById('resultadosBody');
if (!el) return;
var card = '<span class="newssym">Your companies&rsquo; earnings</span>';
if (!data || !data.hay) {
card += '<p class="newsempty">No calendar data yet: it updates every morning with the sync.</p>';
el.innerHTML = '<div class="card">' + card + '</div>';
return;
}
var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
var pasados = [], porVenir = [];
(data.eventos || []).forEach(function (e) {
var d = new Date(String(e.fecha) + 'T12:00:00');
if (isNaN(d.getTime())) return;
if (e.epsReal !== null || e.revReal !== null) pasados.push(e);
else if (d.getTime() >= hoy.getTime()) porVenir.push(e);
});
if (!pasados.length && !porVenir.length) {
// El plazo sale del payload, NO escrito a mano: decía "two weeks" con el
// horizonte del backend en 14, y al ampliarlo a 90 ese texto habría pasado
// a mentir sin que nada fallara (31/08/2026).
var d = Number(data.horizonteDias);
// Sin el dato (un backend anterior a que el campo existiera) no se inventa
// un plazo: se dice que es el período cubierto, sin número.
var plazo = (isFinite(d) && d > 0)
  ? 'in the next ' + (d % 30 === 0 ? (d / 30) + (d === 30 ? ' month' : ' months') : d + ' days')
  : 'in the covered period';
card += '<p class="newsempty">None of your companies report ' + esc(plazo) + '.</p>';
}
pasados.forEach(function (e) {
var partes = [];
if (e.epsReal !== null) partes.push('EPS ' + usd(e.epsReal) + (e.epsEstimado !== null ? ' vs ' + usd(e.epsEstimado) + ' expected' : ''));
if (e.revReal !== null) partes.push('revenue ' + usd(Math.round(e.revReal / 1e6)) + 'M' + (e.revEstimado !== null ? ' vs ' + usd(Math.round(e.revEstimado / 1e6)) + 'M' : ''));
card += '<div class="newsmove"><span><b>' + esc(e.symbol) + '</b> reported on ' + esc(fechaResultado(e.fecha)) + ': ' + esc(partes.join(' · ')) + '</span></div>';
});
porVenir.forEach(function (e) {
// `hora` viaja como CÓDIGO del proveedor, no como frase: el mismo dato lo
// consumen el mail (en español) y esta pantalla (en inglés), así que cada
// uno traduce. Antes llegaba ya escrito y se imprimía "antes de abrir" en
// una interfaz en inglés. Un código que no conocemos no se nombra.
var cuando = e.hora === 'bmo' ? 'before the open' : (e.hora === 'amc' ? 'after the close' : '');
var linea = '<b>' + esc(e.symbol) + '</b> reports on ' + esc(fechaResultado(e.fecha)) + (cuando ? ', ' + esc(cuando) : '');
if (e.epsEstimado !== null) linea += ' — EPS expected ' + esc(usd(e.epsEstimado));
linea += ' <span class="newsmeta">(estimated)</span>';
card += '<div class="newsmove"><span>' + linea + '</span></div>';
});
if (data.fueraDeCobertura && data.fueraDeCobertura.length) {
card += '<p class="newsempty">No coverage (not listed in the US): ' + esc(data.fueraDeCobertura.join(', ')) + '. ETFs and crypto do not report earnings.</p>';
}
// Los que NO contestaron. Sin esto, un proveedor a medias se lee igual que
// "no reporta nadie": el 1/09/2026 el calendario traía UN evento de doce y
// la pantalla no tenía cómo decirlo — ni yo, mirándola.
if (data.sinRespuesta && data.sinRespuesta.length) {
card += '<p class="newsempty">&#9888; Could not check ' + esc(data.sinRespuesta.join(', ')) +
  ' — the data provider did not answer for ' + (data.sinRespuesta.length === 1 ? 'it' : 'them') +
  '. This list may be incomplete; it retries every morning.</p>';
}
el.innerHTML = '<div class="card">' + card + '</div>';
}
function cargarResultados() {
if (resultadosCargados) return;
resultadosCargados = true;
google.script.run.withSuccessHandler(function (d) { renderResultados(d); })
.withFailureHandler(function () { resultadosCargados = false; }).getResultados();
}
