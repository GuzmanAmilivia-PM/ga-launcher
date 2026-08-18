// Analisis de la cartera: concentracion, diversificacion y riesgo (item V3)
// ---------- Analisis de la cartera ----------
// El backend (fn 'analisis') hace las cuentas y manda todo resuelto, incluidos
// los textos de cada chequeo: aca solo se pinta. Cache local igual que
// dividendos y aportes — se ve al instante lo ultimo y se refresca por atras.
var anaCargado = false;

function cargarAnalisis(forzar) {
anaCargado = true;
cargarConCache({
clave: 'ga_cache_ana',
avisoId: 'anaCacheAviso',
bodyId: 'anaBody',
cargando: 'Analizando tu cartera...',
forzar: !!forzar,
render: renderAnalisis,
alFallar: function () { anaCargado = false; },
pedir: function (ok, fail) {
google.script.run.withSuccessHandler(ok).withFailureHandler(fail).getAnalisis({ forzar: !!forzar });
}
});
}

function anaPct(x, dec) {
if (x === null || x === undefined || !isFinite(x)) return '—';
return (Math.round(x * (dec === 1 ? 1000 : 100)) / (dec === 1 ? 10 : 1)).toFixed(dec === 1 ? 1 : 0) + '%';
}
function anaFecha(ms) {
if (!ms) return '';
var d = new Date(ms);
return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
}

function renderAnalisis(r) {
var body = document.getElementById('anaBody');
if (!r || !r.ok) {
body.innerHTML = '<p class="newsempty">' + esc(msgBackend(r)) + '</p>';
return;
}
var c = r.concentracion || {}, rie = r.riesgo || {};
var html = '';

// Puntaje: como esta ARMADA la cartera, no cuanto rindio. La barra hace de
// lectura rapida; el detalle real son los chequeos de abajo.
html += '<div class="anascore"><b>' + esc(r.nivel || '') + '</b><span>' + (r.puntaje || 0) + '/100</span></div>';
html += '<div class="anabarra"><i style="width:' + Math.max(2, Math.min(100, r.puntaje || 0)) + '%"></i></div>';

// Numeros duros. "Posiciones efectivas" = 1/HHI: con que se sienten 12
// posiciones si una pesa el 60% (respuesta: con 2).
html += '<div class="anagrid">' +
'<div class="anacelda"><span>Posiciones</span><b>' + (c.posiciones || 0) + '</b><em>equivalen a ' + (c.efectivas || 0).toFixed(1) + ' parejas</em></div>' +
'<div class="anacelda"><span>Top 5</span><b>' + esc(anaPct(c.top5, 1)) + '</b><em>de lo invertido</em></div>' +
'<div class="anacelda"><span>Volatilidad</span><b>' + esc(anaPct(rie.volAnual, 1)) + '</b><em>' + (rie.volAnual === null ? 'sin historial suficiente' : 'anualizada') + '</em></div>' +
'<div class="anacelda"><span>Peor caída</span><b>' + esc(anaPct(rie.drawdown, 1)) + '</b><em>' + (rie.drawdown === null ? '—' : 'desde su punto más alto') + '</em></div>' +
'</div>';

// El reparto por tipo, por plataforma y por posicion NO se dibuja aca
// (17/08/2026, pedido de Guzman): ya esta en Inicio y en la torta de arriba de
// esta misma vista. Los datos igual llegan en la respuesta y los usan los
// chequeos.

// Chequeos: el corazon de la pantalla. Cada uno dice como esta ese aspecto y
// por que, en criollo.
html += '<p class="anasub">Chequeos</p>';
(r.chequeos || []).forEach(function (q) {
html += '<div class="anachk ' + esc(q.estado) + '"><i class="luz"></i><div><b>' + esc(q.titulo) + '</b><em>' + esc(q.detalle) + '</em></div></div>';
});

if (rie.drawdown && rie.drawdownDesde) {
html += '<p class="newsempty" style="margin-top:10px">La peor caída fue entre el ' + esc(anaFecha(rie.drawdownDesde)) + ' y el ' + esc(anaFecha(rie.drawdownHasta)) + '.</p>';
}
html += '<p class="newsempty" style="margin-top:6px">Es una descripción de cómo está armada tu cartera, no una recomendación de compra o venta.</p>';

body.innerHTML = html;
}

document.getElementById('anaRefreshBtn').onclick = function () { cargarAnalisis(true); };
