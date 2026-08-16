// Trade, transacciones y noticias
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
loadData();
google.script.run.withSuccessHandler(renderTransacciones).getTransacciones();
} else {
mostrarResultado(esc((res && res.mensajes || ['Error desconocido.']).join(' ')), false);
}
}).withFailureHandler(function (err) {
btn.disabled = false; btn.textContent = 'Confirmar y registrar';
cerrarConfirm();
mostrarResultado('Error: ' + esc(err.message), false);
}).registrarOperacion(f);
};
function renderTransacciones(lista) {
lastTx = lista;
var el = document.getElementById('txList');
if (!lista || !lista.length) { el.innerHTML = '<p class="newsempty">Sin operaciones registradas todav&iacute;a.</p>'; return; }
el.innerHTML = '';
lista.forEach(function (t) {
var d = document.createElement('div');
d.className = 'txrow';
d.innerHTML = '<span><b class="' + (String(t.tipo).toLowerCase() === 'compra' ? 'up' : 'down') + '">' + esc(t.tipo) + '</b> ' + esc(t.qty) + ' &times; <b>' + esc(t.symbol) + '</b>' +
'<span class="txmeta">' + esc(t.cuenta) + ' &middot; ' + esc(t.fecha) + '</span></span>' +
'<span>' + esc(mask('USD ' + t.monto)) + '<span class="txmeta">a ' + esc(t.precio) + '</span></span>';
el.appendChild(d);
});
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
// Compatibilidad: el backend viejo devuelve un array plano por empresa.
if (Array.isArray(data)) data = { bruscos: [], mercado: [], empresas: data };

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
'<span class="' + (up ? 'up' : 'down') + '">' + (up ? '+' : '') + Number(b.cambio).toFixed(2) + '%</span></div>' +
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

