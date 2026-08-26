// IA Insights
// ---------- IA Insights ----------
var iaConfigurada = null, iaCargando = false;
function cargarEstadoIA() {
google.script.run.withSuccessHandler(function (st) {
iaConfigurada = !!(st && st.configurada);
var t = document.getElementById('iaEstadoTxt');
if (t) t.innerHTML = iaConfigurada
? '&#10003; Key configured. Analyses are generated with Claude (claude-opus-5) and saved for 6 hours.'
: 'Not configured. Create an API key at <b>console.anthropic.com</b> and paste it here. It\u2019s saved on your private Cloudflare server, never on this page.';
var aviso = document.getElementById('iaKeyAviso');
if (aviso) aviso.style.display = iaConfigurada ? 'none' : '';
}).withFailureHandler(function () {}).estadoIA();
}
document.getElementById('iaKeyGuardar').onclick = function () {
var inp = document.getElementById('iaKey');
// guardarConBoton vive en brokers.js (el conductor unico de credenciales).
guardarConBoton({
btn: this, inputs: [inp], resId: 'iaKeyResultado',
sujeto: 'The AI key', exito: 'Key saved.',
alOk: cargarEstadoIA,
pedir: function (ok, fail) {
google.script.run.withSuccessHandler(ok).withFailureHandler(fail).guardarClaveIA({ apiKey: inp.value });
}
});
};
document.getElementById('iaIrConfig').onclick = function () { setView('config'); };
document.getElementById('iaBack').onclick = function () { setView('inicio'); };
function prepararIA() {
if (iaConfigurada === null) cargarEstadoIA();
else document.getElementById('iaKeyAviso').style.display = iaConfigurada ? 'none' : '';
var el = document.getElementById('iaList');
el.innerHTML = '';
var lista = ((lastData && lastData.posiciones) || []).filter(function (p) { return p.symbol !== 'USDT'; });
if (!lista.length) { el.innerHTML = '<p class="newsempty">No positions loaded yet.</p>'; return; }
lista.forEach(function (p) {
var row = document.createElement('div');
row.className = 'row clickable';
row.innerHTML = '<span><span class="sym">' + esc(p.symbol) + '</span><span class="desc">' + esc(p.nombre || '') + '</span></span><span class="chev">&rsaquo;</span>';
row.onclick = function () { analizarIA(p.symbol, false); };
el.appendChild(row);
});
}
function analizarIA(symbol, forzar) {
if (iaCargando) return;
iaCargando = true;
var out = document.getElementById('iaResultado');
out.innerHTML = '<div class="card"><h2>' + esc(symbol) + '</h2><p class="loadingtxt">Claude is analyzing ' + esc(symbol) + '... this can take up to a minute.</p></div>';
out.scrollIntoView({ behavior: 'smooth', block: 'start' });
google.script.run.withSuccessHandler(function (r) {
iaCargando = false;
if (!r || !r.ok) {
if (r && r.sinClave) { iaConfigurada = false; out.innerHTML = ''; document.getElementById('iaKeyAviso').style.display = ''; window.scrollTo(0, 0); return; }
out.innerHTML = '<div class="card"><h2>' + esc(symbol) + '</h2><p class="newsempty">' + esc(((r && r.mensajes) || ['Error']).join(' ')) + '</p></div>';
return;
}
out.innerHTML = fichaIAHtml(r);
var btn = document.getElementById('iaRegen');
if (btn) btn.onclick = function () { analizarIA(symbol, true); };
}).withFailureHandler(function (err) {
iaCargando = false;
out.innerHTML = '<div class="card"><h2>' + esc(symbol) + '</h2><p class="newsempty">Error: ' + esc(err.message) + '</p></div>';
}).analizarConIA({ symbol: symbol, forzar: !!forzar });
}
// La ficha sigue el ORDEN DEL MARCO que arma el backend (26/08/2026):
// clasificar -> medir -> calidad -> fortalezas/riesgos -> crecimiento ->
// que pide el precio -> encaje en la cartera -> que vigilar. Cada seccion se
// dibuja SOLO si su dato llego: una ficha vieja del cache (esquema v1) pinta
// lo que tiene en vez de mostrar titulos vacios.
// Los titulos son de la app y van en INGLES; el texto de adentro lo escribe el
// modelo en espanol, que es como Guzman lee analisis.
function iaLista(items) {
return '<ul class="ia-ul">' + items.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>';
}
function fichaIAHtml(r) {
var a = r.analisis || {};
var h = '<div class="card"><h2>' + esc(r.symbol) + ' &middot; AI profile</h2>';
h += '<p class="ia-meta">Generated ' + esc(r.generado || '') + ' &middot; ' + esc(r.modelo || '') + '</p>';
// Paso 1: que es y con que lente se lo mide. Va arriba de todo porque es lo
// que evita el error clasico (mirarle el PER a un REIT).
var cl = a.clasificacion;
if (cl && (cl.queEs || cl.lente)) {
h += '<div class="ia-clase">' +
(cl.queEs ? '<b>' + esc(cl.queEs) + '</b>' : '') +
(cl.lente ? '<em>' + esc(cl.lente) + '</em>' : '') + '</div>';
}
if (a.resumen) h += '<p class="ia-p">' + esc(a.resumen) + '</p>';
if (a.indicadores && a.indicadores.length) {
h += '<div style="overflow-x:auto"><table class="holdtable"><thead><tr><th>Indicator</th><th>Value</th><th>Reading</th></tr></thead><tbody>';
a.indicadores.forEach(function (i) {
h += '<tr><td>' + esc(i.nombre) + '</td><td><b>' + esc(i.valor) + '</b></td><td class="ia-coment">' + esc(i.comentario) + '</td></tr>';
});
h += '</tbody></table></div>';
}
if (a.calidad) h += '<h3 class="ia-h">Quality: does it create value?</h3><p class="ia-p">' + esc(a.calidad) + '</p>';
if (a.fortalezas && a.fortalezas.length) h += '<h3 class="ia-h pos">Strengths</h3>' + iaLista(a.fortalezas);
if (a.riesgos && a.riesgos.length) h += '<h3 class="ia-h neg">Risks</h3>' + iaLista(a.riesgos);
// `proyeccion` es el nombre viejo del campo (esquema v1): se sigue leyendo
// para que una ficha cacheada no pierda su seccion.
var crec = a.crecimiento || a.proyeccion;
if (crec) h += '<h3 class="ia-h">Growth outlook</h3><p class="ia-p">' + esc(crec) + '</p>';
// El bloque mas util: que esta descontado en el precio de hoy.
if (a.expectativas) {
h += '<h3 class="ia-h">What today’s price is asking for</h3>' +
'<div class="ia-destacado"><p class="ia-p">' + esc(a.expectativas) + '</p></div>';
}
if (a.enCartera) h += '<h3 class="ia-h">In your portfolio</h3><p class="ia-p">' + esc(a.enCartera) + '</p>';
if (a.queMirar && a.queMirar.length) h += '<h3 class="ia-h">What to watch</h3>' + iaLista(a.queMirar);
h += '<p class="ia-nota">' + esc((a.nota ? a.nota + ' ' : '')) + 'Informational content generated by AI: not a buy or sell recommendation, nor financial advice.</p>';
h += '<button class="ghostbtn" id="iaRegen">Refresh analysis</button></div>';
return h;
}

