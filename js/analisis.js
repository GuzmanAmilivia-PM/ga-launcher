// Analisis de la cartera POR PERFIL (26/08/2026): tarjeta resumen + pagina Analysis
// ---------- Analisis de la cartera ----------
// El backend (fn 'analisis') hace las cuentas y manda todo resuelto, incluidos
// los textos de cada chequeo y el PERFIL contra el que se midio: aca solo se
// pinta. Dos pantallas comparten la MISMA respuesta: la tarjeta resumen de
// Portfolio (renderAnalisis, que se toca para abrir el detalle) y la pagina
// Analysis (renderAnalisisDetalle), donde ademas viven el perfil de inversor
// y su test de 6 preguntas. Cache local igual que dividendos y aportes — se
// ve al instante lo ultimo y se refresca por atras.
var anaCargado = false;
// La ultima respuesta pintada: la pagina Analysis la reusa al entrar sin
// volver a pedir nada (misma leccion que lastAccData en el detalle de cuenta).
var anaUltima = null;

function cargarAnalisis(forzar) {
anaCargado = true;
cargarConCache({
clave: 'ga_cache_ana',
avisoId: 'anaCacheAviso',
bodyId: 'anaBody',
cargando: 'Analyzing your portfolio...',
forzar: !!forzar,
render: function (r) {
// Se pintan LAS DOS pantallas con cada respuesta (la de detalle aunque este
// fuera de pantalla, mismo criterio que los paneles del deck): asi entrar a
// Analysis nunca muestra datos de otra corrida que la tarjeta.
anaUltima = r;
renderAnalisis(r);
renderAnalisisDetalle(r);
},
alFallar: function () { anaCargado = false; },
pedir: function (ok, fail) {
google.script.run.withSuccessHandler(ok).withFailureHandler(fail).getAnalisis({ forzar: !!forzar });
}
});
}

// La pagina Analysis al entrar: si ya hay datos, se pintan al instante; si
// no (se entro directo, sin pasar por Portfolio), dispara la carga normal.
function cargarAnalisisDetalle(forzar) {
if (forzar || !anaCargado) { cargarAnalisis(!!forzar); return; }
if (anaUltima) renderAnalisisDetalle(anaUltima);
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
'Tap this card’s refresh button.</p>';
}
var h = "<p class=\"anadesg-tit\">How we get to " + pj + "</p>";
h += '<div class="anadesg-fila base"><span>Starting point</span><b>' + base + '</b></div>';
h += '<p class="anadesg-nota">Every portfolio starts at ' + base + '. Each check that doesn’t come out well against your profile subtracts: ' +
'<b>&minus;20</b> if it’s a risk, <b>&minus;10</b> if it deserves attention, <b>0</b> if it’s fine.</p>';
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
h += '<p class="anadesg-nota">This measures how the portfolio is <b>built</b> against your investor profile, ' +
'not how much it returned. It is not a buy or sell recommendation.</p>';
return h;
}

// El encabezado compartido: nivel + puntaje + barra. La tarjeta y el detalle
// lo pintan igual para que nunca muestren dos numeros distintos.
function anaScoreHtml(r) {
return '<div class="anascore"><b>' + esc(r.nivel || '') + '</b><span>' + (Number(r.puntaje) || 0) + '/100</span></div>' +
'<div class="anabarra"><i style="width:' + Math.max(2, Math.min(100, Number(r.puntaje) || 0)) + '%"></i></div>';
}

// Numeros duros compartidos. "Positions" con sus efectivas (1/HHI): con que
// se sienten 12 posiciones si una pesa el 60% (respuesta: con 2).
function anaGridHtml(r) {
var c = r.concentracion || {}, rie = r.riesgo || {};
return '<div class="anagrid">' +
'<div class="anacelda"><span>Positions</span><b>' + (c.posiciones || 0) + '</b><em>equivalent to ' + (c.efectivas || 0).toFixed(1) + ' pairs</em></div>' +
'<div class="anacelda"><span>Top 5</span><b>' + esc(anaPct(c.top5, 1)) + '</b><em>of what’s invested</em></div>' +
'<div class="anacelda"><span>Volatility</span><b>' + esc(anaPct(rie.volAnual, 1)) + '</b><em>' + (rie.volAnual === null ? 'not enough history' : 'annualized') + '</em></div>' +
'<div class="anacelda"><span>Worst drawdown</span><b>' + esc(anaPct(rie.drawdown, 1)) + '</b><em>' + (rie.drawdown === null ? '—' : 'from its highest point') + '</em></div>' +
'</div>';
}

// La linea del perfil (tarjeta y detalle): contra que se esta midiendo, o la
// invitacion a elegirlo si todavia corre con el de defecto.
function anaPerfilLinea(r) {
var p = r.perfil;
if (!p) return '';
return '<p class="anaperfil">' + (p.porDefecto
? 'No investor profile set yet — measured as <b>Moderate</b>. Open the full analysis to take the 2-minute test.'
: 'Measured against your <b>' + esc(p.label || p.valor) + '</b> profile.') + '</p>';
}

// ---- La tarjeta RESUMEN (vista Portfolio) ----------------------------------
// Desde el 26/08/2026 los chequeos completos, el desglose del puntaje y el
// reparto viven en la pagina Analysis: aca queda el titular (puntaje, perfil,
// numeros duros y cuantos chequeos flojos hay) y todo el bloque se toca para
// abrir el detalle.
function renderAnalisis(r) {
var body = document.getElementById('anaBody');
if (!r || !r.ok) {
anaCargado = false; // la proxima visita reintenta (mismo criterio que dividendos)
body.innerHTML = '<p class="newsempty">' + esc(msgBackend(r)) + '</p>';
return;
}
var html = '';
html += anaScoreHtml(r);
html += anaPerfilLinea(r);
html += anaGridHtml(r);

// El semaforo, resumido: cuantos chequeos quedaron en cada estado. El texto
// de cada uno esta en el detalle.
var rs = 0, at = 0, oks = 0;
(r.chequeos || []).forEach(function (q) {
if (q.estado === 'riesgo') rs++; else if (q.estado === 'atencion') at++; else oks++;
});
var partes = [];
if (rs) partes.push(rs + ' risk' + (rs > 1 ? 's' : ''));
if (at) partes.push(at + ' to watch');
partes.push(oks + ' ok');
html += '<p class="newsempty" style="margin-top:6px">' + (rs + at + oks) + ' checks against your profile: ' +
esc(partes.join(', ')) + '. Tap for the full analysis.</p>';

body.innerHTML = html;

// Toda la tarjeta lleva al detalle (los nodos recien existen ahora). El
// titulo de la tarjeta ya esta cableado aparte, una sola vez, alla abajo.
body.style.cursor = 'pointer';
body.onclick = function () { setView('analisis'); };
}

// ---- La pagina Analysis (el detalle) ---------------------------------------
function renderAnalisisDetalle(r) {
var body = document.getElementById('anxBody');
if (!body) return;
renderPerfilCard(r);
if (!r || !r.ok) {
body.innerHTML = '<p class="newsempty">' + esc(msgBackend(r)) + '</p>';
return;
}
var html = '';
html += anaScoreHtml(r);
html += anaPerfilLinea(r);
// El desglose del puntaje, SIEMPRE abierto: esta pagina existe para el detalle.
html += '<div class="anadesglose">' + anaDesgloseHtml(r) + '</div>';
html += anaGridHtml(r);

// Que tenes, en clases finas (ETF amplio vs sectorial vs accion vs REIT...):
// la mirada que la torta "Class" no da.
if (r.clases && r.clases.length) {
html += '<p class="anasub">What you hold</p>';
r.clases.forEach(function (c) { html += anxBarraHtml(c.label, c.pct); });
if (r.nucleo) {
html += '<p class="anadesg-nota" style="margin-bottom:12px">Core (broad index + dividend ETFs): ' +
esc(anaPct(r.nucleo.pct, 1)) + ' of what’s invested. Individual bets (stocks, REITs, sector ETFs, crypto): ' +
esc(anaPct(r.nucleo.satelites, 1)) + '.</p>';
}
}

// Sectores mirando ADENTRO de cada ETF (look-through): el 22% en VOO reparte
// su peso entre los sectores del indice, no cuenta como una sola cosa.
if (r.sectores && r.sectores.lista && r.sectores.lista.length) {
html += '<p class="anasub">Sectors, looking inside each ETF</p>';
r.sectores.lista.forEach(function (s) { html += anxBarraHtml(s.sector, s.pct); });
if (typeof r.sectores.cobertura === 'number' && r.sectores.cobertura < 0.95) {
html += '<p class="anadesg-nota" style="margin-bottom:12px">Measured over the ' +
esc(anaPct(r.sectores.cobertura, 1)) + ' of your equity that could be classified.</p>';
}
}

// Chequeos: el corazon de la pagina. Cada uno dice como esta ese aspecto
// CONTRA TU PERFIL y por que, con el texto resuelto en el backend.
html += '<p class="anasub">Checks</p>';
(r.chequeos || []).forEach(function (q) {
html += '<div class="anachk ' + esc(q.estado) + '"><i class="luz"></i><div><b>' + esc(q.titulo) + '</b><em>' + esc(q.detalle) + '</em></div></div>';
});

var rie = r.riesgo || {};
if (rie.drawdown && rie.drawdownDesde) {
html += '<p class="newsempty" style="margin-top:10px">The worst drawdown was between ' + esc(anaFecha(rie.drawdownDesde)) + ' and ' + esc(anaFecha(rie.drawdownHasta)) + '.</p>';
}
html += '<p class="newsempty" style="margin-top:6px">This describes how your portfolio is built against the profile you chose. It is not a buy or sell recommendation.</p>';

body.innerHTML = html;
}

// Una fila con barra proporcional (clases y sectores del detalle).
function anxBarraHtml(label, pct) {
var w = Math.max(1, Math.min(100, Math.round((Number(pct) || 0) * 100)));
return '<div class="anxfila"><span>' + esc(label) + '</span><b>' + esc(anaPct(pct, 1)) + '</b>' +
'<span class="pista"><i style="width:' + w + '%"></i></span></div>';
}

// ---- El perfil de inversor y su test ---------------------------------------
// El test mide lo que el marco profesional (CFA) pide medir: la CAPACIDAD de
// asumir riesgo (horizonte, dependencia de esta plata, colchon: preguntas
// 1-3) y la DISPOSICION (reaccion a una caida, tolerancia, objetivo: 4-6).
// La capacidad le pone el TECHO a la disposicion: sentirse agresivo no
// alcanza si la plata se puede necesitar pronto.
var ANX_PREGUNTAS = [
{ p: '1. When do you expect to need most of this money?',
o: ['Within 3 years', 'In 3 to 10 years', 'In more than 10 years'] },
{ p: '2. How much of your total savings is this portfolio?',
o: ['Almost all of it', 'About half', 'A small part'] },
{ p: '3. If your income stopped, how long could you cover expenses without selling investments?',
o: ['Less than 6 months', '6 to 24 months', 'More than 24 months'] },
{ p: '4. Your portfolio drops 25% in a few months. What do you do?',
o: ['Sell to avoid further losses', 'Hold and wait it out', 'Buy more while it’s down'] },
{ p: '5. Which yearly outcome would you rather live with?',
o: ['+6% best year, −5% worst', '+15% best year, −15% worst', '+30% best year, −35% worst'] },
{ p: '6. What is the main goal of this portfolio?',
o: ['Preserve what I have', 'Grow steadily over the years', 'Maximize long-term growth'] }
];
var ANX_PERFILES = ['conservative', 'moderate', 'aggressive'];
var ANX_LABEL = { conservative: 'Conservative', moderate: 'Moderate', aggressive: 'Aggressive' };
var anxTestAbierto = false;
var anxRespuestas = [0, 0, 0, 0, 0, 0]; // 1-3 por pregunta; 0 = sin contestar
var anxGuardando = false;

// La sugerencia: capacidad = la MENOR de 1-3 (la restriccion mas dura manda),
// disposicion = el promedio de 4-6, y el perfil es el menor de los dos.
function anaPerfilSugerido(resp) {
var cap = Math.min(resp[0], resp[1], resp[2]);
var disp = Math.round((resp[3] + resp[4] + resp[5]) / 3);
return ANX_PERFILES[Math.min(cap, disp) - 1];
}

function renderPerfilCard(r) {
var cont = document.getElementById('anxPerfilBody');
if (!cont) return;
if (anxGuardando) { cont.innerHTML = '<p class="loadingtxt">Saving your profile...</p>'; return; }
if (anxTestAbierto) { renderPerfilTest(cont); return; }

var p = (r && r.perfil) || null;
var actual = p && !p.porDefecto ? p.valor : null;
var html = '';
if (actual) {
html += '<p class="anaperfil">Your profile: <b>' + esc(ANX_LABEL[actual] || actual) + '</b>' +
(p.origen === 'test' ? ' (from your test)' : ' (picked by hand)') +
'. The analysis below uses its thresholds.</p>';
} else {
html += '<p class="anaperfil">You haven’t set a profile yet: the analysis runs as <b>Moderate</b>. ' +
'Take the 2-minute test — 6 questions — or pick one directly.</p>';
}
html += '<div class="tipobar">';
ANX_PERFILES.forEach(function (pf) {
html += '<button type="button" class="tipobtn' + (pf === actual ? ' active-acento' : '') +
'" data-perfil="' + pf + '">' + ANX_LABEL[pf] + '</button>';
});
html += '</div>';
html += '<div class="anxacciones"><button type="button" class="tipobtn" id="anxTestBtn">' +
(actual ? 'Retake the test' : 'Take the test') + '</button></div>';
cont.innerHTML = html;

// Cableado DESPUES de escribir el html (los nodos no existen antes), desde
// JS: la politica de contenido no permite onclick inline.
var botones = cont.querySelectorAll('button[data-perfil]');
for (var i = 0; i < botones.length; i++) {
(function (b) {
b.onclick = function () { guardarPerfilElegido(b.getAttribute('data-perfil'), 'manual', null, null); };
})(botones[i]);
}
var t = document.getElementById('anxTestBtn');
if (t) t.onclick = function () {
anxTestAbierto = true;
anxRespuestas = [0, 0, 0, 0, 0, 0];
renderPerfilCard(anaUltima);
};
}

function renderPerfilTest(cont) {
var html = '<p class="anaperfil">Answer with what you would really do, not what sounds best. ' +
'Questions 1–3 measure how much risk you can afford; 4–6, how much you can stomach.</p>';
ANX_PREGUNTAS.forEach(function (q, qi) {
html += '<div class="anxq"><p>' + esc(q.p) + '</p><div class="anxopts">';
q.o.forEach(function (op, oi) {
var elegido = anxRespuestas[qi] === (oi + 1);
html += '<button type="button" class="tipobtn' + (elegido ? ' active-acento' : '') +
'" data-q="' + qi + '" data-v="' + (oi + 1) + '">' + esc(op) + '</button>';
});
html += '</div></div>';
});
var completas = anxRespuestas.every(function (v) { return v > 0; });
if (completas) {
var sug = anaPerfilSugerido(anxRespuestas);
html += '<p class="anaperfil" style="margin-top:14px">Suggested for your answers: <b>' + ANX_LABEL[sug] + '</b>. ' +
'Save it, or override it if you disagree — it’s your call.</p>';
html += '<div class="tipobar">';
ANX_PERFILES.forEach(function (pf) {
html += '<button type="button" class="tipobtn' + (pf === sug ? ' active-acento' : '') +
'" data-guardar="' + pf + '">' + ANX_LABEL[pf] + (pf === sug ? ' ✓' : '') + '</button>';
});
html += '</div>';
}
html += '<div class="anxacciones"><button type="button" class="tipobtn" id="anxCancelBtn">Cancel</button></div>';
cont.innerHTML = html;

var opciones = cont.querySelectorAll('button[data-q]');
for (var i = 0; i < opciones.length; i++) {
(function (b) {
b.onclick = function () {
anxRespuestas[Number(b.getAttribute('data-q'))] = Number(b.getAttribute('data-v'));
renderPerfilCard(anaUltima); // repinta: marca la opcion y, completo, sugiere
};
})(opciones[i]);
}
var guardar = cont.querySelectorAll('button[data-guardar]');
for (var j = 0; j < guardar.length; j++) {
(function (b) {
b.onclick = function () {
guardarPerfilElegido(b.getAttribute('data-guardar'), 'test',
anaPerfilSugerido(anxRespuestas), anxRespuestas.slice());
};
})(guardar[j]);
}
var c = document.getElementById('anxCancelBtn');
if (c) c.onclick = function () { anxTestAbierto = false; renderPerfilCard(anaUltima); };
}

function guardarPerfilElegido(perfil, origen, sugerido, respuestas) {
if (anxGuardando) return;
anxGuardando = true;
anxTestAbierto = false;
renderPerfilCard(anaUltima);
google.script.run.withSuccessHandler(function (out) {
anxGuardando = false;
if (!out || out.ok === false) {
var cont = document.getElementById('anxPerfilBody');
if (cont) cont.innerHTML = '<p class="newsempty">' + esc(msgBackend(out)) + '</p>' +
'<div class="anxacciones"><button type="button" class="tipobtn" id="anxReintBtn">Try again</button></div>';
var rb = document.getElementById('anxReintBtn');
if (rb) rb.onclick = function () { renderPerfilCard(anaUltima); };
return;
}
// Guardado: el backend ya invalido su cache — se recalcula todo con los
// umbrales del perfil nuevo (forzar saltea el cache local y el de KV).
cargarAnalisis(true);
}).withFailureHandler(function (err) {
anxGuardando = false;
var cont = document.getElementById('anxPerfilBody');
if (cont) cont.innerHTML = '<p class="newsempty">' + esc(msgErr(err, 'The profile')) + '</p>' +
'<div class="anxacciones"><button type="button" class="tipobtn" id="anxReintBtn">Try again</button></div>';
var rb = document.getElementById('anxReintBtn');
if (rb) rb.onclick = function () { renderPerfilCard(anaUltima); };
}).guardarPerfil({ perfil: perfil, origen: origen, sugerido: sugerido || null, respuestas: respuestas || null });
}

// ---- Cableado de una sola vez ----------------------------------------------
document.getElementById('anaRefreshBtn').onclick = function () { cargarAnalisis(true); };
(function () {
var b = document.getElementById('anxRefreshBtn');
if (b) b.onclick = function () { cargarAnalisis(true); };
var back = document.getElementById('anxBack');
if (back) back.onclick = function () { setView('portafolio'); };
// El titulo de la tarjeta resumen abre el detalle: h2 con role="button"
// (la politica de contenido no permite onclick inline), click y teclado,
// mismo patron que el titulo Positions del Inicio.
var t = document.getElementById('anaTitulo');
if (!t) return;
function abrir() { setView('analisis'); }
t.addEventListener('click', abrir);
t.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } });
})();
