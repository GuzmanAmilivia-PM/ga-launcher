// Analisis de la cartera: concentracion, diversificacion y riesgo (item V3)
// ---------- Analisis de la cartera ----------
// El backend (fn 'analisis') hace las cuentas y manda todo resuelto, incluidos
// los textos de cada chequeo: aca solo se pinta. Cache local igual que
// dividendos y aportes — se ve al instante lo ultimo y se refresca por atras.
var anaCargado = false;
// Si el desglose del puntaje estaba abierto, sigue abierto despues de repintar.
// renderAnalisis reescribe el panel entero, y se repinta seguido: al pintar del
// cache y otra vez cuando llega la respuesta fresca, y tambien al tocar el
// ojito. Sin esto, se abria el desglose y dos segundos despues se cerraba solo.
// Es la misma leccion que ya estaba anotada para el detalle de posiciones.
// Auditoria del 23/08/2026.
var anaDesgAbierto = false;

function cargarAnalisis(forzar) {
anaCargado = true;
cargarConCache({
clave: 'ga_cache_ana',
avisoId: 'anaCacheAviso',
bodyId: 'anaBody',
cargando: 'Analyzing your portfolio...',
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

// El desglose del puntaje: de donde sale el numero. Cada chequeo aporta su
// descuento (`resta`, que calcula el backend) y el total tiene que dar
// exactamente el puntaje mostrado — si no diera, la pantalla estaria mintiendo
// y por eso se verifica al pie en vez de asumirlo.
function anaDesgloseHtml(r) {
// El puntaje es el UNICO dato del backend que se interpolaba crudo. Hoy el
// contrato garantiza que sea numero, pero el payload se guarda en localStorage
// y la regla de la casa es que todo lo que viene de afuera se normaliza o se
// escapa. Auditoria del 23/08/2026.
var pj = Number(r.puntaje) || 0;
var base = (typeof r.puntajeBase === 'number') ? r.puntajeBase : 100;
var chequeos = r.chequeos || [];
// Sin el dato del backend (respuesta vieja del cache) no se inventa una
// cuenta: se dice que no esta.
var tieneRestas = chequeos.length > 0 && chequeos.every(function (q) { return typeof q.resta === 'number'; });
if (!tieneRestas) {
return '<p class="anadesg-nota">Calculation detail comes with the updated analysis. ' +
'Tap this card\u2019s refresh button.</p>';
}
var h = "<p class=\"anadesg-tit\">How we get to " + pj + "</p>";
h += '<div class="anadesg-fila base"><span>Starting point</span><b>' + base + '</b></div>';
h += '<p class="anadesg-nota">Every portfolio starts at ' + base + '. Each check that doesn\u2019t come out well subtracts: ' +
'<b>&minus;20</b> if it\u2019s a risk, <b>&minus;10</b> if it deserves attention, <b>0</b> if it\u2019s fine.</p>';
chequeos.forEach(function (q) {
var signo = q.resta > 0 ? ('&minus;' + q.resta) : '0';
h += '<div class="anadesg-fila ' + esc(q.estado) + '">' +
'<span><i class="luz"></i>' + esc(q.titulo) + '</span><b>' + signo + '</b>' +
'<em>' + esc(q.detalle) + '</em></div>';
});
var suma = 0;
chequeos.forEach(function (q) { suma += (Number(q.resta) || 0); });
var total = Math.max(0, base - suma);
h += '<div class="anadesg-fila total"><span>Total</span><b>' + total + '/100</b></div>';
// Si la cuenta no cerrara, decirlo es mejor que mostrar dos numeros distintos
// sin explicacion. No deberia pasar nunca: el backend lo verifica con un test.
if (total !== pj) {
h += '<p class="anadesg-nota">Heads up: the score above says ' + pj + ' and this math gives ' + total + '. ' +
'This is our mistake, not a problem with your data.</p>';
}
h += '<p class="anadesg-nota">This measures how the portfolio is <b>built</b> (concentration, ' +
'allocation, cash cushion), not how much it returned. It is not a buy or sell recommendation.</p>';
return h;
}

function renderAnalisis(r) {
var body = document.getElementById('anaBody');
if (!r || !r.ok) {
anaCargado = false; // la proxima visita reintenta (mismo criterio que dividendos)
body.innerHTML = '<p class="newsempty">' + esc(msgBackend(r)) + '</p>';
return;
}
var c = r.concentracion || {}, rie = r.riesgo || {};
var html = '';

// Puntaje: como esta ARMADA la cartera, no cuanto rindio. Se puede TOCAR para
// ver de donde sale (pedido de Guzman, 22/08/2026): arranca en 100 y cada
// chequeo flojo descuenta. El descuento de cada uno lo manda el backend
// (`resta`), NO se recalcula aca — dos copias de la misma regla terminan
// divergiendo, que es la leccion de los tickers de las hojas ocultas.
html += '<div class="anascore" id="anaScore" role="button" tabindex="0" title="Tap to see how it\u2019s calculated">' +
'<b>' + esc(r.nivel || '') + '</b><span>' + (Number(r.puntaje) || 0) + '/100</span>' +
'<span class="anascore-chev" id="anaScoreChev">&rsaquo;</span></div>';
html += '<div class="anabarra" id="anaBarra"><i style="width:' + Math.max(2, Math.min(100, Number(r.puntaje) || 0)) + '%"></i></div>';
html += '<div class="anadesglose" id="anaDesglose" style="display:none">' + anaDesgloseHtml(r) + '</div>';

// Numeros duros. "Posiciones efectivas" = 1/HHI: con que se sienten 12
// posiciones si una pesa el 60% (respuesta: con 2).
html += '<div class="anagrid">' +
'<div class="anacelda"><span>Positions</span><b>' + (c.posiciones || 0) + '</b><em>equivalent to ' + (c.efectivas || 0).toFixed(1) + ' pairs</em></div>' +
'<div class="anacelda"><span>Top 5</span><b>' + esc(anaPct(c.top5, 1)) + '</b><em>of what\u2019s invested</em></div>' +
'<div class="anacelda"><span>Volatility</span><b>' + esc(anaPct(rie.volAnual, 1)) + '</b><em>' + (rie.volAnual === null ? 'not enough history' : 'annualized') + '</em></div>' +
'<div class="anacelda"><span>Worst drawdown</span><b>' + esc(anaPct(rie.drawdown, 1)) + '</b><em>' + (rie.drawdown === null ? '—' : 'from its highest point') + '</em></div>' +
'</div>';

// El reparto por tipo, por plataforma y por posicion NO se dibuja aca
// (17/08/2026, pedido de Guzman): ya esta en Inicio y en la torta de arriba de
// esta misma vista. Los datos igual llegan en la respuesta y los usan los
// chequeos.

// Chequeos: el corazon de la pantalla. Cada uno dice como esta ese aspecto y
// por que, en criollo.
html += '<p class="anasub">Checks</p>';
(r.chequeos || []).forEach(function (q) {
html += '<div class="anachk ' + esc(q.estado) + '"><i class="luz"></i><div><b>' + esc(q.titulo) + '</b><em>' + esc(q.detalle) + '</em></div></div>';
});

if (rie.drawdown && rie.drawdownDesde) {
html += '<p class="newsempty" style="margin-top:10px">The worst drawdown was between ' + esc(anaFecha(rie.drawdownDesde)) + ' and ' + esc(anaFecha(rie.drawdownHasta)) + '.</p>';
}
html += '<p class="newsempty" style="margin-top:6px">This is a description of how your portfolio is built, not a buy or sell recommendation.</p>';

body.innerHTML = html;

// El puntaje se toca para ver de donde sale. Se engancha DESPUES de escribir
// el html: los nodos no existen antes.
var score = document.getElementById('anaScore');
var desg = document.getElementById('anaDesglose');
var chev = document.getElementById('anaScoreChev');
if (score && desg) {
var pintarDesglose = function (abierto) {
anaDesgAbierto = abierto;
desg.style.display = abierto ? '' : 'none';
if (chev) chev.className = 'anascore-chev' + (abierto ? ' abierto' : '');
score.title = abierto ? 'Tap to hide the calculation' : 'Tap to see how it\u2019s calculated';
};
var abrir = function () { pintarDesglose(desg.style.display === 'none'); };
// El html nuevo nace cerrado: si estaba abierto, se reabre.
if (anaDesgAbierto) pintarDesglose(true);
score.onclick = abrir;
// Con teclado tambien: el div hace de boton (role="button"), asi que tiene
// que responder a Enter y espacio como uno.
score.onkeydown = function (e) {
if (e && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrir(); }
};
var barra = document.getElementById('anaBarra');
if (barra) { barra.style.cursor = 'pointer'; barra.onclick = abrir; }
}
}

document.getElementById('anaRefreshBtn').onclick = function () { cargarAnalisis(true); };
