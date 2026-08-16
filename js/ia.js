// IA Insights
// ---------- IA Insights ----------
var iaConfigurada = null, iaCargando = false;
function cargarEstadoIA() {
google.script.run.withSuccessHandler(function (st) {
iaConfigurada = !!(st && st.configurada);
var t = document.getElementById('iaEstadoTxt');
if (t) t.innerHTML = iaConfigurada
? '&#10003; Clave configurada. Los an&aacute;lisis se generan con Claude (claude-opus-5) y se guardan 6 horas.'
: 'Sin configurar. Cre&aacute; una clave de API en <b>console.anthropic.com</b> y pegala ac&aacute;. Se guarda en tu Apps Script privado, nunca en esta p&aacute;gina.';
var aviso = document.getElementById('iaKeyAviso');
if (aviso) aviso.style.display = iaConfigurada ? 'none' : '';
}).withFailureHandler(function () {}).estadoIA();
}
document.getElementById('iaKeyGuardar').onclick = function () {
var btn = this, inp = document.getElementById('iaKey'), res = document.getElementById('iaKeyResultado');
btn.disabled = true;
google.script.run.withSuccessHandler(function (r) {
btn.disabled = false;
if (r && r.ok) { inp.value = ''; res.innerHTML = '<div class="tmsg ok">&#10003; Clave guardada.</div>'; cargarEstadoIA(); }
else { res.innerHTML = '<div class="tmsg err">' + esc(((r && r.mensajes) || ['Error']).join(' ')) + '</div>'; }
}).withFailureHandler(function (err) {
btn.disabled = false;
res.innerHTML = '<div class="tmsg err">Error: ' + esc(err.message) + '</div>';
}).guardarClaveIA({ apiKey: inp.value });
};
document.getElementById('iaIrConfig').onclick = function () { setView('config'); };
document.getElementById('iaBack').onclick = function () { setView('inicio'); };
function prepararIA() {
if (iaConfigurada === null) cargarEstadoIA();
else document.getElementById('iaKeyAviso').style.display = iaConfigurada ? 'none' : '';
var el = document.getElementById('iaList');
el.innerHTML = '';
var lista = ((lastData && lastData.posiciones) || []).filter(function (p) { return p.symbol !== 'USDT'; });
if (!lista.length) { el.innerHTML = '<p class="newsempty">Todav&iacute;a no hay posiciones cargadas.</p>'; return; }
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
out.innerHTML = '<div class="card"><h2>' + esc(symbol) + '</h2><p class="loadingtxt">Claude est&aacute; analizando ' + esc(symbol) + '... puede tardar hasta un minuto.</p></div>';
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
function fichaIAHtml(r) {
var a = r.analisis || {};
var h = '<div class="card"><h2>' + esc(r.symbol) + ' &middot; ficha IA</h2>';
h += '<p class="ia-meta">Generado ' + esc(r.generado || '') + ' hs &middot; ' + esc(r.modelo || '') + '</p>';
if (a.resumen) h += '<p class="ia-p">' + esc(a.resumen) + '</p>';
if (a.indicadores && a.indicadores.length) {
h += '<div style="overflow-x:auto"><table class="holdtable"><thead><tr><th>Indicador</th><th>Valor</th><th>Lectura</th></tr></thead><tbody>';
a.indicadores.forEach(function (i) {
h += '<tr><td>' + esc(i.nombre) + '</td><td><b>' + esc(i.valor) + '</b></td><td class="ia-coment">' + esc(i.comentario) + '</td></tr>';
});
h += '</tbody></table></div>';
}
if (a.fortalezas && a.fortalezas.length) h += '<h3 class="ia-h pos">Fortalezas</h3><ul class="ia-ul">' + a.fortalezas.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>';
if (a.riesgos && a.riesgos.length) h += '<h3 class="ia-h neg">Riesgos</h3><ul class="ia-ul">' + a.riesgos.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>';
if (a.proyeccion) h += '<h3 class="ia-h">Proyecci&oacute;n de crecimiento</h3><p class="ia-p">' + esc(a.proyeccion) + '</p>';
h += '<p class="ia-nota">' + esc((a.nota ? a.nota + ' ' : '')) + 'Contenido informativo generado por IA: no es una recomendaci&oacute;n de compra o venta ni asesoramiento financiero.</p>';
h += '<button class="ghostbtn" id="iaRegen">Actualizar an&aacute;lisis</button></div>';
return h;
}

